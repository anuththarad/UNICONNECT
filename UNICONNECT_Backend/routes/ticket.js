/**
 * routes/ticket.js
 * Ticket booking router for UniConnect.
 * Mounted at /api/tickets in app.js
 */

"use strict";

const express  = require("express");
const router   = express.Router();
const sql      = require("mssql");
const pool     = require("../db");                           // raw ConnectionPool
const { sendMail } = require("../utils/mailer");            // central mailer
const { createTicketAssets } = require("../utils/ticketGenerator");

// ── Helper: wait for pool to be ready ────────────────────────────────────────
// db.js connects on startup. If the pool isn't connected yet we wait briefly.
async function getPool() {
  if (pool.connected) return pool;
  if (pool.connecting) {
    // Wait up to 5 s for the connection attempt that's already in progress
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("DB connection timeout")), 5000);
      pool.once("connect", () => { clearTimeout(t); resolve(); });
      pool.once("error",   (e) => { clearTimeout(t); reject(e); });
    });
    return pool;
  }
  // Pool is idle/not started — connect now
  await pool.connect();
  return pool;
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/tickets/event/:event_id
// Returns ticket price and remaining seats for an event.
// ────────────────────────────────────────────────────────────────────────────
router.get("/event/:event_id", async (req, res) => {
  try {
    const db = await getPool();
    const eventId = Number(req.params.event_id);

    const evRes = await db.request()
      .input("eid", sql.Int, eventId)
      .query(`
        SELECT event_id, title, capacity,
               allow_ticket_booking, allow_payments, organizer_id
        FROM dbo.Event WHERE event_id = @eid
      `);

    if (!evRes.recordset[0])
      return res.status(404).json({ success: false, message: "Event not found" });

    const ev       = evRes.recordset[0];
    const capacity = Number(ev.capacity || 0);

    // Price from the template seat row (booking_status = 'available')
    const priceRes = await db.request()
      .input("eid", sql.Int, eventId)
      .query(`
        SELECT TOP 1 ticket_price, ticket_type
        FROM dbo.Tickets
        WHERE event_id = @eid AND booking_status = 'available'
        ORDER BY ticket_id DESC
      `);
    const priceRow    = priceRes.recordset[0];
    const ticketPrice = priceRow ? Number(priceRow.ticket_price || 0) : 0;

    // Seats already booked
    const takenRes = await db.request()
      .input("eid", sql.Int, eventId)
      .query(`
        SELECT ISNULL(SUM(quantity),0) AS taken
        FROM dbo.Tickets
        WHERE event_id = @eid
          AND booking_status NOT IN ('cancelled','available')
      `);
    const taken     = Number(takenRes.recordset[0].taken || 0);
    const remaining = capacity > 0 ? Math.max(0, capacity - taken) : null;

    return res.status(200).json({
      success: true,
      data: {
        ticket: {
          ticket_price:      ticketPrice,
          available_tickets: remaining,
          ticket_type:       priceRow?.ticket_type || "General"
        }
      }
    });

  } catch (err) {
    console.error("GET TICKET INFO ERROR:", err);
    return res.status(500).json({ success: false, message: "Could not fetch ticket information" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/tickets/verify?user_id=X&event_id=Y
// Verifies the user exists and belongs to the correct university.
// Used by the frontend user-lookup step.
// ────────────────────────────────────────────────────────────────────────────
router.get("/verify", async (req, res) => {
  try {
    const db                    = await getPool();
    const { user_id, event_id } = req.query;

    if (!user_id || !event_id)
      return res.status(400).json({ success: false, message: "user_id and event_id are required" });

    // Fetch user + university name
    const userRes = await db.request()
      .input("uid", sql.Int, Number(user_id))
      .query(`
        SELECT u.user_id, u.full_name, u.email,
               u.university_id, u.faculty_name, u.department_name,
               u.contact_number, u.role,
               un.university_name
        FROM dbo.Users u
        LEFT JOIN dbo.University un ON un.university_id = u.university_id
        WHERE u.user_id = @uid
      `);

    const user = userRes.recordset[0];
    if (!user)
      return res.status(404).json({ success: false, message: "User not found. Please check your User ID." });
    if (!user.email)
      return res.status(400).json({ success: false, message: "No email address linked to this account." });

    // Fetch event + organiser's university
    const evRes = await db.request()
      .input("eid", sql.Int, Number(event_id))
      .query(`
        SELECT e.event_id, e.title, e.allow_payments, e.allow_ticket_booking,
               u.university_id AS organizer_university_id
        FROM dbo.Event e
        JOIN dbo.Users u ON u.user_id = e.organizer_id
        WHERE e.event_id = @eid
      `);
    const ev = evRes.recordset[0];
    if (!ev)
      return res.status(404).json({ success: false, message: "Event not found." });

    // University match check
    const orgUni  = ev.organizer_university_id;
    const userUni = user.university_id;
    const mismatch =
      orgUni && userUni && Number(orgUni) !== Number(userUni);

    if (mismatch) {
      return res.status(403).json({
        success: false,
        blocked: true,
        message: "This event is restricted to students of the organising university. You are not eligible to book."
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user_id:          user.user_id,
        full_name:        user.full_name,
        email:            user.email,
        university_id:    user.university_id,
        university_name:  user.university_name  || null,
        faculty_name:     user.faculty_name     || null,
        department_name:  user.department_name  || null,
        contact_number:   user.contact_number   || null,
        role:             user.role             || null,
        university_match: !mismatch
      }
    });

  } catch (err) {
    console.error("VERIFY USER ERROR:", err);
    return res.status(500).json({ success: false, message: "Verification failed: " + err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/tickets/book
// Books a ticket. Uses a transaction to keep data consistent.
// ────────────────────────────────────────────────────────────────────────────
router.post("/book", async (req, res) => {
  const db = await getPool();
  const transaction = new sql.Transaction(db);  // db is the resolved pool

  try {
    const { event_id, user_id, ticket_type = "General", quantity = 1 } = req.body;

    if (!event_id || !user_id)
      return res.status(400).json({ success: false, message: "event_id and user_id are required" });

    const ticketQty = Number(quantity);
    if (!Number.isInteger(ticketQty) || ticketQty < 1)
      return res.status(400).json({ success: false, message: "quantity must be a positive integer" });

    await transaction.begin();
    const req1 = () => new sql.Request(transaction);  // shorthand

    // ── Fetch event ─────────────────────────────────────────────────────
    const evRes = await req1()
      .input("eid", sql.Int, Number(event_id))
      .query(`
        SELECT e.event_id, e.title, e.event_date, e.venue,
               e.organizer_id, e.allow_ticket_booking, e.allow_payments,
               e.image_url, e.description, e.capacity,
               u.university_id AS organizer_university_id
        FROM dbo.Event e
        JOIN dbo.Users u ON u.user_id = e.organizer_id
        WHERE e.event_id = @eid
      `);

    const event = evRes.recordset[0];
    if (!event) { await transaction.rollback(); return res.status(404).json({ success: false, message: "Event not found" }); }
    if (!isTruthy(event.allow_ticket_booking)) { await transaction.rollback(); return res.status(400).json({ success: false, message: "Ticket booking is closed for this event" }); }

    // ── Fetch user ──────────────────────────────────────────────────────
    const userRes = await req1()
      .input("uid", sql.Int, Number(user_id))
      .query(`
        SELECT u.user_id, u.full_name, u.email,
               u.university_id, u.faculty_name, u.department_name,
               un.university_name
        FROM dbo.Users u
        LEFT JOIN dbo.University un ON un.university_id = u.university_id
        WHERE u.user_id = @uid
      `);

    const user = userRes.recordset[0];
    if (!user)  { await transaction.rollback(); return res.status(404).json({ success: false, message: "User not found" }); }
    if (!user.email) { await transaction.rollback(); return res.status(400).json({ success: false, message: "No email found for this user" }); }

    // ── University match ─────────────────────────────────────────────────
    const orgUni  = event.organizer_university_id;
    const userUni = user.university_id;
    if (orgUni && userUni && Number(orgUni) !== Number(userUni)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, blocked: true, message: "University mismatch — booking blocked." });
    }

    // ── Seat availability ────────────────────────────────────────────────
    if (event.capacity && event.capacity > 0) {
      const takenRes = await req1()
        .input("eid", sql.Int, Number(event_id))
        .query(`
          SELECT ISNULL(SUM(quantity),0) AS taken
          FROM dbo.Tickets
          WHERE event_id = @eid AND booking_status NOT IN ('cancelled','available')
        `);
      const remaining = event.capacity - Number(takenRes.recordset[0].taken || 0);
      if (remaining < ticketQty) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: `Only ${remaining} ticket(s) remaining` });
      }
    }

    // ── Duplicate check ──────────────────────────────────────────────────
    const dupRes = await req1()
      .input("eid", sql.Int, Number(event_id))
      .input("uid", sql.Int, Number(user_id))
      .query(`
        SELECT TOP 1 ticket_id FROM dbo.Tickets
        WHERE event_id = @eid AND user_id = @uid
          AND booking_status NOT IN ('cancelled','available')
      `);
    if (dupRes.recordset.length > 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "You already have a booking for this event" });
    }

    // ── Price from template row ──────────────────────────────────────────
    const priceRes = await req1()
      .input("eid", sql.Int, Number(event_id))
      .query(`
        SELECT TOP 1 ticket_id AS template_id, ticket_price
        FROM dbo.Tickets
        WHERE event_id = @eid AND booking_status = 'available'
        ORDER BY ticket_id DESC
      `);
    const priceRow    = priceRes.recordset[0];
    const ticketPrice = priceRow ? Number(priceRow.ticket_price || 0) : 0;

    // ── Determine booking status ─────────────────────────────────────────
    // Free tickets (price = 0 or allow_payments = 0) → confirmed immediately
    // Paid tickets → pending_payment (confirmed after payment verification)
    const paymentRequired = isTruthy(event.allow_payments) && ticketPrice > 0;
    const bookingStatus   = paymentRequired ? "pending_payment" : "confirmed";
    const totalAmount     = ticketPrice * ticketQty;

    // ── Insert ticket ────────────────────────────────────────────────────
    const insertRes = await req1()
      .input("eid",    sql.Int,           Number(event_id))
      .input("uid",    sql.Int,           Number(user_id))
      .input("ttype",  sql.VarChar(100),  ticket_type)
      .input("qty",    sql.Int,           ticketQty)
      .input("price",  sql.Decimal(10,2), ticketPrice)
      .input("total",  sql.Decimal(10,2), totalAmount)
      .input("status", sql.VarChar(50),   bookingStatus)
      .query(`
        INSERT INTO dbo.Tickets
          (event_id, user_id, ticket_type, quantity,
           ticket_price, total_amount, booking_date, booking_status)
        VALUES
          (@eid, @uid, @ttype, @qty,
           @price, @total, GETDATE(), @status);
        SELECT SCOPE_IDENTITY() AS ticket_id;
      `);

    const newTicketId = Number(insertRes.recordset[0].ticket_id);

    // Decrement template seat count if one exists
    if (priceRow?.template_id) {
      await req1()
        .input("qty", sql.Int, ticketQty)
        .input("tid", sql.Int, priceRow.template_id)
        .query(`
          UPDATE dbo.Tickets SET quantity = quantity - @qty
          WHERE ticket_id = @tid AND quantity >= @qty
        `);
    }

    await transaction.commit();

    const ticketCode = `UCE${event_id}-U${user_id}-T${newTicketId}`;

    // ── Generate QR + PDF (only for confirmed/free tickets) ──────────────
    let qrCodeUrl = "", ticketDownloadUrl = "";
    if (!paymentRequired) {
      try {
        const assets = await createTicketAssets({
          event,
          user,
          booking: {
            ticket_id:      newTicketId,
            ticket_code:    ticketCode,
            event_id:       Number(event_id),
            user_id:        Number(user_id),
            ticket_type,
            quantity:       ticketQty,
            ticket_price:   ticketPrice,
            total_amount:   totalAmount,
            booking_status: bookingStatus
          }
        });
        qrCodeUrl         = assets.qr_code_url         || "";
        ticketDownloadUrl = assets.ticket_download_url || "";
      } catch (assetErr) {
        console.error("ASSET GENERATION ERROR (non-fatal):", assetErr.message);
      }
    }

    // ── Send email ───────────────────────────────────────────────────────
    let emailSent = false;
    try {
      await sendTicketEmail({
        to:               user.email,
        userName:         user.full_name,
        eventTitle:       event.title,
        eventDate:        formatDate(event.event_date),
        eventVenue:       event.venue         || "—",
        facultyName:      user.faculty_name   || "—",
        departmentName:   user.department_name|| "—",
        universityName:   user.university_name|| "—",
        ticketCode,
        ticketId:         newTicketId,
        quantity:         ticketQty,
        totalAmount,
        paymentRequired,
        bookingStatus,
        qrCodeUrl,
        ticketDownloadUrl
      });
      emailSent = true;
    } catch (emailErr) {
      console.error("EMAIL SEND ERROR (non-fatal):", emailErr.message);
    }

    // ── Response ─────────────────────────────────────────────────────────
    return res.status(201).json({
      success: true,
      message: emailSent
        ? (paymentRequired
            ? "Booking created — complete payment to receive your ticket"
            : "Ticket confirmed and sent to your email")
        : "Ticket booked — email delivery failed, please contact support",
      data: {
        booking: {
          ticket_id:           newTicketId,
          ticket_code:         ticketCode,
          booking_status:      bookingStatus,
          payment_required:    paymentRequired,
          quantity:            ticketQty,
          ticket_price:        ticketPrice,
          total_amount:        totalAmount,
          qr_code_url:         qrCodeUrl,
          ticket_download_url: ticketDownloadUrl,
          email_sent:          emailSent,
          // Full user details for booking summary panel
          user_id:             user.user_id,
          user_name:           user.full_name,
          user_email:          user.email,
          university_name:     user.university_name  || null,
          faculty_name:        user.faculty_name     || null,
          department_name:     user.department_name  || null,
          // Event details
          event_title:         event.title,
          event_date:          formatDate(event.event_date),
          event_venue:         event.venue || "—"
        }
      }
    });

  } catch (error) {
    console.error("BOOKING ERROR:", error);
    try { await transaction.rollback(); } catch (_) {}
    return res.status(500).json({ success: false, message: "Ticket booking failed: " + error.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/tickets/user/:user_id
// Returns all tickets for a user (for "My Tickets" page).
// ────────────────────────────────────────────────────────────────────────────
router.get("/user/:user_id", async (req, res) => {
  try {
    const db     = await getPool();
    const result = await db.request()
      .input("uid", sql.Int, Number(req.params.user_id))
      .query(`
        SELECT t.ticket_id, t.event_id, t.ticket_type,
               t.quantity, t.ticket_price, t.total_amount,
               t.booking_date, t.booking_status,
               e.title AS event_title, e.event_date, e.venue
        FROM dbo.Tickets t
        JOIN dbo.Event   e ON e.event_id = t.event_id
        WHERE t.user_id = @uid
          AND t.booking_status NOT IN ('available','cancelled')
        ORDER BY t.booking_date DESC
      `);
    return res.status(200).json({ success: true, data: { tickets: result.recordset } });
  } catch (err) {
    console.error("GET USER TICKETS ERROR:", err);
    return res.status(500).json({ success: false, message: "Could not fetch tickets" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// PATCH /api/tickets/:ticket_id/cancel
// ────────────────────────────────────────────────────────────────────────────
router.patch("/:ticket_id/cancel", async (req, res) => {
  try {
    const db          = await getPool();
    const { user_id } = req.body;
    if (!user_id)
      return res.status(400).json({ success: false, message: "user_id is required" });

    const result = await db.request()
      .input("tid", sql.Int, Number(req.params.ticket_id))
      .input("uid", sql.Int, Number(user_id))
      .query(`
        UPDATE dbo.Tickets SET booking_status = 'cancelled'
        WHERE ticket_id = @tid AND user_id = @uid
          AND booking_status NOT IN ('cancelled','available');
        SELECT @@ROWCOUNT AS affected;
      `);

    if (!result.recordset[0]?.affected)
      return res.status(404).json({ success: false, message: "Ticket not found or already cancelled" });

    return res.status(200).json({ success: true, message: "Ticket cancelled successfully" });
  } catch (err) {
    console.error("CANCEL TICKET ERROR:", err);
    return res.status(500).json({ success: false, message: "Could not cancel ticket" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// EMAIL HELPER
// Uses the central mailer utility (utils/mailer.js) which is already
// configured and verified on server startup in app.js.
// ────────────────────────────────────────────────────────────────────────────
async function sendTicketEmail({
  to, userName, eventTitle, eventDate, eventVenue,
  facultyName, departmentName, universityName,
  ticketCode, ticketId, quantity, totalAmount,
  paymentRequired, bookingStatus, qrCodeUrl, ticketDownloadUrl
}) {
  const isPending = bookingStatus === "pending_payment";
  const amountStr = totalAmount > 0
    ? `LKR ${Number(totalAmount).toLocaleString("en-LK", { minimumFractionDigits: 2 })}`
    : "Free";

  const qrBlock = qrCodeUrl
    ? `<div style="text-align:center;margin:24px 0">
         <p style="font-size:12px;color:#64748b;margin-bottom:10px;font-weight:700;
                   text-transform:uppercase;letter-spacing:1px">Scan at entrance</p>
         <img src="${qrCodeUrl}" alt="QR Code" width="160" height="160"
              style="border-radius:12px;border:3px solid #1e3a8a;display:block;margin:0 auto;
                     padding:6px;background:#fff"/>
       </div>` : "";

  const downloadBlock = ticketDownloadUrl
    ? `<div style="text-align:center;margin:18px 0">
         <a href="${ticketDownloadUrl}"
            style="display:inline-block;padding:12px 32px;
                   background:linear-gradient(135deg,#1a4fd6,#3730a3);
                   color:#fff;border-radius:10px;text-decoration:none;
                   font-weight:700;font-size:14px">
           ⬇ Download Ticket PDF
         </a>
       </div>` : "";

  const statusBlock = isPending
    ? `<div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;
                   padding:14px 18px;margin:16px 0;color:#78350f;font-size:14px">
         <strong style="display:block;margin-bottom:4px">⚠ Payment Required</strong>
         Please complete your payment to confirm this booking and receive your ticket.
       </div>`
    : `<div style="background:#dcfce7;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;
                   padding:14px 18px;margin:16px 0;color:#14532d;font-size:14px">
         <strong style="display:block;margin-bottom:4px">✓ Booking Confirmed</strong>
         Your ticket is confirmed. Present the QR code at the event entrance.
       </div>`;

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px 0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:560px;margin:0 auto">

  <div style="background:linear-gradient(135deg,#050d1a 0%,#1a4fd6 100%);
              border-radius:16px 16px 0 0;padding:32px 28px;text-align:center">
    <div style="font-size:13px;color:#93c5fd;font-weight:700;letter-spacing:2px;
                text-transform:uppercase;margin-bottom:8px">UniConnect</div>
    <div style="font-size:26px;color:#fff;font-weight:800;line-height:1.2;
                margin-bottom:6px">${eventTitle}</div>
    <div style="font-size:13px;color:#a5b4fc">Event Ticket Confirmation</div>
  </div>

  <div style="background:#fff;padding:28px;border-left:1px solid #e2e8f0;
              border-right:1px solid #e2e8f0">

    <p style="color:#1e293b;font-size:15px;margin:0 0 16px">
      Hi <strong>${userName}</strong>,
    </p>

    ${statusBlock}

    <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;
                padding:16px;text-align:center;margin:20px 0">
      <div style="font-size:11px;color:#64748b;font-weight:700;letter-spacing:1.5px;
                  text-transform:uppercase;margin-bottom:6px">Ticket ID</div>
      <div style="font-size:18px;font-family:monospace;font-weight:700;
                  color:#1a4fd6;letter-spacing:2px">${ticketCode}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:10px 0;color:#64748b;font-weight:700;width:42%;vertical-align:top">📅 Date</td>
        <td style="padding:10px 0;color:#0f172a">${eventDate}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:10px 0;color:#64748b;font-weight:700;vertical-align:top">📍 Venue</td>
        <td style="padding:10px 0;color:#0f172a">${eventVenue}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:10px 0;color:#64748b;font-weight:700;vertical-align:top">🎫 Quantity</td>
        <td style="padding:10px 0;color:#0f172a">${quantity} ticket${quantity > 1 ? "s" : ""}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:10px 0;color:#64748b;font-weight:700;vertical-align:top">💰 Total</td>
        <td style="padding:10px 0;color:#0f172a;font-weight:700">${amountStr}</td>
      </tr>
    </table>

    <div style="background:#f8fafc;border-radius:10px;padding:16px;margin:16px 0">
      <div style="font-size:11px;color:#64748b;font-weight:700;letter-spacing:1px;
                  text-transform:uppercase;margin-bottom:12px">Attendee Details</div>
      <table style="width:100%;border-collapse:collapse;font-size:13.5px">
        <tr><td style="padding:6px 0;color:#64748b;width:42%">Name</td>
            <td style="padding:6px 0;color:#1e293b;font-weight:600">${userName}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">University</td>
            <td style="padding:6px 0;color:#1e293b">${universityName}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Faculty</td>
            <td style="padding:6px 0;color:#1e293b">${facultyName}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Department</td>
            <td style="padding:6px 0;color:#1e293b">${departmentName}</td></tr>
      </table>
    </div>

    ${qrBlock}
    ${downloadBlock}

  </div>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:0;
              border-radius:0 0 16px 16px;padding:16px 28px;text-align:center">
    <p style="color:#94a3b8;font-size:11px;margin:0">
      UniConnect Event Management System · This is an automated message, please do not reply.
    </p>
  </div>

</div>
</body>
</html>`;

  // Use the central mailer utility
  await sendMail({
    to,
    subject: isPending
      ? `Booking received — ${eventTitle} (payment pending)`
      : `✓ Your ticket for ${eventTitle}`,
    html
  });
}

// ── Misc helpers ──────────────────────────────────────────────────────────────
function isTruthy(v) {
  return v === true || v === 1 || v === "1" || v === "true";
}

function formatDate(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("en-GB", {
      day: "2-digit", month: "long", year: "numeric"
    });
  } catch (_) { return String(v).split("T")[0]; }
}

module.exports = router;
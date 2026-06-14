/**
 * payments.js  —  UniConnect Payment Router
 * Handles:
 *   POST  /api/payments/initiate          — create a pending payment record
 *   POST  /api/payments/card              — simulate card charge (Stripe-ready stub)
 *   POST  /api/payments/:id/upload-slip   — upload bank-transfer slip (multipart)
 *   GET   /api/payments/:id               — get single payment + ticket info
 *   GET   /api/payments/ticket/:ticket_id — get payment(s) for a ticket
 *   GET   /api/payments/organizer/all     — all payments for events run by the
 *                                            logged-in organizer (for approval dashboard)
 *   POST  /api/payments/:id/approve       — organizer approves slip (+ email + notification)
 *   POST  /api/payments/:id/reject        — organizer rejects slip  (+ email + notification)
 *   PATCH /api/payments/:id/verify        — legacy alias of approve
 *   PATCH /api/payments/:id/reject        — legacy alias of reject
 */

"use strict";

const express     = require("express");
const router      = express.Router();
const sql         = require("mssql");
const db          = require("../db");
const multer      = require("multer");
const path        = require("path");
const fs          = require("fs");
const crypto      = require("crypto");
const nodemailer  = require("nodemailer");

// ── EMAIL ─────────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || "smtp.gmail.com",
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

// ── FILE UPLOAD (payment slips) ───────────────────────────────────────────────
const SLIP_DIR = path.join(__dirname, "..", "storage", "payment-slips");
fs.mkdirSync(SLIP_DIR, { recursive: true });

const slipStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, SLIP_DIR),
  filename:    (_req, file,  cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `slip-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, name);
  }
});

const slipUpload = multer({
  storage: slipStorage,
  limits:  { fileSize: 10 * 1024 * 1024 },   // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".pdf", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Only JPG / PNG / PDF / WEBP files are accepted"));
  }
});

// ── DB POOL ───────────────────────────────────────────────────────────────────
async function getPool() {
  if (!db.connected) await db.connect().catch(() => {});
  if (typeof db.request !== "function")
    throw new Error("Database pool is not ready.");
  return db;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function isTruthy(v) { return v === true || v === 1 || v === "1" || v === "true"; }

function lkr(v) {
  return `LKR ${Number(v || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })}`;
}

function fmtDate(v) {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" }); }
  catch (_) { return String(v).split("T")[0]; }
}

// Resolve the logged-in user's id from headers set by the frontend
// (PaymentApproval.html sends Authorization: Bearer <token> and x-user-id)
function getRequestUserId(req) {
  const headerUid = req.headers["x-user-id"];
  if (headerUid) return Number(headerUid);
  if (req.user && req.user.user_id) return Number(req.user.user_id);
  return null;
}

// ── SEND EMAIL (generic) ──────────────────────────────────────────────────────
async function sendMail({ to, subject, html }) {
  await transporter.sendMail({
    from:    `"UniConnect Events" <${process.env.SMTP_USER}>`,
    to, subject, html
  });
}

// ── CREATE IN-APP NOTIFICATION ────────────────────────────────────────────────
// Adjust column names here if your dbo.Notifications table differs.
async function createNotification(pool, { user_id, event_id, type, message }) {
  try {
    await pool.request()
      .input("uid",  sql.Int,           user_id)
      .input("eid",  sql.Int,           event_id || null)
      .input("type", sql.VarChar(50),   type || "payment")
      .input("msg",  sql.NVarChar(500), message)
      .query(`
        INSERT INTO dbo.Notifications
          (user_id, event_id, notification_type, message, is_read, created_at)
        VALUES
          (@uid, @eid, @type, @msg, 0, GETDATE())
      `);
  } catch (e) {
    console.error("NOTIFICATION INSERT ERROR:", e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  POST /api/payments/initiate
// ═════════════════════════════════════════════════════════════════════════════
router.post("/initiate", async (req, res) => {
  try {
    const pool = await getPool();
    const { ticket_id, user_id, event_id, amount, payment_method } = req.body;

    if (!ticket_id || !user_id || !event_id || !amount || !payment_method)
      return res.status(400).json({ success: false, message: "ticket_id, user_id, event_id, amount and payment_method are required" });

    const method = String(payment_method).toLowerCase();
    if (!["bank_transfer", "card"].includes(method))
      return res.status(400).json({ success: false, message: "payment_method must be 'bank_transfer' or 'card'" });

    const tkRes = await pool.request()
      .input("tid", sql.Int, ticket_id)
      .input("uid", sql.Int, user_id)
      .query(`
        SELECT ticket_id, booking_status, total_amount, event_id
        FROM dbo.Tickets
        WHERE ticket_id = @tid AND user_id = @uid
      `);
    const ticket = tkRes.recordset[0];
    if (!ticket)
      return res.status(404).json({ success: false, message: "Ticket not found" });
    if (ticket.booking_status === "confirmed")
      return res.status(400).json({ success: false, message: "This ticket is already confirmed" });
    if (ticket.booking_status === "cancelled")
      return res.status(400).json({ success: false, message: "This ticket has been cancelled" });

    // Prevent duplicate active payment
    const dupRes = await pool.request()
      .input("tid", sql.Int, ticket_id)
      .query(`
        SELECT payment_id FROM dbo.Payments
        WHERE ticket_id = @tid AND payment_status NOT IN ('failed','rejected','Rejected','Failed')
      `);
    if (dupRes.recordset.length > 0) {
      return res.status(200).json({
        success:    true,
        message:    "A payment record already exists for this ticket",
        payment_id: dupRes.recordset[0].payment_id
      });
    }

    const insRes = await pool.request()
      .input("tid",    sql.Int,          ticket_id)
      .input("uid",    sql.Int,          user_id)
      .input("eid",    sql.Int,          event_id)
      .input("amt",    sql.Decimal(10,2),amount)
      .input("method", sql.VarChar(100), payment_method)
      .query(`
        INSERT INTO dbo.Payments
          (ticket_id, user_id, event_id, amount, payment_method, payment_status, payment_date)
        VALUES
          (@tid, @uid, @eid, @amt, @method, 'Pending', GETDATE());
        SELECT SCOPE_IDENTITY() AS payment_id;
      `);

    const paymentId = Number(insRes.recordset[0].payment_id);

    return res.status(201).json({
      success:    true,
      message:    "Payment initiated",
      payment_id: paymentId,
      next_step:  method === "bank_transfer" ? "upload_slip" : "card_charge"
    });

  } catch (err) {
    console.error("INITIATE PAYMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Could not initiate payment: " + err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  POST /api/payments/card
// ═════════════════════════════════════════════════════════════════════════════
router.post("/card", async (req, res) => {
  const pool = await getPool();
  let transaction;
  try {
    const { payment_id, card_holder, card_number, expiry_month, expiry_year, cvv } = req.body;

    if (!payment_id || !card_holder || !card_number || !expiry_month || !expiry_year || !cvv)
      return res.status(400).json({ success: false, message: "All card fields are required" });

    const digits = String(card_number).replace(/\s/g, "");
    if (!/^\d{13,19}$/.test(digits))
      return res.status(400).json({ success: false, message: "Invalid card number" });

    if (!/^\d{2,4}$/.test(String(cvv)))
      return res.status(400).json({ success: false, message: "Invalid CVV" });

    const expM = Number(expiry_month);
    const expY = Number(expiry_year);
    const now  = new Date();
    if (expM < 1 || expM > 12 || expY < now.getFullYear() ||
       (expY === now.getFullYear() && expM < now.getMonth() + 1))
      return res.status(400).json({ success: false, message: "Card has expired" });

    const payRes = await pool.request()
      .input("pid", sql.Int, payment_id)
      .query(`
        SELECT p.payment_id, p.ticket_id, p.user_id, p.event_id,
               p.amount, p.payment_status,
               u.full_name, u.email,
               e.title AS event_title, e.event_date, e.venue
        FROM dbo.Payments p
        JOIN dbo.Users u ON u.user_id = p.user_id
        JOIN dbo.Event  e ON e.event_id = p.event_id
        WHERE p.payment_id = @pid
      `);
    const pay = payRes.recordset[0];
    if (!pay)
      return res.status(404).json({ success: false, message: "Payment record not found" });
    if (pay.payment_status === "Completed")
      return res.status(400).json({ success: false, message: "Payment already completed" });

    // ── PRODUCTION: call Stripe / PayHere here ────────────────────────────────
    const txnId = `CARD-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    // ─────────────────────────────────────────────────────────────────────────

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    await new sql.Request(transaction)
      .input("pid", sql.Int,          payment_id)
      .input("txn", sql.VarChar(255), txnId)
      .query(`
        UPDATE dbo.Payments
        SET payment_status = 'Completed', transaction_id = @txn, payment_date = GETDATE()
        WHERE payment_id = @pid
      `);

    await new sql.Request(transaction)
      .input("tid", sql.Int, pay.ticket_id)
      .query(`
        UPDATE dbo.Tickets SET booking_status = 'confirmed'
        WHERE ticket_id = @tid
      `);

    await transaction.commit();

    try {
      await sendMail({
        to:      pay.email,
        subject: `Payment confirmed — ${pay.event_title}`,
        html:    paymentConfirmationEmail({
          userName:    pay.full_name,
          eventTitle:  pay.event_title,
          eventDate:   fmtDate(pay.event_date),
          eventVenue:  pay.venue,
          amount:      lkr(pay.amount),
          method:      "Visa / Mastercard",
          txnId,
          status:      "Confirmed"
        })
      });
    } catch (e) { console.error("EMAIL ERROR:", e.message); }

    await createNotification(pool, {
      user_id: pay.user_id,
      event_id: pay.event_id,
      type: "payment_confirmed",
      message: `Your card payment for "${pay.event_title}" was successful. Your ticket is confirmed!`
    });

    return res.status(200).json({
      success:        true,
      message:        "Card payment successful. Your ticket is confirmed.",
      transaction_id: txnId,
      booking_status: "confirmed"
    });

  } catch (err) {
    try { if (transaction) await transaction.rollback(); } catch (_) {}
    console.error("CARD PAYMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Card payment failed: " + err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  POST /api/payments/:id/upload-slip
// ═════════════════════════════════════════════════════════════════════════════
router.post("/:id/upload-slip", slipUpload.single("slip"), async (req, res) => {
  try {
    const pool      = await getPool();
    const paymentId = Number(req.params.id);

    if (!req.file)
      return res.status(400).json({ success: false, message: "No file uploaded. Field name must be 'slip'" });

    const appUrl  = process.env.APP_URL || "http://localhost:3000";
    const slipUrl = `${appUrl}/payment-slips/${req.file.filename}`;

    const payRes = await pool.request()
      .input("pid", sql.Int, paymentId)
      .query(`
        SELECT p.payment_id, p.payment_status, p.ticket_id,
               p.amount, p.event_id,
               u.full_name, u.email,
               e.title AS event_title
        FROM dbo.Payments p
        JOIN dbo.Users u ON u.user_id = p.user_id
        JOIN dbo.Event  e ON e.event_id = p.event_id
        WHERE p.payment_id = @pid
      `);
    const pay = payRes.recordset[0];
    if (!pay)
      return res.status(404).json({ success: false, message: "Payment not found" });
    if (pay.payment_status === "Completed")
      return res.status(400).json({ success: false, message: "Payment is already completed" });

    await pool.request()
      .input("pid",     sql.Int,               paymentId)
      .input("url",     sql.NVarChar(sql.MAX), slipUrl)
      .query(`
        UPDATE dbo.Payments
        SET payment_slip_url  = @url,
            slip_uploaded_at  = GETDATE(),
            payment_status    = 'SlipUploaded'
        WHERE payment_id = @pid
      `);

    // Notify organiser by email
    try {
      const orgRes = await pool.request()
        .input("eid", sql.Int, pay.event_id)
        .query(`
          SELECT u.email, u.full_name, u.user_id AS organizer_user_id
          FROM dbo.Event e
          JOIN dbo.Users u ON u.user_id = e.organizer_id
          WHERE e.event_id = @eid
        `);
      const org = orgRes.recordset[0];
      if (org) {
        await sendMail({
          to:      org.email,
          subject: `Payment slip received — ${pay.event_title}`,
          html:    slipReceivedEmail({
            organiserName: org.full_name,
            userName:      pay.full_name,
            eventTitle:    pay.event_title,
            amount:        lkr(pay.amount),
            slipUrl,
            paymentId
          })
        });

        // In-app notification to organiser
        await createNotification(pool, {
          user_id: org.organizer_user_id,
          event_id: pay.event_id,
          type: "payment_slip_uploaded",
          message: `${pay.full_name} uploaded a payment slip for "${pay.event_title}" (${lkr(pay.amount)}). Review it in Payment Approvals.`
        });
      }
    } catch (e) { console.error("ORGANISER EMAIL ERROR:", e.message); }

    // Respond with BOTH key names so older/newer frontends both work
    return res.status(200).json({
      success:          true,
      message:          "Payment slip uploaded successfully. Awaiting organiser verification.",
      payment_slip_url: slipUrl,
      slip_url:         slipUrl,
      payment_status:   "SlipUploaded",
      data: {
        slip_url:         slipUrl,
        payment_slip_url: slipUrl,
        payment_status:   "SlipUploaded"
      }
    });

  } catch (err) {
    console.error("SLIP UPLOAD ERROR:", err);
    return res.status(500).json({ success: false, message: "Slip upload failed: " + err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  GET /api/payments/organizer/all
//  Returns every payment for events owned by the logged-in organizer.
//  Used by PaymentApproval.html as the main data source.
//  Requires the frontend to send x-user-id (or Authorization) for the organizer.
// ═════════════════════════════════════════════════════════════════════════════
router.get("/organizer/all", async (req, res) => {
  try {
    const pool = await getPool();
    const organizerId = getRequestUserId(req) || Number(req.query.organizer_id);

    if (!organizerId)
      return res.status(400).json({ success: false, message: "organizer id missing. Send x-user-id header or organizer_id query param." });

    const result = await pool.request()
      .input("oid", sql.Int, organizerId)
      .query(`
        SELECT
          p.payment_id, p.ticket_id, p.user_id, p.event_id,
          p.amount, p.payment_method, p.payment_status,
          p.payment_slip_url AS slip_url,
          p.transaction_id, p.payment_date AS created_at,
          p.slip_uploaded_at, p.verified_at, p.rejection_reason,
          t.quantity, t.ticket_type, t.booking_status,
          u.full_name AS user_name, u.email AS user_email,
          u.faculty_name, u.department_name,
          un.university_name,
          e.title AS event_title, e.event_date, e.venue,
          e.zoom_link
        FROM dbo.Payments p
        JOIN dbo.Tickets  t  ON t.ticket_id  = p.ticket_id
        JOIN dbo.Users    u  ON u.user_id    = p.user_id
        JOIN dbo.Event    e  ON e.event_id   = p.event_id
        LEFT JOIN dbo.University un ON un.university_id = u.university_id
        WHERE e.organizer_id = @oid
        ORDER BY
          CASE WHEN p.payment_status IN ('SlipUploaded','Pending') THEN 0 ELSE 1 END,
          p.payment_date DESC
      `);

    return res.status(200).json({ success: true, data: { payments: result.recordset } });

  } catch (err) {
    console.error("ORGANIZER PAYMENTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Could not fetch payments: " + err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  GET /api/payments/ticket/:ticket_id
//  NOTE: must be registered BEFORE GET /:id, otherwise "ticket" would be
//  captured as :id and this route would never be reached.
// ═════════════════════════════════════════════════════════════════════════════
router.get("/ticket/:ticket_id", async (req, res) => {
  try {
    const pool   = await getPool();
    const result = await pool.request()
      .input("tid", sql.Int, req.params.ticket_id)
      .query(`
        SELECT payment_id, amount, payment_method, payment_status,
               transaction_id, payment_date AS created_at,
               payment_slip_url AS slip_url,
               slip_uploaded_at, verified_at, rejection_reason
        FROM dbo.Payments
        WHERE ticket_id = @tid
        ORDER BY payment_date DESC
      `);
    return res.status(200).json({ success: true, data: { payments: result.recordset } });
  } catch (err) {
    console.error("GET TICKET PAYMENTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Could not fetch payments" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  GET /api/payments/:id
//  NOTE: registered AFTER /organizer/all and /ticket/:ticket_id so those
//  literal paths are matched first. Also guarded to numeric ids only.
// ═════════════════════════════════════════════════════════════════════════════
router.get("/:id", async (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return next();
  try {
    const pool   = await getPool();
    const result = await pool.request()
      .input("pid", sql.Int, req.params.id)
      .query(`
        SELECT p.*,
               p.payment_slip_url AS slip_url,
               u.full_name, u.email, u.faculty_name, u.department_name,
               un.university_name,
               e.title AS event_title, e.event_date, e.venue,
               t.ticket_type, t.quantity, t.booking_status
        FROM dbo.Payments p
        JOIN dbo.Users    u  ON u.user_id       = p.user_id
        JOIN dbo.Event    e  ON e.event_id      = p.event_id
        JOIN dbo.Tickets  t  ON t.ticket_id     = p.ticket_id
        LEFT JOIN dbo.University un ON un.university_id = u.university_id
        WHERE p.payment_id = @pid
      `);
    const pay = result.recordset[0];
    if (!pay)
      return res.status(404).json({ success: false, message: "Payment not found" });
    return res.status(200).json({ success: true, data: { payment: pay } });
  } catch (err) {
    console.error("GET PAYMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Could not fetch payment" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  POST /api/payments/:id/approve
//  Used by PaymentApproval.html. Organizer is taken from x-user-id header.
//  Body: { user_id, event_id, ticket_id, email_subject, email_body, zoom_link, notify_message }
// ═════════════════════════════════════════════════════════════════════════════
async function handleApprove(req, res) {
  const pool = await getPool();
  let transaction;
  try {
    const paymentId   = Number(req.params.id);
    const organizerId = getRequestUserId(req);
    const { email_subject, email_body, zoom_link, notify_message } = req.body;

    const payRes = await pool.request()
      .input("pid", sql.Int, paymentId)
      .query(`
        SELECT p.*, u.email, u.full_name, u.user_id,
               e.title AS event_title, e.event_date, e.venue, e.organizer_id, e.event_id
        FROM dbo.Payments p
        JOIN dbo.Users u ON u.user_id = p.user_id
        JOIN dbo.Event e ON e.event_id = p.event_id
        WHERE p.payment_id = @pid
      `);
    const pay = payRes.recordset[0];
    if (!pay)
      return res.status(404).json({ success: false, message: "Payment not found" });
    if (organizerId && Number(pay.organizer_id) !== Number(organizerId))
      return res.status(403).json({ success: false, message: "Only the event organizer can approve this payment" });
    if (pay.payment_status === "Completed")
      return res.status(400).json({ success: false, message: "Payment already completed" });

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const txnId = `BANK-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    await new sql.Request(transaction)
      .input("pid",  sql.Int,          paymentId)
      .input("org",  sql.Int,          organizerId || pay.organizer_id)
      .input("txn",  sql.VarChar(255), txnId)
      .query(`
        UPDATE dbo.Payments
        SET payment_status = 'Completed',
            transaction_id = @txn,
            verified_by    = @org,
            verified_at    = GETDATE()
        WHERE payment_id = @pid
      `);

    await new sql.Request(transaction)
      .input("tid", sql.Int, pay.ticket_id)
      .query(`UPDATE dbo.Tickets SET booking_status='confirmed' WHERE ticket_id=@tid`);

    // Optionally store/update the zoom link on the event
    if (zoom_link) {
      await new sql.Request(transaction)
        .input("eid",  sql.Int,               pay.event_id)
        .input("link", sql.NVarChar(sql.MAX), zoom_link)
        .query(`UPDATE dbo.Event SET zoom_link = @link WHERE event_id = @eid`);
    }

    await transaction.commit();

    // Send organizer-composed email (falls back to default template if not provided)
    try {
      const subject = email_subject || `Payment confirmed — ${pay.event_title}`;
      const html = email_body
        ? customMessageEmail({
            userName:   pay.full_name,
            eventTitle: pay.event_title,
            bodyText:   email_body,
            zoomLink:   zoom_link || null
          })
        : paymentConfirmationEmail({
            userName:   pay.full_name,
            eventTitle: pay.event_title,
            eventDate:  fmtDate(pay.event_date),
            eventVenue: pay.venue,
            amount:     lkr(pay.amount),
            method:     "Bank Transfer",
            txnId,
            status:     "Verified & Confirmed"
          });

      await sendMail({ to: pay.email, subject, html });
    } catch (e) { console.error("EMAIL ERROR:", e.message); }

    // In-app notification
    await createNotification(pool, {
      user_id:  pay.user_id,
      event_id: pay.event_id,
      type:     "payment_approved",
      message:  notify_message || `Your payment for "${pay.event_title}" has been approved!`
    });

    return res.status(200).json({ success: true, message: "Payment approved. Ticket confirmed and email sent." });

  } catch (err) {
    try { if (transaction) await transaction.rollback(); } catch (_) {}
    console.error("APPROVE PAYMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Approval failed: " + err.message });
  }
}
router.post("/:id/approve", handleApprove);

// ═════════════════════════════════════════════════════════════════════════════
//  POST /api/payments/:id/reject
//  Body: { user_id, event_id, rejection_reason, notify_message }
// ═════════════════════════════════════════════════════════════════════════════
async function handleReject(req, res) {
  try {
    const pool = await getPool();
    const paymentId   = Number(req.params.id);
    const organizerId = getRequestUserId(req);
    const { rejection_reason, notify_message } = req.body;

    const payRes = await pool.request()
      .input("pid", sql.Int, paymentId)
      .query(`
        SELECT p.ticket_id, p.user_id, p.amount, p.event_id,
               u.email, u.full_name,
               e.title AS event_title, e.organizer_id
        FROM dbo.Payments p
        JOIN dbo.Users u ON u.user_id = p.user_id
        JOIN dbo.Event e ON e.event_id = p.event_id
        WHERE p.payment_id = @pid
      `);
    const pay = payRes.recordset[0];
    if (!pay)
      return res.status(404).json({ success: false, message: "Payment not found" });
    if (organizerId && Number(pay.organizer_id) !== Number(organizerId))
      return res.status(403).json({ success: false, message: "Only the event organizer can reject this payment" });

    const reason = rejection_reason || "Your payment slip could not be verified. Please re-upload a valid slip.";

    await pool.request()
      .input("pid",    sql.Int,           paymentId)
      .input("reason", sql.NVarChar(500), reason)
      .query(`
        UPDATE dbo.Payments
        SET payment_status   = 'Rejected',
            rejection_reason = @reason
        WHERE payment_id = @pid
      `);

    try {
      await sendMail({
        to:      pay.email,
        subject: `Payment slip rejected — action required`,
        html:    rejectionEmail({ userName: pay.full_name, reason, amount: lkr(pay.amount) })
      });
    } catch (e) { console.error("EMAIL ERROR:", e.message); }

    await createNotification(pool, {
      user_id:  pay.user_id,
      event_id: pay.event_id,
      type:     "payment_rejected",
      message:  notify_message || `Your payment slip for "${pay.event_title}" was rejected. ${reason}`
    });

    return res.status(200).json({ success: true, message: "Payment rejected. User notified." });

  } catch (err) {
    console.error("REJECT PAYMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Rejection failed: " + err.message });
  }
}
router.post("/:id/reject", handleReject);

// ═════════════════════════════════════════════════════════════════════════════
//  Legacy aliases (kept for backwards compatibility with older callers)
//  PATCH /api/payments/:id/verify
//  PATCH /api/payments/:id/reject
// ═════════════════════════════════════════════════════════════════════════════
router.patch("/:id/verify", async (req, res) => {
  req.body.email_subject  = req.body.email_subject  || null;
  req.body.email_body     = req.body.email_body     || null;
  req.body.notify_message = req.body.notify_message || null;
  if (req.body.organiser_user_id && !req.headers["x-user-id"]) {
    req.headers["x-user-id"] = String(req.body.organiser_user_id);
  }
  return handleApprove(req, res);
});

router.patch("/:id/reject", async (req, res) => {
  req.body.rejection_reason = req.body.rejection_reason || req.body.reason || null;
  if (req.body.organiser_user_id && !req.headers["x-user-id"]) {
    req.headers["x-user-id"] = String(req.body.organiser_user_id);
  }
  return handleReject(req, res);
});

// ═════════════════════════════════════════════════════════════════════════════
//  EMAIL TEMPLATES
// ═════════════════════════════════════════════════════════════════════════════
function paymentConfirmationEmail({ userName, eventTitle, eventDate, eventVenue, amount, method, txnId, status }) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:20px 0;background:#f1f5f9;
    font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:540px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#050d1a,#1a4fd6);border-radius:14px 14px 0 0;
                padding:28px;text-align:center">
      <div style="font-size:12px;color:#93c5fd;font-weight:700;letter-spacing:2px;
                  text-transform:uppercase;margin-bottom:6px">UniConnect</div>
      <div style="font-size:22px;color:#fff;font-weight:800">${eventTitle}</div>
      <div style="font-size:12px;color:#a5b4fc;margin-top:4px">Payment ${status}</div>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:0">
      <p style="color:#1e293b;font-size:15px">Hi <strong>${userName}</strong>,</p>
      <div style="background:#dcfce7;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;
                  padding:12px 16px;margin:16px 0;color:#14532d;font-size:14px">
        <strong>✓ Payment ${status}</strong><br>Your ticket is now confirmed.
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px">
        ${["Amount","Method","Transaction ID","Event Date","Venue"].map((lbl, i) =>
          `<tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:9px 0;color:#64748b;width:40%">${lbl}</td>
            <td style="padding:9px 0;color:#0f172a;font-weight:600">${[amount,method,txnId,eventDate,eventVenue][i]}</td>
          </tr>`).join("")}
      </table>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 14px 14px;
                padding:14px;text-align:center;font-size:11px;color:#94a3b8">
      UniConnect Event Management System · Automated message
    </div>
  </div></body></html>`;
}

function slipReceivedEmail({ organiserName, userName, eventTitle, amount, slipUrl, paymentId }) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:20px 0;background:#f1f5f9;
    font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:540px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#050d1a,#1a4fd6);border-radius:14px 14px 0 0;
                padding:28px;text-align:center">
      <div style="font-size:12px;color:#93c5fd;font-weight:700;letter-spacing:2px;
                  text-transform:uppercase;margin-bottom:6px">UniConnect</div>
      <div style="font-size:20px;color:#fff;font-weight:800">Payment Slip Received</div>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:0">
      <p style="color:#1e293b;font-size:15px">Hi <strong>${organiserName}</strong>,</p>
      <p style="color:#334155;font-size:14px">
        <strong>${userName}</strong> has uploaded a bank transfer slip for
        <strong>${eventTitle}</strong> (${amount}).
      </p>
      <p style="color:#334155;font-size:14px">Payment ID: <code>#${paymentId}</code></p>
      <div style="margin:20px 0;text-align:center">
        <a href="${slipUrl}" style="display:inline-block;padding:12px 28px;
           background:linear-gradient(135deg,#1a4fd6,#3730a3);color:#fff;
           border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
          View Slip
        </a>
      </div>
      <p style="color:#64748b;font-size:13px">
        Please log in to UniConnect to verify or reject this payment.
      </p>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 14px 14px;
                padding:14px;text-align:center;font-size:11px;color:#94a3b8">
      UniConnect Event Management System · Automated message
    </div>
  </div></body></html>`;
}

function rejectionEmail({ userName, reason, amount }) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:20px 0;background:#f1f5f9;
    font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:540px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#050d1a,#7f1d1d);border-radius:14px 14px 0 0;
                padding:28px;text-align:center">
      <div style="font-size:12px;color:#fca5a5;font-weight:700;letter-spacing:2px;
                  text-transform:uppercase;margin-bottom:6px">UniConnect</div>
      <div style="font-size:20px;color:#fff;font-weight:800">Payment Slip Rejected</div>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:0">
      <p style="color:#1e293b;font-size:15px">Hi <strong>${userName}</strong>,</p>
      <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0;
                  padding:12px 16px;margin:16px 0;color:#7f1d1d;font-size:14px">
        <strong>✗ Slip Rejected</strong><br>Reason: ${reason}
      </div>
      <p style="color:#334155;font-size:14px">
        Amount due: <strong>${amount}</strong>. Please upload a correct payment slip or
        contact the event organiser for assistance.
      </p>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 14px 14px;
                padding:14px;text-align:center;font-size:11px;color:#94a3b8">
      UniConnect Event Management System · Automated message
    </div>
  </div></body></html>`;
}

// New: used when the organizer writes their own message (approval w/ Zoom etc.)
function customMessageEmail({ userName, eventTitle, bodyText, zoomLink }) {
  const safeBody = String(bodyText || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html><html><body style="margin:0;padding:20px 0;background:#f1f5f9;
    font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:540px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#050d1a,#1a4fd6);border-radius:14px 14px 0 0;
                padding:28px;text-align:center">
      <div style="font-size:12px;color:#93c5fd;font-weight:700;letter-spacing:2px;
                  text-transform:uppercase;margin-bottom:6px">UniConnect</div>
      <div style="font-size:20px;color:#fff;font-weight:800">${eventTitle}</div>
      <div style="font-size:12px;color:#a5b4fc;margin-top:4px">Payment Verified & Confirmed</div>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:0">
      <div style="color:#1e293b;font-size:14px;line-height:1.7">${safeBody}</div>
      ${zoomLink ? `
      <div style="margin:20px 0;text-align:center">
        <a href="${zoomLink}" style="display:inline-block;padding:12px 28px;
           background:linear-gradient(135deg,#2d8cff,#1a4fd6);color:#fff;
           border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
          Join Meeting Link
        </a>
      </div>` : ""}
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 14px 14px;
                padding:14px;text-align:center;font-size:11px;color:#94a3b8">
      UniConnect Event Management System · Automated message
    </div>
  </div></body></html>`;
}

module.exports = router;
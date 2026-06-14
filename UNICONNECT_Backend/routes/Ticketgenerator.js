/**
 * ticketGenerator.js
 * Generates QR code PNG + boarding-pass style PDF for UniConnect tickets.
 * Called by routes/ticket.js after a confirmed booking.
 */

"use strict";

const fs          = require("fs");
const path        = require("path");
const QRCode      = require("qrcode");
const PDFDocument = require("pdfkit");

// ── Storage folder ────────────────────────────────────────────────────────────
const storageDir = path.join(__dirname, "..", "storage", "tickets");

// ── Public export ─────────────────────────────────────────────────────────────
/**
 * createTicketAssets({ event, user, booking })
 *
 * @param {object} event   – row from dbo.Event  (needs: event_id, title, event_date, venue)
 * @param {object} user    – row from dbo.Users  (needs: user_id, full_name, department_name,
 *                                                  faculty_name, university_name)
 * @param {object} booking – ticket row          (needs: ticket_id, ticket_code, event_id,
 *                                                  user_id, ticket_type, quantity,
 *                                                  ticket_price, total_amount, booking_status)
 * @returns {{ qr_code_url: string, ticket_download_url: string }}
 */
async function createTicketAssets({ event, user, booking }) {
  // Ensure storage dir exists
  await fs.promises.mkdir(storageDir, { recursive: true });

  const appUrl     = process.env.APP_URL || "http://localhost:3000";
  const ticketCode = booking.ticket_code
    || `UCE${booking.event_id}-U${booking.user_id}-T${booking.ticket_id}`;

  // Sanitise for filenames
  const safeCode = ticketCode.replace(/[^a-z0-9\-]/gi, "-");
  const qrFile   = `${safeCode}-qr.png`;
  const pdfFile  = `${safeCode}-ticket.pdf`;
  const qrPath   = path.join(storageDir, qrFile);
  const pdfPath  = path.join(storageDir, pdfFile);

  // ── 1. QR code ────────────────────────────────────────────────────────────
  await QRCode.toFile(
    qrPath,
    JSON.stringify({
      ticket_id:   booking.ticket_id,
      ticket_code: ticketCode,
      event_id:    booking.event_id,
      user_id:     booking.user_id,
      quantity:    booking.quantity
    }),
    {
      width:                320,
      margin:               2,
      errorCorrectionLevel: "H",
      color: { dark: "#050d1a", light: "#ffffff" }
    }
  );

  // ── 2. PDF ────────────────────────────────────────────────────────────────
  await buildBoardingPassPdf({ event, user, booking, ticketCode, qrPath, pdfPath });

  return {
    qr_code_url:         `${appUrl}/tickets/${qrFile}`,
    ticket_download_url: `${appUrl}/tickets/${pdfFile}`
  };
}

// ── PDF builder ───────────────────────────────────────────────────────────────
function buildBoardingPassPdf({ event, user, booking, ticketCode, qrPath, pdfPath }) {
  return new Promise((resolve, reject) => {

    // A5 landscape — boarding-pass proportions
    const W = 595, H = 280;

    const doc = new PDFDocument({
      size:   [W, H],
      margin: 0,
      info: {
        Title:   `UniConnect Ticket — ${event.title || "Event"}`,
        Author:  "UniConnect",
        Subject: "Event Ticket"
      }
    });

    const stream = fs.createWriteStream(pdfPath);
    stream.on("finish", resolve);
    stream.on("error",  reject);
    doc.pipe(stream);

    // ── Palette ───────────────────────────────────────────────────────────
    const NAVY   = "#050d1a";
    const BLUE   = "#1a4fd6";
    const ACCENT = "#818cf8";
    const WHITE  = "#ffffff";
    const LIGHT  = "#e0e7ff";
    const MUTED  = "#94a3b8";

    // ── Helpers ───────────────────────────────────────────────────────────
    const lkr = (v) =>
      Number(v) > 0
        ? `LKR ${Number(v).toLocaleString("en-LK", { minimumFractionDigits: 2 })}`
        : "Free";

    const fmtDate = (v) => {
      if (!v) return "—";
      try {
        return new Date(v).toLocaleDateString("en-GB", {
          day: "2-digit", month: "short", year: "numeric"
        });
      } catch (_) { return String(v).split("T")[0]; }
    };

    const LEFT_W = 392;

    // ── Background ────────────────────────────────────────────────────────
    doc.rect(0, 0, W, H).fill(NAVY);

    // Subtle diagonal stripe texture
    doc.save();
    doc.opacity(0.04);
    for (let x = -H; x < W + H; x += 18) {
      doc.moveTo(x, 0).lineTo(x + H, H).stroke(WHITE);
    }
    doc.restore();

    // ── Left section — main body ──────────────────────────────────────────
    doc.rect(0, 0, LEFT_W, 72).fill(BLUE);
    doc.rect(0, 0, LEFT_W, 5).fill(ACCENT);

    doc.fillColor(LIGHT).font("Helvetica-Bold").fontSize(8)
       .text("UNICONNECT", 24, 16, { characterSpacing: 3 });

    doc.roundedRect(24, 30, 80, 16, 8).fill("rgba(255,255,255,0.15)");
    doc.fillColor(WHITE).font("Helvetica").fontSize(7.5)
       .text("EVENT TICKET", 28, 34, { characterSpacing: 1.5 });

    const titleFontSize = event.title && event.title.length > 30 ? 15 : 18;
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(titleFontSize)
       .text(event.title || "UniConnect Event", 24, 83, {
         width: LEFT_W - 48, ellipsis: true
       });

    // ── Detail rows ───────────────────────────────────────────────────────
    const detailY = 128;
    const col1X   = 24;
    const col2X   = 205;
    const rowH    = 38;

    const details = [
      ["DATE",     fmtDate(event.event_date),                        col1X, detailY],
      ["VENUE",    event.venue || "—",                               col2X, detailY],
      ["ATTENDEE", user.full_name || "—",                            col1X, detailY + rowH],
      ["DEPT",     user.department_name || user.faculty_name || "—", col2X, detailY + rowH],
      ["TICKET",   booking.ticket_type || "General",                 col1X, detailY + rowH * 2],
      ["TOTAL",    lkr(booking.total_amount),                        col2X, detailY + rowH * 2]
    ];

    details.forEach(([label, value, x, y]) => {
      doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(6.5)
         .text(label, x, y, { characterSpacing: 1.5 });
      doc.fillColor(WHITE).font("Helvetica").fontSize(10.5)
         .text(String(value), x, y + 10, { width: 165, ellipsis: true });
    });

    // ── Status badge ──────────────────────────────────────────────────────
    const statusY     = detailY + rowH * 3 + 6;
    const isConfirmed = booking.booking_status === "confirmed";
    const badgeColor  = isConfirmed ? "#16a34a" : "#d97706";
    const badgeBg     = isConfirmed ? "rgba(22,163,74,0.2)" : "rgba(217,119,6,0.2)";
    const badgeLabel  = isConfirmed ? "✓  CONFIRMED" : "⏳  PENDING PAYMENT";

    doc.roundedRect(col1X, statusY, 130, 18, 9).fill(badgeBg);
    doc.fillColor(badgeColor).font("Helvetica-Bold").fontSize(7.5)
       .text(badgeLabel, col1X + 10, statusY + 5, { characterSpacing: 1 });

    doc.roundedRect(col1X + 138, statusY, 60, 18, 9).fill("rgba(129,140,248,0.2)");
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(7.5)
       .text(`QTY: ${booking.quantity || 1}`, col1X + 150, statusY + 5, { characterSpacing: 1 });

    // ── Tear line ─────────────────────────────────────────────────────────
    const TEAR_X = LEFT_W + 2;
    doc.circle(TEAR_X - 1, 0, 14).fill(NAVY);
    doc.circle(TEAR_X - 1, H, 14).fill(NAVY);

    doc.save();
    doc.opacity(0.25);
    let dy = 20;
    while (dy < H - 20) {
      doc.moveTo(TEAR_X + 1, dy).lineTo(TEAR_X + 1, Math.min(dy + 6, H - 20));
      doc.strokeColor(WHITE).lineWidth(1).stroke();
      dy += 11;
    }
    doc.restore();

    // ── Right stub — QR code ──────────────────────────────────────────────
    const STUB_X = LEFT_W + 10;
    const STUB_W = W - STUB_X;

    doc.rect(STUB_X, 0, STUB_W, 5).fill(ACCENT);
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(7)
       .text("ADMIT ONE", STUB_X, 16, { width: STUB_W, align: "center", characterSpacing: 2 });

    const QR_SIZE = 110;
    const qrX     = STUB_X + (STUB_W - QR_SIZE) / 2;
    const qrY     = 32;

    if (fs.existsSync(qrPath)) {
      doc.roundedRect(qrX - 6, qrY - 6, QR_SIZE + 12, QR_SIZE + 12, 8).fill(WHITE);
      doc.image(qrPath, qrX, qrY, { width: QR_SIZE, height: QR_SIZE });
    } else {
      doc.roundedRect(qrX, qrY, QR_SIZE, QR_SIZE, 8).fill("rgba(255,255,255,0.08)");
      doc.fillColor(MUTED).font("Helvetica").fontSize(9)
         .text("QR CODE", qrX, qrY + 48, { width: QR_SIZE, align: "center" });
    }

    doc.fillColor(LIGHT).font("Helvetica-Bold").fontSize(6.5)
       .text(ticketCode, STUB_X, qrY + QR_SIZE + 18, {
         width: STUB_W, align: "center", characterSpacing: 0.8
       });

    doc.fillColor(MUTED).font("Helvetica").fontSize(6)
       .text("Scan at entrance", STUB_X, qrY + QR_SIZE + 30, {
         width: STUB_W, align: "center", characterSpacing: 0.5
       });

    doc.fillColor("rgba(255,255,255,0.2)").font("Helvetica").fontSize(7)
       .text(`#${booking.ticket_id}`, STUB_X, H - 22, { width: STUB_W, align: "center" });

    // ── Bottom bar ────────────────────────────────────────────────────────
    doc.rect(0, H - 18, W, 18).fill("rgba(0,0,0,0.35)");

    const genDate = new Date().toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric"
    });

    doc.fillColor("rgba(255,255,255,0.35)").font("Helvetica").fontSize(6.5)
       .text(
         `${user.university_name || "UniConnect University"}  ·  Generated ${genDate}  ·  UniConnect Event Management System`,
         12, H - 13,
         { width: LEFT_W - 24, ellipsis: true }
       );

    doc.end();
  });
}

module.exports = { createTicketAssets };
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const sql = require("mssql");

// ======================================================
// STORAGE FOLDER
// ======================================================

const storageDir = path.join(
  __dirname,
  "..",
  "storage",
  "tickets"
);

// ======================================================
// CREATE QR + PDF
// ======================================================

async function createTicketAssets({ event, user, booking }) {

  // CREATE STORAGE FOLDER
  await fs.promises.mkdir(storageDir, { recursive: true });

  const appUrl = process.env.APP_URL || "http://localhost:3000";

  // SAFE FILE NAME
  const ticketCode =
    booking.ticket_code ||
    `UC-${booking.event_id}-${booking.user_id}-${Date.now()}`;

  const safeCode = ticketCode.replace(/[^a-z0-9-]/gi, "-");

  // FILE NAMES
  const qrFile = `${safeCode}-qr.png`;
  const pdfFile = `${safeCode}-ticket.pdf`;

  // FILE PATHS
  const qrPath = path.join(storageDir, qrFile);
  const pdfPath = path.join(storageDir, pdfFile);

  // ======================================================
  // CREATE QR CODE
  // ======================================================

  await QRCode.toFile(
    qrPath,
    JSON.stringify({
      ticket_id: booking.ticket_id,
      event_id: booking.event_id,
      user_id: booking.user_id,
      ticket_type: booking.ticket_type,
      quantity: booking.quantity
    }),
    {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF"
      }
    }
  );

  // ======================================================
  // CREATE PDF
  // ======================================================

  await createTicketPdf({
    event,
    user,
    booking,
    qrPath,
    pdfPath
  });

  // ======================================================
  // RETURN URLS
  // ======================================================

  return {
    qr_code_url: `${appUrl}/tickets/${qrFile}`,
    ticket_download_url: `${appUrl}/tickets/${pdfFile}`
  };
}

// ======================================================
// CREATE PDF FUNCTION
// ======================================================

function createTicketPdf({
  event,
  user,
  booking,
  qrPath,
  pdfPath
}) {

  return new Promise((resolve, reject) => {

    const doc = new PDFDocument({
      size: "A4",
      margin: 40
    });

    const stream = fs.createWriteStream(pdfPath);

    // EVENTS
    stream.on("finish", resolve);
    stream.on("error", reject);

    doc.pipe(stream);

    // ======================================================
    // BACKGROUND
    // ======================================================

    doc.rect(0, 0, doc.page.width, doc.page.height)
      .fill("#eef4fb");

    // ======================================================
    // HEADER CARD
    // ======================================================

    doc.roundedRect(40, 40, 515, 220, 20)
      .fill("#07111f");

    // TITLE
    doc.fillColor("#7dd3fc")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("UNICONNECT EVENT TICKET", 70, 70);

    // EVENT NAME
    doc.fillColor("#ffffff")
      .fontSize(26)
      .font("Helvetica-Bold")
      .text(
        event.title || "Event Ticket",
        70,
        105,
        {
          width: 300
        }
      );

    // QR CODE
    if (fs.existsSync(qrPath)) {
      doc.image(qrPath, 410, 85, {
        width: 100,
        height: 100
      });
    }

    // TICKET CODE
    doc.fillColor("#ffffff")
      .fontSize(12)
      .font("Helvetica")
      .text(
        `Ticket ID: ${booking.ticket_id || "-"}`,
        70,
        210
      );

    // ======================================================
    // DETAILS CARD
    // ======================================================

    doc.roundedRect(40, 290, 515, 420, 18)
      .fill("#ffffff");

    // SECTION TITLE
    doc.fillColor("#07111f")
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Booking Details", 70, 325);

    // ======================================================
    // DETAILS DATA
    // ======================================================

    const rows = [
      ["Student Name", user.full_name || "-"],
      ["Email", user.email || "-"],
      ["Event Date", event.event_date || "-"],
      ["Venue", event.venue || "-"],
      ["Ticket Type", booking.ticket_type || "General"],
      ["Quantity", booking.quantity || 1],
      [
        "Ticket Price",
        `LKR ${Number(booking.ticket_price || 0).toLocaleString()}`
      ],
      [
        "Total Amount",
        `LKR ${Number(booking.total_amount || 0).toLocaleString()}`
      ],
      ["Booking Status", booking.booking_status || "confirmed"]
    ];

    let y = 380;














    rows.forEach(([label, value]) => {

      // LABEL
      doc.fillColor("#64748b")
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(label.toUpperCase(), 70, y);

      // VALUE
      doc.fillColor("#07111f")
        .fontSize(13)
        .font("Helvetica")
        .text(String(value), 240, y);

      // LINE
      doc.moveTo(70, y + 22)
        .lineTo(510, y + 22)
        .strokeColor("#e2e8f0")
        .stroke();

      y += 40;
    });

    // ======================================================
    // FOOTER
    // ======================================================

    doc.fillColor("#64748b")
      .fontSize(10)
      .text(
        "Generated by UniConnect",
        70,
        760,
        {
          align: "center"
        }
      );

    // END PDF
    doc.end();
  });
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  createTicketAssets
};
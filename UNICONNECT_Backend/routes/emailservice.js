const nodemailer = require("nodemailer");
const sql = require("mssql");

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: String(process.env.MAIL_SECURE || "false") === "true",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });
}

async function sendTicketEmail({ event, user, booking }) {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to: user.email,
    subject: "Your UniConnect ticket booking confirmation",
    html: `
      <div style="font-family:Arial,sans-serif;background:#eef4fb;padding:30px">
        <div style="max-width:650px;margin:auto;background:white;border-radius:18px;overflow:hidden">
          <div style="background:#07111f;color:white;padding:25px">
            <h2>UniConnect Ticket Confirmation</h2>
            <h1>${event.title}</h1>
          </div>

          ${event.image_url ? `<img src="${event.image_url}" style="width:100%;height:220px;object-fit:cover">` : ""}

          <div style="padding:25px">
            <p>Hello <b>${user.full_name}</b>,</p>
            <p>Your ticket booking has been created successfully.</p>

            <p><b>Ticket Code:</b> ${booking.ticket_code}</p>
            <p><b>Event Date:</b> ${event.event_date || "-"}</p>
            <p><b>Venue:</b> ${event.venue || "-"}</p>
            <p><b>Quantity:</b> ${booking.quantity}</p>
            <p><b>Total:</b> LKR ${Number(booking.total_amount || 0).toLocaleString()}</p>
            <p><b>Status:</b> ${booking.booking_status}</p>

            <div style="text-align:center;margin-top:25px">
              <img src="${booking.qr_code_url}" width="150" height="150" style="border:1px solid #ddd;padding:8px;border-radius:12px">
              <br><br>
              <a href="${booking.ticket_download_url}" style="background:#2563eb;color:white;padding:12px 18px;text-decoration:none;border-radius:10px;font-weight:bold">
                Download Ticket PDF
              </a>
            </div>

            <p style="color:#64748b;font-size:13px;margin-top:25px">
              Show this QR code or downloaded PDF at the event entrance.
            </p>
          </div>
        </div>
      </div>
    `
  });
}

module.exports = { sendTicketEmail };
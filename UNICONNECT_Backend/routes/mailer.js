const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send OTP email to a user
 * @param {string} toEmail  - recipient email address
 * @param {string} otp      - 6-digit OTP code
 */
async function sendOTPEmail(toEmail, otp) {
  await transporter.sendMail({
    from: `"UniConnect" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Your UniConnect Password Reset OTP",
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Password Reset OTP</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f7;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;border-radius:20px;overflow:hidden;background:#ffffff;">

        <!-- HERO HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d0e4b 0%,#152780 60%,#1e3fa8 100%);padding:36px 40px 30px;">

            <!-- Logo row -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="vertical-align:middle;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.22);border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;padding:0 7px;">
                        <img src="${process.env.FRONTEND_URL || 'https://yourdomain.com'}/UClogo.png"
                             alt="UC" width="26" height="26"
                             style="display:block;object-fit:contain;"/>
                      </td>
                      <td style="padding-left:10px;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;vertical-align:middle;">
                        UniConnect
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Lock icon circle -->
            <div style="width:56px;height:56px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.22);border-radius:16px;text-align:center;line-height:56px;font-size:26px;margin-bottom:18px;">
              🔐
            </div>

            <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;letter-spacing:-0.4px;">
              Password Reset
            </h1>
            <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.65);line-height:1.5;">
              We received a request to reset your password.
            </p>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:36px 40px 28px;">

            <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.7;">
              Use the one-time code below to reset your UniConnect password.
              This code expires in <span style="color:#152780;font-weight:700;">10 minutes</span> - do not share it with anyone.
            </p>

            <!-- OTP Block -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#f0f4ff;border:1.5px dashed #b8c5f0;border-radius:14px;padding:28px 20px;text-align:center;">
                  <div style="font-size:11px;font-weight:600;color:#7b8ec8;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">
                    Your one-time code
                  </div>
                  <!-- Individual digit boxes -->
                  <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
                    <tr>
                      ${otp.split('').map(digit => `
                      <td style="width:44px;height:52px;background:#ffffff;border:1.5px solid #dce6ff;border-radius:10px;text-align:center;vertical-align:middle;font-size:26px;font-weight:800;color:#152780;margin:0 3px;font-family:'Courier New',monospace;padding:0 3px;">
                        ${digit}
                      </td>`).join('<td style="width:6px;"></td>')}
                    </tr>
                  </table>
                  <div style="font-size:12px;color:#9ca3af;">
                    ⏱ Expires in 10 minutes
                  </div>
                </td>
              </tr>
            </table>

            <!-- Warning box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#fff8ed;border:1px solid #fde7b0;border-radius:12px;padding:14px 16px;">
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="width:22px;vertical-align:top;font-size:15px;padding-top:1px;">⚠️</td>
                      <td style="padding-left:8px;font-size:13px;color:#92610a;line-height:1.5;">
                        <strong>Security notice:</strong> UniConnect will never ask for this code via phone or chat. If you didn't request a reset, please ignore this email - your account remains secure.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${process.env.FRONTEND_URL || '#'}/reset-password"
                     style="display:inline-block;background:#152780;color:#ffffff;font-size:15px;font-weight:700;padding:14px 40px;border-radius:12px;text-decoration:none;letter-spacing:-0.2px;">
                    Go to Reset Page &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <hr style="border:none;border-top:1px solid #f0f0f0;margin:28px 0;"/>

            <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;line-height:1.6;">
              Wrong email? <a href="mailto:${process.env.EMAIL_USER}" style="color:#152780;font-weight:600;text-decoration:none;">Contact support</a>
            </p>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#f8faff;padding:20px 40px;border-top:1px solid #eef0f8;text-align:center;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
              <tr>
                <td align="center" style="font-size:12px;">
                  <a href="#" style="color:#9ca3af;text-decoration:none;margin:0 10px;">Unsubscribe</a>
                  <a href="#" style="color:#9ca3af;text-decoration:none;margin:0 10px;">Privacy Policy</a>
                  <a href="#" style="color:#9ca3af;text-decoration:none;margin:0 10px;">Contact Us</a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:12px;color:#c4c9d4;">© ${new Date().getFullYear()} UniConnect </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`,
  });
}

module.exports = { sendOTPEmail };
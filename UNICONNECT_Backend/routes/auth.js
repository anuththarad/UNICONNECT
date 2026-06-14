const nodemailer = require("nodemailer");
const express    = require("express");
const router     = express.Router();
const sql        = require("mssql");
const pool       = require("../db");
const bcrypt     = require("bcrypt");
const jwt        = require("jsonwebtoken");
const twilio     = require("twilio");
require("dotenv").config();

const authMiddleware = require('../middleware/authMiddleware');

const { switchLanguage } = require('../controllers/languageSwitchController');
const { applyLocale } = require('../middleware/languageController');
router.post('/settings/language', authMiddleware, applyLocale, switchLanguage);



const twilioEnabled = process.env.SMS_ENABLED === "true";

let client = null;



if (process.env.SMS_ENABLED === "true") {
  client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

/* ================================================================
   HELPERS
================================================================ */

/** Generate a 6-digit OTP */
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const otpStore = new Map();

/* ================================================================
   EMAIL TRANSPORT
================================================================ */
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

transporter.verify((error) => {
    if (error) console.error("Email Error:", error);
    else        console.log("Email Server Ready ✅");
});



async function sendWelcomeEmail(user) {
    try {
        await transporter.sendMail({
            from: `"UniConnect" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: "Welcome to UniConnect 🎉",
            html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to UniConnect</title>
</head>
<body style="margin:0;padding:0;background-color:#ECEEF6;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Email Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#ECEEF6;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:560px;border-radius:20px;overflow:hidden;
                      box-shadow:0 8px 40px rgba(13,9,52,0.12);">

          <!-- ── HEADER BAND ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#0d0934 0%,#152780 55%,#1e3fad 100%);
                       padding:36px 40px 32px;text-align:center;">

              <!-- Logo -->
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:0 auto 20px;">
                <tr>
                  <td style="background:rgba(255,255,255,0.12);border-radius:16px;
                             padding:14px 20px;display:inline-block;">
                    <!--
                      LOGO SWAP:
                      Replace the <img> src below with your hosted UClogo.png URL,
                      or use a CID attachment reference: cid:uclogo
                    -->
                    <img src="${process.env.FRONTEND_URL || '#'}/UClogo.png"
                         alt="UniConnect"
                         width="120"
                         style="display:block;height:auto;max-height:44px;object-fit:contain;"
                         onerror="this.style.display='none';document.getElementById('uc-text-logo').style.display='table-cell'"/>
                    <!-- Fallback text logo (shown if image fails) -->
                    <span id="uc-text-logo"
                          style="display:none;font-size:22px;font-weight:800;
                                 letter-spacing:2px;color:#ffffff;">
                      UC
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Headline -->
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;
                         letter-spacing:-0.3px;line-height:1.3;">
                Welcome aboard,&nbsp;${user.full_name}!&nbsp;🎉
              </h1>
              <p style="margin:10px 0 0;color:rgba(255,255,255,0.72);
                        font-size:15px;line-height:1.6;">
                Your UniConnect account is live and ready to go.
              </p>
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td style="background:#ffffff;padding:36px 40px 12px;">

              <!-- Greeting block -->
              <p style="margin:0 0 20px;color:#1a1a2e;font-size:15.5px;line-height:1.7;">
                Hi <strong>${user.full_name.split(' ')[0]}</strong>,<br/>
                We're thrilled to have you join the UniConnect community. Your account
                is set up and you can start discovering, creating, and managing events
                right now.
              </p>

              <!-- Feature pill list -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-bottom:28px;">
                ${[
                  ['📅', 'Discover Events', 'Browse and join events across your campus.'],
                  ['🗂️', 'Manage RSVPs',    'Track your registrations in one clean dashboard.'],
                  ['🔔', 'Stay Notified',   'Get real-time updates on everything you care about.'],
                ].map(([icon, title, desc]) => `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f0f2f8;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="width:40px;font-size:22px;vertical-align:middle;">${icon}</td>
                        <td style="vertical-align:middle;padding-left:10px;">
                          <span style="display:block;font-weight:700;color:#0d0934;font-size:14px;">
                            ${title}
                          </span>
                          <span style="color:#6b7280;font-size:13px;">${desc}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join('')}
              </table>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:0 auto 36px;">
                <tr>
                  <td align="center"
                      style="background:linear-gradient(135deg,#152780,#1e3fad);
                             border-radius:12px;box-shadow:0 4px 18px rgba(21,39,128,0.35);">
                    <a href="${process.env.FRONTEND_URL || '#'}"
                       style="display:inline-block;padding:14px 36px;color:#ffffff;
                              font-size:15px;font-weight:700;text-decoration:none;
                              letter-spacing:0.2px;border-radius:12px;">
                      Go to UniConnect →
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── DIVIDER ── -->
          <tr>
            <td style="background:#ffffff;padding:0 40px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,#e2e5f1,transparent);"></div>
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="background:#ffffff;border-radius:0 0 20px 20px;
                       padding:20px 40px 32px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12.5px;line-height:1.7;">
                You're receiving this because you created a UniConnect account.<br/>
                If this wasn't you,
                <a href="${process.env.FRONTEND_URL || '#'}/support"
                   style="color:#152780;text-decoration:underline;">let us know</a>.
              </p>
              <p style="margin:10px 0 0;color:#c4c8d8;font-size:11.5px;">
                © ${new Date().getFullYear()} UniConnect · All rights reserved
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`
        });
    } catch (err) {
        console.error("Welcome Mail Error:", err.message);
    }
}

/* ================================================================
   SEND OTP EMAIL
================================================================ */
async function sendOTPEmail(email, otp) {
    await transporter.sendMail({
        from: `"UniConnect" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "UniConnect – Password Reset OTP",
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;background:#f8fafc;border-radius:16px;">
                <h2 style="color:#0d0934;">Reset Your Password</h2>
                <p style="color:#374151;">Use the one-time code below. It expires in <strong>10 minutes</strong>.</p>
                <div style="margin:24px 0;text-align:center;">
                    <span style="display:inline-block;padding:16px 36px;background:#0d0934;color:white;border-radius:12px;font-size:32px;font-weight:800;letter-spacing:8px;">${otp}</span>
                </div>
                <p style="color:#9ca3af;font-size:13px;">If you didn't request this, ignore this email — your account is safe.</p>
            </div>`
    });
}

/* ================================================================
   SEND OTP SMS  (Twilio)
================================================================ */
async function sendOTPSMS(phone, otp) {
    if (!client) throw new Error("SMS service not configured");   // was twilioClient
   await twilioClient.messages.create({
  from: process.env.TWILIO_PHONE,   // ← this is missing
  to: phoneNumber,
  body: `Your UniConnect OTP is: ${otp}`
});
}

/* ================================================================
   REGISTER
================================================================ */
router.post("/register", async (req, res) => {
    try {
        const { full_name, email, password, role, university, studentId, contact_number } = req.body;

        if (!full_name || !email || !password || !role) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // Check duplicate email
        const existing = await pool.request()
            .input("email", sql.NVarChar, email.toLowerCase().trim())
            .query("SELECT user_id FROM Users WHERE email = @email");

        if (existing.recordset.length > 0) {
            return res.status(409).json({ success: false, message: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const result = await pool.request()
            .input("full_name",       sql.NVarChar, full_name.trim())
            .input("email",           sql.NVarChar, email.toLowerCase().trim())
            .input("password",        sql.NVarChar, hashedPassword)
            .input("role",            sql.NVarChar, role)
            .input("university",      sql.VarChar,  university || "Not Specified")
            .input("university_id",   sql.Int,      studentId  || null)
            .input("contact_number",  sql.NVarChar, contact_number || null)
            .query(`
                INSERT INTO Users 
                    (full_name, email, password, role, university, university_id, contact_number)
                OUTPUT INSERTED.user_id, INSERTED.email, INSERTED.full_name, INSERTED.role
                VALUES 
                    (@full_name, @email, @password, @role, @university, @university_id, @contact_number)
            `);

        const newUser = result.recordset[0];
        sendWelcomeEmail(newUser); // fire-and-forget

        res.status(201).json({
            success: true,
            message: "Registered successfully",
            user: { id: newUser.user_id, email: newUser.email }
        });

    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/*----------------LOGIN---------------*/
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.json({ success: false });

        const result = await pool.request()
            .input("email", sql.NVarChar, email.toLowerCase().trim())
            .query("SELECT * FROM Users WHERE email = @email");

        const user = result.recordset[0];
        if (!user) return res.json({ success: false });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.json({ success: false });

        const token = jwt.sign(
            { id: user.user_id, role: user.role },
            process.env.JWT_SECRET || "secret123",
            { expiresIn: "1d" }
        );

        res.json({
            success: true,
            token,
            user: {
                user_id:  user.user_id,
                name:     user.full_name,
                role:     user.role,
                email:    user.email
            }
        });

    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ success: false });
    }
});

/* ================================================================
   FORGOT PASSWORD — STEP 1
   POST /api/auth/forgot-password/lookup
   Body: { method: "email"|"phone", value: "..." }
   → finds the user, returns masked contact info for confirmation
================================================================ */
router.post("/forgot-password/lookup", async (req, res) => {
    try {
        const { method, value } = req.body;

        if (!method || !value) {
            return res.status(400).json({ success: false, message: "Missing fields" });
        }

        let query, inputKey;
        if (method === "email") {
            query    = "SELECT user_id, full_name, email, contact_number FROM Users WHERE email = @val";
            inputKey = "email";
        } else if (method === "phone") {
            query    = "SELECT user_id, full_name, email, contact_number FROM Users WHERE contact_number = @val";
            inputKey = "phone";
        } else {
            return res.status(400).json({ success: false, message: "Invalid method" });
        }

        const result = await pool.request()
            .input("val", sql.NVarChar, value.trim())
            .query(query);

        const user = result.recordset[0];

        if (!user) {
            // Generic message – don't reveal whether account exists
            return res.json({ success: false, message: "No account found with that detail." });
        }

        // Mask values for display
        const maskedEmail = user.email
            ? user.email.replace(/(.{2}).+(@.+)/, "$1****$2")
            : null;
        const maskedPhone = user.contact_number
            ? user.contact_number.replace(/.(?=.{4})/g, "*")
            : null;

        res.json({
            success: true,
            user_id: user.user_id,
            full_name: user.full_name,
            maskedEmail,
            maskedPhone,
            hasEmail: !!user.email,
            hasPhone: !!user.contact_number
        });

    } catch (err) {
        console.error("Lookup Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* ================================================================
   FORGOT PASSWORD — STEP 2
   POST /api/auth/forgot-password/send-otp
   Body: { user_id, channel: "email"|"phone" }
   → sends OTP to the chosen channel
================================================================ */
router.post("/forgot-password/send-otp", async (req, res) => {
    try {
        const { user_id, channel } = req.body;

        if (!user_id || !channel) {
            return res.status(400).json({ success: false, message: "Missing fields" });
        }

        const result = await pool.request()
            .input("id", sql.Int, user_id)
            .query("SELECT user_id, full_name, email, contact_number FROM Users WHERE user_id = @id");

        const user = result.recordset[0];
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const otp       = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min

        if (channel === "email") {
            if (!user.email) return res.status(400).json({ success: false, message: "No email on record" });
            otpStore.set(`email:${user.email}`, { otp, expiresAt, userId: user.user_id });
            await sendOTPEmail(user.email, otp);

            const masked = user.email.replace(/(.{2}).+(@.+)/, "$1****$2");
            return res.json({ success: true, message: `OTP sent to ${masked}` });

        } else if (channel === "phone") {
            if (!user.contact_number) return res.status(400).json({ success: false, message: "No phone on record" });
            otpStore.set(`phone:${user.contact_number}`, { otp, expiresAt, userId: user.user_id });
            await sendOTPSMS(user.contact_number, otp);

            const masked = user.contact_number.replace(/.(?=.{4})/g, "*");
            return res.json({ success: true, message: `OTP sent to ${masked}` });

        } else {
            return res.status(400).json({ success: false, message: "Invalid channel" });
        }

    } catch (err) {
        console.error("Send OTP Error:", err);
        res.status(500).json({ success: false, message: "Failed to send OTP" });
    }
});

/* ================================================================
   FORGOT PASSWORD — STEP 3
   POST /api/auth/forgot-password/verify-otp
   Body: { user_id, channel, otp }
   → verifies OTP, returns a short-lived reset token
================================================================ */
router.post("/forgot-password/verify-otp", async (req, res) => {
    try {
        const { user_id, channel, otp } = req.body;

        if (!user_id || !channel || !otp) {
            return res.status(400).json({ success: false, message: "Missing fields" });
        }

        // Fetch contact info to build the OTP store key
        const result = await pool.request()
            .input("id", sql.Int, user_id)
            .query("SELECT email, contact_number FROM Users WHERE user_id = @id");

        const user = result.recordset[0];
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const key    = channel === "email" ? `email:${user.email}` : `phone:${user.contact_number}`;
        const record = otpStore.get(key);

        if (!record) {
            return res.json({ success: false, message: "No OTP found. Please request a new one." });
        }
        if (Date.now() > record.expiresAt) {
            otpStore.delete(key);
            return res.json({ success: false, message: "OTP expired. Please request a new one." });
        }
        if (record.otp !== otp.trim()) {
            return res.json({ success: false, message: "Incorrect OTP. Please try again." });
        }

        // OTP valid — delete it and issue a 15-min reset token
        otpStore.delete(key);

        const resetToken = jwt.sign(
            { id: user_id, purpose: "password_reset" },
            process.env.JWT_SECRET || "secret123",
            { expiresIn: "15m" }
        );

        res.json({ success: true, resetToken });

    } catch (err) {
        console.error("Verify OTP Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* ================================================================
   FORGOT PASSWORD — STEP 4
   POST /api/auth/forgot-password/reset
   Body: { resetToken, newPassword }
   → saves the new hashed password
================================================================ */
router.post("/forgot-password/reset", async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;

        if (!resetToken || !newPassword) {
            return res.status(400).json({ success: false, message: "Missing fields" });
        }

        // Validate password strength server-side
        const strongPassword =
            newPassword.length >= 8 &&
            /[A-Z]/.test(newPassword) &&
            /[0-9]/.test(newPassword) &&
            /[^A-Za-z0-9]/.test(newPassword);

        if (!strongPassword) {
            return res.status(400).json({
                success: false,
                message: "Password must be 8+ chars with uppercase, number and symbol."
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET || "secret123");
        } catch {
            return res.status(401).json({ success: false, message: "Reset link expired or invalid." });
        }

        if (decoded.purpose !== "password_reset") {
            return res.status(401).json({ success: false, message: "Invalid token purpose." });
        }

        const hashed = await bcrypt.hash(newPassword, 12);

        await pool.request()
            .input("id",       sql.Int,      decoded.id)
            .input("password", sql.NVarChar, hashed)
            .query("UPDATE Users SET password = @password WHERE user_id = @id");

        res.json({ success: true, message: "Password updated successfully." });

    } catch (err) {
        console.error("Reset Password Error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* ================================================================
   GET USER  (for dashboard)
================================================================ */
router.get("/user", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ message: "No token" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret123");

        const result = await pool.request()
            .input("id", sql.Int, decoded.id)
            .query("SELECT full_name, role, email FROM Users WHERE user_id = @id");

        const user = result.recordset[0];
        res.json({ name: user.full_name, role: user.role, email: user.email });

    } catch (err) {
        console.error("Auth Error:", err);
        res.status(401).json({ message: "Invalid token" });
    }
});

module.exports = router;

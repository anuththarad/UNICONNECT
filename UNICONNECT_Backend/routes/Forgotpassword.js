const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const db      = require('../db');               // adjust path to your DB connection
const { sendOTPEmail } = require('../utils/mailer');

/* ─────────────────────────────────────────────
   HELPER — mask email  e.g.  j***@gmail.com
───────────────────────────────────────────── */
function maskEmail(email) {
  const [local, domain] = email.split('@');
  return local[0] + '***@' + domain;
}

/* ─────────────────────────────────────────────
   HELPER — mask phone  e.g.  +94 7** *** 890
───────────────────────────────────────────── */
function maskPhone(phone) {
  if (!phone) return '';
  const s = phone.replace(/\s/g, '');
  return s.slice(0, 3) + ' 7** *** ' + s.slice(-3);
}

/* ─────────────────────────────────────────────
   POST /api/auth/forgot-password/lookup
   Body: { method: "email"|"phone", value: string }
───────────────────────────────────────────── */
router.post('/lookup', async (req, res) => {
  try {
    const { method, value } = req.body;

    if (!method || !value) {
      return res.status(400).json({ success: false, message: 'Method and value are required.' });
    }

    let user;

    if (method === 'email') {
      [user] = await db.query(
        'SELECT id, full_name, email, contact_number FROM users WHERE email = ? LIMIT 1',
        [value.trim().toLowerCase()]
      );
    } else {
      [user] = await db.query(
        'SELECT id, full_name, email, contact_number FROM users WHERE contact_number = ? LIMIT 1',
        [value.trim()]
      );
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with that detail.' });
    }

    return res.json({
      success:      true,
      user_id:      user.id,
      full_name:    user.full_name,
      hasEmail:     !!user.email,
      hasPhone:     !!user.contact_number,
      maskedEmail:  user.email        ? maskEmail(user.email)        : '',
      maskedPhone:  user.contact_number ? maskPhone(user.contact_number) : '',
    });

  } catch (err) {
    console.error('[lookup]', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

/* ─────────────────────────────────────────────
   POST /api/auth/forgot-password/send-otp
   Body: { user_id: number, channel: "email"|"phone" }
───────────────────────────────────────────── */
router.post('/send-otp', async (req, res) => {
  try {
    const { user_id, channel } = req.body;

    if (!user_id || !channel) {
      return res.status(400).json({ success: false, message: 'user_id and channel are required.' });
    }

    // Generate 6-digit OTP
    const otp     = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry  = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Save OTP to DB
    await db.query(
      'UPDATE users SET otp = ?, otp_expiry = ? WHERE id = ?',
      [otp, expiry, user_id]
    );

    // Fetch user contact info
    const [user] = await db.query(
      'SELECT email, contact_number FROM users WHERE id = ?',
      [user_id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (channel === 'email') {
      if (!user.email) {
        return res.status(400).json({ success: false, message: 'No email on file for this account.' });
      }
      await sendOTPEmail(user.email, otp);
      return res.json({
        success: true,
        message: `OTP sent to ${maskEmail(user.email)}`,
      });
    }

    // channel === 'phone' — add your SMS provider here (Twilio, etc.)
    return res.status(400).json({ success: false, message: 'SMS sending not yet configured.' });

  } catch (err) {
    console.error('[send-otp]', err);
    res.status(500).json({ success: false, message: 'Failed to send OTP. Check your email config.' });
  }
});

/* ─────────────────────────────────────────────
   POST /api/auth/forgot-password/verify-otp
   Body: { user_id: number, channel: string, otp: string }
───────────────────────────────────────────── */
router.post('/verify-otp', async (req, res) => {
  try {
    const { user_id, otp } = req.body;

    if (!user_id || !otp) {
      return res.status(400).json({ success: false, message: 'user_id and otp are required.' });
    }

    const [user] = await db.query(
      'SELECT otp, otp_expiry FROM users WHERE id = ?',
      [user_id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP. Please try again.' });
    }

    if (new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    // OTP valid — generate a secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    await db.query(
      'UPDATE users SET otp = NULL, otp_expiry = NULL, reset_token = ?, reset_token_expiry = ? WHERE id = ?',
      [resetToken, new Date(Date.now() + 15 * 60 * 1000), user_id]
    );

    return res.json({ success: true, resetToken });

  } catch (err) {
    console.error('[verify-otp]', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

/* ─────────────────────────────────────────────
   POST /api/auth/forgot-password/reset
   Body: { resetToken: string, newPassword: string }
───────────────────────────────────────────── */
router.post('/reset', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ success: false, message: 'resetToken and newPassword are required.' });
    }

    // Validate password strength server-side too
    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    ) {
      return res.status(400).json({ success: false, message: 'Password does not meet strength requirements.' });
    }

    const [user] = await db.query(
      'SELECT id, reset_token_expiry FROM users WHERE reset_token = ? LIMIT 1',
      [resetToken]
    );

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    if (new Date() > new Date(user.reset_token_expiry)) {
      return res.status(400).json({ success: false, message: 'Reset token has expired. Please start over.' });
    }

    // Hash the new password — use bcrypt (recommended)
    const bcrypt      = require('bcrypt');
    const hashedPass  = await bcrypt.hash(newPassword, 10);

    await db.query(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
      [hashedPass, user.id]
    );

    return res.json({ success: true, message: 'Password updated successfully.' });

  } catch (err) {
    console.error('[reset]', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

module.exports = router;
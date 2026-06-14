// controllers/notificationController.js
'use strict';

const { getPool }   = require('../db');
const { encrypt, decrypt, hmac } = require('../utils/cryptoUtils');
const { adminAnnouncement }      = require('../services/notificationService');
const { sendSMS }                = require('../services/smsService');

// ─── Utility ────────────────────────────────────────────────

function maskPhone(plain) {
    if (!plain || plain.length < 6) return '****';
    return plain.slice(0, 3) + plain.slice(3, -4).replace(/\d/g, '*') + plain.slice(-4);
}

// ─── NOTIFICATION CRUD ──────────────────────────────────────

exports.getMyNotifications = async (req, res) => {
    try {
        const pool   = await getPool();
        const userId = req.user.user_id;
        const limit  = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = parseInt(req.query.offset) || 0;
        const type   = req.query.type || null;

        let query = `
            SELECT notification_id, title, message, type,
                   ref_type, ref_id, status, sent_sms,
                   sms_status, date_sent, read_at
            FROM   Notification
            WHERE  user_id = @user_id
        `;
        if (type) query += ` AND type = @type `;
        query += ` ORDER BY date_sent DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

        const r = await pool.request()
            .input('user_id', userId)
            .input('type',   type)
            .input('offset', offset)
            .input('limit',  limit)
            .query(query);

        const countR = await pool.request()
            .input('user_id', userId)
            .query(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='unread' THEN 1 ELSE 0 END) AS unread FROM Notification WHERE user_id = @user_id`);

        res.json({
            success:       true,
            notifications: r.recordset,
            total:         countR.recordset[0].total,
            unread:        countR.recordset[0].unread
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const pool = await getPool();
        const r = await pool.request()
            .input('user_id', req.user.user_id)
            .query(`SELECT COUNT(*) AS unread FROM Notification WHERE user_id = @user_id AND status = 'unread'`);
        res.json({ success: true, unread: r.recordset[0].unread });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error' });
    }
};

exports.markRead = async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request()
            .input('id',      parseInt(req.params.id))
            .input('user_id', req.user.user_id)
            .query(`
                UPDATE Notification
                SET status = 'read', read_at = GETDATE()
                WHERE notification_id = @id AND user_id = @user_id
            `);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

exports.markAllRead = async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request()
            .input('user_id', req.user.user_id)
            .query(`
                UPDATE Notification
                SET status = 'read', read_at = GETDATE()
                WHERE user_id = @user_id AND status = 'unread'
            `);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

exports.deleteNotification = async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request()
            .input('id',      parseInt(req.params.id))
            .input('user_id', req.user.user_id)
            .query(`DELETE FROM Notification WHERE notification_id = @id AND user_id = @user_id`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

// ─── PREFERENCES ────────────────────────────────────────────

exports.getPreferences = async (req, res) => {
    try {
        const pool = await getPool();
        let r = await pool.request()
            .input('user_id', req.user.user_id)
            .query(`SELECT * FROM NotificationPreference WHERE user_id = @user_id`);

        if (!r.recordset.length) {
            await pool.request()
                .input('user_id', req.user.user_id)
                .query(`INSERT INTO NotificationPreference (user_id) VALUES (@user_id)`);
            r = await pool.request()
                .input('user_id', req.user.user_id)
                .query(`SELECT * FROM NotificationPreference WHERE user_id = @user_id`);
        }
        res.json({ success: true, preferences: r.recordset[0] });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

exports.updatePreferences = async (req, res) => {
    const ALLOWED = [
        'inapp_event_created','inapp_event_updated','inapp_event_cancelled',
        'inapp_event_reminder','inapp_registration','inapp_volunteer',
        'inapp_profile','inapp_announcements',
        'sms_event_created','sms_event_updated','sms_event_cancelled',
        'sms_event_reminder','sms_registration','sms_volunteer',
        'sms_profile','sms_announcements'
    ];
    try {
        const pool    = await getPool();
        const updates = [];
        const req2    = pool.request().input('user_id', req.user.user_id);

        ALLOWED.forEach(col => {
            if (req.body[col] !== undefined) {
                updates.push(`${col} = @${col}`);
                req2.input(col, req.body[col] ? 1 : 0);
            }
        });

        if (!updates.length) return res.status(400).json({ success: false, message: 'No valid fields' });

        await req2.query(`
            UPDATE NotificationPreference
            SET ${updates.join(', ')}
            WHERE user_id = @user_id
        `);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};

// ─── ADMIN ANNOUNCE ─────────────────────────────────────────

exports.adminAnnounce = async (req, res) => {
    const { title, message, departmentId } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'message required' });
    try {
        await adminAnnouncement({
            title, message, departmentId,
            sentBy: req.user.user_id
        });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};

// ─── CONTACT / PHONE ────────────────────────────────────────

exports.getMyContact = async (req, res) => {
    try {
        const pool = await getPool();
        const r = await pool.request()
            .input('user_id', req.user.user_id)
            .query(`
                SELECT sms_opt_in, verified, verified_at, updated_at,
                       phone_encrypted, phone_iv
                FROM   UserContact
                WHERE  user_id = @user_id
            `);

        if (!r.recordset.length) {
            return res.json({ success: true, contact: null });
        }
        const row = r.recordset[0];
        let masked = null;
        if (row.phone_encrypted && row.phone_iv) {
            try {
                const plain = decrypt({ encrypted: row.phone_encrypted, iv: row.phone_iv });
                masked = maskPhone(plain);
            } catch {}
        }
        res.json({
            success: true,
            contact: {
                phone_masked: masked,
                sms_opt_in:   !!row.sms_opt_in,
                verified:     !!row.verified,
                verified_at:  row.verified_at,
                updated_at:   row.updated_at
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};

exports.saveMyContact = async (req, res) => {
    const { phone, sms_opt_in } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'phone is required' });

    // Basic E.164 validation
    const e164 = /^\+[1-9]\d{6,14}$/;
    if (!e164.test(phone)) {
        return res.status(400).json({ success: false, message: 'Phone must be in E.164 format, e.g. +94771234567' });
    }

    try {
        const pool = await getPool();
        const { encrypted, iv } = encrypt(phone);
        const phoneHmac          = hmac(phone);
        const optIn              = sms_opt_in !== false ? 1 : 0;

        // Check if another user has this number (by HMAC – no decryption needed)
        const dup = await pool.request()
            .input('hmac',    phoneHmac)
            .input('user_id', req.user.user_id)
            .query(`
                SELECT user_id FROM UserContact
                WHERE phone_hmac = @hmac AND user_id <> @user_id
            `);
        if (dup.recordset.length) {
            return res.status(409).json({ success: false, message: 'This phone number is already registered to another account.' });
        }

        const existing = await pool.request()
            .input('user_id', req.user.user_id)
            .query(`SELECT contact_id FROM UserContact WHERE user_id = @user_id`);

        if (existing.recordset.length) {
            await pool.request()
                .input('user_id',         req.user.user_id)
                .input('phone_encrypted', encrypted)
                .input('phone_iv',        iv)
                .input('phone_hmac',      phoneHmac)
                .input('sms_opt_in',      optIn)
                .input('verified',        0)
                .query(`
                    UPDATE UserContact
                    SET phone_encrypted = @phone_encrypted,
                        phone_iv        = @phone_iv,
                        phone_hmac      = @phone_hmac,
                        sms_opt_in      = @sms_opt_in,
                        verified        = @verified,
                        verified_at     = NULL,
                        updated_at      = GETDATE()
                    WHERE user_id = @user_id
                `);
        } else {
            await pool.request()
                .input('user_id',         req.user.user_id)
                .input('phone_encrypted', encrypted)
                .input('phone_iv',        iv)
                .input('phone_hmac',      phoneHmac)
                .input('sms_opt_in',      optIn)
                .query(`
                    INSERT INTO UserContact
                        (user_id, phone_encrypted, phone_iv, phone_hmac, sms_opt_in)
                    VALUES
                        (@user_id, @phone_encrypted, @phone_iv, @phone_hmac, @sms_opt_in)
                `);
        }

     

        res.json({
            success:      true,
            message:      'Phone saved. Please verify to enable SMS notifications.',
            phone_masked: maskPhone(phone)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to save phone' });
    }
};

exports.deleteMyContact = async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request()
            .input('user_id', req.user.user_id)
            .query(`DELETE FROM UserContact WHERE user_id = @user_id`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

// Simple OTP verify (you'd generate & store OTP separately)
exports.verifyPhone = async (req, res) => {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: 'OTP required' });
    try {
        const pool = await getPool();
        // Compare OTP (you'd store hashed OTP in a temp table or Redis)
        // Placeholder: mark as verified
        await pool.request()
            .input('user_id', req.user.user_id)
            .query(`
                UPDATE UserContact
                SET verified = 1, verified_at = GETDATE()
                WHERE user_id = @user_id
            `);
        res.json({ success: true, message: 'Phone verified. SMS notifications are now active.' });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};
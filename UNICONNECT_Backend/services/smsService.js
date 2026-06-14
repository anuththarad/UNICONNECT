// services/smsService.js
// ─────────────────────────────────────────────────────────────
//  Twilio SMS wrapper
//
//  Required .env keys:
//    TWILIO_ACCOUNT_SID
//    TWILIO_AUTH_TOKEN
//    TWILIO_PHONE_NUMBER   – E.164 format, e.g. +15551234567
//    SMS_ENABLED           – set to 'true' to actually send (default false)
// ─────────────────────────────────────────────────────────────

'use strict';

const twilio = require('twilio');

const SMS_ENABLED = process.env.SMS_ENABLED === 'true';

let _client = null;
function getClient() {
    if (!_client) {
        _client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );
    }
    return _client;
}

/**
 * Send a single SMS.
 * @param {string} toNumber  – plaintext E.164 phone, e.g. "+94771234567"
 * @param {string} body      – message text
 * @returns {{ success: boolean, sid?: string, error?: string }}
 */
async function sendSMS(toNumber, body) {
    if (!SMS_ENABLED) {
        console.log(`[SMS DISABLED] To: ${toNumber} | Msg: ${body}`);
        return { success: true, sid: 'DISABLED', skipped: true };
    }

    if (!toNumber || !toNumber.startsWith('+')) {
        return { success: false, error: 'Invalid phone number format (must be E.164)' };
    }

    try {
        const msg = await getClient().messages.create({
            body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to:   toNumber
        });
        return { success: true, sid: msg.sid };
    } catch (err) {
        console.error('[smsService] Twilio error:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Send SMS to multiple recipients.
 * @param {Array<{phone: string, body: string}>} messages
 */
async function sendBulkSMS(messages) {
    const results = await Promise.allSettled(
        messages.map(m => sendSMS(m.phone, m.body))
    );
    return results.map((r, i) => ({
        phone:   messages[i].phone,
        success: r.status === 'fulfilled' ? r.value.success : false,
        detail:  r.status === 'fulfilled' ? r.value : r.reason
    }));
}

module.exports = { sendSMS, sendBulkSMS };
// services/notificationService.js
// ─────────────────────────────────────────────────────────────
//  Central notification dispatcher
//  • Writes to Notification table (in-app)
//  • Optionally sends SMS via Twilio
//  • Respects per-user NotificationPreference
//  • Queues scheduled reminders (NotificationQueue)
// ─────────────────────────────────────────────────────────────

'use strict';

const { getPool } = require('../db');          // your DB helper – adjust path
const { sendSMS }  = require('./smsService');
const { decrypt }  = require('../utils/cryptoUtils');

// ─────────────────────────────────────────────────────────────
//  INTERNAL: write a single notification row
// ─────────────────────────────────────────────────────────────
async function _writeInApp(pool, { userId, title, message, type, refType, refId, createdBy }) {
    await pool.request()
        .input('user_id',    userId)
        .input('title',      title   || 'Notification')
        .input('message',    message)
        .input('type',       type)
        .input('ref_type',   refType || null)
        .input('ref_id',     refId   || null)
        .input('created_by', createdBy || null)
        .query(`
            INSERT INTO Notification
                (user_id, title, message, type, ref_type, ref_id,
                 sent_in_app, sms_status, created_by)
            VALUES
                (@user_id, @title, @message, @type, @ref_type, @ref_id,
                 1, 'skipped', @created_by)
        `);
}

// ─────────────────────────────────────────────────────────────
//  INTERNAL: get user phone (decrypted) if SMS opted-in
// ─────────────────────────────────────────────────────────────
async function _getUserPhone(pool, userId) {
    const result = await pool.request()
        .input('user_id', userId)
        .query(`
            SELECT phone_encrypted, phone_iv, sms_opt_in, verified
            FROM   UserContact
            WHERE  user_id = @user_id
        `);
    const row = result.recordset[0];
    if (!row || !row.sms_opt_in || !row.verified) return null;
    if (!row.phone_encrypted || !row.phone_iv)   return null;
    try {
        return decrypt({ encrypted: row.phone_encrypted, iv: row.phone_iv });
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
//  INTERNAL: get user preferences for a type
// ─────────────────────────────────────────────────────────────
const PREF_MAP = {
    event_created:          { inapp: 'inapp_event_created',   sms: 'sms_event_created'   },
    event_updated:          { inapp: 'inapp_event_updated',   sms: 'sms_event_updated'   },
    event_cancelled:        { inapp: 'inapp_event_cancelled', sms: 'sms_event_cancelled' },
    event_reminder_24h:     { inapp: 'inapp_event_reminder',  sms: 'sms_event_reminder'  },
    event_reminder_1h:      { inapp: 'inapp_event_reminder',  sms: 'sms_event_reminder'  },
    event_full:             { inapp: 'inapp_event_updated',   sms: 'sms_event_updated'   },
    event_slots_low:        { inapp: 'inapp_event_updated',   sms: 'sms_event_updated'   },
    registration_confirmed: { inapp: 'inapp_registration',    sms: 'sms_registration'    },
    registration_cancelled: { inapp: 'inapp_registration',    sms: 'sms_registration'    },
    registration_waitlisted:{ inapp: 'inapp_registration',    sms: 'sms_registration'    },
    volunteer_accepted:     { inapp: 'inapp_volunteer',       sms: 'sms_volunteer'       },
    volunteer_rejected:     { inapp: 'inapp_volunteer',       sms: 'sms_volunteer'       },
    profile_updated:        { inapp: 'inapp_profile',         sms: 'sms_profile'         },
    admin_announcement:     { inapp: 'inapp_announcements',   sms: 'sms_announcements'   },
    general:                { inapp: 'inapp_announcements',   sms: 'sms_announcements'   },
};

async function _getPrefs(pool, userId) {
    const result = await pool.request()
        .input('user_id', userId)
        .query(`SELECT * FROM NotificationPreference WHERE user_id = @user_id`);
    return result.recordset[0] || null;
}

// Auto-create preferences row if missing (all defaults)
async function _ensurePrefs(pool, userId) {
    let prefs = await _getPrefs(pool, userId);
    if (!prefs) {
        await pool.request()
            .input('user_id', userId)
            .query(`
                INSERT INTO NotificationPreference (user_id)
                VALUES (@user_id)
            `);
        prefs = await _getPrefs(pool, userId);
    }
    return prefs;
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC: send a notification to ONE user
// ─────────────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {number}  opts.userId
 * @param {string}  opts.title
 * @param {string}  opts.message
 * @param {string}  opts.type          – must match CHECK constraint
 * @param {string} [opts.refType]      – 'event' | 'registration' | 'volunteer' | 'user'
 * @param {number} [opts.refId]
 * @param {number} [opts.createdBy]    – user_id of actor (null = system)
 * @param {boolean}[opts.forceSMS]     – override pref and send SMS anyway
 */
async function notify(opts) {
    const pool = await getPool();
    const { userId, title, message, type, refType, refId, createdBy, forceSMS } = opts;

    const prefs    = await _ensurePrefs(pool, userId);
    const prefKeys = PREF_MAP[type] || PREF_MAP['general'];

    // ----- In-app -----
    if (forceSMS || prefs[prefKeys.inapp] !== 0) {
        await _writeInApp(pool, { userId, title, message, type, refType, refId, createdBy });
    }

    // ----- SMS -----
    const smsAllowed = forceSMS || prefs[prefKeys.sms];
    if (smsAllowed) {
        const phone = await _getUserPhone(pool, userId);
        if (phone) {
            const { success, sid, error } = await sendSMS(phone, `UniConnect: ${message}`);
            // Update the last-inserted notification row with SMS result
            await pool.request()
                .input('user_id',    userId)
                .input('sms_status', success ? 'sent' : 'failed')
                .input('sms_sid',    sid  || null)
                .query(`
                    UPDATE TOP(1) Notification
                    SET sent_sms   = 1,
                        sms_status = @sms_status,
                        sms_sid    = @sms_sid
                    WHERE user_id = @user_id
                    AND   notification_id = (
                        SELECT MAX(notification_id)
                        FROM Notification
                        WHERE user_id = @user_id
                    )
                `);
            if (!success) console.warn(`[notify] SMS failed for user ${userId}:`, error);
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC: send same notification to MANY users (bulk)
// ─────────────────────────────────────────────────────────────
async function notifyMany(userIds, baseOpts) {
    await Promise.allSettled(
        userIds.map(uid => notify({ ...baseOpts, userId: uid }))
    );
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC: schedule a future notification (queued)
// ─────────────────────────────────────────────────────────────
async function scheduleNotification({ userId, eventId, type, fireAt, payload }) {
    const pool = await getPool();
    // Remove any existing queued entry for same user+event+type
    await pool.request()
        .input('user_id',  userId)
        .input('event_id', eventId || null)
        .input('type',     type)
        .query(`
            UPDATE NotificationQueue
            SET    status = 'cancelled'
            WHERE  user_id  = @user_id
            AND    event_id = @event_id
            AND    type     = @type
            AND    status   = 'pending'
        `);

    await pool.request()
        .input('user_id',  userId)
        .input('event_id', eventId || null)
        .input('type',     type)
        .input('fire_at',  fireAt)
        .input('payload',  JSON.stringify(payload || {}))
        .query(`
            INSERT INTO NotificationQueue (user_id, event_id, type, fire_at, payload)
            VALUES (@user_id, @event_id, @type, @fire_at, @payload)
        `);
}

// Cancel all scheduled reminders for a user+event
async function cancelScheduled({ userId, eventId }) {
    const pool = await getPool();
    await pool.request()
        .input('user_id',  userId)
        .input('event_id', eventId)
        .query(`
            UPDATE NotificationQueue
            SET status = 'cancelled'
            WHERE user_id  = @user_id
            AND   event_id = @event_id
            AND   status   = 'pending'
        `);
}

// Cancel ALL scheduled reminders for an event (e.g. event cancelled)
async function cancelAllScheduledForEvent(eventId) {
    const pool = await getPool();
    await pool.request()
        .input('event_id', eventId)
        .query(`
            UPDATE NotificationQueue
            SET status = 'cancelled'
            WHERE event_id = @event_id
            AND   status   = 'pending'
        `);
}

// ─────────────────────────────────────────────────────────────
//  HIGH-LEVEL TRIGGER FUNCTIONS
//  (Called from route controllers / event handlers)
// ─────────────────────────────────────────────────────────────

/**
 * Triggered when an organizer creates a new event.
 * Notifies:
 *   - All users in the same department
 *   - If allow_other_departments=1, all students campus-wide
 */
async function onEventCreated(event, creatorId) {
    const pool = await getPool();
    const { event_id, title, venue, event_date, department_id, allow_other_departments } = event;

    const dateStr = String(event_date).split('T')[0];

    // Get target user IDs
    let query = `
        SELECT u.user_id
        FROM   [User]      u
        JOIN   Department  d ON d.department_id = u.department_id
        WHERE  u.role = 'student'
        AND    u.user_id <> @creator_id
    `;
    if (!allow_other_departments) {
        query += ` AND u.department_id = @dept_id`;
    }

    const result = await pool.request()
        .input('creator_id', creatorId)
        .input('dept_id',    department_id || 0)
        .query(query);

    const userIds = result.recordset.map(r => r.user_id);
    if (!userIds.length) return;

    const scope = allow_other_departments ? 'Open to all students on campus!' : 'Open to your department.';

    await notifyMany(userIds, {
        title:   `New Event: ${title}`,
        message: `A new event "${title}" has been scheduled on ${dateStr} at ${venue || 'TBA'}. ${scope}`,
        type:    'event_created',
        refType: 'event',
        refId:   event_id,
        createdBy: creatorId
    });
}

/**
 * Triggered when an organizer updates event details.
 * Notifies all registered participants.
 */
async function onEventUpdated(eventId, changes, updatedBy) {
    const pool = await getPool();

    const evResult = await pool.request()
        .input('event_id', eventId)
        .query(`SELECT title, venue, event_date FROM Event WHERE event_id = @event_id`);
    const ev = evResult.recordset[0];
    if (!ev) return;

    const regResult = await pool.request()
        .input('event_id', eventId)
        .query(`
            SELECT DISTINCT user_id
            FROM   Registration
            WHERE  event_id = @event_id
            AND    status NOT IN ('cancelled')
        `);
    const userIds = regResult.recordset.map(r => r.user_id);
    if (!userIds.length) return;

    const changeList = Object.keys(changes).join(', ');

    await notifyMany(userIds, {
        title:   `Event Updated: ${ev.title}`,
        message: `The event "${ev.title}" has been updated (${changeList} changed). Please check the latest details.`,
        type:    'event_updated',
        refType: 'event',
        refId:   eventId,
        createdBy: updatedBy
    });
}

/**
 * Triggered when an event is cancelled.
 */
async function onEventCancelled(eventId, reason, cancelledBy) {
    const pool = await getPool();

    const evResult = await pool.request()
        .input('event_id', eventId)
        .query(`SELECT title FROM Event WHERE event_id = @event_id`);
    const ev = evResult.recordset[0];
    if (!ev) return;

    const regResult = await pool.request()
        .input('event_id', eventId)
        .query(`
            SELECT DISTINCT user_id
            FROM   Registration
            WHERE  event_id = @event_id
        `);
    const userIds = regResult.recordset.map(r => r.user_id);

    const msg = reason
        ? `"${ev.title}" has been cancelled. Reason: ${reason}`
        : `"${ev.title}" has been cancelled by the organiser.`;

    await notifyMany(userIds, {
        title:   `Event Cancelled: ${ev.title}`,
        message: msg,
        type:    'event_cancelled',
        refType: 'event',
        refId:   eventId,
        createdBy: cancelledBy
    });

    // Cancel all pending reminders for this event
    await cancelAllScheduledForEvent(eventId);
}

/**
 * Triggered when a registration is confirmed.
 * Also schedules 24h and 1h reminders.
 */
async function onRegistrationConfirmed(registration) {
    const { registration_id, user_id, event_id } = registration;
    const pool = await getPool();

    const evResult = await pool.request()
        .input('event_id', event_id)
        .query(`SELECT title, venue, event_date, start_time FROM Event WHERE event_id = @event_id`);
    const ev = evResult.recordset[0];
    if (!ev) return;

    const dateStr = String(ev.event_date).split('T')[0];

    await notify({
        userId:  user_id,
        title:   `Registered: ${ev.title}`,
        message: `You're registered for "${ev.title}" on ${dateStr} at ${ev.venue || 'TBA'}. See you there! 🎉`,
        type:    'registration_confirmed',
        refType: 'registration',
        refId:   registration_id
    });

    // Schedule reminders
    const eventDateTime = new Date(`${dateStr}T${ev.start_time || '09:00:00'}`);
    const now = new Date();

    const rem24 = new Date(eventDateTime.getTime() - 24 * 60 * 60 * 1000);
    const rem1  = new Date(eventDateTime.getTime() - 1  * 60 * 60 * 1000);

    if (rem24 > now) {
        await scheduleNotification({
            userId:  user_id,
            eventId: event_id,
            type:    'event_reminder_24h',
            fireAt:  rem24,
            payload: { title: ev.title, venue: ev.venue, event_date: dateStr, start_time: ev.start_time }
        });
    }
    if (rem1 > now) {
        await scheduleNotification({
            userId:  user_id,
            eventId: event_id,
            type:    'event_reminder_1h',
            fireAt:  rem1,
            payload: { title: ev.title, venue: ev.venue, event_date: dateStr, start_time: ev.start_time }
        });
    }
}

/**
 * Triggered when a registration is cancelled (by user or organizer).
 */
async function onRegistrationCancelled(registration, cancelledBy) {
    const { registration_id, user_id, event_id } = registration;
    const pool = await getPool();

    const evResult = await pool.request()
        .input('event_id', event_id)
        .query(`SELECT title FROM Event WHERE event_id = @event_id`);
    const ev = evResult.recordset[0];
    if (!ev) return;

    const byOrg = cancelledBy && cancelledBy !== user_id;
    const msg = byOrg
        ? `Your registration for "${ev.title}" was cancelled by the organiser.`
        : `Your registration for "${ev.title}" has been cancelled.`;

    await notify({
        userId:  user_id,
        title:   `Registration Cancelled`,
        message: msg,
        type:    'registration_cancelled',
        refType: 'registration',
        refId:   registration_id,
        createdBy: cancelledBy
    });

    await cancelScheduled({ userId: user_id, eventId: event_id });
}

/**
 * Triggered when event hits max capacity.
 */
async function onEventFull(eventId) {
    const pool = await getPool();
    const evResult = await pool.request()
        .input('event_id', eventId)
        .query(`SELECT organizer_id, title FROM Event WHERE event_id = @event_id`);
    const ev = evResult.recordset[0];
    if (!ev) return;

    await notify({
        userId:  ev.organizer_id,
        title:   `Event Full: ${ev.title}`,
        message: `"${ev.title}" has reached maximum capacity. New registrations are closed.`,
        type:    'event_full',
        refType: 'event',
        refId:   eventId
    });
}

/**
 * Triggered when slots fall below threshold (default: 10 remaining).
 */
async function onEventSlotsLow(eventId, remainingSlots) {
    const pool = await getPool();
    const evResult = await pool.request()
        .input('event_id', eventId)
        .query(`SELECT organizer_id, title FROM Event WHERE event_id = @event_id`);
    const ev = evResult.recordset[0];
    if (!ev) return;

    await notify({
        userId:  ev.organizer_id,
        title:   `Low Slots: ${ev.title}`,
        message: `Only ${remainingSlots} spots remaining for "${ev.title}". Act now to manage capacity.`,
        type:    'event_slots_low',
        refType: 'event',
        refId:   eventId
    });
}

/**
 * Triggered when a volunteer application is accepted/rejected.
 */
async function onVolunteerStatus(application, accepted) {
    const { volunteer_id, user_id, event_id } = application;
    const pool = await getPool();

    const evResult = await pool.request()
        .input('event_id', event_id)
        .query(`SELECT title FROM Event WHERE event_id = @event_id`);
    const ev = evResult.recordset[0];
    if (!ev) return;

    const msg = accepted
        ? `Great news! Your volunteer application for "${ev.title}" has been accepted. 🙌`
        : `Your volunteer application for "${ev.title}" was not accepted this time. Keep an eye out for future opportunities.`;

    await notify({
        userId:  user_id,
        title:   accepted ? 'Volunteer Application Accepted' : 'Volunteer Application Update',
        message: msg,
        type:    accepted ? 'volunteer_accepted' : 'volunteer_rejected',
        refType: 'volunteer',
        refId:   volunteer_id
    });
}

/**
 * Triggered when a user updates their profile.
 */
async function onProfileUpdated(userId, changedFields) {
    const fieldList = Array.isArray(changedFields) ? changedFields.join(', ') : changedFields;
    await notify({
        userId,
        title:   'Profile Updated',
        message: `Your profile has been updated (${fieldList}). If you didn't make this change, contact support immediately.`,
        type:    'profile_updated',
        refType: 'user',
        refId:   userId
    });
}

/**
 * Admin broadcast to all students (or a specific department).
 */
async function adminAnnouncement({ message, title, departmentId, sentBy }) {
    const pool = await getPool();

    let q = `SELECT user_id FROM [User] WHERE role = 'student'`;
    if (departmentId) q += ` AND department_id = ${parseInt(departmentId)}`;

    const result = await pool.request().query(q);
    const userIds = result.recordset.map(r => r.user_id);

    await notifyMany(userIds, {
        title:     title || 'Announcement',
        message,
        type:      'admin_announcement',
        createdBy: sentBy
    });
}

// ─────────────────────────────────────────────────────────────

module.exports = {
    notify,
    notifyMany,
    scheduleNotification,
    cancelScheduled,
    cancelAllScheduledForEvent,

    // High-level triggers
    onEventCreated,
    onEventUpdated,
    onEventCancelled,
    onRegistrationConfirmed,
    onRegistrationCancelled,
    onEventFull,
    onEventSlotsLow,
    onVolunteerStatus,
    onProfileUpdated,
    adminAnnouncement
};
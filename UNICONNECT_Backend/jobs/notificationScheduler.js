// jobs/notificationScheduler.js
// ─────────────────────────────────────────────────────────────
//  Cron job – runs every minute, fires queued notifications
//  that have reached their fire_at timestamp.
//
//  Usage: require this file once at app startup, e.g.
//    require('./jobs/notificationScheduler');
//
//  Requires: npm install node-cron
// ─────────────────────────────────────────────────────────────

'use strict';

const cron  = require('node-cron');
const { getPool } = require('../db');
const { notify }  = require('../services/notificationService');

const MAX_ATTEMPTS = 3;

async function processQueue() {
    let pool;
    try {
        pool = await getPool();
    } catch (e) {
        console.error('[scheduler] DB unavailable:', e.message);
        return;
    }

    // Grab all due rows (fire_at <= now, status=pending, attempts < MAX)
    const result = await pool.request()
        .query(`
            SELECT TOP 50
                   queue_id, user_id, event_id, type, payload, attempts
            FROM   NotificationQueue
            WHERE  status   = 'pending'
            AND    fire_at  <= GETDATE()
            AND    attempts <  ${MAX_ATTEMPTS}
            ORDER  BY fire_at ASC
        `);

    const rows = result.recordset;
    if (!rows.length) return;

    console.log(`[scheduler] Processing ${rows.length} queued notification(s)…`);

    for (const row of rows) {
        let payload = {};
        try { payload = JSON.parse(row.payload || '{}'); } catch {}

        // Mark as in-progress (prevent double-fire)
        await pool.request()
            .input('queue_id', row.queue_id)
            .query(`
                UPDATE NotificationQueue
                SET    attempts      = attempts + 1,
                       last_attempt  = GETDATE()
                WHERE  queue_id = @queue_id
            `);

        try {
            let title, message;

            if (row.type === 'event_reminder_24h') {
                title   = `Reminder: "${payload.title}" is tomorrow!`;
                message = `Don't forget – "${payload.title}" is tomorrow at ${payload.start_time || 'TBA'}, ${payload.venue || ''}. See you there! 📅`;
            } else if (row.type === 'event_reminder_1h') {
                title   = `Starting Soon: "${payload.title}"`;
                message = `"${payload.title}" starts in 1 hour at ${payload.venue || 'TBA'}. Get ready! ⏰`;
            } else {
                title   = payload.title   || 'Event Reminder';
                message = payload.message || 'You have an upcoming event.';
            }

            await notify({
                userId:  row.user_id,
                title,
                message,
                type:    row.type,
                refType: 'event',
                refId:   row.event_id
            });

            // Mark sent
            await pool.request()
                .input('queue_id', row.queue_id)
                .query(`UPDATE NotificationQueue SET status = 'sent' WHERE queue_id = @queue_id`);

        } catch (err) {
            console.error(`[scheduler] Failed queue_id=${row.queue_id}:`, err.message);

            const newStatus = row.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'pending';
            await pool.request()
                .input('queue_id', row.queue_id)
                .input('status',   newStatus)
                .query(`UPDATE NotificationQueue SET status = @status WHERE queue_id = @queue_id`);
        }
    }
}

// Run every minute
cron.schedule('* * * * *', () => {
    processQueue().catch(err => console.error('[scheduler] Unhandled:', err));
});

console.log('[scheduler] Notification scheduler started (every 1 min).');

module.exports = { processQueue };
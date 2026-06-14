// routes/notifications.js
const express          = require("express");
const router           = express.Router();
const sql              = require("mssql");
const { sendOTPEmail } = require("../utils/mailer");

/* ─── helper: get connection pool ─────────────────────────────────────────── */
async function getPool() {
  try {
    return await sql.connect();
  } catch (e) {
    const config = {
      server:   process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT) || 1433,
      database: process.env.DB_NAME,
      user:     process.env.DB_USER,
      password: process.env.DB_PASS,
      options: {
        encrypt:                false,
        trustServerCertificate: true
      }
    };
    return await sql.connect(config);
  }
}

/* =============================================================================
   1.  GET /api/notifications/user/:userId
       Fetch all notifications for a specific user, newest first.
============================================================================= */
router.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId || isNaN(parseInt(userId))) {
    return res.status(400).json({ success: false, message: "Valid userId is required." });
  }

  try {
    const pool   = await getPool();
    const result = await pool.request()
      .input("userId", sql.Int, parseInt(userId))
      .query(`
        SELECT
          n.notification_id,
          n.user_id,
          n.message,
          n.type,
          n.event_id,
          n.is_read,
          n.created_at,
          e.title    AS event_title,
          e.venue    AS location,
          e.organizer_id AS event_organizer_id
        FROM dbo.Notifications n
        LEFT JOIN dbo.Event e ON e.event_id = n.event_id
        WHERE n.user_id = @userId
        ORDER BY n.created_at DESC
      `);

    console.log(`[notifications] user ${userId} -> ${result.recordset.length} rows`);
    res.json(result.recordset);
  } catch (err) {
    console.error("GET /notifications/user/:userId error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =============================================================================
   2.  POST /api/notifications
       Create a new notification and fire-and-forget an email to the user.
       Body: { user_id, message, type?, event_id? }
============================================================================= */
router.post("/", async (req, res) => {
  const {
    user_id,
    message,
    type     = "general",
    event_id = null
  } = req.body;

  if (!user_id || !message) {
    return res.status(400).json({ success: false, message: "user_id and message are required." });
  }

  try {
    const pool = await getPool();

    const insertResult = await pool.request()
      .input("userId",  sql.Int,               user_id)
      .input("message", sql.NVarChar(sql.MAX),  message)
      .input("type",    sql.VarChar(50),        type)
      .input("eventId", sql.Int,               event_id)
      .query(`
        INSERT INTO dbo.Notifications (user_id, message, type, event_id, is_read, created_at)
        OUTPUT INSERTED.notification_id
        VALUES (@userId, @message, @type, @eventId, 0, GETDATE())
      `);

    const notificationId = insertResult.recordset[0].notification_id;

    const userResult = await pool.request()
      .input("userId", sql.Int, user_id)
      .query("SELECT email, full_name FROM dbo.Users WHERE user_id = @userId");

    if (userResult.recordset.length > 0) {
      const { email, full_name } = userResult.recordset[0];

      let eventTitle = "your event";
      if (event_id) {
        const evResult = await pool.request()
          .input("eventId", sql.Int, event_id)
          .query("SELECT title FROM dbo.Event WHERE event_id = @eventId");
        if (evResult.recordset.length > 0) eventTitle = evResult.recordset[0].title;
      }

      if (email) {
        const subject = buildSubject(type, eventTitle);
        const html    = buildEmailHTML(full_name || "User", message, eventTitle, type);
        sendOTPEmail(email, subject, html).catch(err =>
          console.error("Email send failed:", err.message)
        );
      }
    }

    res.json({ success: true, notification_id: notificationId });
  } catch (err) {
    console.error("POST /notifications error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =============================================================================
   3.  PATCH /api/notifications/read-all
       Mark ALL notifications as read for a user.
       Body: { user_id }
       NOTE: This route MUST be registered before /:id routes.
============================================================================= */
router.patch("/read-all", async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ success: false, message: "user_id is required." });
  }
  try {
    const pool = await getPool();
    await pool.request()
      .input("userId", sql.Int, user_id)
      .query("UPDATE dbo.Notifications SET is_read = 1 WHERE user_id = @userId AND is_read = 0");
    res.json({ success: true });
  } catch (err) {
    console.error("PATCH /notifications/read-all error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =============================================================================
   4.  GET /api/notifications/unread-count/:userId
       Returns just the unread count — useful for polling badge numbers.
       NOTE: must be registered before /:id routes too (":id" would otherwise
       try to match "unread-count" as an id).
============================================================================= */
router.get("/unread-count/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const pool   = await getPool();
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT COUNT(*) AS unread_count
        FROM dbo.Notifications
        WHERE user_id = @userId AND is_read = 0
      `);
    res.json({ unread_count: result.recordset[0].unread_count });
  } catch (err) {
    console.error("GET /notifications/unread-count error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =============================================================================
   5.  GET /api/notifications/:id/thread
       Returns the "conversation" for a volunteer_message / participant_reply
       notification, reconstructed from dbo.Notifications — no schema change.

       How it works:
       - We look up the notification to find which user (the participant)
         and which event this thread belongs to.
       - We then pull every Notifications row belonging to THAT SAME USER
         for THAT SAME EVENT where type IN ('volunteer_message','participant_reply'),
         ordered by created_at.
       - type = 'volunteer_message'  -> from the organizer  (sender: organizer)
       - type = 'participant_reply'  -> the participant's own message
                                         (a self-copy is inserted on reply, see below)
============================================================================= */
router.get("/:id/thread", async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ success: false, message: "Invalid notification id." });
  }

  try {
    const pool = await getPool();

    // 1. Find the anchor notification -> gives us user_id (participant) + event_id
    const anchor = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT notification_id, user_id, event_id, type, message, created_at
        FROM dbo.Notifications
        WHERE notification_id = @id
      `);

    if (anchor.recordset.length === 0) {
      return res.json({ messages: [] });
    }

    const { user_id: participantId, event_id: eventId } = anchor.recordset[0];

    if (!eventId) {
      // No event context — just return the single notification as the only message
      const single = anchor.recordset[0];
      return res.json({
        messages: [{
          sender:      "organizer",
          sender_name: "Organizer",
          message:     single.message,
          created_at:  single.created_at
        }]
      });
    }

    // 2. Pull the full thread for this participant + event
    const threadResult = await pool.request()
      .input("userId",  sql.Int, participantId)
      .input("eventId", sql.Int, eventId)
      .query(`
        SELECT notification_id, message, type, created_at
        FROM dbo.Notifications
        WHERE user_id = @userId
          AND event_id = @eventId
          AND type IN ('volunteer_message','participant_reply')
        ORDER BY created_at ASC
      `);

    // 3. Get the organizer's display name (for "from them" labels)
    let organizerName = "Organizer";
    const evResult = await pool.request()
      .input("eventId", sql.Int, eventId)
      .query(`
        SELECT u.full_name
        FROM dbo.Event e
        JOIN dbo.Users u ON u.user_id = e.organizer_id
        WHERE e.event_id = @eventId
      `);
    if (evResult.recordset.length > 0 && evResult.recordset[0].full_name) {
      organizerName = evResult.recordset[0].full_name;
    }

    const messages = threadResult.recordset.map(row => {
      const fromOrganizer = row.type === "volunteer_message";
      return {
        notification_id: row.notification_id,
        sender:          fromOrganizer ? "organizer" : "participant",
        sender_name:      fromOrganizer ? organizerName : "You",
        message:          row.message,
        created_at:       row.created_at
      };
    });

    res.json({ messages });
  } catch (err) {
    console.error("GET /notifications/:id/thread error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =============================================================================
   6.  POST /api/notifications/:id/reply
       Participant replies inside a notification thread.
       Body: { sender_id, sender_name, message }

       We do TWO inserts (no schema change required):
       a) A notification to the EVENT ORGANIZER (type='participant_reply')
          so they see it on their notifications page.
       b) A self-copy notification to the PARTICIPANT THEMSELVES
          (type='participant_reply', is_read=1) so that when /thread is
          re-queried for this user+event, their own sent message shows up
          in the conversation too.
============================================================================= */
router.post("/:id/reply", async (req, res) => {
  const { id } = req.params;
  const { sender_id, sender_name, message } = req.body;

  if (isNaN(parseInt(id))) {
    return res.status(400).json({ success: false, message: "Invalid notification id." });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: "message is required." });
  }

  try {
    const pool = await getPool();

    // 1. Find the anchor notification -> participant user_id + event_id
    const anchor = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT user_id, event_id
        FROM dbo.Notifications
        WHERE notification_id = @id
      `);

    if (anchor.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }

    const { user_id: participantId, event_id: eventId } = anchor.recordset[0];
    const replySenderId = sender_id || participantId;
    const displayName   = sender_name || "Participant";

    // 2. Look up organizer for this event
    let organizerId = null;
    if (eventId) {
      const evResult = await pool.request()
        .input("eventId", sql.Int, eventId)
        .query("SELECT organizer_id FROM dbo.Event WHERE event_id = @eventId");
      if (evResult.recordset.length > 0) organizerId = evResult.recordset[0].organizer_id;
    }

    // 3a. Notify the organizer
    if (organizerId) {
      await pool.request()
        .input("userId",  sql.Int, organizerId)
        .input("message", sql.NVarChar(sql.MAX), `💬 Reply from ${displayName}: "${message}"`)
        .input("type",    sql.VarChar(50), "participant_reply")
        .input("eventId", sql.Int, eventId)
        .query(`
          INSERT INTO dbo.Notifications (user_id, message, type, event_id, is_read, created_at)
          VALUES (@userId, @message, @type, @eventId, 0, GETDATE())
        `);
    }

    // 3b. Self-copy so the participant's own sent message appears in their thread
    let selfCopyId = null;
    if (eventId) {
      const selfInsert = await pool.request()
        .input("userId",  sql.Int, participantId)
        .input("message", sql.NVarChar(sql.MAX), message)
        .input("type",    sql.VarChar(50), "participant_reply")
        .input("eventId", sql.Int, eventId)
        .query(`
          INSERT INTO dbo.Notifications (user_id, message, type, event_id, is_read, created_at)
          OUTPUT INSERTED.notification_id
          VALUES (@userId, @message, @type, @eventId, 1, GETDATE())
        `);
      selfCopyId = selfInsert.recordset[0].notification_id;
    }

    res.json({ success: true, notification_id: selfCopyId });
  } catch (err) {
    console.error("POST /notifications/:id/reply error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =============================================================================
   7.  PATCH /api/notifications/:id/read
       Mark a single notification as read.
============================================================================= */
router.patch("/:id/read", async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ success: false, message: "Invalid notification id." });
  }
  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.Int, id)
      .query("UPDATE dbo.Notifications SET is_read = 1 WHERE notification_id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error("PATCH /notifications/:id/read error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =============================================================================
   8.  DELETE /api/notifications/:id
       Permanently delete a single notification.
============================================================================= */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ success: false, message: "Invalid notification id." });
  }
  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM dbo.Notifications WHERE notification_id = @id");
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /notifications/:id error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =============================================================================
   EMAIL HELPERS
============================================================================= */
function buildSubject(type, eventTitle) {
  const map = {
    registration_confirmed:  `✅ Registration confirmed — ${eventTitle}`,
    registration_cancelled:  `Registration cancelled — ${eventTitle}`,
    registration_pending:    `⏳ Registration pending — ${eventTitle}`,
    volunteer_applied:       `📋 Volunteer application received — ${eventTitle}`,
    volunteer_approved:      `🎉 You're approved as a volunteer — ${eventTitle}`,
    volunteer_rejected:      `Volunteer application update — ${eventTitle}`,
    volunteer_task_updated:  `📋 Your volunteer task was updated — ${eventTitle}`,
    payment_confirmed:       `💳 Payment confirmed — ${eventTitle}`,
    payment_failed:          `⚠️ Payment failed — ${eventTitle}`,
    payment_pending:         `⏳ Payment pending review — ${eventTitle}`,
    feedback_received:       `⭐ New feedback received — ${eventTitle}`,
    event_reminder:          `🔔 Reminder: ${eventTitle} is coming up`,
    event_cancelled:         `Event cancelled — ${eventTitle}`,
  };
  return map[type] || `UniConnect Notification — ${eventTitle}`;
}

function buildEmailHTML(name, message, eventTitle, type) {
  const colorMap = {
    registration_confirmed:  "#10b981",
    registration_cancelled:  "#ef4444",
    registration_pending:    "#f59e0b",
    volunteer_applied:       "#8b5cf6",
    volunteer_approved:      "#10b981",
    volunteer_rejected:      "#ef4444",
    volunteer_task_updated:  "#f59e0b",
    payment_confirmed:       "#10b981",
    payment_failed:          "#ef4444",
    payment_pending:         "#f59e0b",
    feedback_received:       "#f59e0b",
    event_reminder:          "#3b82f6",
    event_cancelled:         "#ef4444",
  };

  const emojiMap = {
    registration_confirmed:  "✅",
    registration_cancelled:  "❌",
    registration_pending:    "⏳",
    volunteer_applied:       "📋",
    volunteer_approved:      "🎉",
    volunteer_rejected:      "📋",
    volunteer_task_updated:  "📝",
    payment_confirmed:       "💳",
    payment_failed:          "⚠️",
    payment_pending:         "⏳",
    feedback_received:       "⭐",
    event_reminder:          "🔔",
    event_cancelled:         "📢",
  };

  const accentColor = colorMap[type] || "#3b82f6";
  const emoji       = emojiMap[type]  || "🔔";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:20px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0d0934,#1e3a8a);padding:32px;text-align:center;">
            <div style="font-size:40px;margin-bottom:8px;">${emoji}</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;">UniConnect</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,.7);font-size:13px;">${eventTitle}</p>
          </td>
        </tr>
        <tr><td style="height:4px;background:${accentColor};"></td></tr>
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 8px;font-size:16px;color:#1e293b;">Hi <strong>${name}</strong>,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#334155;line-height:1.75;">${message}</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="http://localhost:3000/OrganizerNotifications.html"
                 style="display:inline-block;background:linear-gradient(135deg,#0d0934,#1e3a8a);
                        color:#ffffff;text-decoration:none;padding:14px 36px;
                        border-radius:12px;font-size:14px;font-weight:700;">
                View in Dashboard →
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 36px 28px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
              UniConnect · University Event Management Platform<br>
              This is an automated message — please do not reply.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = router;
const express = require("express");
const router  = express.Router();
const sql     = require("mssql");
const pool    = require("../db");

/*
  ============================================================
  CHAT via dbo.Notifications (no schema changes needed)
  ============================================================

  How messages are stored in Notifications:
    user_id   = the RECIPIENT of the message
    message   = "[SenderName]: actual message text"
    type      = "chat_msg_from_{sender_user_id}"
    event_id  = the event this chat belongs to
    is_read   = 0 (unread) / 1 (read)
    created_at = when it was sent

  This lets volunteers also see organizer messages as
  normal notifications on their dashboard automatically.
  ============================================================
*/

/* ── pack / unpack sender name from message text ── */
function packMessage(senderName, text) {
  const safeName = String(senderName || "User").replace(/[\[\]]/g, "");
  return `[${safeName}]: ${text}`;
}

function unpackMessage(raw) {
  const match = String(raw || "").match(/^\[(.+?)\]: ([\s\S]*)$/);
  if (match) {
    return { sender_name: match[1], text: match[2] };
  }
  return { sender_name: "Unknown", text: raw || "" };
}

/* ── extract sender_id from type string ── */
function senderIdFromType(type) {
  const match = String(type || "").match(/^chat_msg_from_(\d+)$/);
  return match ? Number(match[1]) : null;
}

/* ============================================================
   POST /api/messages
   Send a message from organizer to volunteer (or vice versa)

   Body: { sender_id, sender_name, recipient_id, event_id, text }
============================================================ */
router.post("/", async (req, res) => {
  try {
    const { sender_id, sender_name, recipient_id, event_id, text } = req.body;

    if (!sender_id || !recipient_id || !text) {
      return res.status(400).json({
        success: false,
        message: "sender_id, recipient_id and text are required."
      });
    }

    const conn     = await pool;
    const packed   = packMessage(sender_name, text);
    const msgType  = `chat_msg_from_${sender_id}`;
    const evId     = event_id ? Number(event_id) : null;

    await conn.request()
      .input("user_id",  sql.Int,              Number(recipient_id))
      .input("message",  sql.NVarChar(sql.MAX), packed)
      .input("type",     sql.VarChar(50),       msgType)
      .input("event_id", sql.Int,              evId)
      .query(`
        INSERT INTO Notifications (user_id, message, type, event_id, is_read, created_at)
        VALUES (@user_id, @message, @type, @event_id, 0, GETDATE())
      `);

    res.json({ success: true, message: "Message sent." });

  } catch (err) {
    console.error("POST /messages error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

/* ============================================================
   GET /api/messages/thread/:event_id/:org_id/:vol_id
   Fetch the full two-way conversation between organizer
   and volunteer for a specific event, in time order.
============================================================ */
router.get("/thread/:event_id/:org_id/:vol_id", async (req, res) => {
  try {
    const event_id = Number(req.params.event_id);
    const org_id   = Number(req.params.org_id);
    const vol_id   = Number(req.params.vol_id);

    const orgType = `chat_msg_from_${org_id}`;
    const volType = `chat_msg_from_${vol_id}`;

    const conn = await pool;

    /*
      Fetch:
        - messages sent BY organizer TO volunteer  (recipient=vol_id, type=orgType)
        - messages sent BY volunteer TO organizer  (recipient=org_id, type=volType)
    */
    const result = await conn.request()
      .input("event_id", sql.Int,        event_id)
      .input("org_id",   sql.Int,        org_id)
      .input("vol_id",   sql.Int,        vol_id)
      .input("org_type", sql.VarChar(50), orgType)
      .input("vol_type", sql.VarChar(50), volType)
      .query(`
        SELECT
          notification_id  AS message_id,
          user_id          AS recipient_id,
          message          AS raw_message,
          type,
          event_id,
          is_read,
          created_at,
          CASE
            WHEN type = @org_type THEN @org_id
            WHEN type = @vol_type THEN @vol_id
            ELSE NULL
          END AS sender_id
        FROM Notifications
        WHERE event_id = @event_id
          AND type IN (@org_type, @vol_type)
          AND (
            (type = @org_type AND user_id = @vol_id)
            OR
            (type = @vol_type AND user_id = @org_id)
          )
        ORDER BY created_at ASC
      `);

    /* Unpack "[Name]: text" back into clean fields */
    const messages = result.recordset.map(row => {
      const { sender_name, text } = unpackMessage(row.raw_message);
      return {
        message_id:   row.message_id,
        sender_id:    row.sender_id,
        recipient_id: row.recipient_id,
        sender_name,
        text,
        event_id:     row.event_id,
        is_read:      row.is_read,
        created_at:   row.created_at
      };
    });

    res.json({ success: true, data: messages });

  } catch (err) {
    console.error("GET /messages/thread error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

/* ============================================================
   GET /api/messages/unread/:user_id
   Get count of unread chat messages sent TO this user.
   Used to show badge dots on volunteer chat buttons.
============================================================ */
router.get("/unread/:user_id", async (req, res) => {
  try {
    const user_id = Number(req.params.user_id);
    const conn    = await pool;

    const result = await conn.request()
      .input("user_id", sql.Int, user_id)
      .query(`
        SELECT
          notification_id AS message_id,
          user_id,
          event_id,
          type,
          message         AS raw_message,
          is_read,
          created_at
        FROM Notifications
        WHERE user_id = @user_id
          AND is_read = 0
          AND type LIKE 'chat_msg_from_%'
        ORDER BY created_at DESC
      `);

    /* Attach sender_id extracted from type string */
    const data = result.recordset.map(row => ({
      message_id: row.message_id,
      sender_id:  senderIdFromType(row.type),
      event_id:   row.event_id,
      is_read:    row.is_read,
      created_at: row.created_at
    }));

    res.json({ success: true, data });

  } catch (err) {
    console.error("GET /messages/unread error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

/* ============================================================
   PATCH /api/messages/read-thread/:event_id/:user_id
   Mark all chat messages in this event thread as read
   for the given recipient (call this when organizer opens chat).
============================================================ */
router.patch("/read-thread/:event_id/:user_id", async (req, res) => {
  try {
    const event_id = Number(req.params.event_id);
    const user_id  = Number(req.params.user_id);
    const conn     = await pool;

    await conn.request()
      .input("event_id", sql.Int, event_id)
      .input("user_id",  sql.Int, user_id)
      .query(`
        UPDATE Notifications
        SET    is_read = 1
        WHERE  event_id = @event_id
          AND  user_id  = @user_id
          AND  is_read  = 0
          AND  type LIKE 'chat_msg_from_%'
      `);

    res.json({ success: true, message: "Messages marked as read." });

  } catch (err) {
    console.error("PATCH /messages/read-thread error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;
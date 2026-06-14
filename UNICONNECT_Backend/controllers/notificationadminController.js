// controllers/notificationController.js
// UniConnect – Notification Controller (Admin broadcast)

const sql = require("mssql");
const { getPool, logAction } = require("../db");

const ok  = (res, data, msg = "Success")     => res.json({ success: true, message: msg, data });
const err = (res, e,   msg = "Server error") => {
  console.error("[NotifCtrl]", e.message || e);
  res.status(500).json({ success: false, message: msg, error: e.message });
};

// ══════════════════════════════════════════════════════════════════════════════
// BROADCAST ANNOUNCEMENT
// POST /api/admin/notifications/broadcast
// body: { title, message, target, priority }
// target: "All Users" | "Students Only" | "Organizers Only"
// ══════════════════════════════════════════════════════════════════════════════
exports.broadcastAnnouncement = async (req, res) => {
  const { title, message, target = "All Users", priority = "Normal" } = req.body;
  if (!title || !message)
    return res.status(400).json({ success: false, message: "title and message are required" });

  try {
    const pool = await getPool();

    // Determine which users to notify
    let roleFilter = "";
    if (target === "Students Only")   roleFilter = "WHERE role = 'student'";
    if (target === "Organizers Only") roleFilter = "WHERE role = 'organizer'";

    const users = await pool.request().query(
      `SELECT user_id FROM dbo.Users ${roleFilter}`
    );

    // Bulk insert notifications
    const fullMsg = priority === "Urgent"
      ? `🚨 [URGENT] ${title}: ${message}`
      : `📢 ${title}: ${message}`;

    let inserted = 0;
    for (const user of users.recordset) {
      await pool.request()
        .input("uid", sql.Int,      user.user_id)
        .input("msg", sql.NVarChar, fullMsg)
        .input("typ", sql.VarChar,  "announcement")
        .query(`INSERT INTO dbo.Notifications(user_id,message,type,is_read,created_at)
                VALUES(@uid,@msg,@typ,0,GETDATE())`);
      inserted++;
    }

    await logAction(req.user?.user_id, "BROADCAST", `Sent to ${inserted} users: ${title}`);
    ok(res, { sent_to: inserted }, `Announcement sent to ${inserted} users`);
  } catch (e) { err(res, e, "Failed to broadcast"); }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET ALL NOTIFICATIONS  (admin overview)
// ══════════════════════════════════════════════════════════════════════════════
exports.getAllNotifications = async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT TOP 200
        n.notification_id, n.message, n.type, n.is_read, n.created_at,
        u.full_name AS recipient_name, u.email AS recipient_email
      FROM dbo.Notifications n
      LEFT JOIN dbo.Users u ON u.user_id = n.user_id
      ORDER BY n.created_at DESC
    `);
    ok(res, r.recordset);
  } catch (e) { err(res, e); }
};
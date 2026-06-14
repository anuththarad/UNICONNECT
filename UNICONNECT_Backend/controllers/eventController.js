// controllers/eventController.js
// UniConnect – Event Controller (Admin access)

const sql = require("mssql");
const { getPool, logAction } = require("../db");

const ok  = (res, data, msg = "Success")     => res.json({ success: true, message: msg, data });
const err = (res, e,   msg = "Server error") => {
  console.error("[EventCtrl]", e.message || e);
  res.status(500).json({ success: false, message: msg, error: e.message });
};

// ══════════════════════════════════════════════════════════════════════════════
// GET ALL EVENTS
// ══════════════════════════════════════════════════════════════════════════════
exports.getAllEvents = async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT
        e.event_id, e.title, e.description, e.event_date,
        e.venue, e.category, e.start_time, e.end_time,
        e.visibility, e.capacity, e.created_at, e.image_url,
        e.needs_volunteers, e.allow_ticket_booking, e.allow_payments,
        u.full_name AS organizer_name, u.email AS organizer_email,
        (SELECT COUNT(*) FROM dbo.Participant_Registration pr WHERE pr.event_id = e.event_id) AS registration_count
      FROM dbo.Event e
      LEFT JOIN dbo.Users u ON u.user_id = e.organizer_id
      ORDER BY e.created_at DESC
    `);
    ok(res, r.recordset);
  } catch (e) { err(res, e, "Failed to load events"); }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET SINGLE EVENT
// ══════════════════════════════════════════════════════════════════════════════
exports.getEventById = async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT
          e.*, u.full_name AS organizer_name,
          (SELECT COUNT(*) FROM dbo.Participant_Registration pr WHERE pr.event_id=e.event_id) AS registration_count,
          (SELECT COUNT(*) FROM dbo.Volunteer v WHERE v.event_id=e.event_id) AS volunteer_count,
          (SELECT COUNT(*) FROM dbo.Feedback  f WHERE f.event_id=e.event_id) AS feedback_count,
          (SELECT AVG(CAST(rating AS FLOAT)) FROM dbo.Feedback f WHERE f.event_id=e.event_id) AS avg_rating
        FROM dbo.Event e
        LEFT JOIN dbo.Users u ON u.user_id = e.organizer_id
        WHERE e.event_id = @id
      `);
    if (!r.recordset.length)
      return res.status(404).json({ success: false, message: "Event not found" });
    ok(res, r.recordset[0]);
  } catch (e) { err(res, e); }
};

// ══════════════════════════════════════════════════════════════════════════════
// UPDATE EVENT
// ══════════════════════════════════════════════════════════════════════════════
exports.updateEvent = async (req, res) => {
  const {
    title, description, event_date, venue, category,
    start_time, end_time, visibility, capacity
  } = req.body;
  try {
    const pool = await getPool();
    await pool.request()
      .input("id",    sql.Int,      req.params.id)
      .input("ti",   sql.NVarChar, title       || null)
      .input("de",   sql.NVarChar, description || null)
      .input("ed",   sql.Date,     event_date  || null)
      .input("ve",   sql.NVarChar, venue       || null)
      .input("ca",   sql.NVarChar, category    || null)
      .input("st",   sql.NVarChar, start_time  || null)
      .input("et",   sql.NVarChar, end_time    || null)
      .input("vi",   sql.NVarChar, visibility  || null)
      .input("cap",  sql.Int,      capacity    || null)
      .query(`
        UPDATE dbo.Event SET
          title       = COALESCE(@ti,  title),
          description = COALESCE(@de,  description),
          event_date  = COALESCE(@ed,  event_date),
          venue       = COALESCE(@ve,  venue),
          category    = COALESCE(@ca,  category),
          start_time  = COALESCE(@st,  start_time),
          end_time    = COALESCE(@et,  end_time),
          visibility  = COALESCE(@vi,  visibility),
          capacity    = COALESCE(@cap, capacity)
        WHERE event_id = @id
      `);
    await logAction(req.user?.user_id, "UPDATE_EVENT", `Updated event #${req.params.id}`);
    ok(res, null, "Event updated");
  } catch (e) { err(res, e); }
};

// ══════════════════════════════════════════════════════════════════════════════
// DELETE EVENT  (cascades all child rows)
// ══════════════════════════════════════════════════════════════════════════════
exports.deleteEvent = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const pool = await getPool();
    const t = new sql.Transaction(pool);
    await t.begin();
    try {
      const tables = [
        "dbo.NotificationQueue",
        "dbo.Attendance",
        "dbo.Feedback",
        "dbo.Volunteer",
        "dbo.Participant_Registration",
        "dbo.Payments",
        "dbo.Tickets",
        "dbo.Budget",
        "dbo.EventImages",
        "dbo.Event_Image",
        "dbo.Notifications",
      ];
      for (const tbl of tables) {
        try {
          await new sql.Request(t).input("id", sql.Int, id)
            .query(`DELETE FROM ${tbl} WHERE event_id=@id`);
        } catch { /* table may not have event_id col — skip */ }
      }
      await new sql.Request(t).input("id", sql.Int, id)
        .query("DELETE FROM dbo.Event WHERE event_id=@id");
      await t.commit();
      await logAction(req.user?.user_id, "DELETE_EVENT", `Deleted event #${id}`);
      ok(res, null, "Event deleted");
    } catch (inner) {
      await t.rollback();
      throw inner;
    }
  } catch (e) { err(res, e, "Failed to delete event"); }
};

// ══════════════════════════════════════════════════════════════════════════════
// APPROVE EVENT  (toggle visibility to Public)
// ══════════════════════════════════════════════════════════════════════════════
exports.approveEvent = async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE dbo.Event SET visibility='Public' WHERE event_id=@id");
    await logAction(req.user?.user_id, "APPROVE_EVENT", `Approved event #${req.params.id}`);
    ok(res, null, "Event approved");
  } catch (e) { err(res, e); }
};
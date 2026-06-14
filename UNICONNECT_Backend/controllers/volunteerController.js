// controllers/volunteerController.js
// UniConnect – Volunteer Controller (Admin)

const sql = require("mssql");
const { getPool, logAction } = require("../db");

const ok  = (res, data, msg = "Success")     => res.json({ success: true, message: msg, data });
const err = (res, e,   msg = "Server error") => {
  console.error("[VolCtrl]", e.message || e);
  res.status(500).json({ success: false, message: msg, error: e.message });
};

// GET ALL
exports.getAllVolunteers = async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT
        v.volunteer_id, v.role, v.assigned_task, v.status,
        v.attendance, v.skills, v.group_name, v.assigned_at,
        u.full_name AS volunteer_name, u.email AS volunteer_email,
        e.title AS event_title, e.event_date,
        (SELECT COUNT(*) FROM dbo.Volunteer v2 WHERE v2.event_id = v.event_id) AS applicant_count
      FROM dbo.Volunteer v
      LEFT JOIN dbo.Users u ON u.user_id  = v.user_id
      LEFT JOIN dbo.Event e ON e.event_id = v.event_id
      ORDER BY v.assigned_at DESC
    `);
    ok(res, r.recordset);
  } catch (e) { err(res, e); }
};

// DELETE
exports.deleteVolunteer = async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM dbo.Volunteer WHERE volunteer_id=@id");
    await logAction(req.user?.user_id, "DELETE_VOLUNTEER", `Deleted volunteer #${req.params.id}`);
    ok(res, null, "Volunteer deleted");
  } catch (e) { err(res, e); }
};

// UPDATE STATUS
exports.updateVolunteerStatus = async (req, res) => {
  const { status } = req.body;
  const allowed = ["pending","approved","rejected","active","completed"];
  if (!allowed.includes(status))
    return res.status(400).json({ success: false, message: "Invalid status" });
  try {
    const pool = await getPool();
    await pool.request()
      .input("id",     sql.Int,      req.params.id)
      .input("status", sql.NVarChar, status)
      .query("UPDATE dbo.Volunteer SET status=@status WHERE volunteer_id=@id");
    ok(res, null, "Volunteer status updated");
  } catch (e) { err(res, e); }
};
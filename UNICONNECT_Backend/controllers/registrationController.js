// controllers/registrationController.js
// UniConnect – Participant Registration Controller (Admin)

const sql = require("mssql");
const { getPool, logAction } = require("../db");

const ok  = (res, data, msg = "Success")     => res.json({ success: true, message: msg, data });
const err = (res, e,   msg = "Server error") => {
  console.error("[RegCtrl]", e.message || e);
  res.status(500).json({ success: false, message: msg, error: e.message });
};

// GET ALL
exports.getAllRegistrations = async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT
        pr.registration_id, pr.registration_date, pr.status,
        pr.participant_type, pr.role, pr.notes,
        u.full_name AS student_name, u.email AS student_email,
        e.title AS event_title, e.event_date, e.venue
      FROM dbo.Participant_Registration pr
      LEFT JOIN dbo.Users u ON u.user_id  = pr.user_id
      LEFT JOIN dbo.Event e ON e.event_id = pr.event_id
      ORDER BY pr.registration_date DESC
    `);
    ok(res, r.recordset);
  } catch (e) { err(res, e); }
};

// APPROVE
exports.approveRegistration = async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE dbo.Participant_Registration SET status='confirmed' WHERE registration_id=@id");
    await logAction(req.user?.user_id, "APPROVE_REG", `Approved registration #${req.params.id}`);
    ok(res, null, "Registration approved");
  } catch (e) { err(res, e); }
};

// REJECT
exports.rejectRegistration = async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE dbo.Participant_Registration SET status='cancelled' WHERE registration_id=@id");
    await logAction(req.user?.user_id, "REJECT_REG", `Rejected registration #${req.params.id}`);
    ok(res, null, "Registration rejected");
  } catch (e) { err(res, e); }
};

// DELETE
exports.deleteRegistration = async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM dbo.Participant_Registration WHERE registration_id=@id");
    await logAction(req.user?.user_id, "DELETE_REG", `Deleted registration #${req.params.id}`);
    ok(res, null, "Registration deleted");
  } catch (e) { err(res, e); }
};
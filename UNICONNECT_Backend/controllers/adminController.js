// controllers/adminController.js
// UniConnect – Admin Controller
// Handles: Dashboard Stats, Audit Logs, Universities, Interests,
//          Tickets, Payments, Feedback, Attendance, Budgets

const sql = require("mssql");
const { getPool, logAction } = require("../db");

// ─── helpers ──────────────────────────────────────────────────────────────────
const ok  = (res, data, msg = "Success")       => res.json({ success: true, message: msg, data });
const err = (res, e,   msg = "Server error")   => {
  console.error("[AdminCtrl]", e.message || e);
  res.status(500).json({ success: false, message: msg, error: e.message });
};

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// GET /api/admin/stats
// Returns aggregated counts for all dashboard cards in one round-trip.
// ══════════════════════════════════════════════════════════════════════════════
exports.getDashboardStats = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.Users)                                          AS total_users,
        (SELECT COUNT(*) FROM dbo.Users WHERE role = 'student')                   AS total_students,
        (SELECT COUNT(*) FROM dbo.Users WHERE role = 'organizer')                 AS total_organizers,
        (SELECT COUNT(*) FROM dbo.Users WHERE role IN ('admin','super_admin'))     AS total_admins,
        (SELECT COUNT(*) FROM dbo.Event)                                          AS total_events,
        (SELECT COUNT(*) FROM dbo.Event WHERE event_date >= CAST(GETDATE() AS DATE)) AS upcoming_events,
        (SELECT COUNT(*) FROM dbo.Event WHERE event_date < CAST(GETDATE() AS DATE))  AS past_events,
        (SELECT COUNT(*) FROM dbo.Participant_Registration)                       AS total_registrations,
        (SELECT COUNT(*) FROM dbo.Participant_Registration WHERE status='pending') AS pending_registrations,
        (SELECT COUNT(*) FROM dbo.Participant_Registration WHERE status='confirmed') AS confirmed_registrations,
        (SELECT COUNT(*) FROM dbo.Volunteer)                                      AS total_volunteers,
        (SELECT COUNT(*) FROM dbo.University)                                     AS total_universities,
        (SELECT ISNULL(SUM(amount),0) FROM dbo.Payments WHERE payment_status='Completed') AS total_revenue,
        (SELECT COUNT(*) FROM dbo.Tickets)                                        AS total_tickets,
        (SELECT COUNT(*) FROM dbo.Feedback)                                       AS total_feedback
    `);
    ok(res, result.recordset[0]);
  } catch (e) { err(res, e, "Failed to load stats"); }
};

// ══════════════════════════════════════════════════════════════════════════════
// AUDIT LOGS
// GET /api/admin/logs
// Returns the 200 most recent logs ordered by newest first.
// ══════════════════════════════════════════════════════════════════════════════
exports.getLogs = async (req, res) => {
  try {
    const pool = await getPool();
    // If you have a dedicated AuditLog table use it; otherwise fall back to
    // joining notifications + users as a lightweight proxy.
    let result;
    try {
      result = await pool.request().query(`
        SELECT TOP 200
          n.notification_id  AS log_id,
          n.created_at,
          n.type             AS action,
          u.full_name        AS performed_by,
          n.message          AS detail,
          '—'                AS ip_address
        FROM dbo.Notifications n
        LEFT JOIN dbo.Users u ON u.user_id = n.user_id
        ORDER BY n.created_at DESC
      `);
    } catch {
      // table may not exist yet – return empty list gracefully
      result = { recordset: [] };
    }
    ok(res, result.recordset, "Logs fetched");
  } catch (e) { err(res, e, "Failed to load logs"); }
};

// ══════════════════════════════════════════════════════════════════════════════
// UNIVERSITIES
// ══════════════════════════════════════════════════════════════════════════════
exports.getAllUniversities = async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      "SELECT * FROM dbo.University ORDER BY university_name"
    );
    ok(res, r.recordset);
  } catch (e) { err(res, e); }
};

exports.createUniversity = async (req, res) => {
  const { university_name, location } = req.body;
  if (!university_name) return res.status(400).json({ success: false, message: "university_name required" });
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input("n", sql.NVarChar, university_name)
      .input("l", sql.NVarChar, location || null)
      .query(`INSERT INTO dbo.University(university_name,location)
              OUTPUT INSERTED.*
              VALUES(@n,@l)`);
    await logAction(req.user?.user_id, "CREATE_UNIVERSITY", `Created: ${university_name}`);
    ok(res, r.recordset[0], "University created");
  } catch (e) { err(res, e); }
};

exports.deleteUniversity = async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM dbo.University WHERE university_id=@id");
    ok(res, null, "University deleted");
  } catch (e) { err(res, e); }
};

// ══════════════════════════════════════════════════════════════════════════════
// INTERESTS
// ══════════════════════════════════════════════════════════════════════════════
exports.getAllInterests = async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      "SELECT * FROM dbo.Interest ORDER BY interest_name"
    );
    ok(res, r.recordset);
  } catch (e) { err(res, e); }
};

exports.createInterest = async (req, res) => {
  const { interest_name } = req.body;
  if (!interest_name) return res.status(400).json({ success: false, message: "interest_name required" });
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input("n", sql.NVarChar, interest_name)
      .query(`INSERT INTO dbo.Interest(interest_name)
              OUTPUT INSERTED.*
              VALUES(@n)`);
    ok(res, r.recordset[0], "Interest created");
  } catch (e) { err(res, e); }
};

exports.deleteInterest = async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM dbo.Interest WHERE interest_id=@id");
    ok(res, null, "Interest deleted");
  } catch (e) { err(res, e); }
};

// ══════════════════════════════════════════════════════════════════════════════
// TICKETS  (admin read-only overview)
// ══════════════════════════════════════════════════════════════════════════════
exports.getAllTickets = async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT
        t.ticket_id, t.ticket_type, t.quantity, t.ticket_price,
        t.total_amount, t.booking_date, t.booking_status,
        u.full_name AS student_name, u.email AS student_email,
        e.title     AS event_title,  e.event_date
      FROM dbo.Tickets t
      LEFT JOIN dbo.Users  u ON u.user_id  = t.user_id
      LEFT JOIN dbo.Event  e ON e.event_id = t.event_id
      ORDER BY t.booking_date DESC
    `);
    ok(res, r.recordset);
  } catch (e) { err(res, e); }
};

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENTS  (admin read-only overview)
// ══════════════════════════════════════════════════════════════════════════════
exports.getAllPayments = async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT
        p.payment_id, p.amount, p.payment_method,
        p.payment_status, p.transaction_id, p.payment_date,
        u.full_name AS student_name, u.email AS student_email,
        e.title     AS event_title
      FROM dbo.Payments p
      LEFT JOIN dbo.Users u ON u.user_id  = p.user_id
      LEFT JOIN dbo.Event e ON e.event_id = p.event_id
      ORDER BY p.payment_date DESC
    `);
    ok(res, r.recordset);
  } catch (e) { err(res, e); }
};

exports.getPaymentSummary = async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT
        COUNT(*)                                                         AS total_transactions,
        ISNULL(SUM(CASE WHEN payment_status='Completed' THEN amount END),0) AS total_revenue,
        ISNULL(SUM(CASE WHEN payment_status='Pending'   THEN amount END),0) AS pending_amount,
        ISNULL(SUM(CASE WHEN payment_status='Failed'    THEN amount END),0) AS failed_amount
      FROM dbo.Payments
    `);
    ok(res, r.recordset[0]);
  } catch (e) { err(res, e); }
};

// ══════════════════════════════════════════════════════════════════════════════
// FEEDBACK  (admin overview)
// ══════════════════════════════════════════════════════════════════════════════
exports.getAllFeedback = async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT
        f.feedback_id, f.rating, f.comments, f.feedback_date,
        u.full_name AS student_name,
        e.title     AS event_title
      FROM dbo.Feedback f
      LEFT JOIN dbo.Users u ON u.user_id  = f.user_id
      LEFT JOIN dbo.Event e ON e.event_id = f.event_id
      ORDER BY f.feedback_date DESC
    `);
    ok(res, r.recordset);
  } catch (e) { err(res, e); }
};

exports.deleteFeedback = async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM dbo.Feedback WHERE feedback_id=@id");
    ok(res, null, "Feedback deleted");
  } catch (e) { err(res, e); }
};

// ══════════════════════════════════════════════════════════════════════════════
// ATTENDANCE
// ══════════════════════════════════════════════════════════════════════════════
exports.getAllAttendance = async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT
        a.attendance_id, a.status,
        u.full_name AS student_name, u.email,
        e.title     AS event_title,  e.event_date
      FROM dbo.Attendance a
      LEFT JOIN dbo.Users u ON u.user_id  = a.user_id
      LEFT JOIN dbo.Event e ON e.event_id = a.event_id
      ORDER BY e.event_date DESC
    `);
    ok(res, r.recordset);
  } catch (e) { err(res, e); }
};

// ══════════════════════════════════════════════════════════════════════════════
// BUDGET
// ══════════════════════════════════════════════════════════════════════════════
exports.getAllBudgets = async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT
        b.budget_id, b.estimated_cost, b.actual_cost,
        b.description, b.category, b.notes, b.created_at,
        e.title AS event_title
      FROM dbo.Budget b
      LEFT JOIN dbo.Event e ON e.event_id = b.event_id
      ORDER BY b.created_at DESC
    `);
    ok(res, r.recordset);
  } catch (e) { err(res, e); }
};
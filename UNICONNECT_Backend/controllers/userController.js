// controllers/userController.js
// UniConnect – User Controller (Admin access)
// CRUD + role / status management for all users in the system

const sql = require("mssql");
const { getPool, logAction } = require("../db");

const ok  = (res, data, msg = "Success")     => res.json({ success: true, message: msg, data });
const err = (res, e,   msg = "Server error") => {
  console.error("[UserCtrl]", e.message || e);
  res.status(500).json({ success: false, message: msg, error: e.message });
};

// ══════════════════════════════════════════════════════════════════════════════
// GET ALL USERS
// GET /api/admin/users
// ══════════════════════════════════════════════════════════════════════════════
exports.getAllUsers = async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT
        u.user_id, u.full_name, u.email, u.role,
        u.faculty_name, u.department_name, u.contact_number,
        u.profile_image, u.profile_bio, u.interest,
        un.university_name AS university
      FROM dbo.Users u
      LEFT JOIN dbo.University un ON un.university_id = u.university_id
      ORDER BY u.user_id DESC
    `);
    ok(res, r.recordset, "Users fetched");
  } catch (e) { err(res, e, "Failed to load users"); }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET SINGLE USER
// GET /api/admin/users/:id
// ══════════════════════════════════════════════════════════════════════════════
exports.getUserById = async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT
          u.user_id, u.full_name, u.email, u.role,
          u.faculty_name, u.department_name, u.contact_number,
          u.profile_image, u.profile_bio, u.interest,
          un.university_name AS university
        FROM dbo.Users u
        LEFT JOIN dbo.University un ON un.university_id = u.university_id
        WHERE u.user_id = @id
      `);
    if (!r.recordset.length)
      return res.status(404).json({ success: false, message: "User not found" });
    ok(res, r.recordset[0]);
  } catch (e) { err(res, e); }
};

// ══════════════════════════════════════════════════════════════════════════════
// UPDATE USER  (admin edit any field)
// PUT /api/admin/users/:id
// ══════════════════════════════════════════════════════════════════════════════
exports.updateUser = async (req, res) => {
  const { full_name, email, role, faculty_name, department_name, contact_number } = req.body;
  try {
    const pool = await getPool();
    await pool.request()
      .input("id",   sql.Int,      req.params.id)
      .input("fn",   sql.NVarChar, full_name       || null)
      .input("em",   sql.NVarChar, email           || null)
      .input("rl",   sql.NVarChar, role            || null)
      .input("fac",  sql.NVarChar, faculty_name    || null)
      .input("dep",  sql.NVarChar, department_name || null)
      .input("cnt",  sql.NVarChar, contact_number  || null)
      .query(`
        UPDATE dbo.Users SET
          full_name       = COALESCE(@fn,  full_name),
          email           = COALESCE(@em,  email),
          role            = COALESCE(@rl,  role),
          faculty_name    = COALESCE(@fac, faculty_name),
          department_name = COALESCE(@dep, department_name),
          contact_number  = COALESCE(@cnt, contact_number)
        WHERE user_id = @id
      `);
    await logAction(req.user?.user_id, "UPDATE_USER", `Updated user #${req.params.id}`);
    ok(res, null, "User updated");
  } catch (e) { err(res, e); }
};

// ══════════════════════════════════════════════════════════════════════════════
// DELETE USER
// DELETE /api/admin/users/:id
// Cascades: registrations, notifications, volunteers, attendance, feedback
// ══════════════════════════════════════════════════════════════════════════════
exports.deleteUser = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const pool = await getPool();
    const t = new sql.Transaction(pool);
    await t.begin();
    try {
      const req2 = new sql.Request(t);
      // Remove FK-dependent rows first
      await req2.input("id", sql.Int, id).query(
        "DELETE FROM dbo.NotificationQueue        WHERE user_id=@id"
      );
      await new sql.Request(t).input("id",sql.Int,id).query(
        "DELETE FROM dbo.NotificationPreference   WHERE user_id=@id"
      );
      await new sql.Request(t).input("id",sql.Int,id).query(
        "DELETE FROM dbo.Notifications             WHERE user_id=@id"
      );
      await new sql.Request(t).input("id",sql.Int,id).query(
        "DELETE FROM dbo.User_Interest             WHERE user_id=@id"
      );
      await new sql.Request(t).input("id",sql.Int,id).query(
        "DELETE FROM dbo.Attendance                WHERE user_id=@id"
      );
      await new sql.Request(t).input("id",sql.Int,id).query(
        "DELETE FROM dbo.Feedback                  WHERE user_id=@id"
      );
      await new sql.Request(t).input("id",sql.Int,id).query(
        "DELETE FROM dbo.Volunteer                 WHERE user_id=@id"
      );
      await new sql.Request(t).input("id",sql.Int,id).query(
        "DELETE FROM dbo.Participant_Registration  WHERE user_id=@id"
      );
      await new sql.Request(t).input("id",sql.Int,id).query(
        "DELETE FROM dbo.Payments                  WHERE user_id=@id"
      );
      await new sql.Request(t).input("id",sql.Int,id).query(
        "DELETE FROM dbo.Tickets                   WHERE user_id=@id"
      );
      await new sql.Request(t).input("id",sql.Int,id).query(
        "DELETE FROM dbo.UserContact               WHERE user_id=@id"
      );
      await new sql.Request(t).input("id",sql.Int,id).query(
        "DELETE FROM dbo.PasswordResetOTP          WHERE user_id=@id"
      );
      // Delete events organised by this user (and their dependencies)
      // Simple approach: orphan them (set organizer_id=NULL)
      await new sql.Request(t).input("id",sql.Int,id).query(
        "UPDATE dbo.Event SET organizer_id=NULL WHERE organizer_id=@id"
      );
      await new sql.Request(t).input("id",sql.Int,id).query(
        "DELETE FROM dbo.Users WHERE user_id=@id"
      );
      await t.commit();
      await logAction(req.user?.user_id, "DELETE_USER", `Deleted user #${id}`);
      ok(res, null, "User deleted");
    } catch (inner) {
      await t.rollback();
      throw inner;
    }
  } catch (e) { err(res, e, "Failed to delete user"); }
};

// ══════════════════════════════════════════════════════════════════════════════
// CHANGE ROLE
// PATCH /api/admin/users/:id/role   body: { role }
// ══════════════════════════════════════════════════════════════════════════════
exports.changeUserRole = async (req, res) => {
  const { role } = req.body;
  const allowed = ["student","organizer","admin","super_admin"];
  if (!role || !allowed.includes(role))
    return res.status(400).json({ success: false, message: "Invalid role" });
  try {
    const pool = await getPool();
    await pool.request()
      .input("id",   sql.Int,      req.params.id)
      .input("role", sql.NVarChar, role)
      .query("UPDATE dbo.Users SET role=@role WHERE user_id=@id");
    await logAction(req.user?.user_id, "CHANGE_ROLE", `User #${req.params.id} → ${role}`);
    ok(res, null, `Role changed to ${role}`);
  } catch (e) { err(res, e); }
};

// ══════════════════════════════════════════════════════════════════════════════
// CHANGE STATUS  (active / suspended / inactive)
// PATCH /api/admin/users/:id/status   body: { status }
// NOTE: status column doesn't exist in schema – if you haven't added it yet,
//       this will return a graceful error instead of crashing.
// ══════════════════════════════════════════════════════════════════════════════
exports.changeUserStatus = async (req, res) => {
  const { status } = req.body;
  const allowed = ["active","suspended","inactive"];
  if (!status || !allowed.includes(status))
    return res.status(400).json({ success: false, message: "Invalid status" });
  try {
    const pool = await getPool();
    // Check column exists before updating
    const col = await pool.request().query(`
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='Users' AND COLUMN_NAME='status'
    `);
    if (!col.recordset.length)
      return res.status(400).json({ success: false, message: "status column not in schema yet" });

    await pool.request()
      .input("id",     sql.Int,      req.params.id)
      .input("status", sql.NVarChar, status)
      .query("UPDATE dbo.Users SET status=@status WHERE user_id=@id");
    await logAction(req.user?.user_id, "CHANGE_STATUS", `User #${req.params.id} → ${status}`);
    ok(res, null, `Status changed to ${status}`);
  } catch (e) { err(res, e); }
};
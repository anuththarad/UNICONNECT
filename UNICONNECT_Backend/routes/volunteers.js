const express = require("express");
const router  = express.Router();
const sql     = require("mssql");
const pool    = require("../db");

/* =========================================================
   GET — ALL VOLUNTEERS FOR EVENT (FULL PROFILE)
========================================================= */
router.get("/event/:event_id", async (req, res) => {
  try {
    const event_id = Number(req.params.event_id);
    const conn = await pool;

    const result = await conn.request()
      .input("event_id", sql.Int, event_id)
      .query(`
        SELECT
          v.volunteer_id,
          v.user_id,
          v.event_id,
          v.role,
          v.assigned_task,
          v.skills,
          v.status,
          v.attendance,
          v.group_name,
          v.assigned_at,
          u.full_name,
          u.email,
          u.university,
          u.department_name,
          u.contact_number
        FROM Volunteer v
        LEFT JOIN Users u ON u.user_id = v.user_id
        WHERE v.event_id = @event_id
        ORDER BY v.volunteer_id ASC
      `);

    res.json({ success: true, data: result.recordset });

  } catch (err) {
    console.error("GET /volunteers/event error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

/* =========================================================
   POST — REGISTER VOLUNTEER
========================================================= */
router.post("/", async (req, res) => {
  try {
    const { user_id, event_id, role, assigned_task, status, skills } = req.body;

    if (!user_id || !event_id) {
      return res.json({ success: false, message: "user_id and event_id are required." });
    }

    const conn = await pool;

    const check = await conn.request()
      .input("user_id",  sql.Int, Number(user_id))
      .input("event_id", sql.Int, Number(event_id))
      .query(`
        SELECT volunteer_id
        FROM Volunteer
        WHERE user_id = @user_id AND event_id = @event_id
      `);

    if (check.recordset.length > 0) {
      return res.json({ success: false, message: "Already registered as volunteer." });
    }

    await conn.request()
      .input("user_id",       sql.Int,          Number(user_id))
      .input("event_id",      sql.Int,          Number(event_id))
      .input("role",          sql.NVarChar(100), role          || "General Volunteer")
      .input("assigned_task", sql.NVarChar(255), assigned_task || "")
      .input("status",        sql.NVarChar(50),  status        || "pending")
      .input("skills",        sql.NVarChar(255), skills        || "")
      .query(`
        INSERT INTO Volunteer (user_id, event_id, role, assigned_task, status, skills, assigned_at)
        VALUES (@user_id, @event_id, @role, @assigned_task, @status, @skills, GETDATE())
      `);

    res.json({ success: true, message: "Volunteer registered successfully." });

  } catch (err) {
    console.error("POST /volunteers error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

/* =========================================================
   PATCH — UPDATE VOLUNTEER (status, task, role, group, attendance)
========================================================= */
router.patch("/:volunteer_id", async (req, res) => {
  try {
    const volunteer_id = Number(req.params.volunteer_id);
    const {
      role,
      assigned_task,
      status,
      attendance,
      skills,
      group_name
    } = req.body;

    const conn = await pool;

    await conn.request()
      .input("volunteer_id",  sql.Int,           volunteer_id)
      .input("role",          sql.NVarChar(100),  role          ?? null)
      .input("assigned_task", sql.NVarChar(255),  assigned_task ?? null)
      .input("status",        sql.NVarChar(50),   status        ?? null)
      .input("attendance",    sql.NVarChar(20),   attendance    ?? null)
      .input("skills",        sql.NVarChar(255),  skills        ?? null)
      .input("group_name",    sql.NVarChar(20),   group_name    ?? null)
      .query(`
        UPDATE Volunteer
        SET
          role          = COALESCE(@role,          role),
          assigned_task = COALESCE(@assigned_task, assigned_task),
          status        = COALESCE(@status,        status),
          attendance    = COALESCE(@attendance,    attendance),
          skills        = COALESCE(@skills,        skills),
          group_name    = COALESCE(@group_name,    group_name)
        WHERE volunteer_id = @volunteer_id
      `);

    res.json({ success: true, message: "Volunteer updated successfully." });

  } catch (err) {
    console.error("PATCH /volunteers error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

/* =========================================================
   PATCH — ASSIGN GROUP (A / B / C)
========================================================= */
router.patch("/group/:volunteer_id", async (req, res) => {
  try {
    const volunteer_id = Number(req.params.volunteer_id);
    const { group_name } = req.body;

    const conn = await pool;

    await conn.request()
      .input("volunteer_id", sql.Int,         volunteer_id)
      .input("group_name",   sql.NVarChar(20), group_name ?? null)
      .query(`
        UPDATE Volunteer
        SET group_name = @group_name
        WHERE volunteer_id = @volunteer_id
      `);

    res.json({ success: true, message: "Group assigned successfully." });

  } catch (err) {
    console.error("PATCH /volunteers/group error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

/* =========================================================
   DELETE — REMOVE VOLUNTEER
========================================================= */
router.delete("/:volunteer_id", async (req, res) => {
  try {
    const volunteer_id = Number(req.params.volunteer_id);
    const conn = await pool;

    await conn.request()
      .input("volunteer_id", sql.Int, volunteer_id)
      .query(`DELETE FROM Volunteer WHERE volunteer_id = @volunteer_id`);

    res.json({ success: true, message: "Volunteer removed." });

  } catch (err) {
    console.error("DELETE /volunteers error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;
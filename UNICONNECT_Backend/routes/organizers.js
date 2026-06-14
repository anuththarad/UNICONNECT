const express = require("express");
const sql = require("mssql");
const pool = require("../db");

const router = express.Router();

/* ======================================================
   GET STUDENT DASHBOARD
====================================================== */
router.get("/dashboard/:user_id", async (req, res) => {
    try {
        const userId = Number(req.params.user_id);

        const userResult = await pool.request()
            .input("user_id", sql.Int, userId)
            .query(`
                SELECT
                    user_id,
                    full_name,
                    email,
                    role,
                    university,
                    university_id,
                    faculty_name,
                    department_name,
                    contact_number
                FROM Users
                WHERE user_id = @user_id
            `);

        if (!userResult.recordset.length) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const user = userResult.recordset[0];

        const eventsResult = await pool.request()
            .input("university", sql.NVarChar, user.university)
            .query(`
                SELECT
                    event_id,
                    title,
                    description,
                    category,
                    event_date,
                    start_time,
                    end_time,
                    venue,
                    image_url,
                    visibility,
                    department_name,
                    allow_other_departments
                FROM Event
                WHERE university = @university
                ORDER BY event_date ASC
            `);

        const registrationResult = await pool.request()
            .input("user_id", sql.Int, userId)
            .query(`
                SELECT
                    pr.registration_id,
                    pr.status,
                    pr.participant_type,
                    e.event_id,
                    e.title,
                    e.event_date,
                    e.start_time,
                    e.venue,
                    e.image_url,
                    e.department_name
                FROM Participant_Registration pr
                INNER JOIN Event e ON pr.event_id = e.event_id
                WHERE pr.user_id = @user_id
                ORDER BY e.event_date ASC
            `);

        const todayResult = await pool.request()
            .input("university", sql.NVarChar, user.university)
            .query(`
                SELECT
                    event_id,
                    title,
                    start_time,
                    venue
                FROM Event
                WHERE university = @university
                AND CAST(event_date AS DATE) = CAST(GETDATE() AS DATE)
            `);

        res.json({
            success: true,
            student: user,
            events: eventsResult.recordset,
            registrations: registrationResult.recordset,
            todayEvents: todayResult.recordset
        });

    } catch (err) {
        console.error("STUDENT DASHBOARD ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});


/* ======================================================
   REGISTER FOR EVENT  — all 3 bugs fixed here
====================================================== */
router.post("/register/:event_id", async (req, res) => {
    try {
        const eventId = Number(req.params.event_id);
        const { user_id, participant_type } = req.body;  // FIX 1: use user_id consistently

        // Check already registered
        const checkResult = await pool.request()
            .input("user_id", sql.Int, user_id)
            .input("event_id", sql.Int, eventId)
            .query(`
                SELECT registration_id
                FROM Participant_Registration
                WHERE user_id = @user_id AND event_id = @event_id
            `);

        if (checkResult.recordset.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Already registered for this event"
            });
        }

        // Get user details
        const userResult = await pool.request()
            .input("user_id", sql.Int, user_id)
            .query(`
                SELECT full_name, email, university, department_name
                FROM Users
                WHERE user_id = @user_id
            `);

        if (!userResult.recordset.length) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const user = userResult.recordset[0];

        // FIX 2 & 3: removed misplaced eventsResult block; 
        // now properly fetch the single event being registered for
        const eventResult = await pool.request()
            .input("event_id", sql.Int, eventId)
            .query(`
                SELECT
                    event_id,
                    title,
                    university,
                    department_name,
                    allow_other_departments
                FROM Event
                WHERE event_id = @event_id
            `);

        if (!eventResult.recordset.length) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        const event = eventResult.recordset[0];

        // Check department access
        if (
            event.allow_other_departments != 1 &&
            event.department_name !== user.department_name
        ) {
            return res.status(403).json({
                success: false,
                message: "This event is only open to a specific department"
            });
        }

        // Register
        await pool.request()
            .input("user_id", sql.Int, user_id)
            .input("event_id", sql.Int, eventId)
            .input("participant_type", sql.NVarChar(100), participant_type || "participant")
            .query(`
                INSERT INTO Participant_Registration
                    (user_id, event_id, participant_type, status)
                VALUES
                    (@user_id, @event_id, @participant_type, 'confirmed')
            `);

        res.json({ success: true, message: "Successfully registered" });

    } catch (err) {
        console.error("REGISTER ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});


/* ======================================================
   GET MY REGISTRATIONS
====================================================== */
router.get("/my-registrations/:user_id", async (req, res) => {
    try {
        const userId = Number(req.params.user_id);

        const result = await pool.request()
            .input("user_id", sql.Int, userId)
            .query(`
                SELECT
                    pr.registration_id,
                    pr.status,
                    pr.participant_type,
                    e.event_id,
                    e.title,
                    e.event_date,
                    e.start_time,
                    e.venue,
                    e.image_url,
                    e.department_name
                FROM Participant_Registration pr
                INNER JOIN Event e ON pr.event_id = e.event_id
                WHERE pr.user_id = @user_id
                ORDER BY e.event_date ASC
            `);

        res.json({ success: true, data: result.recordset });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


/* ======================================================
   UPDATE PROFILE
====================================================== */
router.put("/profile/:user_id", async (req, res) => {
    try {
        const userId = Number(req.params.user_id);
        const { full_name, email, contact_number } = req.body;

        await pool.request()
            .input("user_id", sql.Int, userId)
            .input("full_name", sql.NVarChar(255), full_name)
            .input("email", sql.NVarChar(255), email)
            .input("contact_number", sql.NVarChar(50), contact_number)
            .query(`
                UPDATE Users
                SET
                    full_name = @full_name,
                    email = @email,
                    contact_number = @contact_number
                WHERE user_id = @user_id
            `);

        res.json({ success: true, message: "Profile updated successfully" });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


/* ======================================================
   GET MY REGISTRATIONS
====================================================== */
router.get("/my-registrations/:user_id", async (req, res) => {
    try {
        const userId = Number(req.params.user_id);

        const result = await pool.request()
            .input("user_id", sql.Int, userId)
            .query(`
                SELECT
                    pr.registration_id,
                    pr.status,
                    pr.participant_type,
                    e.event_id,
                    e.title,
                    e.event_date,
                    e.start_time,
                    e.venue,
                    e.image_url,
                    e.department_name
                FROM Participant_Registration pr
                INNER JOIN Event e ON pr.event_id = e.event_id
                WHERE pr.user_id = @user_id
                ORDER BY e.event_date ASC
            `);

        res.json({ success: true, data: result.recordset });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
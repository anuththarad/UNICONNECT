const express = require("express");
const sql = require("mssql");
const pool = require("../db");

const router = express.Router();

/* =====================================================
   REGISTER PARTICIPANT
   POST /api/events/:event_id/register
===================================================== */
router.post("/:event_id/register", async (req, res) => {
    try {
        const eventId = Number(req.params.event_id);

        if (isNaN(eventId)) {
            return res.status(400).json({ success: false, message: "Invalid event ID" });
        }

        const {
            user_id,
            participant_type,
            role,
            faculty_name,
            university_name,
            contact_no,
            notes
        } = req.body;

        /* ── Validation ── */
        if (!user_id) {
            return res.status(400).json({ success: false, message: "User ID is required" });
        }

        if (!contact_no || contact_no.trim() === "") {
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }

        const phoneRegex = /^(?:\+94|0)?7[0-9]{8}$/;
        if (!phoneRegex.test(contact_no)) {
            return res.status(400).json({ success: false, message: "Invalid phone number" });
        }

        /* ── Check event exists ── */
        const eventCheck = await pool.request()
            .input("event_id", sql.Int, eventId)
            .query(`SELECT event_id FROM Event WHERE event_id = @event_id`);

        if (eventCheck.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        /* ── Check duplicate ── */
        const duplicateCheck = await pool.request()
            .input("user_id", sql.Int, user_id)
            .input("event_id", sql.Int, eventId)
            .query(`
                SELECT user_id
                FROM Participant_Registration
                WHERE user_id = @user_id AND event_id = @event_id
            `);

        if (duplicateCheck.recordset.length > 0) {
            return res.status(400).json({ success: false, message: "You are already registered for this event" });
        }

        /* ── Insert ── */
        await pool.request()
            .input("user_id",          sql.Int,              user_id)
            .input("event_id",         sql.Int,              eventId)
            .input("registration_date",sql.DateTime,         new Date())
            .input("status",           sql.NVarChar,         "pending")        // FIX: was "registered", DB default is "pending"
            .input("participant_type", sql.NVarChar,         participant_type || "participant")
            .input("role",             sql.NVarChar,         role || "participant")
            .input("faculty_name",     sql.NVarChar,         faculty_name    || null)
            .input("university_name",  sql.NVarChar,         university_name || null)
            .input("contact_no",       sql.NVarChar,         contact_no)
            .input("notes",            sql.NVarChar(sql.MAX), notes           || null)
            .query(`
                INSERT INTO Participant_Registration
                    (user_id, event_id, registration_date, status,
                     participant_type, role, faculty_name, university_name,
                     contact_no, notes)
                VALUES
                    (@user_id, @event_id, @registration_date, @status,
                     @participant_type, @role, @faculty_name, @university_name,
                     @contact_no, @notes)
            `);

        return res.status(201).json({ success: true, message: "Participant registered successfully" });

    } catch (error) {
        console.error("Participant Registration Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/* =====================================================
   GET PARTICIPANTS FOR AN EVENT
   GET /api/events/:event_id/participants
   FIX: renamed from /participant_registration → /participants
        to match what the frontend calls
===================================================== */
router.get("/:event_id/participants", async (req, res) => {
    try {
        const eventId = Number(req.params.event_id);

        if (isNaN(eventId)) {
            return res.status(400).json({ success: false, message: "Invalid event ID" });
        }

        /* ── Check event exists ── */
        const eventCheck = await pool.request()
            .input("event_id", sql.Int, eventId)
            .query(`SELECT event_id FROM Event WHERE event_id = @event_id`);

        if (eventCheck.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        const result = await pool.request()
            .input("event_id", sql.Int, eventId)
            .query(`
                SELECT
                    pr.registration_id,
                    pr.event_id,
                    pr.user_id,
                    pr.participant_type,
                    pr.role,
                    pr.status,
                    pr.registration_date,
                    pr.faculty_name,
                    pr.university_name,
                    pr.contact_no,
                    pr.notes,
                    u.full_name,
                    u.email,
                    u.contact_number AS phone
                FROM Participant_Registration pr
                LEFT JOIN Users u ON pr.user_id = u.user_id
                WHERE pr.event_id = @event_id
                ORDER BY pr.registration_date DESC
            `);

        return res.json({ success: true, participants: result.recordset });

    } catch (err) {
        console.error("Get Participants Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;


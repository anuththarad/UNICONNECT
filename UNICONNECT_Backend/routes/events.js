const express = require("express");
const sql = require("mssql");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pool = require("../db");

const router = express.Router();

console.log("EVENTS ROUTER LOADED");

/* ============================================
   MULTER SETUP
============================================ */
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/\s+/g, "-");
        cb(null, `${Date.now()}-${safeName}`);
    }
});
const upload = multer({ storage });

/* ============================================
   HELPERS
============================================ */
function formatTime(time) {
    if (!time || String(time).trim() === "") return null;
    if (/^\d{2}:\d{2}$/.test(time)) return `${time}:00`;
    if (/^\d{2}:\d{2}:\d{2}$/.test(time)) return time;
    return null;
}

function parseBool(value) {
    return value === true || value === 1 || value === "1" || value === "true" || value === "on";
}

/* ============================================
   IMPORTANT: SPECIFIC ROUTES MUST COME BEFORE
   WILDCARD ROUTES LIKE /:id
============================================ */

/* ─────────────────────────────────────────
   GET ALL EVENTS
   GET /api/events
   FIX: added LEFT JOIN to count participants
        per event so event cards show correct count
───────────────────────────────────────── */
router.get("/", async (req, res) => {
    try {
        const request = pool.request();
        let where = "";

        if (req.query.created_by || req.query.user_id || req.query.organizer_id) {
            where = "WHERE e.organizer_id = @organizer_id";
            request.input("organizer_id", sql.Int, Number(req.query.created_by || req.query.user_id || req.query.organizer_id));
        }

        const result = await request.query(`
            SELECT
                e.event_id,
                e.title,
                e.description,
                e.category,
                e.event_date,
                e.start_time,
                e.end_time,
                e.venue,
                e.capacity,
                e.visibility,
                e.organizer_id,
                e.image_url,
                e.needs_volunteers,
                e.university,
                e.department_name,
                e.allow_other_departments,
                e.allow_ticket_booking,
                e.allow_payments,
                e.created_at,
                COUNT(pr.registration_id) AS participant_count
            FROM [Event] e
            LEFT JOIN Participant_Registration pr ON pr.event_id = e.event_id
            ${where}
            GROUP BY
                e.event_id, e.title, e.description, e.category,
                e.event_date, e.start_time, e.end_time, e.venue,
                e.capacity, e.visibility, e.organizer_id, e.image_url,
                e.needs_volunteers, e.university, e.department_name,
                e.allow_other_departments, e.allow_ticket_booking,
                e.allow_payments, e.created_at
            ORDER BY e.event_id DESC
        `);

        res.json({ success: true, data: result.recordset, events: result.recordset });
    } catch (err) {
        console.error("GET EVENTS ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ─────────────────────────────────────────
   SEARCH EVENTS BY ORGANIZER
   GET /api/events/search?organizer_id=5
───────────────────────────────────────── */
router.get("/search", async (req, res) => {
    try {
        const organizerId = Number(req.query.organizer_id);
        if (!organizerId) {
            return res.status(400).json({ success: false, message: "organizer_id is required" });
        }

        const result = await pool.request()
            .input("organizer_id", sql.Int, organizerId)
            .query(`
                SELECT
                    e.event_id, e.title, e.category, e.event_date,
                    e.start_time, e.end_time, e.venue, e.capacity,
                    e.organizer_id, e.image_url,
                    COUNT(pr.registration_id) AS participant_count
                FROM [Event] e
                LEFT JOIN Participant_Registration pr ON pr.event_id = e.event_id
                WHERE e.organizer_id = @organizer_id
                GROUP BY
                    e.event_id, e.title, e.category, e.event_date,
                    e.start_time, e.end_time, e.venue, e.capacity,
                    e.organizer_id, e.image_url
                ORDER BY e.event_id DESC
            `);

        return res.json({ success: true, data: { events: result.recordset } });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/* ─────────────────────────────────────────
   GET EVENTS BY ORGANIZER
   GET /api/events/organizer/:organizerId
───────────────────────────────────────── */
router.get("/organizer/:organizerId", async (req, res) => {
    try {
        const organizerId = Number(req.params.organizerId);
        if (Number.isNaN(organizerId)) {
            return res.status(400).json({ success: false, message: "Invalid organizer ID" });
        }

        const result = await pool.request()
            .input("organizer_id", sql.Int, organizerId)
            .query(`
                SELECT
                    e.event_id, e.title, e.description, e.category,
                    e.event_date, e.start_time, e.end_time, e.venue,
                    e.capacity, e.visibility, e.organizer_id, e.image_url,
                    e.needs_volunteers, e.university, e.department_name,
                    e.allow_other_departments, e.allow_ticket_booking,
                    e.allow_payments, e.created_at,
                    COUNT(pr.registration_id) AS participant_count
                FROM [Event] e
                LEFT JOIN Participant_Registration pr ON pr.event_id = e.event_id
                WHERE e.organizer_id = @organizer_id
                GROUP BY
                    e.event_id, e.title, e.description, e.category,
                    e.event_date, e.start_time, e.end_time, e.venue,
                    e.capacity, e.visibility, e.organizer_id, e.image_url,
                    e.needs_volunteers, e.university, e.department_name,
                    e.allow_other_departments, e.allow_ticket_booking,
                    e.allow_payments, e.created_at
                ORDER BY e.event_date DESC, e.event_id DESC
            `);

        return res.json({ success: true, data: result.recordset, events: result.recordset });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/* ─────────────────────────────────────────
   GET ORGANIZER DETAILS + EVENTS
   GET /api/events/organizer/details/:organizerId
───────────────────────────────────────── */
router.get("/organizer/details/:organizerId", async (req, res) => {
    try {
        const organizerId = Number(req.params.organizerId);

        const organizerResult = await pool.request()
            .input("user_id", sql.Int, organizerId)
            .query(`
                SELECT user_id, full_name, email, role,
                       university, department_name,
                       allow_ticket_booking, allow_payments
                FROM [Users]
                WHERE user_id = @user_id
            `);

        if (organizerResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Organizer not found" });
        }

        const eventsResult = await pool.request()
            .input("organizer_id", sql.Int, organizerId)
            .query(`
                SELECT
                    e.event_id, e.title, e.description, e.category,
                    e.event_date, e.start_time, e.end_time, e.venue,
                    e.capacity, e.image_url, e.visibility, e.needs_volunteers,
                    e.university, e.department_name, e.allow_other_departments,
                    e.allow_ticket_booking, e.allow_payments,
                    COUNT(pr.registration_id) AS participant_count
                FROM [Event] e
                LEFT JOIN Participant_Registration pr ON pr.event_id = e.event_id
                WHERE e.organizer_id = @organizer_id
                GROUP BY
                    e.event_id, e.title, e.description, e.category,
                    e.event_date, e.start_time, e.end_time, e.venue,
                    e.capacity, e.image_url, e.visibility, e.needs_volunteers,
                    e.university, e.department_name, e.allow_other_departments,
                    e.allow_ticket_booking, e.allow_payments
                ORDER BY e.event_date DESC, e.event_id DESC
            `);

        return res.json({
            success: true,
            data: {
                organizer: organizerResult.recordset[0],
                events: eventsResult.recordset
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/* ─────────────────────────────────────────
   GET ORGANIZER DASHBOARD
   GET /api/events/organizer/dashboard/:user_id
───────────────────────────────────────── */
router.get("/organizer/dashboard/:user_id", async (req, res) => {
    try {
        const userId = Number(req.params.user_id);

        const organizerResult = await pool.request()
            .input("user_id", sql.Int, userId)
            .query(`
                SELECT user_id, full_name, email, role,
                       university, department_name,
                       allow_ticket_booking, allow_payments
                FROM [Users]
                WHERE user_id = @user_id
            `);

        const eventsResult = await pool.request()
            .input("organizer_id", sql.Int, userId)
            .query(`
                SELECT
                    e.event_id, e.title, e.description, e.image_url,
                    e.event_date, e.start_time, e.end_time, e.venue,
                    e.capacity, e.category, e.visibility, e.needs_volunteers,
                    e.university, e.department_name, e.allow_other_departments,
                    e.allow_ticket_booking, e.allow_payments,
                    COUNT(pr.registration_id) AS participant_count
                FROM [Event] e
                LEFT JOIN Participant_Registration pr ON pr.event_id = e.event_id
                WHERE e.organizer_id = @organizer_id
                GROUP BY
                    e.event_id, e.title, e.description, e.image_url,
                    e.event_date, e.start_time, e.end_time, e.venue,
                    e.capacity, e.category, e.visibility, e.needs_volunteers,
                    e.university, e.department_name, e.allow_other_departments,
                    e.allow_ticket_booking, e.allow_payments
                ORDER BY e.event_id DESC
            `);

        const regResult = await pool.request()
            .input("organizer_id", sql.Int, userId)
            .query(`
                SELECT COUNT(*) AS totalRegistrations
                FROM Participant_Registration pr
                INNER JOIN [Event] e ON pr.event_id = e.event_id
                WHERE e.organizer_id = @organizer_id
            `);

        const volunteerResult = await pool.request()
            .input("organizer_id", sql.Int, userId)
            .query(`
                SELECT COUNT(*) AS totalVolunteers
                FROM Participant_Registration pr
                INNER JOIN [Event] e ON pr.event_id = e.event_id
                WHERE e.organizer_id = @organizer_id
                AND pr.role = 'volunteer'
            `);

        res.json({
            success: true,
            organizer: organizerResult.recordset[0] || null,
            totalEvents: eventsResult.recordset.length,
            totalRegistrations: regResult.recordset[0].totalRegistrations || 0,
            totalVolunteers: volunteerResult.recordset[0].totalVolunteers || 0,
            revenue: 0,
            pending: 0,
            events: eventsResult.recordset
        });
    } catch (err) {
        console.error("DASHBOARD ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ─────────────────────────────────────────
   GET USER INFO
   GET /api/events/user/:id
───────────────────────────────────────── */
router.get("/user/:id", async (req, res) => {
    try {
        const userId = Number(req.params.id);

        const result = await pool.request()
            .input("user_id", sql.Int, userId)
            .query(`
                SELECT user_id, full_name, university, department_name
                FROM [Users]
                WHERE user_id = @user_id
            `);

        if (!result.recordset.length) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, data: result.recordset[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ─────────────────────────────────────────
   GET PARTICIPANTS FOR AN EVENT
   GET /api/events/:event_id/participants
───────────────────────────────────────── */
router.get("/:event_id/participants", async (req, res) => {
    try {
        const eventId = Number(req.params.event_id);

        if (isNaN(eventId)) {
            return res.status(400).json({ success: false, message: "Invalid event ID" });
        }

        const eventCheck = await pool.request()
            .input("event_id", sql.Int, eventId)
            .query(`SELECT event_id FROM [Event] WHERE event_id = @event_id`);

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

/* ─────────────────────────────────────────
   GET REGISTRATIONS FOR AN EVENT
   GET /api/events/:id/registrations
───────────────────────────────────────── */
router.get("/:id/registrations", async (req, res) => {
    try {
        const eventId = Number(req.params.id);

        const result = await pool.request()
            .input("event_id", sql.Int, eventId)
            .query(`
                SELECT
                    pr.registration_id, pr.user_id, pr.participant_type,
                    pr.faculty_name, pr.university_name, pr.contact_no,
                    pr.notes, pr.role, pr.status, pr.registration_date,
                    u.full_name, u.email
                FROM Participant_Registration pr
                INNER JOIN [Users] u ON pr.user_id = u.user_id
                WHERE pr.event_id = @event_id
                ORDER BY pr.registration_date DESC
            `);

        return res.json({ success: true, registrations: result.recordset });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/* ─────────────────────────────────────────
   UPDATE PARTICIPANT STATUS
   PUT /api/registrations/:id/status
───────────────────────────────────────── */
router.put("/registrations/:id/status", async (req, res) => {
    try {
        const rid = Number(req.params.id);
        const { status } = req.body;

        const allowed = ['pending', 'confirmed', 'cancelled', 'waitlisted'];
        if (!status || !allowed.includes(status)) {
            return res.status(400).json({ success: false, message: `Status must be one of: ${allowed.join(', ')}` });
        }

        const check = await pool.request()
            .input("registration_id", sql.Int, rid)
            .query(`SELECT registration_id FROM Participant_Registration WHERE registration_id = @registration_id`);

        if (check.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Registration not found" });
        }

        await pool.request()
            .input("registration_id", sql.Int, rid)
            .input("status", sql.NVarChar(50), status)
            .query(`
                UPDATE Participant_Registration
                SET status = @status
                WHERE registration_id = @registration_id
            `);

        return res.json({ success: true, message: `Status updated to ${status}` });
    } catch (err) {
        console.error("STATUS UPDATE ERROR:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

/* ─────────────────────────────────────────
   GET SINGLE EVENT
   GET /api/events/:id
   NOTE: must come AFTER all specific /:id/xxx routes
───────────────────────────────────────── */
router.get("/:id", async (req, res) => {
    try {
        const eventId = Number(req.params.id);

        const result = await pool.request()
            .input("event_id", sql.Int, eventId)
            .query(`
                SELECT
                    e.event_id, e.title, e.description, e.category,
                    e.event_date, e.start_time, e.end_time, e.venue,
                    e.capacity, e.visibility, e.organizer_id, e.image_url,
                    e.needs_volunteers, e.university, e.department_name,
                    e.allow_other_departments, e.allow_ticket_booking,
                    e.allow_payments, e.created_at,
                    COUNT(pr.registration_id) AS participant_count
                FROM [Event] e
                LEFT JOIN Participant_Registration pr ON pr.event_id = e.event_id
                WHERE e.event_id = @event_id
                GROUP BY
                    e.event_id, e.title, e.description, e.category,
                    e.event_date, e.start_time, e.end_time, e.venue,
                    e.capacity, e.visibility, e.organizer_id, e.image_url,
                    e.needs_volunteers, e.university, e.department_name,
                    e.allow_other_departments, e.allow_ticket_booking,
                    e.allow_payments, e.created_at
            `);

        if (!result.recordset.length) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        res.json({
            success: true,
            data: { event: result.recordset[0] },
            event: result.recordset[0]
        });
    } catch (err) {
        console.error("GET EVENT ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ─────────────────────────────────────────
   CREATE EVENT
   POST /api/events
───────────────────────────────────────── */
router.post("/", upload.single("cover_image"), async (req, res) => {
    try {
        const {
            title, description, category, event_date,
            start_time, end_time, venue, capacity, visibility,
            user_id, organizer_id, needs_volunteers, university,
            department_name, allow_other_departments,
            allow_ticket_booking, allow_payments
        } = req.body;

        const organizerId = Number(user_id || organizer_id);

        if (!title || !event_date || !organizerId) {
            return res.status(400).json({
                success: false,
                message: "title, event_date and user_id are required"
            });
        }

        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const result = await pool.request()
            .input("title",                   sql.NVarChar(255),     title)
            .input("description",             sql.NVarChar(sql.MAX), description || "")
            .input("category",                sql.NVarChar(100),     category || "academic")
            .input("event_date",              sql.Date,              new Date(event_date))
            .input("start_time",              sql.NVarChar(20),      formatTime(start_time))
            .input("end_time",                sql.NVarChar(20),      formatTime(end_time))
            .input("venue",                   sql.NVarChar(255),     venue || "")
            .input("capacity",                sql.Int,               capacity ? Number(capacity) : 0)
            .input("visibility",              sql.NVarChar(20),      visibility || "Public")
            .input("organizer_id",            sql.Int,               organizerId)
            .input("image_url",               sql.NVarChar(500),     imageUrl)
            .input("needs_volunteers",        sql.Bit,               parseBool(needs_volunteers))
            .input("university",              sql.NVarChar(255),     university || "")
            .input("department_name",         sql.NVarChar(255),     department_name || "")
            .input("allow_other_departments", sql.Bit,               parseBool(allow_other_departments))
            .input("allow_ticket_booking",    sql.Bit,               parseBool(allow_ticket_booking))
            .input("allow_payments",          sql.Bit,               parseBool(allow_payments))
            .query(`
                INSERT INTO [Event]
                (title, description, category, event_date, start_time, end_time,
                 venue, capacity, visibility, organizer_id, image_url, needs_volunteers,
                 university, department_name, allow_other_departments,
                 allow_ticket_booking, allow_payments)
                OUTPUT INSERTED.event_id
                VALUES
                (@title, @description, @category, @event_date, @start_time, @end_time,
                 @venue, @capacity, @visibility, @organizer_id, @image_url, @needs_volunteers,
                 @university, @department_name, @allow_other_departments,
                 @allow_ticket_booking, @allow_payments)
            `);

        const eventId = result.recordset[0].event_id;

        res.status(201).json({
            success: true,
            eventId,
            event_id: eventId,
            eventCode: `UCE${eventId}`,
            allow_ticket_booking: parseBool(allow_ticket_booking),
            allow_payments: parseBool(allow_payments)
        });
    } catch (err) {
        console.error("CREATE EVENT ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ─────────────────────────────────────────
   REGISTER PARTICIPANT FOR EVENT
   POST /api/events/:id/register
───────────────────────────────────────── */
router.post("/:id/register", async (req, res) => {
    try {
        const eventId = Number(req.params.id);
        const { user_id, participant_type, faculty_name, university_name, contact_no, notes, role } = req.body;

        if (!user_id) {
            return res.status(400).json({ success: false, message: "User ID is required" });
        }

        const existing = await pool.request()
            .input("event_id", sql.Int, eventId)
            .input("user_id",  sql.Int, user_id)
            .query(`
                SELECT registration_id FROM Participant_Registration
                WHERE event_id = @event_id AND user_id = @user_id
            `);

        if (existing.recordset.length > 0) {
            return res.status(400).json({ success: false, message: "User already registered for this event" });
        }

        await pool.request()
            .input("event_id",         sql.Int,               eventId)
            .input("user_id",          sql.Int,               user_id)
            .input("participant_type", sql.NVarChar(100),     participant_type || "participant")
            .input("faculty_name",     sql.NVarChar(255),     faculty_name    || "")
            .input("university_name",  sql.NVarChar(255),     university_name || "")
            .input("contact_no",       sql.NVarChar(50),      contact_no      || "")
            .input("notes",            sql.NVarChar(sql.MAX), notes           || "")
            .input("role",             sql.NVarChar(100),     role            || "participant")
            .query(`
                INSERT INTO Participant_Registration
                (user_id, event_id, participant_type, faculty_name,
                 university_name, contact_no, notes, role, status)
                VALUES
                (@user_id, @event_id, @participant_type, @faculty_name,
                 @university_name, @contact_no, @notes, @role, 'pending')
            `);

        return res.json({ success: true, message: "Registration successful" });
    } catch (err) {
        console.error("REGISTER ERROR:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

/* ─────────────────────────────────────────
   VOLUNTEER FOR EVENT
   POST /api/events/:id/volunteer
───────────────────────────────────────── */
router.post("/:id/volunteer", async (req, res) => {
    try {
        const eventId = Number(req.params.id);
        const { user_id, task } = req.body;

        if (!user_id) {
            return res.status(400).json({ success: false, message: "User ID required" });
        }

        const existing = await pool.request()
            .input("event_id", sql.Int, eventId)
            .input("user_id",  sql.Int, user_id)
            .query(`
                SELECT registration_id FROM Participant_Registration
                WHERE event_id = @event_id AND user_id = @user_id AND role = 'volunteer'
            `);

        if (existing.recordset.length > 0) {
            return res.status(400).json({ success: false, message: "Already applied as volunteer" });
        }

        await pool.request()
            .input("event_id",         sql.Int,               eventId)
            .input("user_id",          sql.Int,               user_id)
            .input("participant_type", sql.NVarChar(100),     "volunteer")
            .input("notes",            sql.NVarChar(sql.MAX), task || "")
            .input("role",             sql.NVarChar(100),     "volunteer")
            .query(`
                INSERT INTO Participant_Registration
                (user_id, event_id, participant_type, notes, role, status)
                VALUES
                (@user_id, @event_id, @participant_type, @notes, @role, 'pending')
            `);

        return res.json({ success: true, message: "Volunteer registration successful" });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/* ─────────────────────────────────────────
   UPDATE EVENT
   PUT /api/events/:id
───────────────────────────────────────── */
router.put("/:id", upload.single("cover_image"), async (req, res) => {
    try {
        const eventId = Number(req.params.id);
        const {
            title, description, category, event_date,
            start_time, end_time, venue, capacity, visibility,
            remove_image, needs_volunteers, university, department_name,
            allow_other_departments, allow_ticket_booking, allow_payments
        } = req.body;

        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        const shouldRemoveImage = remove_image === "true" || remove_image === "1";

        await pool.request()
            .input("event_id",                sql.Int,           eventId)
            .input("title",                   sql.NVarChar(255), title || null)
            .input("description",             sql.NVarChar(sql.MAX), description || null)
            .input("category",                sql.NVarChar(100), category || null)
            .input("event_date",              sql.Date,          event_date ? new Date(event_date) : null)
            .input("start_time",              sql.NVarChar(20),  formatTime(start_time))
            .input("end_time",                sql.NVarChar(20),  formatTime(end_time))
            .input("venue",                   sql.NVarChar(255), venue || null)
            .input("capacity",                sql.Int,           capacity ? Number(capacity) : null)
            .input("visibility",              sql.NVarChar(20),  visibility || null)
            .input("image_url",               sql.NVarChar(500), imageUrl)
            .input("remove_image",            sql.Bit,           shouldRemoveImage)
            .input("university",              sql.NVarChar(255), university || null)
            .input("department_name",         sql.NVarChar(255), department_name || null)
            .input("needs_volunteers",        sql.Bit,           needs_volunteers        !== undefined ? parseBool(needs_volunteers)        : null)
            .input("allow_other_departments", sql.Bit,           allow_other_departments !== undefined ? parseBool(allow_other_departments) : null)
            .input("allow_ticket_booking",    sql.Bit,           allow_ticket_booking    !== undefined ? parseBool(allow_ticket_booking)    : null)
            .input("allow_payments",          sql.Bit,           allow_payments          !== undefined ? parseBool(allow_payments)          : null)
            .query(`
                UPDATE [Event] SET
                    title           = COALESCE(@title, title),
                    description     = COALESCE(@description, description),
                    category        = COALESCE(@category, category),
                    event_date      = COALESCE(@event_date, event_date),
                    start_time      = COALESCE(@start_time, start_time),
                    end_time        = COALESCE(@end_time, end_time),
                    venue           = COALESCE(@venue, venue),
                    capacity        = COALESCE(@capacity, capacity),
                    visibility      = COALESCE(@visibility, visibility),
                    university      = COALESCE(@university, university),
                    department_name = COALESCE(@department_name, department_name),
                    needs_volunteers        = CASE WHEN @needs_volunteers        IS NOT NULL THEN @needs_volunteers        ELSE needs_volunteers        END,
                    allow_other_departments = CASE WHEN @allow_other_departments IS NOT NULL THEN @allow_other_departments ELSE allow_other_departments END,
                    allow_ticket_booking    = CASE WHEN @allow_ticket_booking    IS NOT NULL THEN @allow_ticket_booking    ELSE allow_ticket_booking    END,
                    allow_payments          = CASE WHEN @allow_payments          IS NOT NULL THEN @allow_payments          ELSE allow_payments          END,
                    image_url = CASE
                        WHEN @remove_image = 1      THEN NULL
                        WHEN @image_url IS NOT NULL THEN @image_url
                        ELSE image_url
                    END
                WHERE event_id = @event_id
            `);

        return res.json({ success: true, message: "Event updated successfully" });
    } catch (err) {
        console.error("UPDATE EVENT ERROR:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

/* ─────────────────────────────────────────
   DELETE EVENT
   DELETE /api/events/:id
───────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
    try {
        const eventId = Number(req.params.id);

        await pool.request()
            .input("event_id", sql.Int, eventId)
            .query(`DELETE FROM [Event] WHERE event_id = @event_id`);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
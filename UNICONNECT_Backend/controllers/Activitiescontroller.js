const sql = require("mssql");

async function getMyActivities(req, res) {
  const userId = parseInt(req.params.userId, 10);

  const requesterId = req.user.user_id || req.user.id;
  const requesterRole = (req.user.role || "").toLowerCase();

  if (parseInt(requesterId) !== userId && requesterRole !== "admin") {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  try {
    const pool = await sql.connect();

    const [regResult, volResult, ticketResult, attResult, feedbackResult] = await Promise.all([

      // 1. EVENT REGISTRATIONS
      pool.request()
        .input("uid", sql.Int, userId)
        .query(`
          SELECT
            pr.registration_id,
            pr.event_id,
            pr.registration_date,
            pr.status,
            pr.participant_type,
            pr.role,
            pr.notes,
            e.title       AS event_title,
            e.description,
            e.event_date,
            e.venue,
            e.category,
            e.start_time,
            e.end_time,
            e.image_url,
            u.department_name
          FROM dbo.Participant_Registration pr
          JOIN dbo.Event e ON e.event_id = pr.event_id
          JOIN dbo.Users u ON u.user_id  = pr.user_id
          WHERE pr.user_id = @uid
          ORDER BY pr.registration_date DESC
        `),

      // 2. VOLUNTEER APPLICATIONS
      pool.request()
        .input("uid", sql.Int, userId)
        .query(`
          SELECT
            v.volunteer_id,
            v.event_id,
            v.role        AS volunteer_role,
            v.assigned_task AS responsibilities,
            v.status,
            v.skills,
            v.group_name,
            v.assigned_at AS applied_at,
            e.title       AS event_title,
            e.description,
            e.event_date,
            e.venue,
            e.category,
            e.start_time,
            e.end_time,
            e.image_url,
            u.department_name
          FROM dbo.Volunteer v
          JOIN dbo.Event e ON e.event_id = v.event_id
          JOIN dbo.Users u ON u.user_id  = v.user_id
          WHERE v.user_id = @uid
          ORDER BY v.assigned_at DESC
        `),

      // 3. TICKET BOOKINGS
      pool.request()
        .input("uid", sql.Int, userId)
        .query(`
          SELECT
            t.ticket_id,
            t.event_id,
            t.ticket_type,
            t.quantity,
            t.ticket_price,
            t.total_amount,
            t.booking_date,
            t.booking_status,
            p.payment_id,
            p.payment_status,
            p.payment_method,
            p.amount        AS paid_amount,
            p.transaction_id,
            p.payment_date,
            e.title         AS event_title,
            e.description,
            e.event_date,
            e.venue,
            e.category,
            e.start_time,
            e.end_time,
            e.image_url,
            u.department_name
          FROM dbo.Tickets t
          JOIN dbo.Event e        ON e.event_id  = t.event_id
          JOIN dbo.Users u        ON u.user_id   = t.user_id
          LEFT JOIN dbo.Payments p ON p.ticket_id = t.ticket_id
          WHERE t.user_id = @uid
          ORDER BY t.booking_date DESC
        `),

      // 4. ATTENDANCE
      pool.request()
        .input("uid", sql.Int, userId)
        .query(`
          SELECT
            a.attendance_id,
            a.event_id,
            a.status      AS attendance_status,
            e.title       AS event_title,
            e.description,
            e.event_date,
            e.venue,
            e.category,
            e.start_time,
            e.end_time,
            e.image_url,
            u.department_name
          FROM dbo.Attendance a
          JOIN dbo.Event e ON e.event_id = a.event_id
          JOIN dbo.Users u ON u.user_id  = a.user_id
          WHERE a.user_id = @uid
          ORDER BY e.event_date DESC
        `),

      // 5. FEEDBACK
      pool.request()
        .input("uid", sql.Int, userId)
        .query(`
          SELECT
            f.feedback_id,
            f.event_id,
            f.rating,
            f.comments,
            f.feedback_date,
            e.title     AS event_title,
            e.event_date,
            e.image_url,
            e.category
          FROM dbo.Feedback f
          JOIN dbo.Event e ON e.event_id = f.event_id
          WHERE f.user_id = @uid
          ORDER BY f.feedback_date DESC
        `)
    ]);

    const regs     = regResult.recordset     || [];
    const vols     = volResult.recordset     || [];
    const tickets  = ticketResult.recordset  || [];
    const att      = attResult.recordset     || [];
    const feedback = feedbackResult.recordset || [];

    const stats = {
      total_registrations   : regs.length,
      confirmed_events      : regs.filter(r => ["confirmed","approved"].includes((r.status||"").toLowerCase())).length,
      pending_registrations : regs.filter(r => (r.status||"").toLowerCase() === "pending").length,
      volunteer_roles       : vols.length,
      tickets_booked        : tickets.length,
      attended_events       : att.filter(a => (a.attendance_status||"").toLowerCase() === "present").length,
      feedback_given        : feedback.length,
    };

    return res.json({
      success       : true,
      stats,
      registrations : regs,
      volunteers    : vols,
      tickets,
      attendance    : att,
      feedback,
    });

  } catch (err) {
    console.error("[getMyActivities] DB error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
}

/**
 * DELETE /api/activities/registration/:id
 */
async function cancelRegistration(req, res) {
  const regId  = parseInt(req.params.id, 10);
  const userId = req.user.user_id || req.user.id;

  try {
    const pool = await sql.connect();

    const check = await pool.request()
      .input("rid", sql.Int, regId)
      .input("uid", sql.Int, userId)
      .query("SELECT registration_id FROM dbo.Participant_Registration WHERE registration_id=@rid AND user_id=@uid");

    if (!check.recordset.length)
      return res.status(404).json({ success: false, message: "Registration not found or not yours" });

    await pool.request()
      .input("rid", sql.Int, regId)
      .query("DELETE FROM dbo.Participant_Registration WHERE registration_id=@rid");

    return res.json({ success: true, message: "Registration cancelled successfully" });
  } catch (err) {
    console.error("[cancelRegistration] DB error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * DELETE /api/activities/volunteer/:id
 */
async function withdrawVolunteer(req, res) {
  const volId  = parseInt(req.params.id, 10);
  const userId = req.user.user_id || req.user.id;

  try {
    const pool = await sql.connect();

    const check = await pool.request()
      .input("vid", sql.Int, volId)
      .input("uid", sql.Int, userId)
      .query("SELECT volunteer_id FROM dbo.Volunteer WHERE volunteer_id=@vid AND user_id=@uid");

    if (!check.recordset.length)
      return res.status(404).json({ success: false, message: "Volunteer record not found or not yours" });

    await pool.request()
      .input("vid", sql.Int, volId)
      .query("DELETE FROM dbo.Volunteer WHERE volunteer_id=@vid");

    return res.json({ success: true, message: "Volunteer application withdrawn successfully" });
  } catch (err) {
    console.error("[withdrawVolunteer] DB error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/activities/organizer/:userId
 */
async function getOrganizerActivities(req, res) {
  const userId = parseInt(req.params.userId, 10);
  const requesterId = req.user.user_id || req.user.id;
  const requesterRole = (req.user.role || "").toLowerCase();

  if (parseInt(requesterId) !== userId && requesterRole !== "admin") {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  try {
    const pool = await sql.connect();

    const [eventsResult, regsResult, volResult, ticketResult, attResult] = await Promise.all([

      // 1. EVENTS CREATED BY THIS ORGANIZER
      pool.request()
        .input("uid", sql.Int, userId)
        .query(`
          SELECT
            e.event_id,
            e.title         AS event_title,
            e.description,
            e.event_date,
            e.venue,
            e.category,
            e.start_time,
            e.end_time,
            e.image_url,
            e.visibility,
            e.capacity,
            e.created_at,
            e.needs_volunteers,
            e.allow_ticket_booking,
            e.allow_payments,
            u.department_name,
            (SELECT COUNT(*) FROM dbo.Participant_Registration pr WHERE pr.event_id = e.event_id) AS registrant_count,
            (SELECT COUNT(*) FROM dbo.Volunteer v WHERE v.event_id = e.event_id) AS volunteer_count
          FROM dbo.Event e
          LEFT JOIN dbo.Users u ON u.user_id = e.organizer_id
          WHERE e.organizer_id = @uid
          ORDER BY e.event_date DESC
        `),

      // 2. REGISTRATIONS ON THIS ORGANIZER'S EVENTS
      pool.request()
        .input("uid", sql.Int, userId)
        .query(`
          SELECT
            pr.registration_id,
            pr.event_id,
            pr.registration_date,
            pr.status,
            pr.participant_type,
            pr.role,
            pr.notes,
            e.title         AS event_title,
            e.description,
            e.event_date,
            e.venue,
            e.category,
            e.start_time,
            e.end_time,
            e.image_url,
            su.full_name    AS student_name,
            su.email        AS student_email,
            su.department_name AS student_department
          FROM dbo.Participant_Registration pr
          JOIN dbo.Event e ON e.event_id = pr.event_id
          JOIN dbo.Users su ON su.user_id = pr.user_id
          WHERE e.organizer_id = @uid
          ORDER BY pr.registration_date DESC
        `),

      // 3. VOLUNTEERS ON THIS ORGANIZER'S EVENTS
      pool.request()
        .input("uid", sql.Int, userId)
        .query(`
          SELECT
            v.volunteer_id,
            v.event_id,
            v.role          AS volunteer_role,
            v.assigned_task AS responsibilities,
            v.status,
            v.skills,
            v.group_name,
            v.assigned_at   AS applied_at,
            e.title         AS event_title,
            e.description,
            e.event_date,
            e.venue,
            e.category,
            e.start_time,
            e.end_time,
            e.image_url,
            su.full_name    AS student_name,
            su.email        AS student_email,
            su.department_name AS student_department
          FROM dbo.Volunteer v
          JOIN dbo.Event e ON e.event_id = v.event_id
          JOIN dbo.Users su ON su.user_id = v.user_id
          WHERE e.organizer_id = @uid
          ORDER BY v.assigned_at DESC
        `),

      // 4. TICKET BOOKINGS ON THIS ORGANIZER'S EVENTS
      pool.request()
        .input("uid", sql.Int, userId)
        .query(`
          SELECT
            t.ticket_id,
            t.event_id,
            t.ticket_type,
            t.quantity,
            t.ticket_price,
            t.total_amount,
            t.booking_date,
            t.booking_status,
            p.payment_id,
            p.payment_status,
            p.payment_method,
            p.amount        AS paid_amount,
            p.transaction_id,
            p.payment_date,
            e.title         AS event_title,
            e.description,
            e.event_date,
            e.venue,
            e.category,
            e.start_time,
            e.end_time,
            e.image_url,
            su.full_name    AS student_name,
            su.email        AS student_email
          FROM dbo.Tickets t
          JOIN dbo.Event e        ON e.event_id  = t.event_id
          JOIN dbo.Users su       ON su.user_id  = t.user_id
          LEFT JOIN dbo.Payments p ON p.ticket_id = t.ticket_id
          WHERE e.organizer_id = @uid
          ORDER BY t.booking_date DESC
        `),

      // 5. ATTENDANCE ON THIS ORGANIZER'S EVENTS
      pool.request()
        .input("uid", sql.Int, userId)
        .query(`
          SELECT
            a.attendance_id,
            a.event_id,
            a.status        AS attendance_status,
            e.title         AS event_title,
            e.description,
            e.event_date,
            e.venue,
            e.category,
            e.start_time,
            e.end_time,
            e.image_url,
            su.full_name    AS student_name,
            su.email        AS student_email,
            su.department_name AS student_department
          FROM dbo.Attendance a
          JOIN dbo.Event e ON e.event_id = a.event_id
          JOIN dbo.Users su ON su.user_id = a.user_id
          WHERE e.organizer_id = @uid
          ORDER BY e.event_date DESC
        `)
    ]);

    const events  = eventsResult.recordset || [];
    const regs    = regsResult.recordset   || [];
    const vols    = volResult.recordset    || [];
    const tickets = ticketResult.recordset || [];
    const att     = attResult.recordset    || [];

    // Debug logging — remove once confirmed working
    console.log(`[getOrganizerActivities] userId=${userId} → events found: ${events.length}`);
    if (events.length === 0) {
      const check = await pool.request()
        .query(`SELECT event_id, title, organizer_id FROM dbo.Event`);
      console.log("[getOrganizerActivities] All events in DB:", check.recordset);
    }

    const today = new Date().toISOString().split("T")[0];

    const stats = {
      total_events       : events.length,
      upcoming_events    : events.filter(e => (e.event_date||"").toString().split("T")[0] >= today).length,
      total_registrations: regs.length,
      confirmed_regs     : regs.filter(r => ["confirmed","approved"].includes((r.status||"").toLowerCase())).length,
      pending_regs       : regs.filter(r => (r.status||"").toLowerCase() === "pending").length,
      total_volunteers   : vols.length,
      approved_volunteers: vols.filter(v => (v.status||"").toLowerCase() === "approved").length,
      total_tickets      : tickets.length,
      total_attendance   : att.filter(a => (a.attendance_status||"").toLowerCase() === "present").length,
    };

    return res.json({
      success      : true,
      stats,
      events,
      registrations: regs,
      volunteers   : vols,
      tickets,
      attendance   : att,
    });

  } catch (err) {
    console.error("[getOrganizerActivities] DB error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
}

module.exports = {
  getMyActivities,
  cancelRegistration,
  withdrawVolunteer,
  getOrganizerActivities,
};
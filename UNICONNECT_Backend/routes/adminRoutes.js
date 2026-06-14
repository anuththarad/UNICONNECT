// routes/adminRoutes.js
// UniConnect Admin API Routes
// Covers: Users, Events, Registrations, Volunteers, Logs, Announcements, Stats

const express = require("express");
const router  = express.Router();

const authMiddleware  = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const adminCtrl   = require("../controllers/adminController");
const userCtrl    = require("../controllers/userController");
const eventCtrl   = require("../controllers/eventController");
const regCtrl     = require("../controllers/registrationController");
const volCtrl     = require("../controllers/volunteerController");
const notifCtrl   = require("../controllers/notificationController");

// ─── All routes below require a valid JWT + admin role ───────────────────────
router.use(authMiddleware);
router.use(adminMiddleware);

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// GET /api/admin/stats  → aggregated counts for the dashboard cards
// ══════════════════════════════════════════════════════════════════════════════
router.get("/stats", adminCtrl.getDashboardStats);

// ══════════════════════════════════════════════════════════════════════════════
// USERS
// ══════════════════════════════════════════════════════════════════════════════
router.get   ("/users",            userCtrl.getAllUsers);
router.get   ("/users/:id",        userCtrl.getUserById);
router.put   ("/users/:id",        userCtrl.updateUser);
router.delete("/users/:id",        userCtrl.deleteUser);
router.patch ("/users/:id/role",   userCtrl.changeUserRole);
router.patch ("/users/:id/status", userCtrl.changeUserStatus);

// ══════════════════════════════════════════════════════════════════════════════
// EVENTS
// ══════════════════════════════════════════════════════════════════════════════
router.get   ("/events",       eventCtrl.getAllEvents);
router.get   ("/events/:id",   eventCtrl.getEventById);
router.put   ("/events/:id",   eventCtrl.updateEvent);
router.delete("/events/:id",   eventCtrl.deleteEvent);
router.patch ("/events/:id/approve", eventCtrl.approveEvent);

// ══════════════════════════════════════════════════════════════════════════════
// REGISTRATIONS
// ══════════════════════════════════════════════════════════════════════════════
router.get   ("/registrations",              regCtrl.getAllRegistrations);
router.patch ("/registrations/:id/approve",  regCtrl.approveRegistration);
router.patch ("/registrations/:id/reject",   regCtrl.rejectRegistration);
router.delete("/registrations/:id",          regCtrl.deleteRegistration);

// ══════════════════════════════════════════════════════════════════════════════
// VOLUNTEERS
// ══════════════════════════════════════════════════════════════════════════════
router.get   ("/volunteers",      volCtrl.getAllVolunteers);
router.delete("/volunteers/:id",  volCtrl.deleteVolunteer);
router.patch ("/volunteers/:id/status", volCtrl.updateVolunteerStatus);

// ══════════════════════════════════════════════════════════════════════════════
// LOGS  (audit trail)
// ══════════════════════════════════════════════════════════════════════════════
router.get("/logs", adminCtrl.getLogs);

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS / BROADCAST ANNOUNCEMENTS
// ══════════════════════════════════════════════════════════════════════════════
router.post("/notifications/broadcast", notifCtrl.broadcastAnnouncement);
router.get ("/notifications",           notifCtrl.getAllNotifications);

// ══════════════════════════════════════════════════════════════════════════════
// UNIVERSITIES  (lookup / management)
// ══════════════════════════════════════════════════════════════════════════════
router.get   ("/universities",       adminCtrl.getAllUniversities);
router.post  ("/universities",       adminCtrl.createUniversity);
router.delete("/universities/:id",   adminCtrl.deleteUniversity);

// ══════════════════════════════════════════════════════════════════════════════
// INTERESTS  (recommendation tags)
// ══════════════════════════════════════════════════════════════════════════════
router.get   ("/interests",      adminCtrl.getAllInterests);
router.post  ("/interests",      adminCtrl.createInterest);
router.delete("/interests/:id",  adminCtrl.deleteInterest);

// ══════════════════════════════════════════════════════════════════════════════
// TICKETS  &  PAYMENTS  (read-only overview for admin)
// ══════════════════════════════════════════════════════════════════════════════
router.get("/tickets",   adminCtrl.getAllTickets);
router.get("/payments",  adminCtrl.getAllPayments);
router.get("/payments/summary", adminCtrl.getPaymentSummary);

// ══════════════════════════════════════════════════════════════════════════════
// FEEDBACK  (admin overview)
// ══════════════════════════════════════════════════════════════════════════════
router.get("/feedback",         adminCtrl.getAllFeedback);
router.delete("/feedback/:id",  adminCtrl.deleteFeedback);

// ══════════════════════════════════════════════════════════════════════════════
// ATTENDANCE  (admin overview)
// ══════════════════════════════════════════════════════════════════════════════
router.get("/attendance", adminCtrl.getAllAttendance);

// ══════════════════════════════════════════════════════════════════════════════
// BUDGET  (admin overview per event)
// ══════════════════════════════════════════════════════════════════════════════
router.get("/budgets", adminCtrl.getAllBudgets);

module.exports = router;
// routes/activitiesRoutes.js
const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/authMiddleware");
const {
  getMyActivities,
  cancelRegistration,
  withdrawVolunteer,
  getOrganizerActivities,
} = require("../controllers/activitiesController");

// IMPORTANT: specific DELETE routes MUST come before the /:userId GET
// otherwise Express matches "registration" and "volunteer" as a userId param

// DELETE (cancel) a registration
router.delete("/registration/:id", auth, cancelRegistration);

// DELETE (withdraw) a volunteer application
router.delete("/volunteer/:id", auth, withdrawVolunteer);

// GET all activities for a student
router.get("/student/:userId", auth, getMyActivities);

// GET all activities for an organizer
router.get("/organizer/:userId", auth, getOrganizerActivities);

module.exports = router;
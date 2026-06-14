require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");
const { i18nextMiddleware, applyLocale } = require("./middleware/languageController");

const app = express();
const authMiddleware = require("./middleware/authMiddleware");
const { switchLanguage } = require("./controllers/languageSwitchController");

/* ============================================
   MIDDLEWARE
============================================ */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ============================================
   i18n — serve translation files to frontend
   then apply locale to every request
============================================ */
app.use("/locales", express.static(path.join(__dirname, "locales")));
app.use(i18nextMiddleware);
app.use(applyLocale);

/* ============================================
   LOGGER
============================================ */
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

/* ============================================
   LANGUAGE SWITCH ROUTE
============================================ */
app.post("/api/settings/language", authMiddleware, applyLocale, switchLanguage);

/* ============================================
   ROUTES
============================================ */
const authRoutes           = require("./routes/auth");
const eventRoutes          = require("./routes/events");
const budgetRoutes         = require("./routes/budget");
const studentRoutes        = require("./routes/student");
const profileRoutes        = require("./routes/profile");
const dashboardRoutes      = require("./routes/organizers");
const ticketRoutes         = require("./routes/ticket");
const participantRoutes    = require("./routes/participant");
const volunteerRoutes      = require("./routes/volunteers");
const volunteerChatRoutes  = require("./routes/volunteerchat");   // ← ADDED
const notificationRoutes   = require("./routes/notifications");
const feedbackRoutes       = require("./routes/feedbackRoutes");
const forgotPasswordRoutes = require("./routes/Forgotpassword");
const activitiesRoutes     = require("./routes/Activitiesroutes");

app.use("/api/auth",          authRoutes);
app.use("/api/auth",          forgotPasswordRoutes);

app.use("/api/events",        eventRoutes);

app.use("/api/registrations", participantRoutes);

app.use("/api/budgets",       budgetRoutes);
app.use("/api/volunteers",    volunteerRoutes);
app.use("/api/messages",      volunteerChatRoutes);               // ← ADDED
app.use("/api/student",       studentRoutes);
app.use("/api/users",         profileRoutes);
app.use("/api/dashboard",     dashboardRoutes);
app.use("/api/tickets",       ticketRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activities",    activitiesRoutes);
app.use("/api",               feedbackRoutes);

/* ============================================
   TEST ROUTES
============================================ */
app.get("/ping", (req, res) => {
  res.json({ success: true, message: "UniConnect Backend Running" });
});

app.get("/test-i18n", (req, res) => {
  res.json({
    locale:    req.locale,
    welcome:   req.t("common.welcome", { name: "Anu" }),
    dashboard: req.t("nav.dashboard"),
    register:  req.t("events.register"),
  });
});

/* ============================================
   STATIC FILES
============================================ */
app.use("/tickets", express.static(path.join(__dirname, "storage", "tickets")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Frontend catch-all — must be last
app.use(express.static(path.join(__dirname, "../UNICONNECT_Frontend")));

/* ============================================
   GLOBAL ERROR HANDLER
============================================ */
app.use((err, req, res, next) => {
  console.error("EXPRESS ERROR:", err);
  res.status(500).json({ success: false, message: err.message });
});

/* ============================================
   START SERVER
============================================ */
const PORT = process.env.PORT || 3000;
const { verifyConnection } = require("./utils/mailer");

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Test i18n at: http://localhost:${PORT}/test-i18n`);
  console.log(`Test Tamil:   http://localhost:${PORT}/test-i18n?lng=ta`);
  console.log(`Test Sinhala: http://localhost:${PORT}/test-i18n?lng=si`);

  try {
    await verifyConnection();
    console.log("Email service connected successfully");
  } catch (err) {
    console.error("Email service connection failed:", err.message);
  }
});
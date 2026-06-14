const translate = require('@vitalets/google-translate-api');
const fs = require('fs');
const path = require('path');

const TARGET_LANGS = {
  ta: 'ta',   // Tamil
  
  si: 'si'    // Sinhala
};

// ─── MASTER ENGLISH FILE ───────────────────────────────────────────────
// Add ALL your system strings here — every label, button, message, email,
// SMS, chatbot reply, PDF text, error — everything in one place.
// The script auto-translates this into ta, pt, si JSON files.

const MASTER = {
  common: {
    welcome: "Welcome, {{name}}",
    logout: "Logout",
    save: "Save",
    cancel: "Cancel",
    loading: "Loading...",
    error: "Something went wrong",
    success: "Done!",
    search: "Search",
    submit: "Submit",
    delete: "Delete",
    edit: "Edit",
    back: "Back",
    yes: "Yes",
    no: "No",
    confirm: "Confirm",
    close: "Close",
    view: "View",
    download: "Download",
    print: "Print",
    required: "This field is required",
    optional: "Optional"
  },
  nav: {
    dashboard: "Dashboard",
    events: "Events",
    settings: "Settings",
    profile: "Profile",
    notifications: "Notifications",
    reports: "Reports",
    users: "Users",
    logout: "Logout"
  },
  auth: {
    login: "Login",
    register: "Register",
    email: "Email address",
    password: "Password",
    confirm_password: "Confirm password",
    forgot_password: "Forgot password?",
    reset_password: "Reset password",
    login_success: "Login successful",
    login_failed: "Invalid email or password",
    logout_success: "You have been logged out",
    register_success: "Account created successfully",
    passwords_no_match: "Passwords do not match",
    email_exists: "Email already registered"
  },
  dashboard: {
    admin: {
      title: "Admin Dashboard",
      total_users: "Total Users",
      total_events: "Total Events",
      active_events: "Active Events",
      total_revenue: "Total Revenue",
      recent_activity: "Recent Activity",
      manage_users: "Manage Users",
      manage_events: "Manage Events",
      system_stats: "System Statistics"
    },
    organizer: {
      title: "Organizer Dashboard",
      my_events: "My Events",
      upcoming: "Upcoming Events",
      registrations: "Registrations",
      create_event: "Create Event",
      event_stats: "Event Statistics",
      attendees: "Attendees"
    },
    student: {
      title: "Student Dashboard",
      registered_events: "My Registered Events",
      upcoming_events: "Upcoming Events",
      past_events: "Past Events",
      browse_events: "Browse Events",
      certificates: "Certificates"
    }
  },
  events: {
    title: "Events",
    name: "Event Name",
    date: "Date",
    time: "Time",
    venue: "Venue",
    description: "Description",
    capacity: "Capacity",
    seats_left: "{{count}} seats left",
    register: "Register for this event",
    registered: "You are registered",
    full: "Event is full",
    cancelled: "Cancelled",
    upcoming: "Upcoming",
    ongoing: "Ongoing",
    completed: "Completed",
    created_success: "Event created successfully",
    updated_success: "Event updated successfully",
    deleted_success: "Event deleted successfully",
    registration_success: "You have registered for {{event}}",
    registration_failed: "Registration failed. Please try again.",
    cancel_registration: "Cancel Registration",
    registration_cancelled: "Your registration has been cancelled",
    no_events: "No events available at the moment",
    filter_by_date: "Filter by date",
    filter_by_category: "Filter by category"
  },
  settings: {
    title: "Settings",
    language: "Language",
    choose_language: "Choose your preferred language",
    language_saved: "Language updated successfully",
    profile_saved: "Profile updated successfully",
    change_password: "Change Password",
    current_password: "Current Password",
    new_password: "New Password",
    notification_prefs: "Notification Preferences",
    email_notifications: "Email Notifications",
    sms_notifications: "SMS Notifications"
  },
  notifications: {
    new: "You have {{count}} new notifications",
    none: "No new notifications",
    mark_read: "Mark all as read",
    event_reminder: "Reminder: {{event}} is tomorrow",
    registration_confirmed: "Registration confirmed for {{event}}",
    event_cancelled: "{{event}} has been cancelled",
    event_updated: "{{event}} has been updated"
  },
  email: {
    greeting: "Hello {{name}},",
    footer: "This is an automated message. Please do not reply to this email.",
    confirmation_subject: "Event Registration Confirmed",
    confirmation_body: "You have successfully registered for {{event}} on {{date}} at {{time}}, {{venue}}. Please arrive 15 minutes early.",
    reminder_subject: "Reminder: {{event}} is tomorrow",
    reminder_body: "This is a friendly reminder that {{event}} is scheduled for tomorrow at {{time}}, {{venue}}. We look forward to seeing you.",
    cancellation_subject: "Event Cancelled: {{event}}",
    cancellation_body: "We regret to inform you that {{event}} scheduled for {{date}} has been cancelled. We apologize for the inconvenience.",
    welcome_subject: "Welcome to the Event Management System",
    welcome_body: "Your account has been created successfully. You can now browse and register for events.",
    reset_subject: "Password Reset Request",
    reset_body: "We received a request to reset your password. Click the link below. This link expires in 1 hour. If you did not request this, ignore this email.",
    reset_button: "Reset My Password"
  },
  sms: {
    confirmation: "Confirmed: {{event}} on {{date}} at {{venue}}. - EMS",
    reminder: "Reminder: {{event}} tomorrow at {{time}}. See you there! - EMS",
    cancellation: "{{event}} on {{date}} has been cancelled. Sorry for the inconvenience. - EMS",
    otp: "Your EMS verification code is {{code}}. Expires in 10 minutes.",
    welcome: "Welcome to EMS! Your account is ready. Login at {{url}}"
  },
  chatbot: {
    greeting: "Hello! I am your Event Assistant. How can I help you today?",
    help_options: "I can help you with: 1) Browse events 2) Register for events 3) Check your registrations 4) Contact support",
    events_list: "Here are the upcoming events:",
    no_events: "There are no upcoming events at the moment. Check back soon!",
    register_help: "To register for an event, go to the Events page and click Register on any event you are interested in.",
    my_registrations: "Here are your current registrations:",
    no_registrations: "You have not registered for any events yet.",
    contact_support: "For further assistance, please email support@yourdomain.com or call our helpline.",
    unknown: "I did not understand that. Please try again or type HELP to see what I can do.",
    goodbye: "Thank you for using Event Assistant. Have a great day!"
  },
  pdf: {
    report_title: "Event Management System Report",
    generated_on: "Generated on {{date}}",
    event_name: "Event Name",
    participants: "Participants",
    registered: "Registered",
    attended: "Attended",
    revenue: "Revenue",
    status: "Status",
    total: "Total",
    summary: "Summary",
    page: "Page {{current}} of {{total}}",
    no_data: "No data available for this report",
    confidential: "Confidential - For internal use only"
  },
  errors: {
    not_found: "Page not found",
    unauthorized: "You are not authorized to view this page",
    forbidden: "Access denied",
    server_error: "Server error. Please try again later.",
    validation: "Please check your input and try again",
    network: "Network error. Please check your connection.",
    session_expired: "Your session has expired. Please login again."
  }
};

// ─── HELPER: preserve {{placeholders}} so translator doesn't break them ──
function protectPlaceholders(str) {
  const holders = [];
  // Replace {{name}} style placeholders with safe tokens
  const protected_ = str.replace(/\{\{[^}]+\}\}/g, (match) => {
    holders.push(match);
    return `__PH${holders.length - 1}__`;
  });
  return { protected_, holders };
}

function restorePlaceholders(str, holders) {
  return str.replace(/__PH(\d+)__/g, (_, i) => holders[i]);
}

// ─── HELPER: translate a flat object of strings ──────────────────────────
async function translateObject(obj, targetLang) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object') {
      result[key] = await translateObject(value, targetLang);
    } else if (typeof value === 'string') {
      try {
        const { protected_, holders } = protectPlaceholders(value);
        const { text } = await translate(protected_, { to: targetLang });
        result[key] = restorePlaceholders(text, holders);
        process.stdout.write('.');  // progress indicator
      } catch (err) {
        console.warn(`\nFailed translating "${key}" to ${targetLang} — keeping English`);
        result[key] = value;  // fallback to English on failure
      }
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── MAIN ────────────────────────────────────────────────────────────────
async function run() {
  // Always write English master first
  const enDir = path.join(__dirname, '../locales/en');
  fs.mkdirSync(enDir, { recursive: true });
  fs.writeFileSync(
    path.join(enDir, 'translation.json'),
    JSON.stringify(MASTER, null, 2)
  );
  console.log('Written: locales/en/translation.json');

  // Translate to each target language
  for (const [lang, code] of Object.entries(TARGET_LANGS)) {
    console.log(`\nTranslating to ${lang}...`);
    const translated = await translateObject(MASTER, code);

    const dir = path.join(__dirname, `../locales/${lang}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'translation.json'),
      JSON.stringify(translated, null, 2)
    );
    console.log(`\nWritten: locales/${lang}/translation.json`);
  }

  console.log('\nAll translations generated!');
}

run().catch(console.error);
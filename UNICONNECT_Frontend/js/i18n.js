/**
 * UniConnect i18n — Universal Translation Engine
 * ─────────────────────────────────────────────
 * Drop this ONE file into every HTML page with:
 *   <script src="i18n.js"></script>
 *
 * No other setup needed. It will:
 *  1. Detect the saved language preference (localStorage)
 *  2. Auto-translate every element with data-i18n="key"
 *  3. Auto-translate placeholders with data-i18n-placeholder="key"
 *  4. Sync any <select id="language-picker"> on the page
 *  5. Re-apply after dynamic content changes (MutationObserver)
 *
 * Usage in HTML:
 *   <span data-i18n="nav.dashboard">Dashboard</span>
 *   <input data-i18n-placeholder="budget.setup.org_id_placeholder">
 *   <select id="language-picker" onchange="i18n.change(this.value)">
 *     <option value="en">🌐 English</option>
 *     <option value="ta">தமிழ்</option>
 *     <option value="si">සිංහල</option>
 *   </select>
 */

const i18n = (() => {

  /* ═══════════════════════════════════════════════════════════════
     TRANSLATIONS
  ═══════════════════════════════════════════════════════════════ */
  const translations = {

  /* ════════════════════════════════════════════════════════════ EN */
  en: {
    brand: { name: "UniConnect" },

    roles: {
      admin: "Admin", admin_name: "Admin", super_admin: "Super Admin",
      admin_pill: "admin", students: "Students",
      organizers: "Organizers", admins: "Admins", student: "Student",
    },

    common: {
      done: "Done.", ok: "OK", message: "Message", loading: "Loading…",
      active: "Active", pending: "Pending", live: "Live", new: "new",
      search_users_events: "Search users, events…", search: "Search",
      view_all: "View all", refresh: "Refresh",
      close: "Close", cancel: "Cancel", delete: "Delete", save: "Save",
      submitting: "Submitting…",
    },

    nav: {
      section: {
        overview: "Overview", management: "Management", platform: "Platform",
        main_menu: "Main Menu", account: "Account",
      },
      dashboard: "Dashboard", users: "Users", events: "Events",
      registrations: "Registrations", volunteers: "Volunteer management",
      payments: "Payments", budget: "Budget Management",
      theme: "Theme", homepage: "Homepage", announce: "Announce",
      settings: "Settings", logs: "Logs", notifications: "Notifications",
      my_profile: "My Profile", browse_events: "Browse Events",
      my_registrations: "My Registrations", logout: "Logout",
      home: "Home", sign_up: "Sign Up", exit: "Exit", give_feedback: "Give Feedback",
    },

    table: {
      user: "User", role: "Role", joined: "Joined", university: "University",
      dept_faculty: "Dept / Faculty", actions: "Actions", student: "Student",
      status: "Status", volunteer: "Volunteer", amount: "Amount",
      method: "Method", time: "Time", action: "Action", detail: "Detail", ip: "IP",
      title: "Title", venue: "Venue",
    },

    status: { online: "System Online", all_running: "All services running" },

    filter: { all: "All", upcoming: "Upcoming", past: "Past" },

    users: { search_by_id: "Search by User ID…", filter: "Filter users…" },

    events: { loading: "Loading events…", filter: "Filter events…", date: "Date" },

    /* ── Dashboard ── */
    dashboard: {
      admin: {
        greeting: "Welcome back 👋",
        greeting_sub: "Loading platform overview…",
        total_users: "Total Users", total_events: "Total Events",
        organizers: "Organizers", recent_users: "Recent Users",
        todays_events: "Today's Events", pending_approvals: "Pending Approvals",
        activity_feed: "Activity Feed", full_log: "Full log",
        manage_users: "User Management", users_sub: "All registered accounts across the platform",
        manage_events: "Event Management", events_sub: "All events platform-wide",
        registrations_sub: "Review and manage all event registrations platform-wide",
        volunteers_sub: "All volunteer assignments and applications",
        payments_sub: "All ticket payments and transactions",
        no_events_today: "No events today", no_pending_regs: "No pending registrations",
        broadcast: "Broadcast", budget_sub: "View estimated vs actual costs, budget breakdowns per event",
        finance_badge: "Finance", needs_review: "needs review",
      },
      organizer: { registrations: "All Registrations" },
    },

    /* ── Organizer Dashboard ── */
    organizer_dash: {
      greeting_morning: "Good morning", greeting_afternoon: "Good afternoon",
      greeting_evening: "Good evening", greeting_night: "Good night",
      subtitle: "Manage your events from UniConnect",
      create_event: "Create Event",
      my_events: "My Created Events", my_events_sub: "Events published under your account",
      view_all: "View All →", recent_regs: "Recent Registrations",
      notifications: "Notifications", todays_events: "Today's Events",
      quick_stats: "Quick Stats",
      manage_participants: "Manage Participants for Your Events",
      manage_participants_sub: "Track attendees, manage registrations, and build stronger event communities — all from one place.",
      manage_participants_btn: "Manage Participants →",
      volunteers_banner: "Need Volunteers for Your Events?",
      volunteers_banner_sub: "Post volunteer opportunities and get students to help run your events smoothly.",
      volunteers_btn: "Post Opportunity →",
      total_events: "Total Events", total_registrants: "Total Registrants",
      pending_approvals: "Pending Approvals", upcoming_events: "Upcoming Events",
      no_events: "You haven't created any events yet.",
      create_first: "+ Create your first event",
      no_regs: "No registrations yet", no_notifs: "No notifications yet",
      no_today: "No events today", sign_out: "Sign Out",
      stat_created: "Total events created", stat_upcoming: "Upcoming events",
      stat_completed: "Completed events", stat_open: "Open to all depts",
      view_all_notifs: "View all notifications →",
      toast_deleted: "Event deleted successfully.",
      toast_delete_failed: "Delete failed. Try again.",
      delete_confirm_title: "Delete Event?",
      delete_confirm_text: "This action cannot be undone. The event will be permanently removed.",
      delete_btn: "Delete",
    },

    /* ── Theme ── */
    theme: {
      title: "Theme & Branding", subtitle: "Customize the platform's visual identity",
      preset_themes: "Preset Themes", preset_sub: "One-click color schemes",
      preset: { default: "Default", ocean: "Ocean", forest: "Forest", sunset: "Sunset", violet: "Violet", gold: "Gold" },
      primary_color: "Primary Color",
      platform_identity: "Platform Identity", identity_sub: "Logo, name and tagline",
      platform_name: "Platform Name", tagline: "Tagline", logo_path: "Logo Path",
      typography: "Typography", typography_sub: "Platform fonts and sizing",
      heading_font: "Heading Font", body_font: "Body Font", base_size: "Base Size",
      save: "Save Theme", save_branding: "Save Branding", save_typography: "Save Typography",
    },

    /* ── Homepage ── */
    homepage: {
      title: "Homepage Control", subtitle: "Edit banners, hero sections and featured content",
      hero_banner: "Hero Banner", banner_title: "Title", banner_subtitle: "Subtitle",
      gradient_start: "Gradient Start", gradient_end: "Gradient End", save_banner: "Save Banner",
      featured_events: "Featured Events", max_events: "Max Events on Homepage", sort_by: "Sort By",
      sort: { upcoming: "Upcoming First", most_reg: "Most Registered", recent: "Recently Created" },
      show_past: "Show Past Events",
      past: { hide: "No — Hide Past", show: "Yes — Show All" },
      notice_bar: "Notice Bar", enable_notice: "Enable Notice Bar",
      notice_sub: "Show banner on all pages", notice_style: "Style",
      style: { navy: "Navy", info: "Info Blue", amber: "Amber Warning", red: "Red Alert" },
      save_display: "Save Display", save_notice: "Save Notice Bar",
    },

    /* ── Announcements ── */
    announcements: {
      title: "Platform Announcements", subtitle: "Broadcast messages to all users",
      new: "New Announcement", new_sub: "Sent as platform notification",
      ann_title: "Title", title_placeholder: "e.g. System Maintenance Scheduled",
      body_placeholder: "Write your announcement here…", target: "Target",
      target_: { all: "All Users", students: "Students Only", organizers: "Organizers Only" },
      priority: "Priority",
      priority_: { normal: "Normal", urgent: "Urgent", info: "Informational" },
      send: "Send Announcement", history: "History", history_sub: "Previously sent broadcasts",
    },

    /* ── Settings ── */
    settings: {
      subtitle: "Global platform configuration", registration: "Registration",
      auto_approve: "Auto-approve Registrations", auto_approve_sub: "Skip manual approval",
      email_confirm: "Email Confirmations", email_confirm_sub: "Email on successful registration",
      allow_cancel: "Allow Cancellations", allow_cancel_sub: "Students can cancel",
      cross_dept: "Cross-Dept Events", cross_dept_sub: "Any dept student can register",
      req_approval: "Require Admin Approval", req_approval_sub: "Events go live after approval",
      req_images: "Require Event Images", req_images_sub: "Must upload before creating",
      featured: "Featured Section", featured_sub: "Show pinned events at top",
      auto_del: "Auto-delete Past Events", auto_del_sub: "Remove events older than 6 months",
      security: "Security",
      maintenance: "Maintenance Mode", maintenance_sub: "Show maintenance page to users",
      restrict_signup: "Restrict New Signups", restrict_signup_sub: "Disable new registrations",
      admin_2fa: "2FA for Admins", admin_2fa_sub: "Require two-factor auth",
      activity_log: "Activity Logging", activity_log_sub: "Log all admin actions",
      email_notif: "Email Notifications", email_notif_sub: "Email for platform events",
      inapp_notif: "In-app Notifications", inapp_notif_sub: "Bell icon notifications",
      reminders: "Event Reminders", reminders_sub: "24hr reminder before events",
      save_all: "Save All Settings",
    },

    /* ── Logs ── */
    logs: {
      title: "Activity Logs", subtitle: "Full audit trail of all platform actions",
      export_csv: "Export CSV",
    },

    /* ── All Events ── */
    allevents: {
      welcome_badge: "Welcome to UniConnect",
      find_event: "Find Your Event",
      hero_desc: "Discover workshops, competitions, networking sessions, sports meets, cultural festivals and more.",
      search_placeholder: "Search by title, category, venue or event code…",
      browse_all: "Browse all upcoming events",
      vol_prompt_msg: "You have been registered as a participant.",
      vol_prompt_volunteer: "This event also needs volunteers. Would you like to apply?",
      maybe_later: "Maybe Later", yes_volunteer: "Yes, Volunteer",
    },

    /* ── Event Details ── */
    eventdetails: {
      eyebrow: "UniConnect Event",
      vol_needed: "Volunteers Needed", vol_title: "We Need Volunteers!",
      vol_desc: "Join our volunteer team and help make this event a success.",
      vol_btn: "Register as Volunteer",
      feedback_title: "Attendee Feedback",
      feedback_sub: "Reviews submitted by people who attended this event.",
    },

    /* ── Registration Modal ── */
    modal: {
      reg_title: "Participant Registration",
      reg_sub: "Fill the form below to register for this event.",
      step1_label: "Step 1 — Verify Your Account",
      user_id_placeholder: "Enter your User ID",
      verify_user: "Verify User",
      step2_label: "Step 2 — Registration Details",
      participant: "Participant", audience: "Audience",
      faculty_placeholder: "Faculty / Department",
      university_placeholder: "University / Campus",
      phone_placeholder: "Phone Number",
      notes_placeholder: "Additional Notes (optional)",
      complete_reg: "Complete Registration",
      form_note_bold: "Check your details carefully.",
      form_note_body: "Make sure your university, department and contact info are correct before submitting.",
      success_title: "Registration Successful",
    },

    /* ── Volunteer ── */
    volunteer: {
      badge: "Volunteer",
      left_desc: "Join as a volunteer, support the event team and gain real-world experience.",
      application_title: "Volunteer Application",
      application_sub: "Complete the form below to apply as a volunteer for this event.",
      your_user_id: "Your User ID",
      email: "Email Address", email_placeholder: "your@email.com",
      phone: "Phone Number", phone_placeholder: "+94 7XX XXX XXX",
      preferred_role: "Preferred Role",
      role: {
        general: "General Volunteer", coordinator: "Event Coordinator",
        reg_desk: "Registration Desk", stage: "Stage Management",
        tech: "Technical Support", logistics: "Logistics",
        marketing: "Marketing & Promotion", security: "Security", photo: "Photography / Media",
      },
      task_label: "Task / What You Can Help With",
      task_placeholder: "Describe what you can help with at this event…",
      skills_label: "Relevant Skills",
      skill: {
        communication: "Communication", leadership: "Leadership", technical: "Technical",
        design: "Design", photography: "Photography", first_aid: "First Aid", driving: "Driving",
      },
      why_label: "Why do you want to volunteer?",
      why_placeholder: "Tell us why you want to be part of this event…",
      form_note: "Your application will be reviewed by the event organizer.",
      submit: "Submit Application",
    },

    /* ── Budget ── */
    budget: {
      title: "Budget Management System - Uniconnect",
      subtitle: "Plan, manage & track budget allocations with AI insights and analytics",
      export_report: "Export Report",
      ai_insights: "AI Insights",
      tab: {
        setup: "Setup", overview: "Overview", items: "Budget Items",
        analytics: "Analytics", forecast: "Forecast",
        category: "Category Split", planner: "Smart Planner",
      },
      setup: {
        find_event: "Find & Select Event",
        find_desc: "Enter your Organizer ID to load all your events from the database.",
        org_id: "Organizer ID", org_id_placeholder: "Enter organizer ID",
        search_btn: "Search Events", select_event: "Select This Event",
      },
      items: {
        add_title: "Add Budget Item",
        description: "Description", desc_placeholder: "e.g. Venue booking",
        category: "Category", priority: "Priority",
        estimated: "Estimated Cost (Rs.)", actual: "Actual Cost (Rs.)",
        cost_placeholder: "0.00",
        vendor: "Vendor / Supplier", vendor_placeholder: "Vendor name (optional)",
        payment_status: "Payment Status",
        notes: "Notes (optional)", notes_placeholder: "Additional notes...",
        add_btn: "Add Item",
        rec_title: "Here are few Recommendations. Click to Auto-Fill",
      },
      table: { description: "Description", difference: "Difference", usage: "Usage" },
      edit: {
        title: "Edit Budget Item",
        estimated: "Estimated (Rs.)", actual: "Actual (Rs.)", save: "Save Changes",
      },
      delete: { title: "Delete Budget Item?", subtitle: "This action cannot be undone." },
      forecast: {
        title: "Spend Forecasting & Analysis",
        subtitle: "Predictive analytics based on current spend patterns",
      },
      category: { title: "Category Spending Breakdown" },
      planner: {
        title: "Smart Budget Planner",
        subtitle: "Select an event first. The planner will understand the selected event name and create a suitable budget plan.",
        total_budget: "Total Budget (Rs.)", total_placeholder: "e.g. 500000",
        attendees: "Expected Attendees", attendees_placeholder: "e.g. 200",
        generate_btn: "Generate Smart Budget Plan",
      },
      report: { download_pdf: "Download PDF", print: "Print" },
      nav: { back_home: "Back to Home", create_event: "Create Event" },
    },
  },

  /* ════════════════════════════════════════════════════════════ TA */
  ta: {
    brand: { name: "யூனிகனெக்ட்" },

    roles: {
      admin: "நிர்வாகி", admin_name: "நிர்வாகி", super_admin: "சூப்பர் நிர்வாகி",
      admin_pill: "நிர்வாகி", students: "மாணவர்கள்",
      organizers: "ஏற்பாட்டாளர்கள்", admins: "நிர்வாகிகள்", student: "மாணவர்",
    },

    common: {
      done: "முடிந்தது.", ok: "சரி", message: "செய்தி", loading: "ஏற்றுகிறது…",
      active: "செயலில்", pending: "நிலுவையில்", live: "நேரடி", new: "புதியது",
      search_users_events: "பயனர்கள், நிகழ்வுகளை தேடுங்கள்…", search: "தேடு",
      view_all: "அனைத்தும் காண்க", refresh: "புதுப்பி",
      close: "மூடு", cancel: "ரத்து செய்", delete: "நீக்கு", save: "சேமி",
      submitting: "சமர்ப்பிக்கிறது…",
    },

    nav: {
      section: {
        overview: "மேலோட்டம்", management: "நிர்வாகம்", platform: "தளம்",
        main_menu: "முக்கிய மெனு", account: "கணக்கு",
      },
      dashboard: "டாஷ்போர்டு", users: "பயனர்கள்", events: "நிகழ்வுகள்",
      registrations: "பதிவுகள்", volunteers: "தன்னார்வல நிர்வாகம்",
      payments: "கட்டணங்கள்", budget: "பட்ஜெட் நிர்வாகம்",
      theme: "தீம்", homepage: "முகப்புப்பக்கம்", announce: "அறிவிப்பு",
      settings: "அமைப்புகள்", logs: "பதிவேடுகள்", notifications: "அறிவிப்புகள்",
      my_profile: "என் சுயவிவரம்", browse_events: "நிகழ்வுகளை உலாவு",
      my_registrations: "என் பதிவுகள்", logout: "வெளியேறு",
      home: "முகப்பு", sign_up: "பதிவு செய்யுங்கள்", exit: "வெளியேறு",
      give_feedback: "கருத்து தெரிவிக்கவும்",
    },

    table: {
      user: "பயனர்", role: "பங்கு", joined: "சேர்ந்தது", university: "பல்கலைக்கழகம்",
      dept_faculty: "துறை / பீடம்", actions: "செயல்கள்", student: "மாணவர்",
      status: "நிலை", volunteer: "தன்னார்வலர்", amount: "தொகை",
      method: "முறை", time: "நேரம்", action: "செயல்", detail: "விவரம்", ip: "ஐபி",
      title: "தலைப்பு", venue: "இடம்",
    },

    status: { online: "சிஸ்டம் ஆன்லைனில் உள்ளது", all_running: "அனைத்து சேவைகளும் இயங்குகின்றன" },

    filter: { all: "அனைத்தும்", upcoming: "வரவிருக்கும்", past: "கடந்த" },

    users: { search_by_id: "பயனர் ஐடி மூலம் தேடு…", filter: "பயனர்களை வடிகட்டு…" },

    events: { loading: "நிகழ்வுகள் ஏற்றுகிறது…", filter: "நிகழ்வுகளை வடிகட்டு…", date: "தேதி" },

    dashboard: {
      admin: {
        greeting: "மீண்டும் வரவேற்கிறோம் 👋",
        greeting_sub: "தளத்தின் கண்ணோட்டம் ஏற்றுகிறது…",
        total_users: "மொத்த பயனர்கள்", total_events: "மொத்த நிகழ்வுகள்",
        organizers: "ஏற்பாட்டாளர்கள்", recent_users: "சமீபத்திய பயனர்கள்",
        todays_events: "இன்றைய நிகழ்வுகள்", pending_approvals: "நிலுவை அனுமதிகள்",
        activity_feed: "செயல்பாட்டு ஊட்டம்", full_log: "முழு பதிவு",
        manage_users: "பயனர் நிர்வாகம்", users_sub: "தளம் முழுவதும் பதிவுசெய்த கணக்குகள்",
        manage_events: "நிகழ்வு நிர்வாகம்", events_sub: "தளம் முழுவதும் உள்ள நிகழ்வுகள்",
        registrations_sub: "அனைத்து நிகழ்வு பதிவுகளையும் மதிப்பாய்வு செய்யவும்",
        volunteers_sub: "அனைத்து தன்னார்வல நியமனங்கள்",
        payments_sub: "அனைத்து டிக்கெட் கட்டணங்கள்",
        no_events_today: "இன்று நிகழ்வுகள் இல்லை", no_pending_regs: "நிலுவை பதிவுகள் இல்லை",
        broadcast: "ஒளிபரப்பு", budget_sub: "மதிப்பீட்டு மற்றும் உண்மையான செலவுகளைக் காண்க",
        finance_badge: "நிதி", needs_review: "மதிப்பாய்வு தேவை",
      },
      organizer: { registrations: "அனைத்து பதிவுகள்" },
    },

    organizer_dash: {
      greeting_morning: "காலை வணக்கம்", greeting_afternoon: "மதிய வணக்கம்",
      greeting_evening: "மாலை வணக்கம்", greeting_night: "இரவு வணக்கம்",
      subtitle: "யூனிகனெக்ட்டில் இருந்து உங்கள் நிகழ்வுகளை நிர்வகிக்கவும்",
      create_event: "நிகழ்வை உருவாக்கு",
      my_events: "என் உருவாக்கிய நிகழ்வுகள்", my_events_sub: "உங்கள் கணக்கில் வெளியிடப்பட்ட நிகழ்வுகள்",
      view_all: "அனைத்தும் காண்க →", recent_regs: "சமீபத்திய பதிவுகள்",
      notifications: "அறிவிப்புகள்", todays_events: "இன்றைய நிகழ்வுகள்",
      quick_stats: "விரைவு புள்ளிவிவரங்கள்",
      manage_participants: "உங்கள் நிகழ்வுகளுக்கான பங்கேற்பாளர்களை நிர்வகிக்கவும்",
      manage_participants_sub: "கலந்தாளுபவர்களை கண்காணிக்கவும், பதிவுகளை நிர்வகிக்கவும்.",
      manage_participants_btn: "பங்கேற்பாளர்களை நிர்வகி →",
      volunteers_banner: "உங்கள் நிகழ்வுகளுக்கு தன்னார்வலர்கள் தேவையா?",
      volunteers_banner_sub: "தன்னார்வல வாய்ப்புகளை இடுகையிட்டு மாணவர்களை பெறுங்கள்.",
      volunteers_btn: "வாய்ப்பை இடுகையிடு →",
      total_events: "மொத்த நிகழ்வுகள்", total_registrants: "மொத்த பதிவாளர்கள்",
      pending_approvals: "நிலுவை அனுமதிகள்", upcoming_events: "வரவிருக்கும் நிகழ்வுகள்",
      no_events: "நீங்கள் இன்னும் எந்த நிகழ்வையும் உருவாக்கவில்லை.",
      create_first: "+ உங்கள் முதல் நிகழ்வை உருவாக்குங்கள்",
      no_regs: "இன்னும் பதிவுகள் இல்லை", no_notifs: "இன்னும் அறிவிப்புகள் இல்லை",
      no_today: "இன்று நிகழ்வுகள் இல்லை", sign_out: "வெளியேறு",
      stat_created: "மொத்தம் உருவாக்கப்பட்ட நிகழ்வுகள்", stat_upcoming: "வரவிருக்கும் நிகழ்வுகள்",
      stat_completed: "முடிந்த நிகழ்வுகள்", stat_open: "அனைத்து துறைகளுக்கும் திறந்தது",
      view_all_notifs: "அனைத்து அறிவிப்புகளையும் காண்க →",
      toast_deleted: "நிகழ்வு வெற்றிகரமாக நீக்கப்பட்டது.",
      toast_delete_failed: "நீக்கம் தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.",
      delete_confirm_title: "நிகழ்வை நீக்கவா?",
      delete_confirm_text: "இந்த செயலை மீயாக இயலாது. நிகழ்வு நிரந்தரமாக நீக்கப்படும்.",
      delete_btn: "நீக்கு",
    },

    theme: {
      title: "தீம் & பிராண்டிங்", subtitle: "தளத்தின் காட்சி அடையாளத்தை தனிப்பயனாக்குங்கள்",
      preset_themes: "முன்னமைவு தீம்கள்", preset_sub: "ஒரே கிளிக் வண்ண திட்டங்கள்",
      preset: { default: "இயல்புநிலை", ocean: "கடல்", forest: "காடு", sunset: "சூரியாஸ்தமனம்", violet: "ஊதா", gold: "தங்கம்" },
      primary_color: "முதன்மை வண்ணம்",
      platform_identity: "தள அடையாளம்", identity_sub: "லோகோ, பெயர் மற்றும் குறிச்சொல்",
      platform_name: "தள பெயர்", tagline: "குறிச்சொல்", logo_path: "லோகோ பாதை",
      typography: "டைப்போகிராஃபி", typography_sub: "தள எழுத்துருக்கள் மற்றும் அளவு",
      heading_font: "தலைப்பு எழுத்துரு", body_font: "உடல் எழுத்துரு", base_size: "அடிப்படை அளவு",
      save: "தீம் சேமி", save_branding: "பிராண்டிங் சேமி", save_typography: "டைப்போகிராஃபி சேமி",
    },

    homepage: {
      title: "முகப்புப்பக்க கட்டுப்பாடு", subtitle: "பேனர்கள், ஹீரோ பிரிவுகளை திருத்துங்கள்",
      hero_banner: "ஹீரோ பேனர்", banner_title: "தலைப்பு", banner_subtitle: "துணை தலைப்பு",
      gradient_start: "சாய்வு தொடக்கம்", gradient_end: "சாய்வு முடிவு", save_banner: "பேனர் சேமி",
      featured_events: "சிறப்பு நிகழ்வுகள்", max_events: "முகப்பில் அதிகபட்ச நிகழ்வுகள்",
      sort_by: "வரிசைப்படுத்து",
      sort: { upcoming: "வரவிருக்கும் முதல்", most_reg: "அதிக பதிவுகள்", recent: "சமீபத்தில் உருவாக்கப்பட்டது" },
      show_past: "கடந்த நிகழ்வுகளை காட்டு",
      past: { hide: "இல்லை — மறை", show: "ஆம் — அனைத்தும் காட்டு" },
      notice_bar: "அறிவிப்பு பட்டை", enable_notice: "அறிவிப்பு பட்டையை இயக்கு",
      notice_sub: "அனைத்து பக்கங்களிலும் பேனர் காட்டு", notice_style: "பாணி",
      style: { navy: "நேவி", info: "தகவல் நீலம்", amber: "அம்பர் எச்சரிக்கை", red: "சிவப்பு எச்சரிக்கை" },
      save_display: "காட்சி சேமி", save_notice: "அறிவிப்பு பட்டை சேமி",
    },

    announcements: {
      title: "தள அறிவிப்புகள்", subtitle: "அனைத்து பயனர்களுக்கும் செய்திகளை ஒளிபரப்பு",
      new: "புதிய அறிவிப்பு", new_sub: "தள அறிவிப்பாக அனுப்பப்படும்",
      ann_title: "தலைப்பு", title_placeholder: "எ.கா. சிஸ்டம் பராமரிப்பு திட்டமிடப்பட்டது",
      body_placeholder: "உங்கள் அறிவிப்பை இங்கே எழுதுங்கள்…", target: "இலக்கு",
      target_: { all: "அனைத்து பயனர்களும்", students: "மாணவர்கள் மட்டும்", organizers: "ஏற்பாட்டாளர்கள் மட்டும்" },
      priority: "முன்னுரிமை",
      priority_: { normal: "சாதாரண", urgent: "அவசரம்", info: "தகவல்" },
      send: "அறிவிப்பு அனுப்பு", history: "வரலாறு", history_sub: "முன்பு அனுப்பப்பட்ட ஒளிபரப்புகள்",
    },

    settings: {
      subtitle: "உலகளாவிய தள உள்ளமைவு", registration: "பதிவு",
      auto_approve: "தானாக பதிவுகளை அனுமதி", auto_approve_sub: "கையேடு அனுமதியை தவிர்க்கவும்",
      email_confirm: "மின்னஞ்சல் உறுதிப்படுத்தல்கள்", email_confirm_sub: "வெற்றிகரமான பதிவில் மின்னஞ்சல்",
      allow_cancel: "ரத்துசெய்தல்களை அனுமதி", allow_cancel_sub: "மாணவர்கள் ரத்துசெய்யலாம்",
      cross_dept: "குறுக்கு-துறை நிகழ்வுகள்", cross_dept_sub: "எந்த துறை மாணவரும் பதிவுசெய்யலாம்",
      req_approval: "நிர்வாக அனுமதி தேவை", req_approval_sub: "அனுமதிக்குப் பிறகு நிகழ்வுகள் நேரடியாகும்",
      req_images: "நிகழ்வு படங்கள் தேவை", req_images_sub: "உருவாக்குவதற்கு முன் பதிவேற்ற வேண்டும்",
      featured: "சிறப்பு பிரிவு", featured_sub: "மேல் நிரலிட்ட நிகழ்வுகளை காட்டு",
      auto_del: "கடந்த நிகழ்வுகளை தானாக நீக்கு", auto_del_sub: "6 மாதங்களுக்கு பழைய நிகழ்வுகளை நீக்கு",
      security: "பாதுகாப்பு",
      maintenance: "பராமரிப்பு பயன்முறை", maintenance_sub: "பயனர்களுக்கு பராமரிப்பு பக்கம் காட்டு",
      restrict_signup: "புதிய பதிவுகளை கட்டுப்படுத்து", restrict_signup_sub: "புதிய பதிவுகளை முடக்கு",
      admin_2fa: "நிர்வாகிகளுக்கு 2FA", admin_2fa_sub: "இரு காரணி அங்கீகாரம் தேவை",
      activity_log: "செயல்பாடு பதிவு", activity_log_sub: "அனைத்து நிர்வாக செயல்களை பதிவுசெய்",
      email_notif: "மின்னஞ்சல் அறிவிப்புகள்", email_notif_sub: "தள நிகழ்வுகளுக்கு மின்னஞ்சல்",
      inapp_notif: "ஆப் அறிவிப்புகள்", inapp_notif_sub: "மணி ஐகான் அறிவிப்புகள்",
      reminders: "நிகழ்வு நினைவூட்டல்கள்", reminders_sub: "நிகழ்வுகளுக்கு 24 மணி நேரம் முன் நினைவூட்டல்",
      save_all: "அனைத்து அமைப்புகளையும் சேமி",
    },

    logs: {
      title: "செயல்பாட்டு பதிவேடுகள்", subtitle: "அனைத்து தள செயல்களின் முழு தணிக்கை பாதை",
      export_csv: "CSV ஏற்றுமதி",
    },

    allevents: {
      welcome_badge: "யூனிகனெக்ட்-க்கு வரவேற்கிறோம்",
      find_event: "உங்கள் நிகழ்வை கண்டறியுங்கள்",
      hero_desc: "பட்டறைகள், போட்டிகள், நெட்வொர்க்கிங் அமர்வுகள், விளையாட்டு கூட்டங்கள், கலாச்சார விழாக்கள் மற்றும் பலவற்றை கண்டறியுங்கள்.",
      search_placeholder: "தலைப்பு, வகை, இடம் அல்லது நிகழ்வு குறியீட்டால் தேடுங்கள்…",
      browse_all: "அனைத்து வரவிருக்கும் நிகழ்வுகளையும் உலாவுங்கள்",
      vol_prompt_msg: "நீங்கள் பங்கேற்பாளராக பதிவுசெய்யப்பட்டுள்ளீர்கள்.",
      vol_prompt_volunteer: "இந்த நிகழ்வுக்கு தன்னார்வலர்களும் தேவை. விண்ணப்பிக்க விரும்புகிறீர்களா?",
      maybe_later: "பிறகு பார்க்கலாம்", yes_volunteer: "ஆம், தன்னார்வலர்",
    },

    eventdetails: {
      eyebrow: "யூனிகனெக்ட் நிகழ்வு",
      vol_needed: "தன்னார்வலர்கள் தேவை", vol_title: "எங்களுக்கு தன்னார்வலர்கள் தேவை!",
      vol_desc: "எங்கள் தன்னார்வல குழுவில் சேர்ந்து இந்த நிகழ்வை வெற்றிகரமாக்க உதவுங்கள்.",
      vol_btn: "தன்னார்வலராக பதிவுசெய்யுங்கள்",
      feedback_title: "கலந்தவர் கருத்துகள்",
      feedback_sub: "இந்த நிகழ்வில் கலந்தவர்கள் சமர்ப்பித்த மதிப்புரைகள்.",
    },

    modal: {
      reg_title: "பங்கேற்பாளர் பதிவு",
      reg_sub: "இந்த நிகழ்வில் பதிவுசெய்ய கீழே உள்ள படிவத்தை நிரப்புங்கள்.",
      step1_label: "படி 1 — உங்கள் கணக்கை சரிபார்க்கவும்",
      user_id_placeholder: "உங்கள் பயனர் ஐடியை உள்ளிடவும்",
      verify_user: "பயனரை சரிபார்க்கவும்",
      step2_label: "படி 2 — பதிவு விவரங்கள்",
      participant: "பங்கேற்பாளர்", audience: "பார்வையாளர்",
      faculty_placeholder: "பீடம் / துறை",
      university_placeholder: "பல்கலைக்கழகம் / வளாகம்",
      phone_placeholder: "தொலைபேசி எண்",
      notes_placeholder: "கூடுதல் குறிப்புகள் (விருப்பமானது)",
      complete_reg: "பதிவை முடிக்கவும்",
      form_note_bold: "உங்கள் விவரங்களை கவனமாக சரிபார்க்கவும்.",
      form_note_body: "சமர்ப்பிக்கும் முன் உங்கள் பல்கலைக்கழகம், துறை மற்றும் தொடர்பு தகவல் சரியானதா என்று உறுதிசெய்யுங்கள்.",
      success_title: "பதிவு வெற்றிகரமாக முடிந்தது",
    },

    volunteer: {
      badge: "தன்னார்வலர்",
      left_desc: "தன்னார்வலராக சேர்ந்து, நிகழ்வு குழுவை ஆதரித்து, உண்மையான அனுபவம் பெறுங்கள்.",
      application_title: "தன்னார்வல விண்ணப்பம்",
      application_sub: "இந்த நிகழ்வில் தன்னார்வலராக விண்ணப்பிக்க கீழே உள்ள படிவத்தை நிரப்புங்கள்.",
      your_user_id: "உங்கள் பயனர் ஐடி",
      email: "மின்னஞ்சல் முகவரி", email_placeholder: "your@email.com",
      phone: "தொலைபேசி எண்", phone_placeholder: "+94 7XX XXX XXX",
      preferred_role: "விரும்பிய பங்கு",
      role: {
        general: "பொது தன்னார்வலர்", coordinator: "நிகழ்வு ஒருங்கிணைப்பாளர்",
        reg_desk: "பதிவு மேசை", stage: "மேடை நிர்வாகம்",
        tech: "தொழில்நுட்ப ஆதரவு", logistics: "தளவாட",
        marketing: "சந்தைப்படுத்தல் & விளம்பரம்", security: "பாதுகாப்பு", photo: "புகைப்படம் / ஊடகம்",
      },
      task_label: "பணி / நீங்கள் என்ன உதவி செய்யலாம்",
      task_placeholder: "இந்த நிகழ்வில் என்ன உதவி செய்யலாம் என்று விவரிக்கவும்…",
      skills_label: "தொடர்புடைய திறன்கள்",
      skill: {
        communication: "தகவல் தொடர்பு", leadership: "தலைமைத்துவம்", technical: "தொழில்நுட்பம்",
        design: "வடிவமைப்பு", photography: "புகைப்படம்", first_aid: "முதலுதவி", driving: "வாகனம் ஓட்டுதல்",
      },
      why_label: "ஏன் தன்னார்வலராக விரும்புகிறீர்கள்?",
      why_placeholder: "இந்த நிகழ்வில் ஏன் பங்கேற்க விரும்புகிறீர்கள் என்று கூறுங்கள்…",
      form_note: "உங்கள் விண்ணப்பம் நிகழ்வு ஏற்பாட்டாளரால் மதிப்பாய்வு செய்யப்படும்.",
      submit: "விண்ணப்பத்தை சமர்ப்பிக்கவும்",
    },

    budget: {
      title: "பட்ஜெட் மேலாண்மை அமைப்பு - யூனிகனெக்ட்",
      subtitle: "AI நுண்ணறிவு மற்றும் பகுப்பாய்வுடன் பட்ஜெட் ஒதுக்கீடுகளை திட்டமிடுங்கள்",
      export_report: "அறிக்கையை ஏற்றுமதி செய்",
      ai_insights: "AI நுண்ணறிவு",
      tab: {
        setup: "அமைப்பு", overview: "கண்ணோட்டம்", items: "பட்ஜெட் உருப்படிகள்",
        analytics: "பகுப்பாய்வு", forecast: "முன்கணிப்பு",
        category: "வகை பிரிப்பு", planner: "ஸ்மார்ட் திட்டமிடல்",
      },
      setup: {
        find_event: "நிகழ்வை கண்டறிந்து தேர்வு செய்",
        find_desc: "உங்கள் ஏற்பாட்டாளர் ஐடியை உள்ளிட்டு நிகழ்வுகளை ஏற்றுங்கள்.",
        org_id: "ஏற்பாட்டாளர் ஐடி", org_id_placeholder: "ஏற்பாட்டாளர் ஐடியை உள்ளிடவும்",
        search_btn: "நிகழ்வுகளை தேடு", select_event: "இந்த நிகழ்வை தேர்வு செய்",
      },
      items: {
        add_title: "பட்ஜெட் உருப்படி சேர்க்கவும்",
        description: "விளக்கம்", desc_placeholder: "எ.கா. இடம் முன்பதிவு",
        category: "வகை", priority: "முன்னுரிமை",
        estimated: "மதிப்பீட்டு செலவு (ரூ.)", actual: "உண்மையான செலவு (ரூ.)",
        cost_placeholder: "0.00",
        vendor: "விற்பனையாளர்", vendor_placeholder: "விற்பனையாளர் பெயர் (விருப்பமானது)",
        payment_status: "கட்டண நிலை",
        notes: "குறிப்புகள் (விருப்பமானது)", notes_placeholder: "கூடுதல் குறிப்புகள்...",
        add_btn: "உருப்படி சேர்",
        rec_title: "பரிந்துரைகள் — கிளிக் செய்து நிரப்பவும்",
      },
      table: { description: "விளக்கம்", difference: "வித்தியாசம்", usage: "பயன்பாடு" },
      edit: {
        title: "பட்ஜெட் உருப்படியை திருத்து",
        estimated: "மதிப்பீட்டு (ரூ.)", actual: "உண்மையான (ரூ.)", save: "மாற்றங்களை சேமி",
      },
      delete: { title: "பட்ஜெட் உருப்படியை நீக்கவா?", subtitle: "இந்த செயலை மீயாக இயலாது." },
      forecast: {
        title: "செலவு முன்கணிப்பு & பகுப்பாய்வு",
        subtitle: "தற்போதைய செலவு வடிவங்களை அடிப்படையாக கொண்ட முன்கணிப்பு",
      },
      category: { title: "வகை செலவு விவரம்" },
      planner: {
        title: "ஸ்மார்ட் பட்ஜெட் திட்டமிடல்",
        subtitle: "முதலில் ஒரு நிகழ்வை தேர்வு செய்யவும். திட்டமிடல் தகுந்த பட்ஜெட் திட்டத்தை உருவாக்கும்.",
        total_budget: "மொத்த பட்ஜெட் (ரூ.)", total_placeholder: "எ.கா. 500000",
        attendees: "எதிர்பார்க்கப்படும் கலந்தாளுபவர்கள்", attendees_placeholder: "எ.கா. 200",
        generate_btn: "ஸ்மார்ட் பட்ஜெட் திட்டத்தை உருவாக்கு",
      },
      report: { download_pdf: "PDF பதிவிறக்கம்", print: "அச்சிடு" },
      nav: { back_home: "முகப்புக்கு திரும்பு", create_event: "நிகழ்வை உருவாக்கு" },
    },
  },

  /* ════════════════════════════════════════════════════════════ SI */
  si: {
    brand: { name: "යූනිකනෙක්ට්" },

    roles: {
      admin: "පරිපාලක", admin_name: "පරිපාලක", super_admin: "සුපිරි පරිපාලක",
      admin_pill: "පරිපාලක", students: "සිසුන්",
      organizers: "සංවිධායකයින්", admins: "පරිපාලකයින්", student: "ශිෂ්‍ය",
    },

    common: {
      done: "සිදු විය.", ok: "හරි", message: "පණිවිඩය", loading: "පූරණය වෙමින්…",
      active: "ක්‍රියාකාරී", pending: "අපේක්ෂිත", live: "සජීවී", new: "නව",
      search_users_events: "පරිශීලකයින්, සිදුවීම් සොයන්න…", search: "සොයන්න",
      view_all: "සියල්ල බලන්න", refresh: "නැවුම් කරන්න",
      close: "වසන්න", cancel: "අවලංගු කරන්න", delete: "ඉවත් කරන්න", save: "සුරකින්න",
      submitting: "ඉදිරිපත් කරමින්…",
    },

    nav: {
      section: {
        overview: "දළ විශ්ලේෂණය", management: "කළමනාකරණය", platform: "වේදිකාව",
        main_menu: "ප්‍රධාන මෙනුව", account: "ගිණුම",
      },
      dashboard: "උපකරණ පුවරුව", users: "පරිශීලකයින්", events: "සිදුවීම්",
      registrations: "ලියාපදිංචි", volunteers: "ස්වේච්ඡා කළමනාකරණය",
      payments: "ගෙවීම්", budget: "අයවැය කළමනාකරණය",
      theme: "තේමා", homepage: "මුල් පිටුව", announce: "නිවේදනය",
      settings: "සැකසුම්", logs: "ලොග", notifications: "දැනුම්දීම්",
      my_profile: "මගේ පැතිකඩ", browse_events: "සිදුවීම් බලන්න",
      my_registrations: "මගේ ලියාපදිංචි", logout: "පිටවීම",
      home: "මුල් පිටුව", sign_up: "ලියාපදිංචි වන්න", exit: "පිටවීම",
      give_feedback: "අදහස් දෙන්න",
    },

    table: {
      user: "පරිශීලක", role: "භූමිකාව", joined: "සම්බන්ධ වූ", university: "විශ්වවිද්‍යාලය",
      dept_faculty: "දෙපාර්තමේන්තුව / පීඨය", actions: "ක්‍රියා", student: "ශිෂ්‍ය",
      status: "තත්ත්වය", volunteer: "ස්වේච්ඡා සේවක", amount: "මුදල",
      method: "ක්‍රමය", time: "කාලය", action: "ක්‍රියාව", detail: "විස්තර", ip: "අයිපී",
      title: "මාතෘකාව", venue: "ස්ථානය",
    },

    status: { online: "පද්ධතිය සබැඳිව ඇත", all_running: "සියලු සේවාවන් ක්‍රියාත්මක වෙමින්" },

    filter: { all: "සියල්ල", upcoming: "ඉදිරි", past: "පසු" },

    users: { search_by_id: "පරිශීලක ID මගින් සොයන්න…", filter: "පරිශීලකයින් පෙරහන් කරන්න…" },

    events: { loading: "සිදුවීම් පූරණය වෙමින්…", filter: "සිදුවීම් පෙරහන් කරන්න…", date: "දිනය" },

    dashboard: {
      admin: {
        greeting: "නැවත සාදරයෙන් පිළිගනිමු 👋",
        greeting_sub: "වේදිකා දළ විශ්ලේෂණය පූරණය වෙමින්…",
        total_users: "මුළු පරිශීලකයින්", total_events: "මුළු සිදුවීම්",
        organizers: "සංවිධායකයින්", recent_users: "මෑත පරිශීලකයින්",
        todays_events: "අද සිදුවීම්", pending_approvals: "අපේක්ෂිත අනුමැති",
        activity_feed: "ක්‍රියාකාරකම් ප්‍රවාහය", full_log: "සම්පූර්ණ ලොගය",
        manage_users: "පරිශීලක කළමනාකරණය", users_sub: "වේදිකාවේ ලියාපදිංචි ගිණුම් සියල්ල",
        manage_events: "සිදුවීම් කළමනාකරණය", events_sub: "වේදිකාවේ සිදුවීම් සියල්ල",
        registrations_sub: "සිදුවීම් ලියාපදිංචි සමාලෝචනය",
        volunteers_sub: "සියලු ස්වේච්ඡා සේවා පැවරුම්",
        payments_sub: "සියලු ටිකට් ගෙවීම්",
        no_events_today: "අද සිදුවීම් නැත", no_pending_regs: "අපේක්ෂිත ලියාපදිංචි නැත",
        broadcast: "විකාශය", budget_sub: "ගණනය කළ හා සත්‍ය පිරිවැය බලන්න",
        finance_badge: "මූල්‍ය", needs_review: "සමාලෝචනය අවශ්‍යයි",
      },
      organizer: { registrations: "සියලු ලියාපදිංචි" },
    },

    organizer_dash: {
      greeting_morning: "සුභ උදෑසනක්", greeting_afternoon: "සුභ දහවලක්",
      greeting_evening: "සුභ සන්ධ්‍යාවක්", greeting_night: "සුභ රාත්‍රියක්",
      subtitle: "යූනිකනෙක්ට් හරහා ඔබේ සිදුවීම් කළමනාකරණය කරන්න",
      create_event: "සිදුවීමක් සාදන්න",
      my_events: "මගේ සාදන ලද සිදුවීම්", my_events_sub: "ඔබේ ගිණුම යටතේ ප්‍රකාශිත සිදුවීම්",
      view_all: "සියල්ල බලන්න →", recent_regs: "මෑත ලියාපදිංචි",
      notifications: "දැනුම්දීම්", todays_events: "අද සිදුවීම්",
      quick_stats: "ඉක්මන් සංඛ්‍යාලේඛන",
      manage_participants: "ඔබේ සිදුවීම් සහභාගිවන්නන් කළමනාකරණය",
      manage_participants_sub: "සහභාගිවන්නන් නිරීක්ෂණය කර ලියාපදිංචි කළමනාකරණය කරන්න.",
      manage_participants_btn: "සහභාගිවන්නන් කළමනාකරණය →",
      volunteers_banner: "ඔබේ සිදුවීම් සඳහා ස්වේච්ඡා සේවකයින් අවශ්‍යද?",
      volunteers_banner_sub: "ස්වේච්ඡා අවස්ථා පළ කර සිසුන් ලබා ගන්න.",
      volunteers_btn: "අවස්ථාව පළ කරන්න →",
      total_events: "මුළු සිදුවීම්", total_registrants: "මුළු ලියාපදිංචි",
      pending_approvals: "අපේක්ෂිත අනුමැති", upcoming_events: "ඉදිරි සිදුවීම්",
      no_events: "ඔබ තවම සිදුවීමක් සාදා නැත.",
      create_first: "+ ඔබේ පළමු සිදුවීම සාදන්න",
      no_regs: "තවම ලියාපදිංචි නැත", no_notifs: "තවම දැනුම්දීම් නැත",
      no_today: "අද සිදුවීම් නැත", sign_out: "පිටවීම",
      stat_created: "සාදන ලද මුළු සිදුවීම්", stat_upcoming: "ඉදිරි සිදුවීම්",
      stat_completed: "සම්පූර්ණ සිදුවීම්", stat_open: "සියලු දෙපාර්තමේන්තු සඳහා විවෘතයි",
      view_all_notifs: "සියලු දැනුම්දීම් බලන්න →",
      toast_deleted: "සිදුවීම සාර්ථකව ඉවත් කරන ලදී.",
      toast_delete_failed: "ඉවත් කිරීම අසාර්ථකයි. නැවත උත්සාහ කරන්න.",
      delete_confirm_title: "සිදුවීම ඉවත් කරන්නද?",
      delete_confirm_text: "මෙම ක්‍රියාව දෙකෙලෙකින් නොහැකිය. සිදුවීම ස්ථිරවම ඉවත් කෙරේ.",
      delete_btn: "ඉවත් කරන්න",
    },

    theme: {
      title: "තේමා සහ බ්‍රෑන්ඩිං", subtitle: "වේදිකාවේ දෘශ්‍ය අනන්‍යතාව අභිමත කරන්න",
      preset_themes: "පෙරසකසන ලද තේමා", preset_sub: "එක් ක්ලික් වර්ණ යෝජනා ක්‍රම",
      preset: { default: "පෙරනිමි", ocean: "සාගරය", forest: "වනාන්තරය", sunset: "හිරු බැසීම", violet: "දම්", gold: "රන්" },
      primary_color: "ප්‍රාථමික වර්ණය",
      platform_identity: "වේදිකා අනන්‍යතාව", identity_sub: "ලාංඡනය, නම සහ ටැග්ලයිනය",
      platform_name: "වේදිකා නම", tagline: "ටැග්ලයිනය", logo_path: "ලාංඡන මාර්ගය",
      typography: "ටයිපොග්‍රැෆිය", typography_sub: "වේදිකා අකුරු සහ ප්‍රමාණ",
      heading_font: "ශීර්ෂ අකුරු", body_font: "ශරීර අකුරු", base_size: "මූලික ප්‍රමාණය",
      save: "තේමා සුරකින්න", save_branding: "බ්‍රෑන්ඩිං සුරකින්න", save_typography: "ටයිපොග්‍රැෆිය සුරකින්න",
    },

    homepage: {
      title: "මුල් පිටු පාලනය", subtitle: "බැනර්, ශූරවර කොටස් සංස්කරණය කරන්න",
      hero_banner: "ශූරවර බැනරය", banner_title: "මාතෘකාව", banner_subtitle: "උප මාතෘකාව",
      gradient_start: "ශ්‍රේණිය ආරම්භය", gradient_end: "ශ්‍රේණිය අවසාන", save_banner: "බැනරය සුරකින්න",
      featured_events: "විශේෂිත සිදුවීම්", max_events: "මුල් පිටුවේ උපරිම සිදුවීම්",
      sort_by: "වර්ග කරන්න",
      sort: { upcoming: "ඉදිරි මුලින්", most_reg: "වැඩිම ලියාපදිංචි", recent: "මෑතකදී සාදන ලද" },
      show_past: "පසු සිදුවීම් පෙන්වන්න",
      past: { hide: "නැත — සඟවන්න", show: "ඔව් — සියල්ල පෙන්වන්න" },
      notice_bar: "දැනුම්දීම් තීරුව", enable_notice: "දැනුම්දීම් තීරුව සක්‍රිය කරන්න",
      notice_sub: "සියලු පිටුවල බැනරය පෙන්වන්න", notice_style: "විලාසය",
      style: { navy: "නාවික", info: "තොරතුරු නිල්", amber: "ඇම්බර් අනතුරු ඇඟවීම", red: "රතු අනතුරු" },
      save_display: "දර්ශනය සුරකින්න", save_notice: "දැනුම්දීම් තීරුව සුරකින්න",
    },

    announcements: {
      title: "වේදිකා නිවේදන", subtitle: "සියලු පරිශීලකයින්ට පණිවිඩ විකාශය කරන්න",
      new: "නව නිවේදනය", new_sub: "වේදිකා දැනුම්දීමක් ලෙස යවා ඇත",
      ann_title: "මාතෘකාව", title_placeholder: "උදා. පද්ධති නඩත්තු කාලසටහන",
      body_placeholder: "ඔබේ නිවේදනය මෙහි ලියන්න…", target: "ඉලක්කය",
      target_: { all: "සියලු පරිශීලකයින්", students: "ශිෂ්‍යයන් පමණි", organizers: "සංවිධායකයින් පමණි" },
      priority: "ප්‍රමුඛතාව",
      priority_: { normal: "සාමාන්‍ය", urgent: "හදිසි", info: "තොරතුරු" },
      send: "නිවේදනය යවන්න", history: "ඉතිහාසය", history_sub: "කලින් යවන ලද විකාශ",
    },

    settings: {
      subtitle: "ගෝලීය වේදිකා වින්‍යාසය", registration: "ලියාපදිංචිය",
      auto_approve: "ලියාපදිංචි ස්වයංක්‍රීයව අනුමත කරන්න", auto_approve_sub: "අතින් අනුමැතිය මඟ හරින්න",
      email_confirm: "ඊමේල් තහවුරු කිරීම්", email_confirm_sub: "සාර්ථක ලියාපදිංචිය ඊමේල්",
      allow_cancel: "අවලංගු කිරීම් ඉඩ දෙන්න", allow_cancel_sub: "ශිෂ්‍යයන්ට අවලංගු කළ හැක",
      cross_dept: "හරස්-දෙපාර්තමේන්තු සිදුවීම්", cross_dept_sub: "ඕනෑම දෙපාර්තමේන්තු ශිෂ්‍යයෙකුට ලියාපදිංචි විය හැකිය",
      req_approval: "පරිපාලක අනුමැතිය අවශ්‍යයි", req_approval_sub: "අනුමැතියෙන් පසු සිදුවීම් සජීවීව",
      req_images: "සිදුවීම් රූප අවශ්‍යයි", req_images_sub: "සෑදීමට පෙර උඩුගත කළ යුතුය",
      featured: "විශේෂිත කොටස", featured_sub: "ඉහළ සිට කදවුරු සිදුවීම් පෙන්වන්න",
      auto_del: "පසු සිදුවීම් ස්වයංක්‍රීයව ඉවත් කරන්න", auto_del_sub: "මාස 6 කට වඩා පැරණි සිදුවීම් ඉවත් කරන්න",
      security: "ආරක්ෂාව",
      maintenance: "නඩත්තු ප්‍රකාරය", maintenance_sub: "පරිශීලකයින්ට නඩත්තු පිටුව පෙන්වන්න",
      restrict_signup: "නව ලියාපදිංචි සීමා කරන්න", restrict_signup_sub: "නව ලියාපදිංචි අක්‍රීය කරන්න",
      admin_2fa: "පරිපාලකයින් සඳහා 2FA", admin_2fa_sub: "ද්වි-සාධක සත්‍යාපනය අවශ්‍යයි",
      activity_log: "ක්‍රියාකාරකම් ලොගිං", activity_log_sub: "සියලු පරිපාලක ක්‍රියා ලොග් කරන්න",
      email_notif: "ඊමේල් දැනුම්දීම්", email_notif_sub: "වේදිකා සිදුවීම් ඊමේල්",
      inapp_notif: "යෙදුම් තුළ දැනුම්දීම්", inapp_notif_sub: "සීනු නිරූපක දැනුම්දීම්",
      reminders: "සිදුවීම් මතකපත් කිරීම්", reminders_sub: "සිදුවීම්වලට පෙර පැය 24",
      save_all: "සියලු සැකසුම් සුරකින්න",
    },

    logs: {
      title: "ක්‍රියාකාරකම් ලොග", subtitle: "සියලු වේදිකා ක්‍රියාවල සම්පූර්ණ විගණන ලුහුබැඳීම",
      export_csv: "CSV අපනයනය",
    },

    allevents: {
      welcome_badge: "යූනිකනෙක්ට් වෙත සාදරයෙන් පිළිගනිමු",
      find_event: "ඔබේ සිදුවීම සොයා ගන්න",
      hero_desc: "වැඩමුළු, තරඟ, ජාලකරණ සැසි, ක්‍රීඩා රැස්වීම්, සාංස්කෘතික උත්සව සහ තවත් බොහෝ දේ සොයා ගන්න.",
      search_placeholder: "මාතෘකාව, කාණ්ඩය, ස්ථානය හෝ සිදුවීම් කේතය මගින් සොයන්න…",
      browse_all: "ඉදිරි සිදුවීම් සියල්ල බලන්න",
      vol_prompt_msg: "ඔබ සහභාගිවන්නෙකු ලෙස ලියාපදිංචි වී ඇත.",
      vol_prompt_volunteer: "මෙම සිදුවීමට ස්වේච්ඡා සේවකයින් ද අවශ්‍යයි. ඔබ අයදුම් කිරීමට කැමතිද?",
      maybe_later: "පසුව බලමු", yes_volunteer: "ඔව්, ස්වේච්ඡා",
    },

    eventdetails: {
      eyebrow: "යූනිකනෙක්ට් සිදුවීම",
      vol_needed: "ස්වේච්ඡා සේවකයින් අවශ්‍යයි", vol_title: "අපට ස්වේච්ඡා සේවකයින් අවශ්‍යයි!",
      vol_desc: "අපේ ස්වේච්ඡා කණ්ඩායමට සම්බන්ධ වී මෙම සිදුවීම සාර්ථක කිරීමට සහාය වන්න.",
      vol_btn: "ස්වේච්ඡා සේවකයෙකු ලෙස ලියාපදිංචි වන්න",
      feedback_title: "සහභාගිවන්නන්ගේ අදහස්",
      feedback_sub: "මෙම සිදුවීමට සහභාගි වූ අය ඉදිරිපත් කළ සමාලෝචන.",
    },

    modal: {
      reg_title: "සහභාගිවන්නා ලියාපදිංචිය",
      reg_sub: "මෙම සිදුවීම සඳහා ලියාපදිංචි වීමට පහත පෝරමය පුරවන්න.",
      step1_label: "පියවර 1 — ඔබේ ගිණුම තහවුරු කරන්න",
      user_id_placeholder: "ඔබේ පරිශීලක ID ඇතුළත් කරන්න",
      verify_user: "පරිශීලකයා තහවුරු කරන්න",
      step2_label: "පියවර 2 — ලියාපදිංචි විස්තර",
      participant: "සහභාගිවන්නා", audience: "ප්‍රේක්ෂකයා",
      faculty_placeholder: "පීඨය / දෙපාර්තමේන්තුව",
      university_placeholder: "විශ්වවිද්‍යාලය / පරිශ්‍රය",
      phone_placeholder: "දුරකථන අංකය",
      notes_placeholder: "අමතර සටහන් (විකල්ප)",
      complete_reg: "ලියාපදිංචිය සම්පූර්ණ කරන්න",
      form_note_bold: "ඔබේ විස්තර ප්‍රවේශමෙන් පරීක්ෂා කරන්න.",
      form_note_body: "ඉදිරිපත් කිරීමට පෙර ඔබේ විශ්වවිද්‍යාලය, දෙපාර්තමේන්තුව සහ සම්බන්ධතා තොරතුරු නිවැරදි බව සහතික කරන්න.",
      success_title: "ලියාපදිංචිය සාර්ථකයි",
    },

    volunteer: {
      badge: "ස්වේච්ඡා සේවකයා",
      left_desc: "ස්වේච්ඡා සේවකයෙකු ලෙස සම්බන්ධ වී, සිදුවීම් කණ්ඩායමට සහාය වී, සැබෑ අත්දැකීම් ලබා ගන්න.",
      application_title: "ස්වේච්ඡා සේවා අයදුම්පත",
      application_sub: "මෙම සිදුවීම සඳහා ස්වේච්ඡා සේවකයෙකු ලෙස අයදුම් කිරීමට පහත පෝරමය සම්පූර්ණ කරන්න.",
      your_user_id: "ඔබේ පරිශීලක ID",
      email: "විද්‍යුත් තැපැල් ලිපිනය", email_placeholder: "your@email.com",
      phone: "දුරකථන අංකය", phone_placeholder: "+94 7XX XXX XXX",
      preferred_role: "කැමති භූමිකාව",
      role: {
        general: "සාමාන්‍ය ස්වේච්ඡා සේවකයා", coordinator: "සිදුවීම් සම්බන්ධීකාරක",
        reg_desk: "ලියාපදිංචි මේසය", stage: "වේදිකා කළමනාකරණය",
        tech: "තාක්ෂණික සහාය", logistics: "සැපයුම්",
        marketing: "අලෙවිකරණය සහ ප්‍රවර්ධනය", security: "ආරක්ෂාව", photo: "ඡායාරූප / මාධ්‍ය",
      },
      task_label: "කාර්යය / ඔබට කළ හැකි දේ",
      task_placeholder: "මෙම සිදුවීමේදී ඔබට කළ හැකි දේ විස්තර කරන්න…",
      skills_label: "අදාළ කුසලතා",
      skill: {
        communication: "සන්නිවේදනය", leadership: "නායකත්වය", technical: "තාක්ෂණික",
        design: "නිර්මාණය", photography: "ඡායාරූපකරණය", first_aid: "ප්‍රථමාධාර", driving: "රිය පැදවීම",
      },
      why_label: "ඔබ ස්වේච්ඡා සේවකයෙකු වීමට කැමැත්තේ ඇයි?",
      why_placeholder: "ඔබ මෙම සිදුවීමේ කොටසක් වීමට කැමති ඇයිද කියන්න…",
      form_note: "ඔබේ අයදුම්පත සිදුවීම් සංවිධායකයා විසින් සමාලෝචනය කරනු ලැබේ.",
      submit: "අයදුම්පත ඉදිරිපත් කරන්න",
    },

    budget: {
      title: "අයවැය කළමනාකරණ පද්ධතිය - යූනිකනෙක්ට්",
      subtitle: "AI තීක්ෂ්ණ බුද්ධිය සමඟ අයවැය වෙන් කිරීම් සැලසුම් කරන්න",
      export_report: "වාර්තාව අපනයනය",
      ai_insights: "AI තීක්ෂ්ණ බුද්ධිය",
      tab: {
        setup: "සැකසීම", overview: "දළ විශ්ලේෂණය", items: "අයවැය අයිතම",
        analytics: "විශ්ලේෂණය", forecast: "පූර්වාවලෝකනය",
        category: "කාණ්ඩ බෙදීම", planner: "ස්මාර්ට් සැලසුම්කරු",
      },
      setup: {
        find_event: "සිදුවීම සොයා තෝරන්න",
        find_desc: "ඔබේ සංවිධායක ID ඇතුළත් කර සිදුවීම් පූරණය කරන්න.",
        org_id: "සංවිධායක ID", org_id_placeholder: "සංවිධායක ID ඇතුළත් කරන්න",
        search_btn: "සිදුවීම් සොයන්න", select_event: "මෙම සිදුවීම තෝරන්න",
      },
      items: {
        add_title: "අයවැය අයිතමය එකතු කරන්න",
        description: "විස්තරය", desc_placeholder: "උදා. ස්ථාන ලොතු කිරීම",
        category: "කාණ්ඩය", priority: "ප්‍රමුඛතාව",
        estimated: "ගණනය කළ පිරිවැය (රු.)", actual: "සත්‍ය පිරිවැය (රු.)",
        cost_placeholder: "0.00",
        vendor: "සැපයුම්කරු", vendor_placeholder: "සැපයුම්කරු නම (විකල්ප)",
        payment_status: "ගෙවීම් තත්ත්වය",
        notes: "සටහන් (විකල්ප)", notes_placeholder: "අමතර සටහන්...",
        add_btn: "අයිතමය එකතු කරන්න",
        rec_title: "නිර්දේශ — ක්ලික් කර පිරවන්න",
      },
      table: { description: "විස්තරය", difference: "වෙනස", usage: "භාවිතය" },
      edit: {
        title: "අයවැය අයිතමය සංස්කරණය",
        estimated: "ගණනය කළ (රු.)", actual: "සත්‍ය (රු.)", save: "වෙනස්කම් සුරකින්න",
      },
      delete: { title: "අයවැය අයිතමය ඉවත් කරන්නද?", subtitle: "මෙම ක්‍රියාව ආපසු හැරවිය නොහැක." },
      forecast: {
        title: "වියදම් පූර්වාවලෝකනය සහ විශ්ලේෂණය",
        subtitle: "වත්මන් වියදම් රටා මත පදනම් වූ පුරෝකථනය",
      },
      category: { title: "කාණ්ඩ වියදම් විශ්ලේෂණය" },
      planner: {
        title: "ස්මාර්ට් අයවැය සැලසුම්කරු",
        subtitle: "මුලින්ම සිදුවීමක් තෝරන්න. සැලසුම්කරු සුදුසු අයවැය සැලැස්මක් සාදනු ඇත.",
        total_budget: "මුළු අයවැය (රු.)", total_placeholder: "උදා. 500000",
        attendees: "අපේක්ෂිත සහභාගිවන්නන්", attendees_placeholder: "උදා. 200",
        generate_btn: "ස්මාර්ට් අයවැය සැලැස්ම සාදන්න",
      },
      report: { download_pdf: "PDF බාගන්න", print: "මුද්‍රණය" },
      nav: { back_home: "මුල් පිටුවට ආපසු", create_event: "සිදුවීමක් සාදන්න" },
    },
  },

  }; // end translations

  /* ═══════════════════════════════════════════════════════════════
     CORE ENGINE
  ═══════════════════════════════════════════════════════════════ */

  let currentLocale = 'en';

  /** Resolve a dot-separated key from the translation tree */
  function resolve(key, locale) {
    const parts = key.split('.');
    let node = translations[locale] || translations['en'];
    for (const p of parts) {
      if (node == null || typeof node !== 'object') return null;
      node = node[p];
    }
    return typeof node === 'string' ? node : null;
  }

  /** Public: get a translated string */
  function t(key) {
    return resolve(key, currentLocale) || resolve(key, 'en') || key;
  }

  /** Apply translations to the entire document (or a subtree) */
  function apply(root) {
    root = root || document;

    // Text content
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (val && val !== key) el.innerText = val;
    });

    // Placeholder attributes
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const val = t(key);
      if (val && val !== key) el.placeholder = val;
    });

    // Title attributes (tooltips)
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const val = t(key);
      if (val && val !== key) el.title = val;
    });

    // ARIA labels
    root.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      const val = t(key);
      if (val && val !== key) el.setAttribute('aria-label', val);
    });

    // Sync all language pickers on the page
    document.querySelectorAll(
      '#language-picker, .lang-picker-budget, [data-lang-picker]'
    ).forEach(picker => {
      if (picker.tagName === 'SELECT') picker.value = currentLocale;
    });

    document.documentElement.lang = currentLocale;
  }

  /** Public: change language, persist, re-render */
  function change(locale) {
    if (!translations[locale]) {
      console.warn(`[i18n] Unknown locale "${locale}", falling back to "en"`);
      locale = 'en';
    }
    currentLocale = locale;
    localStorage.setItem('uc_locale', locale);
    apply();
  }

  /* ── Detect preferred locale on startup ────────────────────── */
  function detectLocale() {
    // 1. Try JWT payload
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.locale && translations[payload.locale]) {
          return payload.locale;
        }
      }
    } catch (_) {}

    // 2. Saved preference
    const saved = localStorage.getItem('uc_locale');
    if (saved && translations[saved]) return saved;

    // 3. Browser language
    const browser = (navigator.language || '').split('-')[0];
    if (translations[browser]) return browser;

    return 'en';
  }

  /* ── MutationObserver: auto-translate dynamically added nodes ─ */
  function watchDOM() {
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) { // ELEMENT_NODE
            // Translate the new node itself if it has data-i18n
            if (node.hasAttribute && node.hasAttribute('data-i18n')) {
              apply(node.parentElement || document);
              break;
            }
            // Translate any data-i18n descendants
            if (node.querySelector && node.querySelector('[data-i18n]')) {
              apply(node);
            }
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ── Boot ───────────────────────────────────────────────────── */
  function boot() {
    currentLocale = detectLocale();
    apply();
    watchDOM();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ── Public API ─────────────────────────────────────────────── */
  return { t, change, apply };

})();
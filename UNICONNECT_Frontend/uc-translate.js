/* =============================================================
   uc-translate.js  —  UniConnect Global Translation & Session
   Link this file in EVERY HTML page before your page script:
   <script src="uc-translate.js"></script>
   ============================================================= */

/* ── STEP 1: Restore session from localStorage immediately
      This runs before anything else so auth guard never fires
      after a Google Translate reload.
   ─────────────────────────────────────────────────────────── */
(function restoreSession() {
    const t   = localStorage.getItem("_uc_token");
    const uid = localStorage.getItem("_uc_user_id");
    if (!t || !uid) return;

    sessionStorage.setItem("token",      t);
    sessionStorage.setItem("user_id",    uid);
    sessionStorage.setItem("username",   localStorage.getItem("_uc_username") || "");
    sessionStorage.setItem("uni_name",   localStorage.getItem("_uc_uni")      || "");
    sessionStorage.setItem("dept_name",  localStorage.getItem("_uc_dept")     || "");
    sessionStorage.setItem("role",       localStorage.getItem("_uc_role")     || "");
    sessionStorage.setItem("user_role",  localStorage.getItem("_uc_role")     || "");
    sessionStorage.setItem("user_phone", localStorage.getItem("_uc_phone")    || "");
    sessionStorage.setItem("email",      localStorage.getItem("_uc_email")    || "");

    // Clean up — never leave credentials in localStorage permanently
    [
        "_uc_token", "_uc_user_id", "_uc_username",
        "_uc_uni", "_uc_dept", "_uc_role", "_uc_phone", "_uc_email"
    ].forEach(k => localStorage.removeItem(k));
})();


/* ── STEP 2: Inject Google Translate widget
      Injects the hidden element + bootstrap script automatically
      so every page gets translation support without extra markup.
   ─────────────────────────────────────────────────────────── */
(function injectGoogleTranslate() {
    // Inject hidden container
    const div = document.createElement("div");
    div.id = "google_translate_element";
    div.style.display = "none";
    document.documentElement.appendChild(div);

    // Define the callback Google Translate will call
    window.googleTranslateElementInit = function () {
        new google.translate.TranslateElement({
            pageLanguage:      "en",
            includedLanguages: "en,ta,si",
            autoDisplay:       false
        }, "google_translate_element");

        // After widget is ready, sync picker to saved language
        UCTranslate._syncPickers();

        // Hide the Google Translate toolbar banner
        UCTranslate._hideGTBar();
    };

    // Load the Google Translate script
    const s = document.createElement("script");
    s.src   = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    s.async = true;
    document.head.appendChild(s);
})();


/* ── STEP 3: Core translate object
      Called by your language picker: onchange="UCTranslate.set(this.value)"
   ─────────────────────────────────────────────────────────── */
window.UCTranslate = {

    /* Change language — saves session, sets cookie, reloads */
    set: function (lang) {
        if (!lang) return;

        // 1. Save language preference
        localStorage.setItem("uc_lang", lang);

        // 2. Bridge sessionStorage → localStorage so it survives reload
        UCTranslate._saveSession();

        // 3. Write/clear the googtrans cookie
        UCTranslate._setCookie(lang);

        // 4. Reload — GT picks up the cookie and translates the page
        location.reload();
    },

    /* Call this on logout to clear everything */
    logout: function () {
        sessionStorage.clear();
        localStorage.removeItem("uc_lang");
        UCTranslate._clearCookie();
        window.location.href = "Login.html";
    },

    /* Returns the currently saved language code ("en", "ta", "si") */
    current: function () {
        return localStorage.getItem("uc_lang") || "en";
    },

    /* ── INTERNALS ── */

    _saveSession: function () {
        const keys = {
            "_uc_token":    "token",
            "_uc_user_id":  "user_id",
            "_uc_username": "username",
            "_uc_uni":      "uni_name",
            "_uc_dept":     "dept_name",
            "_uc_role":     "role",
            "_uc_phone":    "user_phone",
            "_uc_email":    "email"
        };
        Object.entries(keys).forEach(([lk, sk]) => {
            const val = sessionStorage.getItem(sk);
            if (val) localStorage.setItem(lk, val);
        });
    },

    _setCookie: function (lang) {
        if (lang === "en") {
            UCTranslate._clearCookie();
            return;
        }
        const val  = `/en/${lang}`;
        const host = location.hostname;
        document.cookie = `googtrans=${val}; path=/`;
        document.cookie = `googtrans=${val}; path=/; domain=${host}`;
    },

    _clearCookie: function () {
        const exp  = "Thu, 01 Jan 1970 00:00:00 UTC";
        const host = location.hostname;
        document.cookie = `googtrans=; path=/; expires=${exp}`;
        document.cookie = `googtrans=; path=/; domain=${host}; expires=${exp}`;
    },

    /* Sync all pickers on the page to the saved language */
    _syncPickers: function () {
        const saved = UCTranslate.current();
        document.querySelectorAll("[data-uc-lang-picker]").forEach(el => {
            el.value = saved;
        });
        // backwards compat — also support id="langSelect"
        const legacy = document.getElementById("langSelect");
        if (legacy) legacy.value = saved;
    },

    /* Hide the Google Translate top banner that appears after translation */
    _hideGTBar: function () {
        const style = document.createElement("style");
        style.textContent = `
            body { top: 0 !important; }
            .goog-te-banner-frame,
            #goog-gt-tt,
            .goog-te-balloon-frame,
            .skiptranslate { display: none !important; }
        `;
        document.head.appendChild(style);
    }
};


/* ── STEP 4: On DOM ready — sync pickers ── */
document.addEventListener("DOMContentLoaded", function () {
    UCTranslate._syncPickers();
});
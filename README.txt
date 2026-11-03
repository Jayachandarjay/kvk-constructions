KVK CONSTRUCTION & ENGINEERING WEBSITE  (v3 — working enquiry system)
=====================================================================

WHAT CHANGED IN THIS VERSION
- "Get in Touch" is now a clean section: company contact details + one simple enquiry form.
  Removed: service selection, project details/information fields, the multi-step wizard,
  file attachment and the FormSubmit placeholder form.
- Verified contact details (clickable, with icons):
    Email     jayachandar1j@gmail.com    -> mailto:jayachandar1j@gmail.com
    Phone     8608892839                 -> tel:+918608892839
    WhatsApp  https://wa.me/918608892839 (also used by the floating WhatsApp button)
- Form fields: Full Name*, Email*, Phone*, Company (optional), Message*  +  "Send Enquiry" button.
- Email is sent by a SERVER-SIDE Cloudflare Pages Function (functions/api/enquiry.js) through the
  Resend email API. No keys/passwords exist in any frontend file.
- Everything else (design, 3D models, hero, tools, navigation, footer, theme toggle) is unchanged.

FILES
  index.html                    website
  assets/css/v2.css             styles (incl. contact + form styles)
  assets/js/site2.js            form validation + submit logic (no secrets)
  functions/api/enquiry.js      backend: validate, sanitise, spam checks, send email
  db/schema.sql                 OPTIONAL Cloudflare D1 table (not required for email)
  .dev.vars.example             template for local testing secrets
  assets/js/{three.min.js,OrbitControls.js,models3d.js}   3D viewer (unchanged)

HOW SUBMISSION WORKS
  Browser --JSON--> /api/enquiry (Pages Function) --HTTPS+secret key--> Resend --> jayachandar1j@gmail.com
  * Browser validates first (instant feedback), the server validates AGAIN (never trust the browser).
  * Success message appears only when the server confirms the email provider accepted the message.
    If the provider fails/unreachable/not configured the visitor sees an error and the form is NOT cleared.
  * Subject: "New Website Enquiry – KVK Construction". Reply-To is the visitor's email, so you can
    just press Reply in Gmail. All submitted details are in the email body.
  * Send button is disabled while a request is running (no duplicate submissions).

EMAIL DELIVERY CONFIGURATION (one-time, ~5 minutes)
  1. Create a free account at https://resend.com **using jayachandar1j@gmail.com**.
     (Resend's free test sender "onboarding@resend.dev" can only deliver to the email of the account
      owner. That is exactly the company inbox here, so no domain is needed to start.)
  2. In Resend -> API Keys -> Create API key (permission: "Sending access"). Copy it (starts with re_).
  3. In Cloudflare -> Workers & Pages -> your project -> Settings -> Variables and Secrets, add:
        RESEND_API_KEY   = re_...   (type: SECRET, Production AND Preview)
        TO_EMAIL         = jayachandar1j@gmail.com      (optional; this is already the default)
        FROM_EMAIL       = KVK Website <onboarding@resend.dev>   (optional; default)
  4. Redeploy (variables apply to new deployments).
  LATER (recommended): verify your own domain in Resend and set FROM_EMAIL to e.g.
  "KVK Website <enquiries@yourdomain.com>" for better deliverability / more recipients.

DEPLOY TO CLOUDFLARE PAGES
  Functions only run when deployed with the functions/ folder. Dashboard drag-and-drop of loose
  files does not build functions, so use ONE of these:

  A) Git (recommended)
     1. Put this folder in a GitHub/GitLab repo (root of repo = folder containing index.html).
     2. Cloudflare -> Workers & Pages -> Create -> Pages -> Connect to Git -> pick the repo.
     3. Framework preset: None.  Build command: (leave empty).  Build output directory: /  (root)
     4. Save and Deploy, then add the variables above and redeploy.

  B) Wrangler CLI
        npm i -g wrangler          (or use npx)
        wrangler login
        wrangler pages deploy . --project-name kvk-construction
     then add the variables in the dashboard (or: wrangler pages secret put RESEND_API_KEY --project-name kvk-construction)

  LOCAL TEST
        cp .dev.vars.example .dev.vars     (put your real key in it; .dev.vars is git-ignored)
        npx wrangler pages dev .           -> http://localhost:8788

SPAM PROTECTION (all server-enforced)
  1. Honeypot: hidden field; bots that fill it get a fake "success" and NOTHING is emailed.
  2. Time trap: submissions arriving < 2.5 s after page load are rejected.
  3. Origin check: posts from other websites are rejected (403). Add extra origins in ALLOWED_ORIGINS.
  4. Optional Cloudflare Turnstile CAPTCHA (free):
       a. Cloudflare -> Turnstile -> Add site -> copy Site key + Secret key.
       b. Put the SITE key in index.html:  <meta name="turnstile-sitekey" content="YOUR_SITE_KEY">
       c. Add secret variable TURNSTILE_SECRET = your secret key. (Both steps are required together.)
  Also: server-side length limits, control-character stripping, HTML-escaping in the email body.
  Not included: IP rate limiting. For heavy abuse add a Cloudflare WAF rate-limiting rule on /api/enquiry.

CLOUDFLARE D1 (OPTIONAL, NOT CONNECTED)
  The handler already contains a saveEnquiry() step that stores each enquiry IF a D1 binding named DB
  exists, and it never blocks or fails an email that was already delivered. Database storage is
  therefore NOT active in this delivery. To turn it on later:
        npx wrangler d1 create kvk-enquiries
        npx wrangler d1 execute kvk-enquiries --file=db/schema.sql --remote
     then Pages -> Settings -> Bindings -> Add -> D1 database -> variable name: DB.
  The D1 code path has only been exercised against a mock, not a real D1 database. Test it after binding.

WHAT WAS TESTED (and what was not)
  Tested here:  29 automated server-function checks with a mocked email provider (valid submission,
  recipient/subject/reply-to/body content, invalid email, missing fields, invalid phone, honeypot sends
  nothing, time-trap, origin/content-type/size/JSON checks, HTML escaping, provider failure and missing
  key never report success); 20 browser checks (links, removed fields, validation messages, duplicate-click
  protection, success reset, failure keeps data, network error, mobile 390 px layout + tap-to-send, no JS errors).
  NOT tested here: a real email arriving in Gmail, a live Cloudflare deployment, live Turnstile, real D1.
  After deploying, send ONE real test enquiry from the live site and confirm it reaches the inbox
  (check Spam the first time). Until you've done that, treat delivery as unconfirmed.

BEFORE PUBLISHING (still applies)
  - The project gallery uses images/captions from separate SS Design / Prabal reference presentations and
    generated schematic 3D models. They are NOT verified KVK projects. Get permission / replace with
    KVK-authorised projects before presenting them as company experience.
  - Confirm company registration/licence statements, address and business hours before publishing.
  - The steel estimator uses generic rule-of-thumb ranges (editable via data-lo / data-hi in index.html).

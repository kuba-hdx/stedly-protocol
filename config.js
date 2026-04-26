// Stedly Protocol — runtime configuration
//
// SETUP — to enable real Gmail OAuth in the prototype:
//   1. Open https://console.cloud.google.com/apis/credentials
//   2. Create (or pick) a project, enable the "Gmail API"
//   3. Create an OAuth 2.0 Client ID — Application type: "Web application"
//   4. Authorized JavaScript origins: add http://localhost:5174
//      (and any other origin you serve this prototype from)
//   5. Copy the Client ID and paste it below, replacing the empty string.
//
// SCOPES — Stedly needs to READ recent messages (so it can classify intent
// and draft a reply) plus COMPOSE drafts (so the user can approve-to-send).
// We use the two narrowest scopes that cover that:
//   - gmail.readonly  → read inbox messages (no labels, no delete, no send)
//   - gmail.compose   → create drafts + send mail Stedly itself authored
// We deliberately avoid gmail.modify (which adds label/delete) — Stedly
// never needs to mutate your existing mail, only draft new replies.
//
// IMPORTANT — this file is shipped to the browser. The Client ID is public
// by design (Google ties it to the registered origins). NEVER put a Client
// SECRET here — only Web Application server flows use a secret, and we don't
// have a server.

window.__STEDLY_GOOGLE_CLIENT_ID = "1001065629522-5csu57p9shtpsjhstg7tphrkbvsrf3a2.apps.googleusercontent.com";    // ← paste your OAuth client ID
window.__STEDLY_GOOGLE_SCOPES    = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose";

// How many recent inbox messages to pull when connected.
window.__STEDLY_INBOX_LIMIT      = 10;

// =====================================================================
// FIREBASE AUTH — for client signup/login/password-reset
//
// SETUP (≈4 minutes):
//   1. https://console.firebase.google.com → Add project (name doesn't matter)
//   2. Build → Authentication → Get started → Sign-in method tab
//        - Enable "Email/Password"  (and "Email link (passwordless)" if you like)
//        - Enable "Google" provider (uses the same Google account picker)
//   3. Project settings (gear icon) → General → Your apps → Add web app (</> icon)
//        - Register the app, copy the firebaseConfig object
//   4. Authentication → Settings → Authorized domains → add `localhost`
//        (Firebase's `localhost` entry covers any port, including 5174)
//   5. Paste the config below.
//
// NOTE — the apiKey here is PUBLIC by design (Firebase ties it to authorized
// domains + security rules). Never put a service-account secret here.
// =====================================================================
window.__STEDLY_FIREBASE = {
  apiKey:            "AIzaSyDSJUHfgRqoP-Ger_Hyd4ATOOdUsw8VViM",  // ← Firebase config.apiKey
  authDomain:        "stedly-8d36a.firebaseapp.com",  // ← e.g. stedly-protocol.firebaseapp.com
  projectId:         "stedly-8d36a",  // ← e.g. stedly-protocol
  appId:             "1:674216059917:web:94d591c098b573f85d2144",  // ← Firebase config.appId
  // storageBucket / messagingSenderId / measurementId are optional for auth-only.
};

// Require email verification before letting users into the dashboard.
//   - true  → email/password signups must click the link before /dashboard
//   - false → testing-only escape hatch when verification mail isn't arriving
// Google SSO users naturally bypass this — Firebase returns emailVerified:true
// for federated providers, so the gate auto-passes for them.
window.__STEDLY_REQUIRE_EMAIL_VERIFICATION = true;

// =====================================================================
// STRIPE — Payment Links + Customer Portal
//
// SETUP (≈5 minutes):
//   1. https://dashboard.stripe.com → Products
//      Create two recurring products:
//        - "Stedly Basic"  — $29.00 / month
//        - "Stedly Pro"    — $49.99 / month with a 30% promotion code applied
//          (Or set price to $34.99/mo and skip the promo code — simpler.)
//   2. For each product → click the price → "Create payment link"
//        - "After payment" → Don't show confirmation page, redirect to:
//          http://localhost:5174/#/welcome?plan=basic   (or ?plan=pro)
//        - Toggle "Allow promotion codes" if you want users to apply codes
//        - Toggle "Collect customer's name" → Yes
//   3. Copy each Payment Link URL below.
//
//   4. (Optional but recommended) Customer Portal:
//        Stripe → Settings → Billing → Customer portal
//        - Enable, set your branding, allow plan switching + cancellation
//        - Copy the test link or use the API to generate per-customer links
//        - Drop the link below as STEDLY_STRIPE_PORTAL_URL
//
// All three URLs are public — they're meant to be shared. NEVER put your
// Stripe secret key (sk_live_… / sk_test_…) anywhere in this prototype.
// =====================================================================
window.__STEDLY_STRIPE = {
  paymentLinkBasic: "https://buy.stripe.com/test_8x26oIaYj0H98Ug9xI8g000",  // ← e.g. https://buy.stripe.com/test_abc123
  paymentLinkPro:   "https://buy.stripe.com/test_14A7sM3vRfC32vScJU8g001",  // ← e.g. https://buy.stripe.com/test_xyz789
  customerPortal:   "https://billing.stripe.com/p/login/test_8x26oIaYj0H98Ug9xI8g000",  // ← e.g. https://billing.stripe.com/p/login/test_abc
};

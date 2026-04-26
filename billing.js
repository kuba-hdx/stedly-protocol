// Stedly Protocol — Stripe billing helpers
//
// Strategy: Stripe Payment Links + Customer Portal. No backend required.
//
//   - Payment Link → Stripe-hosted checkout. We append:
//       prefilled_email   = the authed user's email
//       client_reference_id = the Firebase UID
//     so subscriptions in your Stripe dashboard tie back to your auth users.
//   - Customer Portal → Stripe-hosted self-serve cancellation / plan switch /
//     invoice history. We deep-link the user there from the dashboard.
//
// Production note: the source of truth for "is this user paid?" must be a
// Stripe webhook handler in your Next.js app — NOT a client-side flag.
// The localStorage flag we set on success is for UX only (welcome screen
// state), never for gating paid features.

(function () {
  function paymentLinkFor(plan) {
    const cfg = window.__STEDLY_STRIPE || {};
    if (plan === "basic") return cfg.paymentLinkBasic || "";
    if (plan === "pro")   return cfg.paymentLinkPro   || "";
    return "";
  }

  function isStripeConfigured() {
    const cfg = window.__STEDLY_STRIPE || {};
    return !!(cfg.paymentLinkBasic && cfg.paymentLinkPro);
  }

  // Open the Stripe-hosted checkout for the given plan, prefilling the
  // authed user's email and tagging the session with their Firebase UID.
  function startCheckout({ plan, user }) {
    const link = paymentLinkFor(plan);
    if (!link) {
      throw new Error(`Stripe Payment Link for "${plan}" isn't configured. See config.js.`);
    }
    const url = new URL(link);
    if (user && user.email)  url.searchParams.set("prefilled_email", user.email);
    if (user && user.uid)    url.searchParams.set("client_reference_id", user.uid);
    // Plan tag is preserved in the success URL via Stripe's redirect config
    // (?plan=pro is set in the dashboard, not here).
    window.location.assign(url.toString());
  }

  function openCustomerPortal({ user }) {
    const cfg = window.__STEDLY_STRIPE || {};
    if (!cfg.customerPortal) {
      throw new Error("Stripe Customer Portal URL isn't configured. See config.js.");
    }
    const url = new URL(cfg.customerPortal);
    if (user && user.email) url.searchParams.set("prefilled_email", user.email);
    window.open(url.toString(), "_blank", "noopener");
  }

  // Best-effort client-side "they paid" flag — UX only, not a gate.
  const PAID_FLAG_KEY = "stedly:paid:v1";
  function markPaid({ uid, plan }) {
    try {
      localStorage.setItem(PAID_FLAG_KEY, JSON.stringify({
        uid, plan, at: Date.now(),
      }));
    } catch (_) {}
  }
  function readPaidFlag() {
    try {
      const raw = localStorage.getItem(PAID_FLAG_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }
  function clearPaidFlag() {
    try { localStorage.removeItem(PAID_FLAG_KEY); } catch (_) {}
  }

  Object.assign(window, {
    paymentLinkFor,
    isStripeConfigured,
    startCheckout,
    openCustomerPortal,
    markPaid,
    readPaidFlag,
    clearPaidFlag,
  });
})();

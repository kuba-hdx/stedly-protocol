# Stedly Protocol — Security audit (prototype, 2026-04-26)

Findings logged per request, prototype-honest. Production deployment to the
Next.js app at `C:\Users\Jacob\stedly\` requires the items marked **PROD-GAP**.

## Verified clean

- ✅ **No secrets in repo.** Only public-by-design identifiers in `config.js`
  (Firebase apiKey, Google OAuth client ID, Stripe Payment Link URLs). All
  three are tied to authorized origins / domain checks, not to authority.
- ✅ **No XSS surface.** Grep for `dangerouslySetInnerHTML`, `innerHTML =`,
  `eval(`, `new Function`, `document.write` returns nothing. All user/email
  text routes through React text nodes which auto-escape.
- ✅ **Email body sanitization.** `decodeBody()` in `gmail.jsx` strips
  `<script>`, `<style>`, and tags before rendering. Even if a tag slipped
  through, React text-node rendering would escape it. Defense in depth.
- ✅ **OAuth scopes are minimal.** `gmail.readonly` + `gmail.compose` only —
  not `gmail.modify` (no labels/delete) and not `gmail.send` standalone.
- ✅ **Tokens scoped + ephemeral.** Gmail access token in `sessionStorage`
  with `expiresAt` check on every read. Disconnect calls Google's revoke
  endpoint, then clears storage.
- ✅ **Firebase config is public by design.** Confirmed against Google's
  documented threat model — Firebase enforces auth via Authorized Domains +
  security rules, not the apiKey.
- ✅ **Stripe Payment Links are public URLs.** No Stripe secret key anywhere
  in the prototype. Checkout happens on Stripe-hosted pages.
- ✅ **HTTPS required for OAuth.** Gmail OAuth + Firebase Auth refuse to run
  on `http:` for non-localhost origins. Localhost is the only `http` carve-out.

## Real but accepted risks (prototype scope)

- ⚠ **Client-side "paid" flag.** `billing.js → markPaid()` writes
  `stedly:paid:v1` to `localStorage` after Stripe redirect. **This is UX
  only** — anyone can fake it in DevTools. The flag drives the welcome
  banner, never gates paid features. Comment in source already notes this.

- ⚠ **OAuth tokens in `sessionStorage` survive same-tab navigation.** This
  is intentional (so reload doesn't force re-consent) but means an XSS bug
  *anywhere* on origin would expose the token. Mitigated by:
  - No XSS surface (verified above).
  - Token is short-lived (1h expiry).
  - Disconnect + revoke is one-click from the topbar.

## PROD-GAP — fix when porting to Next.js

- 🔴 **`__STEDLY_REQUIRE_EMAIL_VERIFICATION` was set to `false`** for testing
  while Firebase verification mail wasn't delivering. **FIXED THIS TURN** —
  flag now `true`. Google SSO users naturally skip the verify gate (Firebase
  sets `emailVerified: true` for all federated providers).

- 🔴 **No Stripe webhook validation.** The "is the user paid" question must
  be answered server-side from Stripe's `checkout.session.completed` /
  `customer.subscription.updated` / `.deleted` webhooks, not from the
  client-side flag. This belongs in the Next.js app — the prototype has no
  backend to receive webhooks.

- 🔴 **No Content-Security-Policy header.** Prototype is served by
  `http-server` which doesn't set CSP. Next.js production deploy should set:
  ```
  default-src 'self';
  script-src 'self' https://accounts.google.com https://www.gstatic.com
             https://*.googleapis.com https://cdn.jsdelivr.net;
  connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com
              https://identitytoolkit.googleapis.com
              https://securetoken.googleapis.com;
  frame-src https://*.firebaseapp.com https://accounts.google.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src https://fonts.gstatic.com;
  img-src 'self' data: https:;
  ```

- 🔴 **No refresh-token strategy.** Browser-only flow has 1h tokens; users
  re-consent each hour. Production wants the server-side authorization-code
  flow with refresh tokens stored encrypted at rest.

- 🔴 **No rate limiting on Gmail API calls.** A buggy retry loop or hostile
  user could burn the user's daily Gmail quota (~250 quota units/sec). The
  Next.js app should debounce + rate-limit.

- 🔴 **No Firebase Auth rate limiting at app layer.** Firebase has its own
  rate limits for `signInWithEmailAndPassword`, but the front-end has no
  exponential backoff. Add one in production.

- 🟡 **Verification email deliverability.** Firebase's default `noreply@<project>.firebaseapp.com`
  spam-filters often. Production should configure a custom SMTP sender
  (SendGrid / Postmark / SES) under Authentication → Templates.

## Privacy posture

- Gmail message bodies are read into memory client-side and never persisted.
- Classifier runs entirely client-side (keyword scoring; not an LLM call).
- Drafts written to user's own Gmail — Stedly never sees a server-stored
  copy in the prototype.
- Tokens never hit a Stedly-controlled server (no server exists).

This is the strongest privacy posture for an autonomous-inbox tool because
the user's mail data literally cannot leak from a Stedly database — there
isn't one. Production parity will require careful design of the Next.js
backend so this property is preserved.

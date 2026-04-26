# Stedly Protocol

Autonomous-inbox B2B utility for client-services pros. Reads incoming
Gmail, classifies intent and priority, drafts a reply in your voice,
generates a branded PDF (quote / invoice / onboarding), syncs to your
Drafts folder. **Approve-to-send, always** — Stedly never sends without
your tap.

> Don't check your email. Approve it.

---

## Status

🚧 **Private testing.** Site is currently behind a temporary PIN lock
(see `lock.jsx`). PIN was shared separately with the test cohort. To
remove the lock at launch:
1. Delete `lock.jsx`
2. Remove its `<script>` tag from `index.html`
3. Render `<App />` directly in `app.jsx` (replace the `GatedApp`
   wrapper)

Heads-up — the lock is **client-side soft security**. It blocks casual
visitors but anyone with browser DevTools can bypass it. For real
"nobody can reach this URL" before launch, use Vercel Password
Protection (Pro plan), Cloudflare Access (free up to 50 users), or
keep the deploy as a preview-only branch and don't promote to prod.

## Stack

- **Static site** — no build step. CDN-loaded React (production build),
  Babel-standalone for in-browser JSX transpilation, custom CSS
- **Firebase Auth** — email/password + Google SSO (compat SDK)
- **Stripe** — Payment Links + Customer Portal (no backend required)
- **Google Identity Services** — real OAuth for Gmail (`gmail.readonly`
  + `gmail.compose` scopes)
- **jsPDF** — PDF generation, runs entirely client-side
- **Three.js / OGL** — animated mesh-gradient hero on the landing page

No server, no database, no API costs. Production deploy hosted on
Vercel as a static site (see `vercel.json`).

## Layout

```
.
├── index.html              # entrypoint
├── app.jsx                 # root + hash router + LockGate
├── lock.jsx                # temporary PIN lock (REMOVE AT LAUNCH)
├── auth.js                 # Firebase Auth wrapper + useAuth hook
├── auth-ui.jsx             # SignIn / SignUp / Forgot / Verify / Welcome
├── billing.js              # Stripe Payment Links integration
├── gmail.jsx               # Real Gmail OAuth + inbox reader + classifier
├── trust.jsx               # Email forensics (SPF/DKIM/DMARC, BEC, links)
├── relationship.jsx        # Sender history + cross-thread reference detection
├── categorizer.js          # senderType × flowType → display category
├── brands.js               # ~400-entry brand directory (impersonation defense)
├── popover.jsx             # Tooltip / Popover / SideDrawer primitives
├── pdf.jsx                 # jsPDF templates: quote / invoice / onboarding
├── dashboard.jsx           # Single-Screen Workstation
├── sections.jsx            # Landing sections (Hero/Stats/Features/Pricing/etc.)
├── screenshots.jsx         # Connect-Inbox + dashboard mockup
├── icons.jsx               # Lucide-style SVG icons
├── styles.css              # Original handoff design tokens
├── screens.css             # macOS-style dashboard mockup styles
├── protocol.css            # All Stedly Protocol additions
├── config.js               # Firebase config, OAuth client ID, Stripe links
└── vercel.json             # Static deploy config (framework: null, no build)
```

## Run locally

Static site, any HTTP server works. From the repo root:

```bash
npx --yes http-server -p 5174 -c-1 .
# → http://localhost:5174
```

## Deploy (Vercel)

1. Connect this repo to a Vercel project
2. Set Framework Preset to **Other** (or let `vercel.json` override it
   — it sets `framework: null`)
3. Set Root Directory to **`./`**
4. Build Command: leave blank
5. Output Directory: leave blank
6. Deploy

When linking your domain (e.g. `stedly.app`), update these consoles so
sign-in actually works in production:

| Console | Setting | Add |
| --- | --- | --- |
| Firebase | Authentication → Settings → Authorized domains | `stedly.app` |
| Google Cloud | APIs & Services → Credentials → OAuth client → Authorized JavaScript origins | `https://stedly.app` |
| Stripe | Each Payment Link → After payment redirect URL | `https://stedly.app/#/welcome?plan=basic` (and `?plan=pro`) |

Without those updates, sign-in and Gmail OAuth fail with
"redirect_uri not authorized" / "domain not allowlisted" errors.

## Configuration

`config.js` contains three blocks of public-by-design IDs:

- `__STEDLY_GOOGLE_CLIENT_ID` — Google OAuth client ID (for Gmail).
  Bound to authorized origins in Google Cloud Console.
- `__STEDLY_FIREBASE` — Firebase project config. The apiKey is public
  by Google's threat model (real auth comes from authorized-domains +
  security rules).
- `__STEDLY_STRIPE` — Stripe Payment Link URLs and Customer Portal URL.
  Public by design — they're meant to be shared.

There are NO server secrets in this repo. Service-account keys, Stripe
secret keys (`sk_*`), Firebase admin SDKs, etc. — all server-side, none
present here. Don't add them; switch to `.env` if you ever need to.

## Security audit

See [`SECURITY.md`](./SECURITY.md) for the full threat-model walkthrough:
verified-clean items, accepted prototype risks, and PROD-GAPs to close
when porting to a Next.js backend.

## Testing pin

Currently locked to PIN `1029` (testing only — REMOVE BEFORE PUBLIC
LAUNCH). The hash lives in `lock.jsx`; to rotate, recompute with
`printf '%s' '<new-pin>' | sha256sum` and replace the constant.

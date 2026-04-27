// Stedly Protocol — auth UI screens
// Visual reference: Mercury / Stripe auth pages. Centered card, generous
// whitespace, monochrome with one green accent, professional feel.

const { useState: useStateA, useEffect: useEffectA } = React;

function AuthShell({ children, onExit }) {
  return (
    <div className="auth-root">
      <header className="auth-topbar">
        <a className="auth-brand" href="#" onClick={(e) => { e.preventDefault(); if (onExit) onExit(); else window.location.hash = ""; }}>
          <span className="auth-brand-mark"/>
          <span className="auth-brand-name">Stedly</span>
          <span className="auth-brand-suffix">Protocol</span>
        </a>
        <a className="auth-back" href="#">← Back to landing</a>
      </header>
      <main className="auth-main">{children}</main>
      <footer className="auth-foot">
        <span>© 2026 Stedly Protocol, Inc.</span>
        <span><a href="#">Privacy</a> · <a href="#">Terms</a> · <a href="#">Security</a></span>
      </footer>
    </div>
  );
}

function GoogleButton({ onClick, busy, label = "Continue with Google", recommended = false }) {
  return (
    <button type="button" className={`auth-google ${recommended ? "is-recommended" : ""}`} onClick={onClick} disabled={busy}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.69-3.89 2.69-6.63z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z" fill="#FBBC05"/>
        <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      <span>{label}</span>
      {recommended && <span className="auth-recommended-pill">Recommended</span>}
    </button>
  );
}

// SVG icons for auth screens — replaces emoji unicode that triggers
// the "no emoji icons" anti-pattern in our design system.
const AuthIconMail = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"/>
    <path d="M22 6l-10 7L2 6"/>
  </svg>
);
const AuthIconCheck = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
);

function Divider({ children }) {
  return <div className="auth-divider"><span>{children}</span></div>;
}

function Field({ id, label, type = "text", value, onChange, autoFocus, autoComplete, error, help, ...rest }) {
  return (
    <div className={`auth-field ${error ? "has-err" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        spellCheck={false}
        {...rest}
      />
      {error && <span className="auth-err">{error}</span>}
      {!error && help && <span className="auth-help">{help}</span>}
    </div>
  );
}

function PasswordStrengthMeter({ value }) {
  const ps = (window.passwordStrength ? window.passwordStrength(value) : { score: 0, label: "" });
  return (
    <div className="auth-pw-meter" data-score={ps.score}>
      <div className="auth-pw-bars">
        {[0,1,2,3,4].map((i) => <span key={i} className={i < ps.score ? "on" : ""}/>)}
      </div>
      <span className="auth-pw-label">{ps.label}</span>
    </div>
  );
}

// ─── SIGN UP ─────────────────────────────────────────────────────────────
// Smooth navigation helper — uses useEffect (not render-time) so React
// doesn't keep firing setTimeout on every render. Adds a brief fade so
// the route change doesn't snap.
function useAuthRedirect(targetHash) {
  useEffectA(() => {
    if (!targetHash) return;
    // Tiny delay so the success state has a frame to paint before route swap.
    const t = setTimeout(() => {
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    }, 220);
    return () => clearTimeout(t);
  }, [targetHash]);
}

function SignUpScreen({ onExit }) {
  const auth = useAuth();
  const [name, setName] = useStateA("");
  const [email, setEmail] = useStateA("");
  const [password, setPassword] = useStateA("");
  const [humanVerified, setHumanVerified] = useStateA(false);

  // Smooth redirect once Firebase confirms the user is signed in. Replaces
  // the old render-time `if (auth.user) setTimeout(...)` anti-pattern.
  const target = auth.user
    ? (auth.user.emailVerified ? "#/dashboard" : "#/verify")
    : null;
  useAuthRedirect(target);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!humanVerified) { return; }
    try {
      await auth.signUp({ email, password, name });
      // The useAuthRedirect effect will fire when auth.user updates.
    } catch (_) { /* error already in auth.error */ }
  };

  const onGoogle = async () => {
    if (!humanVerified) { return; }
    try {
      await auth.signInWithGoogle();
      // Redirect handled by useAuthRedirect when auth.user populates.
    } catch (_) {}
  };

  return (
    <AuthShell onExit={onExit}>
      <div className="auth-card">
        <h1>Create your account</h1>
        <p className="auth-sub">Start your 14-day Pro trial — no card required until you connect a paying mailbox.</p>

        {!auth.isConfigured && (
          <div className="auth-setup-banner">
            <strong>Setup required.</strong> Firebase Auth isn't configured in <code>config.js</code>. The form below validates input but won't actually create an account until your Firebase config is in place — see the README's "Auth setup" section.
          </div>
        )}

        <GoogleButton onClick={onGoogle} busy={auth.busy || !humanVerified} label="Sign up with Google" recommended/>
        <p className="auth-google-note">
          Faster · email auto-verified · one click. Stedly only reads your basic profile —
          inbox access is requested separately later.
        </p>

        <Divider>or with email</Divider>

        <form onSubmit={onSubmit} className="auth-form" noValidate>
          <Field id="su-name" label="Full name"
            value={name} onChange={setName} autoFocus autoComplete="name"/>
          <Field id="su-email" label="Work email" type="email"
            value={email} onChange={setEmail} autoComplete="email"/>
          <Field id="su-pw" label="Password" type="password"
            value={password} onChange={setPassword} autoComplete="new-password"
            help="Minimum 8 characters with a number or symbol."/>
          {password && <PasswordStrengthMeter value={password}/>}

          {auth.error && <div className="auth-error-box">{auth.error}</div>}

          {/* Cosmetic captcha — auto-passes ~1.1s after click. Required
              before submit (Google + email/password both gated on it). */}
          {window.HumanCheck && (
            <window.HumanCheck onPass={() => setHumanVerified(true)} label="I'm not a robot"/>
          )}

          <button type="submit" className="auth-submit" disabled={auth.busy || !humanVerified}>
            {auth.busy ? "Creating account…" : !humanVerified ? "Verify above to continue" : "Create account"}
          </button>

          <p className="auth-fineprint">
            By creating an account you agree to Stedly's <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.
            We'll send a verification email — confirm before connecting Gmail.
          </p>
        </form>

        <div className="auth-toggle">
          Already have an account? <a href="#/login">Sign in →</a>
        </div>
      </div>
    </AuthShell>
  );
}

// ─── SIGN IN ─────────────────────────────────────────────────────────────
function SignInScreen({ onExit }) {
  const auth = useAuth();
  const [email, setEmail] = useStateA("");
  const [password, setPassword] = useStateA("");
  const [humanVerified, setHumanVerified] = useStateA(false);

  // Smooth redirect via useEffect (was render-time before, causing jitter).
  const target = auth.user
    ? (auth.user.emailVerified ? "#/dashboard" : "#/verify")
    : null;
  useAuthRedirect(target);

  // ?reset=1 banner after password reset email send
  const showResetBanner = window.location.hash.includes("reset=1");

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!humanVerified) return;
    try {
      await auth.signIn({ email, password });
      // Redirect handled by useAuthRedirect on auth.user populate.
    } catch (_) {}
  };

  const onGoogle = async () => {
    if (!humanVerified) return;
    try {
      await auth.signInWithGoogle();
    } catch (_) {}
  };

  return (
    <AuthShell onExit={onExit}>
      <div className="auth-card">
        <h1>Sign in</h1>
        <p className="auth-sub">Back to your Stedly workstation.</p>

        {!auth.isConfigured && (
          <div className="auth-setup-banner">
            <strong>Setup required.</strong> Firebase Auth isn't configured in <code>config.js</code>. See README's "Auth setup".
          </div>
        )}

        {showResetBanner && (
          <div className="auth-info-box">
            Password reset email sent. Check your inbox, then sign in with the new password.
          </div>
        )}

        <GoogleButton onClick={onGoogle} busy={auth.busy || !humanVerified} label="Continue with Google"/>

        <Divider>or with email</Divider>

        <form onSubmit={onSubmit} className="auth-form" noValidate>
          <Field id="si-email" label="Email" type="email"
            value={email} onChange={setEmail} autoFocus autoComplete="email"/>
          <Field id="si-pw" label="Password" type="password"
            value={password} onChange={setPassword} autoComplete="current-password"/>

          <div className="auth-row-spread">
            <span/>
            <a className="auth-link-sm" href="#/forgot">Forgot password?</a>
          </div>

          {auth.error && <div className="auth-error-box">{auth.error}</div>}

          {window.HumanCheck && (
            <window.HumanCheck onPass={() => setHumanVerified(true)} label="I'm not a robot"/>
          )}

          <button type="submit" className="auth-submit" disabled={auth.busy || !humanVerified}>
            {auth.busy ? "Signing in…" : !humanVerified ? "Verify above to continue" : "Sign in"}
          </button>
        </form>

        <div className="auth-toggle">
          New here? <a href="#/signup">Create an account →</a>
        </div>
      </div>
    </AuthShell>
  );
}

// ─── FORGOT PASSWORD ─────────────────────────────────────────────────────
function ForgotPasswordScreen({ onExit }) {
  const auth = useAuth();
  const [email, setEmail] = useStateA("");
  const [sent, setSent] = useStateA(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await auth.resetPassword({ email });
      setSent(true);
    } catch (_) {}
  };

  return (
    <AuthShell onExit={onExit}>
      <div className="auth-card">
        <h1>Reset your password</h1>
        <p className="auth-sub">We'll send you a link to set a new one.</p>

        {sent ? (
          <div className="auth-success">
            <div className="auth-success-mark"><AuthIconCheck size={20}/></div>
            <h3>Check your email</h3>
            <p>We sent a reset link to <strong>{email}</strong>. The link expires in an hour.</p>
            <a className="auth-submit auth-submit-link" href="#/login">Back to sign in</a>
          </div>
        ) : (
          <>
            {!auth.isConfigured && (
              <div className="auth-setup-banner">
                <strong>Setup required.</strong> Firebase Auth isn't configured — see config.js.
              </div>
            )}
            <form onSubmit={onSubmit} className="auth-form" noValidate>
              <Field id="fp-email" label="Email" type="email"
                value={email} onChange={setEmail} autoFocus autoComplete="email"/>
              {auth.error && <div className="auth-error-box">{auth.error}</div>}
              <button type="submit" className="auth-submit" disabled={auth.busy}>
                {auth.busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <div className="auth-toggle">
              <a href="#/login">← Back to sign in</a>
            </div>
          </>
        )}
      </div>
    </AuthShell>
  );
}

// ─── VERIFY EMAIL ────────────────────────────────────────────────────────
function VerifyEmailScreen({ onExit }) {
  const auth = useAuth();
  const [resent, setResent] = useStateA(false);

  // Poll for verification — refresh token periodically while on this screen.
  useEffectA(() => {
    if (!auth.user) return;
    if (auth.user.emailVerified) {
      setTimeout(() => { window.location.hash = "#/dashboard"; }, 600);
      return;
    }
    const t = setInterval(() => { auth.refreshUser(); }, 3500);
    return () => clearInterval(t);
  }, [auth.user, auth.refreshUser]);

  if (!auth.ready) {
    return <AuthShell onExit={onExit}><div className="auth-card"><div className="auth-loading"/></div></AuthShell>;
  }
  if (!auth.user) {
    setTimeout(() => { window.location.hash = "#/signup"; }, 0);
    return null;
  }
  if (auth.user.emailVerified) {
    setTimeout(() => { window.location.hash = "#/dashboard"; }, 0);
    return null;
  }

  const onResend = async () => {
    try { await auth.resendVerification(); setResent(true); setTimeout(() => setResent(false), 5000); } catch (_) {}
  };

  return (
    <AuthShell onExit={onExit}>
      <div className="auth-card">
        <div className="auth-stage-icon"><AuthIconMail/></div>
        <h1>Verify your email</h1>
        <p className="auth-sub">
          We sent a verification link to <strong>{auth.user.email}</strong>.
          Click it from your inbox — this page will move you forward automatically.
        </p>

        <div className="auth-verify-tips">
          <p><strong>Don't see it?</strong> Check spam/promotions. If you used Gmail, search "from:noreply@{(window.__STEDLY_FIREBASE && window.__STEDLY_FIREBASE.authDomain) || "stedly"}".</p>
        </div>

        {resent && <div className="auth-info-box">Verification email re-sent.</div>}

        <div className="auth-cta-row">
          <button className="auth-submit" onClick={onResend} disabled={auth.busy}>
            {auth.busy ? "Sending…" : "Resend verification email"}
          </button>
          <button className="auth-submit auth-submit-ghost" onClick={auth.signOut}>
            Sign out
          </button>
        </div>

        <div className="auth-toggle">
          Wrong email? <a href="#" onClick={(e) => { e.preventDefault(); auth.signOut().then(() => { window.location.hash = "#/signup"; }); }}>Sign out and start over →</a>
        </div>
      </div>
    </AuthShell>
  );
}

// ─── WELCOME (post-payment) ──────────────────────────────────────────────
function WelcomeScreen({ onExit }) {
  const auth = useAuth();
  const params = new URLSearchParams((window.location.hash.split("?")[1] || ""));
  const plan = params.get("plan");
  const verified = params.get("verified") === "1";

  useEffectA(() => {
    if (auth.user && plan) {
      window.markPaid && window.markPaid({ uid: auth.user.uid, plan });
    }
  }, [auth.user, plan]);

  return (
    <AuthShell onExit={onExit}>
      <div className="auth-card">
        <div className="auth-stage-icon ok"><AuthIconCheck/></div>
        <h1>{plan ? "You're on Stedly Pro" : verified ? "Email verified" : "Welcome"}</h1>
        <p className="auth-sub">
          {plan === "pro"
            ? "Subscription active — Pro features are unlocked. Connect your inbox to start drafting."
            : plan === "basic"
              ? "Basic plan active — connect your inbox to start drafting."
              : verified
                ? "Your email is verified. You're all set."
                : "You're all set. Connect your inbox and let Stedly start drafting."}
        </p>
        <div className="auth-cta-row">
          <a className="auth-submit" href="#/dashboard">Open the workstation →</a>
        </div>
        <div className="auth-toggle">
          Need to manage billing? <a href="#" onClick={(e) => {
            e.preventDefault();
            try { window.openCustomerPortal({ user: auth.user }); }
            catch (err) { alert(err.message); }
          }}>Customer portal →</a>
        </div>
      </div>
    </AuthShell>
  );
}

Object.assign(window, {
  AuthShell,
  SignUpScreen,
  SignInScreen,
  ForgotPasswordScreen,
  VerifyEmailScreen,
  WelcomeScreen,
});

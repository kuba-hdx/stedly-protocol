// Stedly Protocol — temporary PIN lock (TESTING ONLY)
//
// HONEST DISCLOSURE: this is a CLIENT-SIDE soft lock. It keeps casual
// visitors out — friends, link-leakers, search-engine indexers — but it
// is NOT real security. Anyone with browser DevTools can:
//
//   - Bypass the React render gate (delete the lock state, render <App/>)
//   - Read the source files directly via the Network tab
//   - Compute hashes of any 4-digit PIN and compare to the constant below
//
// What this DOES protect against:
//   - A non-technical user typing stedly.app and seeing the dashboard
//   - Search engines indexing pre-launch content
//   - Casual screenshot leakage of the in-progress UI
//
// What this DOES NOT protect against:
//   - Anyone who opens DevTools
//   - Anyone who reads the GitHub source
//   - A targeted security review
//
// FOR ACTUAL "no one can reach this URL" SECURITY:
//   - Vercel Password Protection (Pro plan, edge-level HTTP Basic Auth)
//   - Cloudflare Access (free up to 50 users, edge-level OIDC/SSO)
//   - Don't promote the deployment to production until launch
//
// Once you launch, REMOVE this file + remove the LockGate wrap in app.jsx.

(function () {
  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  const LOCK_STORAGE_KEY  = "stedly:lock:v1";
  const LOCK_ATTEMPTS_KEY = "stedly:lock:attempts:v1";

  // SHA-256 of "1029". Computed at build time (printf '%s' '1029' | sha256sum).
  // Storing only the hash — the plaintext PIN is never in the bundle.
  const PIN_SHA256 = "d9a5223b761c375d1263e6e57ebec42d3e0fe3f6f283488d2eb204fb6ff17ee5";

  // 4-digit PIN, auto-submit on full entry.
  const PIN_LENGTH = 4;
  // Lockout after 5 wrong attempts; resets after 60s.
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS   = 60_000;

  async function sha256Hex(str) {
    if (!crypto?.subtle?.digest) {
      // Fallback for ancient browsers (which we don't really support, but
      // we degrade gracefully — return a sentinel that never matches).
      return "__no_subtle_crypto__";
    }
    const buf = new TextEncoder().encode(String(str));
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Read attempt counter (resets after window expires).
  function readAttempts() {
    try {
      const raw = localStorage.getItem(LOCK_ATTEMPTS_KEY);
      if (!raw) return { count: 0, firstAt: 0 };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { count: 0, firstAt: 0 };
      // Window expired? Reset.
      if (Date.now() - parsed.firstAt > LOCKOUT_MS) return { count: 0, firstAt: 0 };
      return parsed;
    } catch (_) { return { count: 0, firstAt: 0 }; }
  }
  function writeAttempts(state) {
    try { localStorage.setItem(LOCK_ATTEMPTS_KEY, JSON.stringify(state)); } catch (_) {}
  }
  function clearAttempts() {
    try { localStorage.removeItem(LOCK_ATTEMPTS_KEY); } catch (_) {}
  }

  function isUnlocked() {
    try { return sessionStorage.getItem(LOCK_STORAGE_KEY) === "ok"; }
    catch (_) { return false; }
  }
  function setUnlocked(v) {
    try {
      if (v) sessionStorage.setItem(LOCK_STORAGE_KEY, "ok");
      else   sessionStorage.removeItem(LOCK_STORAGE_KEY);
    } catch (_) {}
  }

  // ─── React component ─────────────────────────────────────────────────
  function LockScreen({ onUnlock }) {
    const [digits, setDigits] = useState(Array(PIN_LENGTH).fill(""));
    const [error, setError]   = useState(null);
    const [busy, setBusy]     = useState(false);
    const [shake, setShake]   = useState(false);
    const [lockoutSeconds, setLockoutSeconds] = useState(0);
    const refs = useRef([]);

    // On mount: focus first input. Check lockout state.
    useEffect(() => {
      const a = readAttempts();
      if (a.count >= MAX_ATTEMPTS) {
        const remain = Math.max(0, LOCKOUT_MS - (Date.now() - a.firstAt));
        setLockoutSeconds(Math.ceil(remain / 1000));
      } else {
        setTimeout(() => { refs.current[0] && refs.current[0].focus(); }, 60);
      }
    }, []);

    // Countdown ticker while locked out.
    useEffect(() => {
      if (lockoutSeconds <= 0) return;
      const t = setInterval(() => {
        setLockoutSeconds((s) => {
          if (s <= 1) {
            clearAttempts();
            clearInterval(t);
            setTimeout(() => refs.current[0] && refs.current[0].focus(), 30);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      return () => clearInterval(t);
    }, [lockoutSeconds]);

    const handleDigit = useCallback((idx, raw) => {
      if (lockoutSeconds > 0) return;
      // Accept only one digit. Strip non-numeric.
      const clean = String(raw).replace(/\D/g, "").slice(-1);
      const next = [...digits];
      next[idx] = clean;
      setDigits(next);
      setError(null);
      // Advance focus when a digit is entered.
      if (clean && idx < PIN_LENGTH - 1) {
        const nextEl = refs.current[idx + 1];
        if (nextEl) nextEl.focus();
      }
      // Auto-submit when all 4 are filled.
      if (next.every((d) => d.length === 1)) {
        submit(next.join(""));
      }
    }, [digits, lockoutSeconds]);

    const handleKey = (idx) => (e) => {
      if (e.key === "Backspace" && !digits[idx] && idx > 0) {
        // Move focus back; let the previous handleDigit clear via empty value.
        refs.current[idx - 1].focus();
      }
      if (e.key === "ArrowLeft" && idx > 0) refs.current[idx - 1].focus();
      if (e.key === "ArrowRight" && idx < PIN_LENGTH - 1) refs.current[idx + 1].focus();
    };

    // Paste handler — accept full PIN at any input.
    const handlePaste = (e) => {
      const txt = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, PIN_LENGTH);
      if (txt.length === PIN_LENGTH) {
        e.preventDefault();
        const next = txt.split("");
        setDigits(next);
        submit(txt);
      }
    };

    const submit = useCallback(async (pin) => {
      if (busy || lockoutSeconds > 0) return;
      setBusy(true);
      try {
        const candidateHash = await sha256Hex(pin);
        if (candidateHash === PIN_SHA256) {
          clearAttempts();
          setUnlocked(true);
          // Tiny celebration delay so the user sees the success state for a beat.
          setTimeout(() => onUnlock && onUnlock(), 240);
          return;
        }
        // Wrong PIN.
        const a = readAttempts();
        const next = a.firstAt
          ? { count: a.count + 1, firstAt: a.firstAt }
          : { count: 1, firstAt: Date.now() };
        writeAttempts(next);

        if (next.count >= MAX_ATTEMPTS) {
          setLockoutSeconds(Math.ceil(LOCKOUT_MS / 1000));
          setError(`Too many wrong attempts. Locked for ${Math.ceil(LOCKOUT_MS / 1000)}s.`);
        } else {
          const remain = MAX_ATTEMPTS - next.count;
          setError(`Wrong PIN. ${remain} attempt${remain === 1 ? "" : "s"} left.`);
          setShake(true);
          setTimeout(() => setShake(false), 480);
          // Clear digits + refocus first.
          setDigits(Array(PIN_LENGTH).fill(""));
          setTimeout(() => refs.current[0] && refs.current[0].focus(), 60);
        }
      } catch (err) {
        setError("Verification failed. Try again.");
      } finally {
        setBusy(false);
      }
    }, [busy, lockoutSeconds, onUnlock]);

    const lockedOut = lockoutSeconds > 0;

    return (
      <div className="lock-root" role="dialog" aria-modal="true" aria-labelledby="lock-title">
        <div className="lock-orb lock-orb-1" aria-hidden="true"/>
        <div className="lock-orb lock-orb-2" aria-hidden="true"/>

        <div className={`lock-card ${shake ? "shake" : ""}`}>
          <div className="lock-mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2"/>
              <path d="M8 11V7a4 4 0 018 0v4"/>
            </svg>
          </div>
          <div className="lock-eyebrow">Stedly Protocol · private testing</div>
          <h1 id="lock-title" className="lock-title">Enter access PIN</h1>
          <p className="lock-sub">
            This site is locked while we put the finishing touches in place.
            If you're a tester, your PIN was shared with you separately.
          </p>

          <div className={`lock-pinrow ${lockedOut ? "is-locked" : ""}`} aria-disabled={lockedOut}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (refs.current[i] = el)}
                className={`lock-digit ${d ? "filled" : ""}`}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                autoComplete="one-time-code"
                value={d}
                disabled={lockedOut || busy}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={handleKey(i)}
                onPaste={i === 0 ? handlePaste : undefined}
                aria-label={`PIN digit ${i + 1} of ${PIN_LENGTH}`}
              />
            ))}
          </div>

          {lockedOut ? (
            <div className="lock-msg lock-msg-err">
              Too many wrong attempts. Try again in <strong>{lockoutSeconds}s</strong>.
            </div>
          ) : error ? (
            <div className="lock-msg lock-msg-err">{error}</div>
          ) : (
            <div className="lock-msg lock-msg-hint">PIN auto-submits when all four digits are entered.</div>
          )}

          <div className="lock-foot">
            <span>© 2026 Stedly Protocol</span>
            <span className="lock-foot-sep">·</span>
            <span>Private · do not share</span>
          </div>
        </div>
      </div>
    );
  }

  // Convenience wrapper used by app.jsx.
  function LockGate({ children }) {
    const [unlocked, setUnlockedState] = useState(() => isUnlocked());
    if (unlocked) return children;
    return <LockScreen onUnlock={() => setUnlockedState(true)}/>;
  }

  // Tiny utility — devs can call window.stedlyLock.lock() in DevTools to
  // re-engage the lock for testing the screen itself without closing the tab.
  Object.assign(window, {
    LockScreen,
    LockGate,
    stedlyLock: {
      lock:   () => { setUnlocked(false); window.location.reload(); },
      isOpen: isUnlocked,
    },
  });
})();

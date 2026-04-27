// Stedly Protocol — Human Verification (cosmetic)
//
// Cloudflare Turnstile-inspired UI. Auto-passes after a short delay so it
// looks like a real check ran. NOT real bot prevention — for real bot
// defense use Cloudflare Turnstile (free), Google reCAPTCHA, hCaptcha, or
// Vercel's edge-level bot mitigation.
//
// Why we have it: brand polish + signals "we care about who's here".
// What it does: shows a checkbox → spinner → green check + "Verified",
// then calls onPass(). Total ~1100ms (random 800–1500ms so it doesn't
// feel scripted).

(function () {
  const { useState, useEffect, useRef, useCallback } = React;

  function HumanCheck({ onPass, autoPass = true, label = "I'm not a robot" }) {
    const [state, setState] = useState("idle"); // idle | checking | verified
    const timerRef = useRef(null);
    const passedRef = useRef(false);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    const start = useCallback(() => {
      if (state !== "idle") return;
      setState("checking");
      // Random 800–1500ms — makes it feel real, not scripted.
      const ms = 800 + Math.floor(Math.random() * 700);
      timerRef.current = setTimeout(() => {
        setState("verified");
        if (!passedRef.current) {
          passedRef.current = true;
          if (typeof onPass === "function") onPass();
        }
      }, ms);
    }, [state, onPass]);

    const onKeyDown = (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        start();
      }
    };

    const reset = () => {
      clearTimeout(timerRef.current);
      passedRef.current = false;
      setState("idle");
    };

    return (
      <div
        className={`human-check state-${state}`}
        role="checkbox"
        aria-checked={state === "verified"}
        aria-busy={state === "checking"}
        tabIndex={0}
        onClick={start}
        onKeyDown={onKeyDown}>
        <div className="hc-box" aria-hidden="true">
          {state === "idle" && <span className="hc-box-empty"/>}
          {state === "checking" && <span className="hc-box-spinner"/>}
          {state === "verified" && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          )}
        </div>
        <div className="hc-label">
          {state === "idle"     && label}
          {state === "checking" && "Running checks…"}
          {state === "verified" && "Verified"}
        </div>
        <div className="hc-brand" aria-hidden="true">
          <div className="hc-brand-mark"/>
          <div className="hc-brand-stack">
            <span className="hc-brand-name">Stedly</span>
            <span className="hc-brand-tag">Trust</span>
          </div>
        </div>
        {/* Hidden reset trigger that consumers can wire to */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          ref={(el) => { if (el) el._hcReset = reset; }}
          style={{ display: "none" }}
        />
      </div>
    );
  }

  Object.assign(window, { HumanCheck });
})();

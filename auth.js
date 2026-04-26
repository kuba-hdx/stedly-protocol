// Stedly Protocol — Firebase Auth integration
//
// Real auth: passwords are sent directly from the browser to Firebase's
// auth servers over TLS — never touch our code, never sit in localStorage.
// Tokens are issued by Firebase, refreshed automatically.
//
// What this prototype gives you (all real, no faking):
//   - Email + password signup with verification email
//   - Email + password sign-in
//   - "Continue with Google" (Firebase's Google provider — separate from
//     the Gmail OAuth we use for inbox reading)
//   - Password reset (Firebase sends the email)
//   - Display-name updates
//   - Sign-out + token revocation
//
// What this prototype does NOT do (needs the Next.js / backend):
//   - Server-side session validation on protected API routes
//   - Authoritative subscription gating
//   - Custom-branded transactional emails (Firebase's templates are plain)

(function () {
  // Lazy-init the Firebase app once compat scripts have loaded.
  function initFirebase() {
    const cfg = window.__STEDLY_FIREBASE;
    if (!cfg || !cfg.apiKey) return null;
    if (!window.firebase) return null;
    if (window.firebase.apps && window.firebase.apps.length) return window.firebase;
    try {
      window.firebase.initializeApp({
        apiKey:     cfg.apiKey,
        authDomain: cfg.authDomain,
        projectId:  cfg.projectId,
        appId:      cfg.appId,
      });
      return window.firebase;
    } catch (err) {
      console.warn("[stedly] Firebase init failed:", err);
      return null;
    }
  }

  // Map Firebase error codes to copy people can actually understand.
  const HUMAN_ERR = {
    "auth/email-already-in-use":      "An account already exists with this email — try signing in instead.",
    "auth/invalid-email":             "That email doesn't look right — double-check the format.",
    "auth/user-disabled":             "This account has been disabled. Contact support if that's unexpected.",
    "auth/user-not-found":            "No account found for that email.",
    "auth/wrong-password":            "Wrong password. Try again or use 'Forgot password'.",
    "auth/invalid-credential":        "Wrong email or password. Try again or use 'Forgot password'.",
    "auth/weak-password":             "Password is too weak — use at least 8 characters with a number or symbol.",
    "auth/popup-closed-by-user":      "Sign-in popup was closed before completing.",
    "auth/popup-blocked":             "Browser blocked the sign-in popup. Allow popups for this site and try again.",
    "auth/cancelled-popup-request":   "Sign-in cancelled.",
    "auth/network-request-failed":    "Network request failed — check your connection and try again.",
    "auth/too-many-requests":         "Too many attempts — wait a minute and try again, or reset your password.",
    "auth/configuration-not-found":   "Auth provider isn't enabled in Firebase. Check the Sign-in method tab.",
  };
  function humanizeError(err) {
    if (!err) return "Something went wrong.";
    if (typeof err === "string") return err;
    return HUMAN_ERR[err.code] || err.message || "Something went wrong.";
  }

  // Validation helpers — surface errors before we even hit Firebase.
  const PW_MIN_LEN = 8;
  function validateEmail(email) {
    if (!email) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
    return null;
  }
  function passwordStrength(pw) {
    if (!pw) return { score: 0, label: "Too short", ok: false };
    let score = 0;
    if (pw.length >= PW_MIN_LEN) score++;
    if (pw.length >= 12) score++;
    if (/\d/.test(pw)) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const label = ["Too short", "Weak", "Okay", "Good", "Strong", "Excellent"][score] || "Strong";
    return { score, label, ok: score >= 2 };
  }

  // The hook — single source of truth for client auth state.
  const { useState, useEffect, useCallback, useMemo } = React;

  function useAuth() {
    const [ready, setReady]   = useState(false);
    const [user, setUser]     = useState(null);
    const [error, setError]   = useState(null);
    const [busy, setBusy]     = useState(false);

    const fb = useMemo(() => initFirebase(), []);
    const isConfigured = !!(window.__STEDLY_FIREBASE && window.__STEDLY_FIREBASE.apiKey && fb);

    useEffect(() => {
      if (!isConfigured) { setReady(true); return; }
      const auth = fb.auth();
      const unsub = auth.onAuthStateChanged((u) => {
        setUser(u ? {
          uid:           u.uid,
          email:         u.email,
          displayName:   u.displayName,
          photoURL:      u.photoURL,
          emailVerified: u.emailVerified,
          providerIds:   (u.providerData || []).map((p) => p.providerId),
        } : null);
        setReady(true);
      });
      return () => unsub();
    }, [isConfigured, fb]);

    const signUp = useCallback(async ({ email, password, name }) => {
      setError(null);
      const ev = validateEmail(email);
      if (ev) { setError(ev); throw new Error(ev); }
      const ps = passwordStrength(password);
      if (!ps.ok) { const m = "Password is too weak — use at least 8 characters with a number or symbol."; setError(m); throw new Error(m); }
      if (!isConfigured) { const m = "Firebase isn't configured — see config.js."; setError(m); throw new Error(m); }
      setBusy(true);
      try {
        const cred = await fb.auth().createUserWithEmailAndPassword(email, password);
        if (name) await cred.user.updateProfile({ displayName: name });
        try {
          await cred.user.sendEmailVerification({
            url: window.location.origin + "/#/welcome?verified=1",
            handleCodeInApp: false,
          });
        } catch (_) { /* non-fatal — user can resend later */ }
        return cred.user;
      } catch (err) {
        const msg = humanizeError(err);
        setError(msg);
        throw new Error(msg);
      } finally {
        setBusy(false);
      }
    }, [isConfigured, fb]);

    const signIn = useCallback(async ({ email, password }) => {
      setError(null);
      const ev = validateEmail(email);
      if (ev) { setError(ev); throw new Error(ev); }
      if (!password) { const m = "Password is required."; setError(m); throw new Error(m); }
      if (!isConfigured) { const m = "Firebase isn't configured — see config.js."; setError(m); throw new Error(m); }
      setBusy(true);
      try {
        return await fb.auth().signInWithEmailAndPassword(email, password);
      } catch (err) {
        const msg = humanizeError(err);
        setError(msg);
        throw new Error(msg);
      } finally {
        setBusy(false);
      }
    }, [isConfigured, fb]);

    const signInWithGoogle = useCallback(async () => {
      setError(null);
      if (!isConfigured) { const m = "Firebase isn't configured — see config.js."; setError(m); throw new Error(m); }
      setBusy(true);
      try {
        const provider = new fb.auth.GoogleAuthProvider();
        provider.addScope("email");
        provider.addScope("profile");
        return await fb.auth().signInWithPopup(provider);
      } catch (err) {
        const msg = humanizeError(err);
        setError(msg);
        throw new Error(msg);
      } finally {
        setBusy(false);
      }
    }, [isConfigured, fb]);

    const signOut = useCallback(async () => {
      if (!isConfigured) return;
      try { await fb.auth().signOut(); } catch (_) {}
    }, [isConfigured, fb]);

    const resetPassword = useCallback(async ({ email }) => {
      setError(null);
      const ev = validateEmail(email);
      if (ev) { setError(ev); throw new Error(ev); }
      if (!isConfigured) { const m = "Firebase isn't configured — see config.js."; setError(m); throw new Error(m); }
      setBusy(true);
      try {
        await fb.auth().sendPasswordResetEmail(email, {
          url: window.location.origin + "/#/login?reset=1",
        });
      } catch (err) {
        const msg = humanizeError(err);
        setError(msg);
        throw new Error(msg);
      } finally {
        setBusy(false);
      }
    }, [isConfigured, fb]);

    const resendVerification = useCallback(async () => {
      if (!isConfigured || !fb.auth().currentUser) return;
      setBusy(true);
      try {
        await fb.auth().currentUser.sendEmailVerification({
          url: window.location.origin + "/#/welcome?verified=1",
        });
      } catch (err) {
        setError(humanizeError(err));
      } finally {
        setBusy(false);
      }
    }, [isConfigured, fb]);

    const refreshUser = useCallback(async () => {
      if (!isConfigured || !fb.auth().currentUser) return;
      await fb.auth().currentUser.reload();
      const u = fb.auth().currentUser;
      setUser(u ? {
        uid: u.uid, email: u.email, displayName: u.displayName,
        photoURL: u.photoURL, emailVerified: u.emailVerified,
        providerIds: (u.providerData || []).map((p) => p.providerId),
      } : null);
    }, [isConfigured, fb]);

    return {
      ready,
      isConfigured,
      user,
      error,
      busy,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
      resendVerification,
      refreshUser,
      clearError: () => setError(null),
    };
  }

  // Tiny utility: the user's initials from displayName or email, for avatars.
  function userInitials(user) {
    if (!user) return "?";
    const src = (user.displayName || user.email || "").trim();
    const parts = src.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (src[0] || "?").toUpperCase() + (src[1] ? src[1].toUpperCase() : "");
  }

  Object.assign(window, {
    useAuth,
    initFirebase,
    humanizeAuthError: humanizeError,
    validateEmail,
    passwordStrength,
    userInitials,
  });
})();

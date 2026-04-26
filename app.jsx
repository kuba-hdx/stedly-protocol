// Stedly Protocol — root app. Hash routing keeps perceived latency at zero.
const { useState, useEffect } = React;

function useRevealObserver() {
  useEffect(() => {
    let io;
    const attach = () => {
      const vh = window.innerHeight;
      const els = document.querySelectorAll(".reveal:not(.in)");
      els.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < vh - 20) el.classList.add("in");
      });
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.05, rootMargin: "0px 0px -8% 0px" }
      );
      document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
    };
    const raf = requestAnimationFrame(() => requestAnimationFrame(attach));
    return () => { cancelAnimationFrame(raf); if (io) io.disconnect(); };
  }, []);
}

// Map hash → route name. Strip ?query while matching.
function parseRoute() {
  const raw = (window.location.hash || "").split("?")[0];
  if (raw === "#/dashboard") return "dashboard";
  if (raw === "#/login")     return "login";
  if (raw === "#/signup")    return "signup";
  if (raw === "#/forgot")    return "forgot";
  if (raw === "#/verify")    return "verify";
  if (raw === "#/welcome")   return "welcome";
  return "landing";
}

function useRoute() {
  const [route, setRoute] = useState(parseRoute());
  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute());
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return [route, (next) => {
    const map = {
      landing: "",
      dashboard: "#/dashboard",
      login: "#/login",
      signup: "#/signup",
      forgot: "#/forgot",
      verify: "#/verify",
      welcome: "#/welcome",
    };
    window.location.hash = map[next] ?? "";
    setRoute(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }];
}

function Landing({ onOpenDemo, onOpenDashboard, auth }) {
  useRevealObserver();
  return (
    <>
      <Nav onOpenDemo={onOpenDemo} onOpenDashboard={onOpenDashboard} auth={auth} />
      <main>
        <Hero onOpenDemo={onOpenDemo} onOpenDashboard={onOpenDashboard} />
        <StatsBand />
        <Features />
        <ConnectSection />
        <Pricing auth={auth} />
        <CtaBand onOpenDashboard={onOpenDashboard} auth={auth} />
      </main>
      <Footer />
    </>
  );
}

function App() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [route, go] = useRoute();
  const auth = useAuth();

  // Honor the kill-switch in config.js. When false, signed-in users land on
  // the dashboard regardless of emailVerified — useful while Firebase's
  // verification mail is misbehaving in test environments.
  const requireVerify = window.__STEDLY_REQUIRE_EMAIL_VERIFICATION !== false;

  // Auth-gate dashboard: if not authed (and Firebase IS configured), bounce
  // to login. If Firebase isn't configured, fall through so the prototype's
  // demo mode still works without setup.
  if (route === "dashboard") {
    if (!auth.ready) return <AuthLoading/>;
    if (auth.isConfigured && !auth.user) {
      setTimeout(() => go("login"), 0);
      return <AuthLoading/>;
    }
    if (requireVerify && auth.isConfigured && auth.user && !auth.user.emailVerified) {
      setTimeout(() => go("verify"), 0);
      return <AuthLoading/>;
    }
    return <Dashboard onExit={() => go("landing")} authedUser={auth.user} onSignOut={async () => { await auth.signOut(); go("landing"); }} />;
  }

  if (route === "signup")  return <SignUpScreen           onExit={() => go("landing")}/>;
  if (route === "login")   return <SignInScreen           onExit={() => go("landing")}/>;
  if (route === "forgot")  return <ForgotPasswordScreen   onExit={() => go("landing")}/>;
  if (route === "verify")  return <VerifyEmailScreen      onExit={() => go("landing")}/>;
  if (route === "welcome") return <WelcomeScreen          onExit={() => go("landing")}/>;

  return (
    <>
      <Landing
        auth={auth}
        onOpenDemo={() => setDemoOpen(true)}
        onOpenDashboard={() => {
          if (auth.isConfigured && !auth.user) { go("login"); return; }
          if (requireVerify && auth.isConfigured && auth.user && !auth.user.emailVerified) { go("verify"); return; }
          go("dashboard");
        }}
      />
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </>
  );
}

function AuthLoading() {
  return (
    <div className="auth-root auth-root-loading">
      <div className="auth-loading"/>
    </div>
  );
}

// Wrap the entire app in the LockGate. While testing, every visitor must
// enter the PIN before any other code paths render. Once you launch:
//   1. Delete lock.jsx
//   2. Remove its <script> tag from index.html
//   3. Render <App/> directly here
function GatedApp() {
  // LockGate is provided by lock.jsx (loaded earlier in index.html).
  // If lock.jsx ever fails to load, fall through to the app — better
  // than showing nothing.
  if (typeof window.LockGate !== "function") return <App />;
  return <window.LockGate><App /></window.LockGate>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<GatedApp />);

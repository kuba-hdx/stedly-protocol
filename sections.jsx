// Stedly Protocol — landing sections (editorial, "steady", utility-grade)
// Tone target: Stripe / Mercury minimalism. Zero-latency feel via reveal-on-scroll
// + perf-cheap CSS gradients (no heavy SVG in critical paint).

function Nav({ onOpenDemo, onOpenDashboard, auth }) {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef(null);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  React.useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const signedIn = !!(auth && auth.user);
  const initials = signedIn && window.userInitials ? window.userInitials(auth.user) : "";

  return (
    <header className={`nav ${scrolled ? "scrolled" : ""}`}>
      <div className="container nav-inner">
        <div className="nav-left">
          <a className="logo" href="#top"><span className="logo-mark" aria-hidden="true"/><span className="logo-text">Stedly</span><span className="logo-suffix">Protocol</span></a>
          <nav className="nav-links" aria-label="Primary">
            <a className="nav-link" href="#features">Protocol</a>
            <a className="nav-link" href="#product">Approval Feed</a>
            <a className="nav-link" href="#pricing">Pricing</a>
            <a className="nav-link" href="#changelog">Trust</a>
          </nav>
        </div>
        <div className="nav-right">
          <span className="nav-badge" title="Private beta">
            <span className="nav-badge-dot"/> Private beta
          </span>
          {signedIn ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={onOpenDashboard}>Open dashboard</button>
              <div className="nav-user" ref={menuRef}>
                <button className="nav-user-trigger" onClick={() => setMenuOpen((o) => !o)} aria-label="Account menu">
                  <span className="nav-user-avatar">{initials}</span>
                </button>
                {menuOpen && (
                  <div className="nav-user-menu" role="menu">
                    <div className="nav-user-meta">
                      <div className="nav-user-name">{auth.user.displayName || auth.user.email}</div>
                      <div className="nav-user-email">{auth.user.email}</div>
                    </div>
                    <div className="nav-user-sep"/>
                    <button className="nav-user-item" onClick={() => { setMenuOpen(false); onOpenDashboard(); }}>Open dashboard</button>
                    <button className="nav-user-item" onClick={() => {
                      setMenuOpen(false);
                      try { window.openCustomerPortal({ user: auth.user }); }
                      catch (err) { alert(err.message); }
                    }}>Manage billing</button>
                    <div className="nav-user-sep"/>
                    <button className="nav-user-item warn" onClick={async () => { setMenuOpen(false); await auth.signOut(); }}>Sign out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <a className="btn btn-ghost btn-sm" href="#/login">Sign in</a>
              <a className="btn btn-accent btn-sm" href="#/signup">
                <span>Get started</span>
                <span className="btn-chip"><IconArrowRight size={12}/></span>
              </a>
            </>
          )}
          <button className="nav-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
            {mobileOpen ? <IconX size={18}/> : <IconMenu size={18}/>}
          </button>
        </div>
      </div>
      <div className={`nav-mobile ${mobileOpen ? "open" : ""}`}>
        <a href="#features" onClick={() => setMobileOpen(false)}>Protocol <IconArrowRight size={14}/></a>
        <a href="#product" onClick={() => setMobileOpen(false)}>Approval Feed <IconArrowRight size={14}/></a>
        <a href="#pricing" onClick={() => setMobileOpen(false)}>Pricing <IconArrowRight size={14}/></a>
        {signedIn ? (
          <a href="#" onClick={(e) => { e.preventDefault(); setMobileOpen(false); onOpenDashboard(); }}>Open dashboard <IconArrowRight size={14}/></a>
        ) : (
          <>
            <a href="#/login" onClick={() => setMobileOpen(false)}>Sign in <IconArrowRight size={14}/></a>
          </>
        )}
        <div className="mobile-ctas">
          {signedIn ? (
            <a className="btn btn-accent btn-lg" href="#" onClick={(e) => { e.preventDefault(); setMobileOpen(false); onOpenDashboard(); }}>
              <span>Open dashboard</span>
              <span className="btn-chip"><IconArrowRight size={12}/></span>
            </a>
          ) : (
            <a className="btn btn-accent btn-lg" href="#/signup" onClick={() => setMobileOpen(false)}>
              <span>Create account</span>
              <span className="btn-chip"><IconArrowRight size={12}/></span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero({ onOpenDemo, onOpenDashboard }) {
  const frameRef = React.useRef(null);
  React.useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let rx = 2, ry = 0, trx = 2, try_ = 0, raf;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) - 0.5;
      const y = ((e.clientY - r.top) / r.height) - 0.5;
      trx = 2 - y * 6;
      try_ = x * 8;
    };
    const onLeave = () => { trx = 2; try_ = 0; };
    const tick = () => {
      rx += (trx - rx) * 0.08;
      ry += (try_ - ry) * 0.08;
      el.style.setProperty("--rx", `${rx}deg`);
      el.style.setProperty("--ry", `${ry}deg`);
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
  }, []);
  return (
    <section className="hero" id="top">
      <div className="hero-video-wrap">
        {window.ColorBends ? (
          <ColorBends
            colors={["#031A0C", "#062A14", "#0B3D1C", "#14532D", "#166534", "#22A34A"]}
            rotation={110}
            autoRotate={1}
            speed={0.14}
            scale={1}
            frequency={1}
            warpStrength={1}
            mouseInfluence={0.5}
            parallax={0.3}
            noise={0.08}
            iterations={1}
            intensity={0.85}
            bandWidth={6}
            transparent={false}
          />
        ) : null}
        <div className="hero-wash"/>
      </div>
      {/* Floating jitter chips — Stedly Protocol activity, not real-estate */}
      <div className="hero-chip hero-chip-1">
        <span className="hero-chip-dot green"/>
        <div>
          <div style={{ color: "var(--fg)", fontWeight: 500 }}>3 drafts ready to approve</div>
          <div style={{ color: "var(--muted)", fontSize: 11.5 }}>Inbox · synced 14 sec ago</div>
        </div>
      </div>
      <div className="hero-chip hero-chip-2">
        <span className="hero-chip-dot amber"/>
        <div>
          <div style={{ color: "var(--fg)", fontWeight: 500 }}>Quote PDF · Acme Refit</div>
          <div style={{ color: "var(--muted)", fontSize: 11.5 }}>$18,420 · awaiting your sign-off</div>
        </div>
      </div>
      <div className="hero-chip hero-chip-3">
        <span className="hero-chip-dot red"/>
        <div>
          <div style={{ color: "var(--fg)", fontWeight: 500 }}>Vault question flagged</div>
          <div style={{ color: "var(--muted)", fontSize: 11.5 }}>Stedly won't guess — review needed</div>
        </div>
      </div>
      <div className="container">
        <span className="hero-kicker">
          <span className="hero-kicker-tag">New</span>
          The Stedly Protocol — autonomous inbox, now live
        </span>
        <h1>Don't check your email.<br/><span className="accent">Approve&nbsp;it.</span></h1>
        <p className="hero-sub">
          Stedly drafts your replies and builds your documents before you wake up.
          Connect your inbox once. Wake up to a queue you can clear in five minutes —
          every reply written in your voice, every quote and invoice already attached.
        </p>
        <div className="hero-ctas">
          <a className="btn btn-accent btn-lg" href="#connect">
            <span>Connect your inbox</span>
            <span className="btn-chip"><IconArrowRight size={13}/></span>
          </a>
          <button className="hero-demo" onClick={onOpenDashboard}>
            <span className="play-dot"><IconPlay size={10}/></span>
            See the Approval Feed
          </button>
        </div>
        <div className="trust-row">
          <span>Read-only inbox access</span>
          <span className="sep">·</span>
          <span>Drafts only — never sends without you</span>
          <span className="sep">·</span>
          <span>SOC 2 Type II in progress</span>
        </div>
        <div className="product-stage" id="product">
          <div className="product-frame" ref={frameRef}>
            <ApprovalFeedMock/>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsBand() {
  return (
    <section className="stats-band reveal">
      <div className="container">
        <div className="stats-row">
          <div className="stat-cell">
            <div className="stat-value">5<span className="unit">min</span></div>
            <div className="stat-label">To clear a morning's<br/><strong>inbox via approve-only</strong></div>
          </div>
          <div className="stat-cell">
            <div className="stat-value">&lt;800<span className="unit">ms</span></div>
            <div className="stat-label">From received email<br/>to <strong>drafted reply in your folder</strong></div>
          </div>
          <div className="stat-cell">
            <div className="stat-value">0<span className="unit"></span></div>
            <div className="stat-label">Outbound messages sent<br/>without your <strong>explicit approval</strong></div>
          </div>
          <div className="stat-cell">
            <div className="stat-value">100<span className="unit">%</span></div>
            <div className="stat-label">Citation-backed replies<br/><strong>from your Vault, never invented</strong></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: <IconInbox size={22}/>, title: "The Shadow Inbox",
      desc: "Stedly reads incoming mail and prepares perfect drafts in your Drafts folder — quietly, in the background. You open Gmail or Outlook and the reply is already waiting, written like you wrote it.",
      viz: <MiniInboxViz/> },
    { icon: <IconPdf size={22}/>, title: "The PDF Factory",
      desc: "Quote requested? Invoice owed? Onboarding pack needed? Stedly classifies email intent and generates the branded PDF automatically — line items, totals, terms, attached to the draft.",
      viz: <MiniFactoryViz/> },
    { icon: <IconVault size={22}/>, title: "The Vault Context",
      desc: "Your prices, policies, past threads, signed contracts — Stedly grounds every reply in the Vault. Factually accurate, in your voice, and when it isn't sure, it flags rather than guesses.",
      viz: <MiniVaultViz/> },
  ];
  return (
    <section id="features">
      <div className="container">
        <span className="section-eyebrow reveal">The Protocol</span>
        <h2 className="section-title reveal">Three layers of professional<br/>infrastructure. One quiet inbox.</h2>
        <p className="section-sub reveal" data-delay="1">A drafting engine, a document engine, and a context engine — running on top of the inbox you already use.</p>
        <div className="features-grid">
          {items.map((f, i) => (
            <article className="feature-card reveal" data-delay={i+1} key={i}>
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
              {f.viz}
              <a className="feature-link" href="#">How it works <IconArrowRight size={14}/></a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ConnectSection() {
  return (
    <section id="connect" className="connect-section">
      <div className="container">
        <span className="section-eyebrow reveal">Step one</span>
        <h2 className="section-title reveal">Connect once. Stedly does the rest.</h2>
        <p className="section-sub reveal" data-delay="1">
          OAuth into Gmail or Microsoft 365. Read-only at first — Stedly will never
          send mail it didn't write or send any mail without your tap.
        </p>
        <div className="reveal" data-delay="2">
          <ConnectInbox/>
        </div>
      </div>
    </section>
  );
}

function PricingTier({ tier, auth }) {
  const popular = tier.popular;
  const hasDiscount = tier.discount > 0;
  const wasPrice = tier.price;
  const nowPrice = hasDiscount ? +(tier.price * (1 - tier.discount)).toFixed(2) : tier.price;
  const stripeReady = !!(window.__STEDLY_STRIPE && (tier.plan === "basic"
    ? window.__STEDLY_STRIPE.paymentLinkBasic
    : window.__STEDLY_STRIPE.paymentLinkPro));
  const signedIn = !!(auth && auth.user);

  const onChoose = (e) => {
    e.preventDefault();
    if (!signedIn) {
      // Stash the intended plan so the Welcome screen knows what to celebrate
      try { sessionStorage.setItem("stedly:intended_plan", tier.plan); } catch (_) {}
      window.location.hash = "#/signup";
      return;
    }
    if (!stripeReady) {
      alert(`Stripe Payment Link for "${tier.plan}" isn't configured yet. See README → "Stripe billing setup".`);
      return;
    }
    try {
      window.startCheckout({ plan: tier.plan, user: auth.user });
    } catch (err) {
      alert(err.message);
    }
  };

  const ctaLabel = !signedIn
    ? (popular ? "Get started — Pro" : "Get started")
    : !stripeReady
      ? "Setup required"
      : (popular ? "Subscribe to Pro" : "Subscribe to Basic");

  return (
    <div className={`pricing-card reveal ${popular ? "popular" : ""}`} data-delay={tier.delay}>
      {popular && !hasDiscount && (
        <span className="pricing-popular-badge">Most popular</span>
      )}
      {hasDiscount && (
        <span className="pricing-popular-badge">Save {Math.round(tier.discount * 100)}%</span>
      )}
      <div className="pricing-name">{tier.name}</div>
      <h3>{tier.title}</h3>
      <div className="pricing-price">
        {hasDiscount && <span className="price-was">${wasPrice}</span>}
        <span className="price">${nowPrice}</span>
        <span className="price-suffix">/ month</span>
      </div>
      <div className="pricing-desc">{tier.desc}</div>
      <div className="pricing-divider"/>
      <div className="pricing-features">
        {tier.features.map((f, i) => (
          <div className="pricing-feat" key={i}><IconCheck size={14}/><span>{f}</span></div>
        ))}
      </div>
      <button className={`btn ${popular ? "btn-accent" : "btn-primary"} btn-lg pricing-cta`} onClick={onChoose}>
        <span>{ctaLabel}</span>
        <span className="btn-chip"><IconArrowRight size={13}/></span>
      </button>
      {signedIn && !stripeReady && (
        <div className="pricing-setup-note">Stripe Payment Link not configured — see README.</div>
      )}
    </div>
  );
}

function Pricing({ auth }) {
  const tiers = [
    { name: "Basic", plan: "basic", title: "For solo operators", price: 29, delay: 1,
      desc: "Your inbox, drafted overnight. One mailbox, one Vault.",
      features: ["1 connected mailbox","Unlimited drafts","Branded quotes & invoices","Vault context (5k docs)","Email approval queue"] },
    { name: "Pro", plan: "pro", title: "For studios up to 5", price: 49.99, delay: 2,
      discount: 0.30,
      desc: "Shared Vault, shared voice — one queue across the team.",
      features: ["Up to 5 mailboxes","Shared Vault & voice profile","Custom PDF templates","Per-mailbox approval routing","Audit trail (30 days)","Priority support"],
      popular: true },
  ];
  return (
    <section id="pricing">
      <div className="container">
        <div className="pricing-head">
          <span className="section-eyebrow reveal">Pricing</span>
          <h2 className="section-title reveal" style={{ margin: "0 auto" }}>Two plans. Both flat monthly.<br/>No per-email fees, ever.</h2>
          <p className="section-sub reveal" data-delay="1" style={{ margin: "22px auto 0" }}>Connect a mailbox, clear your morning, cancel in one click.</p>
        </div>
        <div className="pricing-grid pricing-grid-2">
          {tiers.map((t, i) => <PricingTier key={i} tier={t} auth={auth}/>)}
        </div>
        <div className="founder-note reveal"><strong>Pro is 30% off through Q2</strong> — locked at the discounted rate while your subscription stays active.</div>
      </div>
    </section>
  );
}

function CtaBand({ onOpenDashboard, auth }) {
  const signedIn = !!(auth && auth.user);
  return (
    <section style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="cta-band reveal">
          <div className="cta-aurora"/>
          <span className="cta-eyebrow">
            <span className="cta-eyebrow-tag">Limited</span>
            Founding operator pricing — locked for life
          </span>
          <h2>Stop checking your email.<br/>Start <span className="accent">approving</span> it.</h2>
          <p>Plug in your inbox tonight. Wake up tomorrow to a clean queue, drafts in your voice, and PDFs already attached. One tap to send.</p>
          <div className="btn-row">
            <a className="btn btn-accent btn-lg" href={signedIn ? "#/dashboard" : "#/signup"}>
              <span>{signedIn ? "Open the workstation" : "Create your account"}</span>
              <span className="btn-chip"><IconArrowRight size={13}/></span>
            </a>
            <button className="btn btn-secondary btn-lg" onClick={onOpenDashboard}>See the dashboard</button>
          </div>
          <div className="cta-proof">
            <span><strong>Read-only</strong> inbox access</span>
            <span className="dot"/>
            <span><strong>Approve-to-send</strong>, always</span>
            <span className="dot"/>
            <span><strong>SOC 2</strong> Type II in progress</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-cta-block">
            <h3>Get the Stedly Protocol changelog — engineering only, no marketing.</h3>
            <p>Monthly notes from the team building the autonomous inbox. New PDF templates, Vault upgrades, drafting model evals. Unsubscribe in one click.</p>
            <form className="footer-newsletter" onSubmit={(e) => { e.preventDefault(); }}>
              <input type="email" placeholder="you@yourdomain.com" aria-label="Email address" required/>
              <button type="submit" className="footer-news-btn">Subscribe <IconArrowRight size={12}/></button>
            </form>
          </div>
          <div>
            <a className="logo" href="#top"><span className="logo-mark" aria-hidden="true"/><span className="logo-text">Stedly</span><span className="logo-suffix">Protocol</span></a>
            <p className="footer-tag">Professional infrastructure for the inbox. Drafting logic, document engine, and Vault context — running quietly behind the email you already use.</p>
            <div className="footer-socials">
              <a className="footer-social" href="#" aria-label="Twitter"><IconTwitter size={15}/></a>
              <a className="footer-social" href="#" aria-label="LinkedIn"><IconLinkedin size={15}/></a>
              <a className="footer-social" href="#" aria-label="GitHub"><IconGithub size={15}/></a>
            </div>
          </div>
        </div>
        <div className="footer-cols" style={{ marginTop: 48 }}>
          <div className="footer-col">
            <h5>Protocol</h5>
            <ul>
              <li><a href="#features">Shadow Inbox</a></li>
              <li><a href="#features">PDF Factory</a></li>
              <li><a href="#features">Vault Context</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="#changelog">Changelog <span className="ext-badge">New</span></a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h5>Trust</h5>
            <ul>
              <li><a href="#">Security model</a></li>
              <li><a href="#">Approve-to-send guarantee</a></li>
              <li><a href="#">Vault data handling</a></li>
              <li><a href="#">Status</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h5>Company</h5>
            <ul>
              <li><a href="#">About</a></li>
              <li><a href="#">Contact</a></li>
              <li><a href="#">Privacy</a></li>
              <li><a href="#">Careers <span className="ext-badge">2 open</span></a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Stedly Protocol, Inc.</span>
          <div className="footer-legal">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Cookies</a>
          </div>
          <span className="status-pill"><span className="status-dot"/> Drafting engine · operational</span>
        </div>
      </div>
    </footer>
  );
}

function DemoModal({ open, onClose }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div className={`modal-overlay ${open ? "open" : ""}`} onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-video">
          <button className="modal-play" aria-label="Play demo"><IconPlay size={28}/></button>
          <button className="modal-close" onClick={onClose} aria-label="Close"><IconX size={16}/></button>
        </div>
        <div className="modal-caption">
          <span>A 90-second tour — inbox connect to first approved send.</span>
          <span style={{ color: "#71717A" }}>1:32</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Nav, Hero, StatsBand, Features, ConnectSection, Pricing, CtaBand, Footer, DemoModal });

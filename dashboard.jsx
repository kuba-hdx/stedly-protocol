// Stedly Protocol — Single-Screen Workstation (v2)
// Goals this revision:
//   - Easier to read at a glance: section numbering, tinted accents,
//     focal Draft, demoted Inquiry/Asset
//   - Slight color differentials (slate / paper / warm) so the eye knows
//     where it is
//   - Real Gmail integration via useGmailAuth — Sync calls users.drafts.create
//   - View-transition + queue-hover micro-motion (CSS keyframes — same
//     output as Framer Motion, no extra runtime)

const { useState: useStateD, useRef: useRefD, useEffect: useEffectD, useMemo: useMemoD, useCallback: useCallbackD } = React;

const QUEUE = [
  {
    id: "q1",
    from: "Daniel Park",
    fromEmail: "daniel@harborlogistics.co",
    co: "Harbor Logistics",
    status: "Ready to sync",
    received: "07:14 — today",
    subj: "Re: Quote for Q2 freight contract",
    intent: "Quote",
    inquiry:
`Hi Eliana,

Looking to lock in Q2 freight rates. Same lanes as last quarter (OAK→DFW, OAK→SEA, LAX→PHX) plus two new ones I'd want to add by mid-quarter. Volumes are roughly flat from Q1 — happy to share the spreadsheet if useful.

If you can hold the same fuel-surcharge structure we used in Q4 we'd commit through end of Q2.

— Daniel
Harbor Logistics`,
    original:
`Daniel —

Thanks for the freight volumes. I've put together the Q2 quote on the same lane structure we used for the Q4 run, with the rate adjustment we agreed to last September.

You'll see the full breakdown in Q2-Quote-Harbor.pdf — net-30 terms, the standard fuel surcharge clause, and a 90-day price lock on the 12 highest-volume lanes.

Happy to walk through it Wednesday morning if useful.

— Eliana`,
    pdf: { kind: "quote", name: "Q2-Quote-Harbor.pdf", pages: 2, total: "$42,800 / mo", to: "Harbor Logistics", attn: "Daniel Park" },
  },
  {
    id: "q2",
    from: "Mira Tanaka",
    fromEmail: "mira@tanakaco.studio",
    co: "Tanaka & Co Studio",
    status: "Drafting",
    received: "06:58 — today",
    subj: "Onboarding paperwork — new client",
    intent: "Onboarding",
    inquiry:
`Hi! Just got the green light from our partner. Can you send over the standard onboarding pack so we can get rolling?

We'd like to kick off the week of the 24th if possible.

Thanks,
Mira`,
    original:
`Mira —

Welcome aboard. Attached you'll find the full onboarding pack — the welcome doc, our SOW template, the master services agreement (already countersigned by our side), and the quick-start access kit.

Forms-side: there's a W-9 and banking form your accounting team can fill in any time. Not a blocker for kickoff.

I've held the morning of the 24th — let's lock it once the SOW comes back signed.

— Eliana`,
    pdf: { kind: "onboarding", name: "Studio-Onboarding-Pack.pdf", pages: 7, total: "6 documents", to: "Tanaka & Co Studio", attn: "Mira Tanaka" },
  },
  {
    id: "q3",
    from: "Aiyana Cross",
    fromEmail: "aiyana@crosscabinetry.com",
    co: "Cross Cabinetry",
    status: "Ready to sync",
    received: "06:31 — today",
    subj: "Final invoice — Atherton job",
    intent: "Invoice",
    inquiry:
`Hey Eliana, the Atherton job wrapped Friday. Whenever you have a chance, can you send the final invoice?

Same payment details as last time work for us.

Aiyana`,
    original:
`Aiyana —

Final invoice for the Atherton job is attached. Net-15 from today, payable to the same account on file. Subtotal lines up with the SOW; the only addition is the third site visit on the 28th, billed at the agreed rate.

Let me know if you'd like me to break out anything differently for your books.

— Eliana`,
    pdf: { kind: "invoice", name: "INV-Atherton-2026-03.pdf", pages: 1, total: "$18,420", to: "Cross Cabinetry", attn: "Aiyana Cross" },
  },
  {
    id: "q4",
    from: "Owen Ashby",
    fromEmail: "owen@ashbycap.com",
    co: "Ashby Capital",
    status: "Needs review",
    received: "05:47 — today",
    subj: "Re: NDA + scope of work",
    intent: "Reply",
    inquiry:
`Eliana,

Mutual NDA looks fine on a quick read. The scope is close to what we discussed — one note on §4: deliverable timing should be tied to data handover, not contract execution. Otherwise, we're aligned.

Let's plan to sign by EOW.

Owen`,
    original:
`Owen —

Good catch on §4 — agreed, deliverable timing should run from data handover. I'll have legal swap that language and resend by tomorrow morning.

Everything else holds. EOW signing works on our end.

— Eliana`,
    pdf: null,
  },
];

function tagKindFor(status) {
  if (status === "Ready to sync") return "ready";
  if (status === "Drafting") return "drafting";
  if (status === "Needs review") return "review";
  if (status === "Synced") return "synced";
  if (status === "Syncing") return "syncing";
  return "neutral";
}

function intentToneFor(intent) {
  if (intent === "Quote")      return "g";  // green
  if (intent === "Invoice")    return "a";  // amber
  if (intent === "Onboarding") return "b";  // blue
  return "n";                                // neutral
}

function StatusTag({ kind, label }) {
  return <span className={`ws-tag ws-tag-${kind}`}>{label}</span>;
}

function CornerMenu({ onExit, gmailEmail, onDisconnect, authedUser, onSignOut }) {
  const [open, setOpen] = useStateD(false);
  const ref = useRefD(null);
  useEffectD(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const initials = authedUser ? (window.userInitials ? window.userInitials(authedUser) : "?") : "EM";
  const displayName = authedUser ? (authedUser.displayName || authedUser.email?.split("@")[0] || "You") : "Demo";
  return (
    <div className="ws-corner" ref={ref}>
      <button className="ws-corner-trigger" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span className="ws-corner-avatar">{initials}</span>
        <span className="ws-corner-name">{displayName}</span>
        <IconChevronDown size={11}/>
      </button>
      {open && (
        <div className="ws-corner-menu" role="menu">
          {authedUser ? (
            <>
              <div className="ws-corner-meta">
                <div className="ws-corner-meta-row">
                  <span className="ws-corner-meta-mail">{authedUser.displayName || authedUser.email}</span>
                </div>
                <span className="ws-corner-meta-sub">{authedUser.email}{authedUser.emailVerified ? " · verified" : " · unverified"}</span>
              </div>
              <div className="ws-corner-sep"/>
            </>
          ) : null}
          {gmailEmail ? (
            <>
              <div className="ws-corner-meta">
                <div className="ws-corner-meta-row">
                  <span className="ws-corner-conn-dot"/>
                  <span className="ws-corner-meta-mail">{gmailEmail}</span>
                </div>
                <span className="ws-corner-meta-sub">Gmail · readonly + compose</span>
              </div>
              <div className="ws-corner-sep"/>
            </>
          ) : null}
          <button className="ws-corner-item" role="menuitem">Vault</button>
          <button className="ws-corner-item" role="menuitem">Voice profile</button>
          <button className="ws-corner-item" role="menuitem" onClick={() => {
            try { window.openCustomerPortal({ user: authedUser }); }
            catch (err) { alert(err.message); }
          }}>Manage billing</button>
          <div className="ws-corner-sep"/>
          <button className="ws-corner-item" role="menuitem">Settings</button>
          <button className="ws-corner-item" role="menuitem" onClick={onExit}>View landing page</button>
          {gmailEmail ? <>
            <div className="ws-corner-sep"/>
            <button className="ws-corner-item warn" role="menuitem" onClick={onDisconnect}>Disconnect Gmail</button>
          </> : null}
          <div className="ws-corner-sep"/>
          <button className="ws-corner-item muted" role="menuitem" onClick={onSignOut}>Sign out</button>
        </div>
      )}
    </div>
  );
}

// Tiny media-query hook — mobile dashboard pattern hinges on it.
function useMobileViewport() {
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e) => setIsMobile(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return isMobile;
}

function Workstation({ onExit, authedUser, onSignOut }) {
  const [activeId, setActiveId] = useStateD(null);
  const [edits, setEdits]       = useStateD({});
  const [subjects, setSubjects] = useStateD({});
  const [view, setView]         = useStateD({});
  const [pdfStamp, setPdfStamp] = useStateD({});
  const [synced, setSynced]     = useStateD({});
  const [syncing, setSyncing]   = useStateD(false);
  const [syncError, setSyncError] = useStateD(null);
  const [toast, setToast]       = useStateD(null);
  const [transitionKey, setTransitionKey] = useStateD(0);
  const [priorityFilter, setPriorityFilter] = useStateD("all");
  // Mobile master-detail — "queue" or "workstation". Ignored on desktop.
  const [mobileView, setMobileView] = useStateD("queue");
  const isMobile = useMobileViewport();
  const draftRef = useRefD(null);

  const gmail = useGmailAuth();
  const inbox = useGmailInbox(gmail);
  const gmailEmail = gmail.profile?.emailAddress || null;

  // Click-guard for any links rendered into the inquiry pane.
  // Always declared (not behind a conditional) so the hook order stays stable.
  const clickGuard = (typeof window.useClickGuard === "function")
    ? window.useClickGuard()
    : { guard: () => {}, modalProps: { link: null } };

  // PRODUCTION: real Gmail data only. The hardcoded QUEUE constant remains
  // in this file for design-system review and as fallback if window.__STEDLY_DEMO
  // is set to true in DevTools (handy for screenshots, never for users).
  const demoMode = !!window.__STEDLY_DEMO;
  const isLive = gmail.status === "connected" && inbox.status === "ready";

  // Apply the priority filter, sort by priority order then time desc.
  const liveQueue = useMemoD(() => {
    if (!isLive) return [];
    let items = inbox.items.slice();
    if (priorityFilter !== "all") {
      items = items.filter((q) => (q.priority || "standard") === priorityFilter);
    } else {
      // "all" hides spam by default — Spam tab to opt back in.
      items = items.filter((q) => (q.priority || "standard") !== "spam");
    }
    items.sort((a, b) => {
      const pa = (PRIORITY_META[a.priority || "standard"] || {}).order ?? 9;
      const pb = (PRIORITY_META[b.priority || "standard"] || {}).order ?? 9;
      if (pa !== pb) return pa - pb;
      return (b.receivedTs || 0) - (a.receivedTs || 0);
    });
    return items;
  }, [isLive, inbox.items, priorityFilter]);

  // Bucket counts for the filter bar (always derived from full inbox).
  const priorityCounts = useMemoD(() => {
    const c = { all: 0, urgent: 0, important: 0, standard: 0, promotion: 0, spam: 0 };
    if (!isLive) return c;
    for (const m of inbox.items) {
      const p = m.priority || "standard";
      c[p] = (c[p] || 0) + 1;
      if (p !== "spam") c.all += 1;
    }
    return c;
  }, [isLive, inbox.items]);

  const sourceQueue = demoMode ? QUEUE : liveQueue;

  // Default the active item to the first in whichever queue we have.
  useEffectD(() => {
    if (sourceQueue.length === 0) { setActiveId(null); return; }
    if (!activeId || !sourceQueue.find((q) => q.id === activeId)) {
      setActiveId(sourceQueue[0].id);
    }
  }, [sourceQueue, activeId]);

  const active = useMemoD(
    () => sourceQueue.find((q) => q.id === activeId) || sourceQueue[0] || null,
    [sourceQueue, activeId]
  );

  // Sender history — fetches lazily for the active message's sender, caches
  // 24h in sessionStorage. The hook handles its own gating (no-op if not
  // connected or no email), so it's safe to call unconditionally.
  const senderHistoryHook = (typeof window.useSenderHistory === "function")
    ? window.useSenderHistory({ email: active?.fromEmail || "", gmailAuth: gmail })
    : { status: "idle", received: [], sent: [], relationship: null };

  // Enriched trust — re-runs assessTrust with the sender's relationship
  // attached (so BEC's first-contact multiplier kicks in correctly).
  const enrichedTrust = useMemoD(() => {
    if (!active) return null;
    if (typeof window.assessTrust !== "function") return active.trust || null;
    if (!senderHistoryHook.relationship && active.trust) return active.trust;
    return window.assessTrust({
      headers: {
        From: active.gmailFromHeader || "",
        "Reply-To": active.gmailReplyTo || "",
        "Authentication-Results": active.gmailAuthResults || "",
      },
      fromEmail: active.fromEmail || "",
      subject: active.subj || "",
      plainBody: active.inquiry || "",
      htmlBody: active.inquiryHtml || "",
      senderHistory: senderHistoryHook.relationship ? { relationship: senderHistoryHook.relationship.state } : null,
    });
  }, [active, senderHistoryHook.relationship]);

  // Related earlier conversations (cross-thread). Pulls from the sender's
  // full history when available, else from the inbox queue.
  const relatedThreads = useMemoD(() => {
    if (!active || typeof window.findRelatedThreads !== "function") return [];
    const history = senderHistoryHook.received && senderHistoryHook.received.length > 0
      ? senderHistoryHook.received
      : inbox.items.filter((m) => m.fromEmail === active.fromEmail).map((m) => ({
          id: m.id, threadId: m.threadId, subject: m.subj, snippet: m.inquiry?.slice(0, 200) || "",
          ts: m.receivedTs || 0,
        }));
    return window.findRelatedThreads({
      targetMessage: {
        id: active.id, threadId: active.threadId,
        subject: active.subj, snippet: active.inquiry?.slice(0, 400) || "",
        body: active.inquiry || "",
      },
      history,
      maxResults: 3,
      threshold: 0.3,
    });
  }, [active, senderHistoryHook.received, inbox.items]);

  // Reference-phrase signals on the active message.
  const referencePhrases = useMemoD(() => {
    if (!active || typeof window.detectReferencePhrases !== "function") return [];
    return window.detectReferencePhrases(active.inquiry || "");
  }, [active]);

  // Re-run categorizer with sender-history attached so business senders
  // resolve to "Client" / "Potential client" / "Pending reply" correctly.
  const enrichedCategory = useMemoD(() => {
    if (!active) return null;
    if (typeof window.categorizeEmail !== "function") return active._category || null;
    return window.categorizeEmail({
      message: active,
      senderHistory: senderHistoryHook.relationship || null,
    });
  }, [active, senderHistoryHook.relationship]);

  // ────────────────────────────────────────────────────────────────────
  // ALL HOOKS MUST BE DECLARED BEFORE ANY EARLY RETURN.
  // Rules-of-hooks: same number + order on every render, no exceptions.
  // ────────────────────────────────────────────────────────────────────

  // Derived values from `active` — null-safe so they work pre-load.
  const defaultReplySubj = active ? (active.replySubject || active.subj || "") : "";
  const currentSubj      = active ? (subjects[active.id] ?? defaultReplySubj) : "";
  const currentText      = active ? (edits[active.id] ?? active.original ?? "") : "";
  const isEdited         = active ? (currentText !== active.original || currentSubj !== defaultReplySubj) : false;
  const currentView      = active ? (view[active.id] || "current") : "current";
  const shownText        = currentView === "original" ? (active?.original ?? "") : currentText;
  const shownSubj        = currentView === "original" ? defaultReplySubj : currentSubj;
  const shownEditable    = currentView === "current";

  const onSelect = useCallbackD((id) => {
    if (id === activeId) {
      // Same item tapped again on mobile from the queue → just open it.
      if (isMobile) setMobileView("workstation");
      return;
    }
    setActiveId(id);
    setSyncError(null);
    setTransitionKey((k) => k + 1);
    // On mobile, opening a queue item swaps to the workstation view.
    if (isMobile) setMobileView("workstation");
  }, [activeId, isMobile]);

  // Toast helper (not a hook — plain function).
  const showToast = (kind, msg, ms = 3800) => {
    setToast({ kind, msg, key: Math.random() });
    setTimeout(() => setToast((t) => (t && t.msg === msg ? null : t)), ms);
  };

  const onSync = useCallbackD(async () => {
    if (!active) return;          // null-guard for hoisted hook
    setSyncError(null);
    if (gmail.status !== "connected") {
      showToast("warn", "Connect Gmail first — opening consent screen…", 2200);
      gmail.connect();
      return;
    }
    setSyncing(true);
    try {
      let attachment = null;
      if (active.pdf && active.pdf.kind && typeof window.buildPdfBase64 === "function") {
        try {
          const built = window.buildPdfBase64({ active, pdf: active.pdf });
          attachment = { name: built.filename, mime: built.mime, base64: built.base64 };
        } catch (pdfErr) {
          console.warn("PDF generation failed — sending draft without attachment:", pdfErr);
          showToast("warn", "PDF generation failed — draft saved without attachment.", 3500);
        }
      }

      const threadingParams = {};
      if (active.source === "gmail") {
        if (active.threadId)        threadingParams.threadId   = active.threadId;
        if (active.gmailMessageId)  threadingParams.inReplyTo  = active.gmailMessageId;
        if (active.gmailReferences) threadingParams.references = active.gmailReferences;
      }

      const result = await gmail.syncDraft({
        to: active.fromEmail,
        subject: currentSubj,
        body: currentText,
        fromName: gmailEmail,
        attachment,
        ...threadingParams,
      });

      const draftUrl = window.gmailDraftUrl
        ? window.gmailDraftUrl({ messageId: result.message?.id, threadId: result.message?.threadId })
        : "https://mail.google.com/mail/u/0/#drafts";

      setSynced((s) => ({ ...s, [active.id]: {
        id: result.id,
        messageId: result.message?.id,
        threadId: result.message?.threadId,
        url: draftUrl,
        attached: !!attachment,
        threaded: !!threadingParams.threadId,
        at: Date.now(),
      } }));
      showToast(
        "ok",
        attachment
          ? `Synced · PDF attached · ${threadingParams.threadId ? "threaded into the original conversation" : "new draft"}`
          : `Synced to Gmail Drafts · ${threadingParams.threadId ? "threaded" : "new draft"}`,
        4500
      );
    } catch (err) {
      setSyncError(err.message || String(err));
      showToast("err", err.message || "Sync failed", 5500);
    } finally {
      setSyncing(false);
    }
  }, [active, currentSubj, currentText, gmail, gmailEmail]);

  // ↑/↓ to move through queue (zero-menu nav). Skip when inside textarea/input.
  useEffectD(() => {
    const onKey = (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      const idx = sourceQueue.findIndex((q) => q.id === activeId);
      if (e.key === "ArrowDown" && idx < sourceQueue.length - 1) { e.preventDefault(); onSelect(sourceQueue[idx + 1].id); }
      if (e.key === "ArrowUp"   && idx > 0)                       { e.preventDefault(); onSelect(sourceQueue[idx - 1].id); }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter")          { e.preventDefault(); onSync(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeId, onSelect, onSync, sourceQueue]);

  // ────────────────────────────────────────────────────────────────────
  // EARLY RETURNS — all hooks already ran above, so any order works here.
  // ────────────────────────────────────────────────────────────────────
  if (!demoMode && gmail.status !== "connected") {
    return <WorkstationNotConnected onExit={onExit} gmail={gmail} authedUser={authedUser} onSignOut={onSignOut}/>;
  }
  if (gmail.status === "connected" && inbox.status === "loading") {
    return <WorkstationLoading onExit={onExit} gmail={gmail} authedUser={authedUser} onSignOut={onSignOut}/>;
  }
  if (gmail.status === "connected" && inbox.status === "error") {
    return <WorkstationInboxError onExit={onExit} gmail={gmail} error={inbox.error} retry={inbox.refresh} authedUser={authedUser} onSignOut={onSignOut}/>;
  }
  if (!active) {
    return <WorkstationEmpty onExit={onExit} gmail={gmail} retry={inbox.refresh} authedUser={authedUser} onSignOut={onSignOut} priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter}/>;
  }

  // Plain helpers + handlers — not hooks, safe to declare here.
  const statusFor = (q) => {
    if (synced[q.id]) return "Synced";
    if (syncing && q.id === activeId) return "Syncing";
    return q.status;
  };
  const onChangeDraft = (e) => setEdits((s) => ({ ...s, [active.id]: e.target.value }));
  const onChangeSubj  = (e) => setSubjects((s) => ({ ...s, [active.id]: e.target.value }));
  const onRestore = () => {
    setEdits((s) => { const n = { ...s }; delete n[active.id]; return n; });
    setSubjects((s) => { const n = { ...s }; delete n[active.id]; return n; });
    setView((s) => ({ ...s, [active.id]: "current" }));
    if (draftRef.current) draftRef.current.focus();
  };
  const onGeneratePdf = () => setPdfStamp((s) => ({ ...s, [active.id]: (s[active.id] || 0) + 1 }));

  const stamp = pdfStamp[active.id] || 0;
  const isSyncedNow = !!synced[active.id];
  const intentTone = intentToneFor(active.intent);

  return (
    <div className="ws-root">
      <header className="ws-topbar">
        <a className="ws-brand" href="#" onClick={(e) => { e.preventDefault(); onExit(); }}>
          <span className="ws-brand-mark"/>
          <span className="ws-brand-name">Stedly</span>
          <span className="ws-brand-suffix">Protocol</span>
        </a>
        <div className="ws-topbar-right">
          <GmailIndicator gmail={gmail}/>
          <CornerMenu onExit={onExit} gmailEmail={gmailEmail} onDisconnect={gmail.disconnect} authedUser={authedUser} onSignOut={onSignOut}/>
        </div>
      </header>

      <div className={`ws-shell ${isMobile ? `is-mobile mobile-view-${mobileView}` : ""}`}>
        {/* LEFT — The Queue */}
        <aside className="ws-queue" aria-label="Pending tasks">
          <div className="ws-queue-head">
            <div>
              <div className="ws-queue-title">
                {isLive ? <>Inbox <span className="ws-queue-live">live</span></> : "Pending"}
              </div>
              <div className="ws-queue-sub">
                {isLive
                  ? `Read + classified from ${gmailEmail}`
                  : "Stedly drafted these overnight"}
              </div>
            </div>
            <div className="ws-queue-head-r">
              {isLive && (
                <button className="ws-queue-refresh" onClick={inbox.refresh} title="Re-pull inbox" aria-label="Refresh inbox">
                  <IconRefresh size={11}/>
                </button>
              )}
              <div className="ws-queue-count">{sourceQueue.filter((q) => !synced[q.id]).length}</div>
            </div>
          </div>

          {/* Priority filter bar — only when live */}
          {isLive && (
            <nav className="ws-priority-bar" aria-label="Priority filter">
              {[
                { key: "all",       label: "All" },
                { key: "urgent",    label: "Urgent",    tone: "r" },
                { key: "important", label: "Important", tone: "g" },
                { key: "standard",  label: "Standard",  tone: "n" },
                { key: "promotion", label: "Promo",     tone: "b" },
                { key: "spam",      label: "Spam",      tone: "muted" },
              ].map((tab) => {
                const count = priorityCounts[tab.key] || 0;
                const isOn = priorityFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    className={`ws-priority-tab ${isOn ? "on" : ""} ${tab.tone ? `tone-${tab.tone}` : ""}`}
                    onClick={() => setPriorityFilter(tab.key)}
                    disabled={count === 0 && tab.key !== "all"}
                    title={count === 0 ? `No ${tab.label.toLowerCase()} messages` : undefined}>
                    <span className="ws-priority-tab-label">{tab.label}</span>
                    <span className="ws-priority-tab-count">{count}</span>
                  </button>
                );
              })}
            </nav>
          )}

          <ul className="ws-queue-list" role="listbox">
            {sourceQueue.map((q, idx) => {
              const status = statusFor(q);
              const kind = tagKindFor(status);
              const isActive = q.id === activeId;
              const tone = intentToneFor(q.intent);
              const prioMeta = PRIORITY_META[q.priority || "standard"] || PRIORITY_META.standard;
              return (
                <li key={q.id} role="option" aria-selected={isActive} style={{ "--qi-i": idx }}>
                  <button
                    className={`ws-qi tone-${tone} prio-${q.priority || "standard"} ${isActive ? "active" : ""} ${synced[q.id] ? "is-synced" : ""} ${q.unread ? "is-unread" : ""}`}
                    onClick={() => onSelect(q.id)}>
                    <div className="ws-qi-row">
                      <span className="ws-qi-from">
                        {q.unread && <span className="ws-qi-unread-dot" aria-label="Unread"/>}
                        {q.from}
                      </span>
                      <span className="ws-qi-time">{q.received.split(" ")[0]}</span>
                    </div>
                    <div className="ws-qi-co">{q.co}</div>
                    <div className="ws-qi-preview">{q.subj}</div>
                    <div className="ws-qi-tag-row">
                      {q.trust && (q.trust.verdict === "scam" || q.trust.verdict === "phishing") && (
                        <span className="ws-qi-trust-pill">
                          {q.trust.verdict === "phishing" ? "Phishing" : "Scam"}
                        </span>
                      )}
                      {q.trust && q.trust.verdict === "suspicious" && (
                        <span className="ws-qi-trust-pill warn">Suspicious</span>
                      )}
                      {q.category && (
                        <span className={`ws-cat-pill tone-${q.categoryTone || "n"}`}>
                          {q.knownBrand && <span className="ws-cat-verified" aria-label="Verified brand">✓</span>}
                          {q.category}
                        </span>
                      )}
                      {q.priority && q.priority !== "standard" && (
                        <span className={`ws-prio-pill tone-${prioMeta.tone}`}>{prioMeta.label}</span>
                      )}
                      <span className={`ws-intent-pill tone-${tone}`}>{q.intent}</span>
                      <StatusTag kind={kind} label={status}/>
                      {edits[q.id] && !synced[q.id] && (
                        <span className="ws-qi-dot">edited</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
            {sourceQueue.length === 0 && isLive && (
              <li className="ws-queue-empty-row">
                <span>No <strong>{priorityFilter === "all" ? "messages" : priorityFilter}</strong> right now.</span>
                {priorityFilter !== "all" && (
                  <button className="ws-mini-btn" onClick={() => setPriorityFilter("all")}>Show all</button>
                )}
              </li>
            )}
          </ul>
          <div className="ws-queue-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span className="sep">·</span>
            <span><kbd>⌘</kbd><kbd>↵</kbd> sync</span>
          </div>
        </aside>

        {/* RIGHT — The Workstation */}
        <main className="ws-stage" key={`stage-${transitionKey}`}>
          {/* Mobile-only "back to inbox" — visible only when mobile + workstation view */}
          {isMobile && (
            <button
              className="ws-mobile-back"
              onClick={() => setMobileView("queue")}
              aria-label="Back to inbox">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              <span>Inbox</span>
              <span className="ws-mobile-back-count">{sourceQueue.filter((q) => !synced[q.id]).length}</span>
            </button>
          )}
          <div className="ws-paper">
            {/* Thread header */}
            <div className={`ws-paper-head tone-${intentTone}`}>
              <div className="ws-thread-l">
                <div className="ws-thread-eyebrow">
                  <span>Thread</span>
                  <span className={`ws-intent-pill tone-${intentTone}`}>{active.intent}</span>
                </div>
                <div className="ws-thread-from">
                  {active.from} <span className="ws-thread-co">· {active.co}</span>
                </div>
                <div className="ws-thread-mail">{active.fromEmail}</div>
              </div>
              <div className="ws-thread-meta">
                <StatusTag kind={tagKindFor(statusFor(active))} label={statusFor(active)}/>
                <span className="ws-thread-time">{active.received}</span>
              </div>
            </div>

            {/* Trust banner — shows above section 01 when concerns detected */}
            {enrichedTrust && enrichedTrust.verdict !== "safe" && (
              <TrustBanner trust={enrichedTrust}/>
            )}

            {/* Section 01 — Inbound Context */}
            <section className="ws-section ws-sec-inquiry">
              <div className="ws-section-head">
                <div className="ws-section-title-row">
                  <span className="ws-sec-num">01</span>
                  <span className="ws-section-eyebrow">Client inquiry</span>
                  {enrichedCategory && (
                    <CategoryPill
                      category={enrichedCategory.category}
                      tone={enrichedCategory.categoryTone}
                      knownBrand={enrichedCategory.knownBrand}
                      senderTypeReason={enrichedCategory.senderTypeReason}
                      flowSignals={enrichedCategory.flowSignals}
                    />
                  )}
                  {senderHistoryHook.relationship && (
                    <RelationshipPill relationship={senderHistoryHook.relationship}/>
                  )}
                  {referencePhrases.length > 0 && (
                    (() => {
                      const refTip = (
                        <div className="stedly-tooltip-rich">
                          <div className="stedly-tooltip-title">Continuation detected</div>
                          <div className="stedly-tooltip-body">This message references a prior conversation.</div>
                          <div className="stedly-tooltip-detail">Phrases: {referencePhrases.slice(0, 4).map(p => `"${p}"`).join(", ")}</div>
                        </div>
                      );
                      const RefPill = <span className="ws-ref-pill" tabIndex={0}>Continuation</span>;
                      return window.Tooltip ? <window.Tooltip content={refTip} placement="top">{RefPill}</window.Tooltip> : RefPill;
                    })()
                  )}
                </div>
                <div className="ws-section-meta-row">
                  {enrichedTrust?.links?.length > 0 && (
                    <LinkSummaryChip links={enrichedTrust.links} onLinkClick={clickGuard.guard}/>
                  )}
                  <span className="ws-section-meta">
                    {active.source === "gmail" ? "received via Gmail" : "Stedly demo data"}
                    {enrichedTrust && enrichedTrust.auth && enrichedTrust.auth.verdict === "verified" &&
                      <> · <span className="ws-auth-ok">DMARC pass</span></>}
                    {enrichedTrust && enrichedTrust.auth && enrichedTrust.auth.verdict === "failed" &&
                      <> · <span className="ws-auth-bad">DMARC fail</span></>}
                  </span>
                </div>
              </div>
              <div className="ws-inquiry-frame">
                <div className="ws-inquiry-from">
                  <span className="ws-inquiry-from-name">{active.from}</span>
                  <span className="ws-inquiry-from-mail">&lt;{active.fromEmail}&gt;</span>
                  {active.gmailReplyTo && enrichedTrust?.replyTo?.diverges && (
                    <span className="ws-replyto-warn" title={enrichedTrust.replyTo.reason}>
                      reply-to: {enrichedTrust.replyTo.replyEmail}
                    </span>
                  )}
                </div>
                <div className="ws-inquiry">
                  {(active.inquiry || "").split(/\n\n+/).map((p, i) => (
                    <p key={i}>
                      {p.split("\n").map((line, j, arr) => (
                        <React.Fragment key={j}>{renderInlineLinks(line, enrichedTrust?.links || [], clickGuard.guard)}{j < arr.length - 1 ? <br/> : null}</React.Fragment>
                      ))}
                    </p>
                  ))}
                </div>
              </div>

              {/* Related earlier conversations (cross-thread) */}
              {relatedThreads.length > 0 && (
                <RelatedThreads threads={relatedThreads}/>
              )}
            </section>

            {/* Section 02 — Stedly Draft (focal) */}
            <section className="ws-section ws-sec-draft">
              <div className="ws-section-head">
                <div className="ws-section-title-row">
                  <span className="ws-sec-num">02</span>
                  <span className="ws-section-eyebrow">Stedly draft</span>
                  <span className="ws-section-focal">Editable</span>
                </div>
                <div className="ws-version">
                  <button
                    className={currentView === "original" ? "on" : ""}
                    onClick={() => setView((s) => ({ ...s, [active.id]: "original" }))}>
                    Original
                  </button>
                  <button
                    className={currentView === "current" ? "on" : ""}
                    onClick={() => setView((s) => ({ ...s, [active.id]: "current" }))}>
                    Your edit{isEdited && currentView !== "original" ? " ·" : ""}
                  </button>
                  {isEdited && (
                    <button className="ws-restore" onClick={onRestore} title="Revert to Stedly's original draft">
                      Restore
                    </button>
                  )}
                </div>
              </div>

              {/* Subject line — like a real compose window */}
              <div className="ws-compose">
                <div className="ws-compose-row">
                  <label className="ws-compose-label">To</label>
                  <span className="ws-compose-to">{active.from} &lt;{active.fromEmail}&gt;</span>
                </div>
                <div className="ws-compose-row">
                  <label className="ws-compose-label">Subject</label>
                  <input
                    className="ws-compose-subject"
                    value={shownSubj}
                    readOnly={!shownEditable}
                    onChange={onChangeSubj}
                  />
                </div>
                <div className={`ws-draft ${shownEditable ? "" : "is-readonly"}`}>
                  <textarea
                    ref={draftRef}
                    className="ws-draft-input"
                    value={shownText}
                    readOnly={!shownEditable}
                    onChange={onChangeDraft}
                    spellCheck={true}
                  />
                </div>
              </div>

              <div className="ws-draft-foot">
                <span>{shownText.trim().split(/\s+/).filter(Boolean).length} words</span>
                <span className="ws-draft-foot-sep">·</span>
                <span>in your voice</span>
                {currentView === "original" && <>
                  <span className="ws-draft-foot-sep">·</span>
                  <span>Read-only — switch to <button className="ws-inline-link" onClick={() => setView((s) => ({ ...s, [active.id]: "current" }))}>Your edit</button> to type</span>
                </>}
              </div>
            </section>

            {/* Section 03 — Generated Asset */}
            <section className="ws-section ws-sec-asset">
              <div className="ws-section-head">
                <div className="ws-section-title-row">
                  <span className="ws-sec-num">03</span>
                  <span className="ws-section-eyebrow">Generated asset</span>
                  {active.pdf && <span className="ws-section-asset-name">{active.pdf.name}</span>}
                </div>
                <div className="ws-asset-actions">
                  {active.pdf && (
                    <>
                      <button
                        className="ws-mini-btn"
                        onClick={() => {
                          if (typeof window.openPdfInNewTab === "function") {
                            window.openPdfInNewTab({ active, pdf: active.pdf });
                          }
                        }}
                        title="Open the real generated PDF (the one Stedly attaches to Sync) in a new tab">
                        Preview real PDF
                      </button>
                      <button className="ws-mini-btn" onClick={onGeneratePdf}>
                        {stamp > 0 ? "Regenerate preview" : "Refresh preview"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="ws-asset">
                {active.pdf ? (
                  <PdfPreview key={active.id + ":" + stamp} pdf={active.pdf} active={active} stamp={stamp}/>
                ) : (
                  <div className="ws-asset-empty">
                    <span>Reply-only thread.</span>
                    <span className="ws-muted">No document attached. Sync sends the draft alone.</span>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Fixed footer — Sync */}
          <div className="ws-footer">
            <div className="ws-footer-left">
              {isSyncedNow ? (
                <span className="ws-footer-meta">
                  <span className="ws-footer-mark ok"/>
                  Saved to <strong>Gmail Drafts</strong>
                  {synced[active.id]?.attached && <> · <span className="ws-footer-tag">PDF attached</span></>}
                  {synced[active.id]?.threaded && <> · <span className="ws-footer-tag">threaded</span></>}
                  {" · "}
                  <a href={synced[active.id]?.url || "https://mail.google.com/mail/u/0/#drafts"} target="_blank" rel="noreferrer">
                    open the draft in Gmail →
                  </a>
                </span>
              ) : gmail.status === "connected" ? (
                <span className="ws-footer-meta">
                  <span className="ws-footer-mark"/>
                  Connected to <strong>{gmailEmail}</strong> · Stedly will write this draft into your Gmail Drafts. Nothing sends.
                </span>
              ) : (
                <span className="ws-footer-meta">
                  <span className="ws-footer-mark warn"/>
                  Gmail isn't connected — clicking Sync will open Google's consent screen.
                </span>
              )}
              {syncError && <div className="ws-footer-error">{syncError}</div>}
            </div>
            <button
              className={`ws-sync ${isSyncedNow ? "done" : ""} ${syncing ? "loading" : ""}`}
              onClick={onSync}
              disabled={isSyncedNow || syncing}>
              {isSyncedNow
                ? "Synced to Gmail Drafts"
                : syncing
                  ? "Syncing…"
                  : gmail.status === "connected"
                    ? "Sync to Gmail Drafts"
                    : "Connect Gmail · then sync"}
            </button>
          </div>

          {/* Toast */}
          {toast && (
            <div key={toast.key} className={`ws-toast ws-toast-${toast.kind}`}>
              {toast.msg}
            </div>
          )}
        </main>
      </div>

      {/* Click-warning modal — surfaces whenever a link is clicked through guard() */}
      {window.ClickWarningModal && (
        <window.ClickWarningModal {...clickGuard.modalProps}/>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Auxiliary states for the live-inbox path
function WorkstationShell({ children, onExit, gmail, authedUser, onSignOut }) {
  return (
    <div className="ws-root">
      <header className="ws-topbar">
        <a className="ws-brand" href="#" onClick={(e) => { e.preventDefault(); onExit(); }}>
          <span className="ws-brand-mark"/>
          <span className="ws-brand-name">Stedly</span>
          <span className="ws-brand-suffix">Protocol</span>
        </a>
        <div className="ws-topbar-right">
          <GmailIndicator gmail={gmail}/>
          <CornerMenu onExit={onExit} gmailEmail={gmail.profile?.emailAddress} onDisconnect={gmail.disconnect} authedUser={authedUser} onSignOut={onSignOut}/>
        </div>
      </header>
      <div className="ws-shell ws-shell-state">{children}</div>
    </div>
  );
}

function WorkstationLoading({ onExit, gmail, authedUser, onSignOut }) {
  // Real shimmer skeleton — same shape as the loaded workstation. Beats the
  // old "Reading your inbox…" centered card because it (a) doesn't appear
  // to crash on quick loads and (b) communicates the layout the user is
  // about to see.
  const skel = Array.from({ length: 6 });
  return (
    <div className="ws-root">
      <header className="ws-topbar">
        <a className="ws-brand" href="#" onClick={(e) => { e.preventDefault(); onExit(); }}>
          <span className="ws-brand-mark"/>
          <span className="ws-brand-name">Stedly</span>
          <span className="ws-brand-suffix">Protocol</span>
        </a>
        <div className="ws-topbar-right">
          <GmailIndicator gmail={gmail}/>
          <CornerMenu onExit={onExit} gmailEmail={gmail.profile?.emailAddress} onDisconnect={gmail.disconnect} onSignOut={onSignOut}/>
        </div>
      </header>
      <div className="ws-shell ws-shell-loading">
        <aside className="ws-queue" aria-label="Loading inbox">
          <div className="ws-queue-head">
            <div>
              <div className="ws-queue-title">Inbox <span className="ws-queue-live">live</span></div>
              <div className="ws-queue-sub">Reading + classifying from {gmail.profile?.emailAddress || "your inbox"}…</div>
            </div>
            <div className="ws-queue-head-r">
              <div className="ws-skel ws-skel-pill"/>
            </div>
          </div>
          <ul className="ws-queue-list">
            {skel.map((_, i) => (
              <li key={i} style={{ "--qi-i": i }} className="ws-queue-skel-row">
                <div className="ws-skel ws-skel-line w70"/>
                <div className="ws-skel ws-skel-line w50"/>
                <div className="ws-skel ws-skel-line w90"/>
                <div className="ws-skel-tagrow">
                  <div className="ws-skel ws-skel-pill"/>
                  <div className="ws-skel ws-skel-pill"/>
                </div>
              </li>
            ))}
          </ul>
        </aside>
        <main className="ws-stage">
          <div className="ws-paper ws-paper-skel">
            <div className="ws-paper-head">
              <div className="ws-thread-l" style={{ flex: 1 }}>
                <div className="ws-skel ws-skel-line w30" style={{ marginBottom: 8 }}/>
                <div className="ws-skel ws-skel-line w60" style={{ marginBottom: 6 }}/>
                <div className="ws-skel ws-skel-line w40"/>
              </div>
            </div>
            <section className="ws-section">
              <div className="ws-section-head">
                <div className="ws-skel ws-skel-line w20"/>
              </div>
              <div style={{ padding: "22px 28px 26px" }}>
                <div className="ws-skel ws-skel-line w90" style={{ marginBottom: 10 }}/>
                <div className="ws-skel ws-skel-line w80" style={{ marginBottom: 10 }}/>
                <div className="ws-skel ws-skel-line w95" style={{ marginBottom: 10 }}/>
                <div className="ws-skel ws-skel-line w60"/>
              </div>
            </section>
            <section className="ws-section">
              <div className="ws-section-head">
                <div className="ws-skel ws-skel-line w20"/>
              </div>
              <div style={{ padding: "22px 28px" }}>
                <div className="ws-skel ws-skel-block" style={{ height: 200 }}/>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function WorkstationInboxError({ onExit, gmail, error, retry, authedUser, onSignOut }) {
  return (
    <WorkstationShell onExit={onExit} gmail={gmail} authedUser={authedUser} onSignOut={onSignOut}>
      <div className="ws-state-card error">
        <h3>Couldn't read your inbox</h3>
        <p className="ws-state-error-msg">{error}</p>
        <p>Most common cause: token doesn't include the <code>gmail.readonly</code> scope. Disconnect Gmail and reconnect to grant the new scope.</p>
        <div className="ws-state-actions">
          <button className="ws-mini-btn" onClick={retry}>Try again</button>
          <button className="ws-mini-btn" onClick={gmail.disconnect}>Disconnect &amp; reconnect</button>
        </div>
      </div>
    </WorkstationShell>
  );
}

function WorkstationEmpty({ onExit, gmail, retry, authedUser, onSignOut, priorityFilter, setPriorityFilter }) {
  return (
    <WorkstationShell onExit={onExit} gmail={gmail} authedUser={authedUser} onSignOut={onSignOut}>
      <div className="ws-state-card">
        <h3>No {priorityFilter && priorityFilter !== "all" ? priorityFilter : ""} messages to draft</h3>
        <p>Your inbox is clear for this filter. Stedly polls on demand — refresh anytime.</p>
        <div className="ws-state-actions">
          <button className="ws-mini-btn" onClick={retry}>Refresh inbox</button>
          {priorityFilter !== "all" && setPriorityFilter && (
            <button className="ws-mini-btn" onClick={() => setPriorityFilter("all")}>Show all priorities</button>
          )}
          <button className="ws-mini-btn" onClick={onExit}>View landing page</button>
        </div>
      </div>
    </WorkstationShell>
  );
}

function WorkstationNotConnected({ onExit, gmail, authedUser, onSignOut }) {
  const setupRequired = !gmail.isConfigured;
  return (
    <WorkstationShell onExit={onExit} gmail={gmail} authedUser={authedUser} onSignOut={onSignOut}>
      <div className="ws-connect-hero">
        <div className="ws-connect-mark">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
            <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>
          </svg>
        </div>
        <h2>Connect your Gmail to start drafting</h2>
        <p>Stedly reads incoming mail, classifies intent, and writes a draft reply for each one — straight into your Drafts folder. Nothing sends without your tap.</p>

        <div className="ws-connect-points">
          <div className="ws-connect-point">
            <span className="ws-connect-num">01</span>
            <div>
              <strong>Read-only on existing mail.</strong>
              <span>Stedly classifies + drafts but never modifies, labels, or deletes anything.</span>
            </div>
          </div>
          <div className="ws-connect-point">
            <span className="ws-connect-num">02</span>
            <div>
              <strong>Approve-to-send, always.</strong>
              <span>Drafts land in Gmail Drafts. You decide what ships.</span>
            </div>
          </div>
          <div className="ws-connect-point">
            <span className="ws-connect-num">03</span>
            <div>
              <strong>Disconnect any time.</strong>
              <span>One click revokes the OAuth token from Google.</span>
            </div>
          </div>
        </div>

        {setupRequired ? (
          <div className="ws-connect-setup">
            <strong>Setup required.</strong> The Google OAuth client ID isn't configured in <code>config.js</code>. See README → "Real Gmail integration setup" for the 3-minute walkthrough.
          </div>
        ) : (
          <button className="ws-connect-cta" onClick={gmail.connect} disabled={gmail.status === "connecting"}>
            {gmail.status === "connecting" ? "Awaiting Google sign-in…" : "Connect Gmail"}
          </button>
        )}

        {gmail.error && (
          <div className="ws-connect-error"><strong>Couldn't connect:</strong> {gmail.error}</div>
        )}

        <div className="ws-connect-trust">
          OAuth scopes: <code>gmail.readonly</code> + <code>gmail.compose</code>. Never <code>gmail.modify</code>.
        </div>
      </div>
    </WorkstationShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny Gmail-status indicator in the topbar — green dot + email when connected
// ─────────────────────────────────────────────────────────────────────────────
// Trust + relationship UI components
// ─────────────────────────────────────────────────────────────────────────────

function TrustBanner({ trust }) {
  const sevTone = trust.verdict === "phishing" ? "block"
                : trust.verdict === "scam"     ? "block"
                : trust.verdict === "suspicious" ? "warn"
                : "safe";
  const headlines = {
    phishing:   "Likely phishing",
    scam:       "Likely scam",
    suspicious: "Several red flags",
    safe:       "No concerns detected",
  };
  return (
    <div className={`ws-trust-banner sev-${sevTone}`} role="alert">
      <div className="ws-trust-banner-head">
        <span className="ws-trust-banner-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </span>
        <div>
          <div className="ws-trust-banner-title">{headlines[trust.verdict] || "Concerns detected"}</div>
          <div className="ws-trust-banner-conf">
            Stedly heuristic confidence: {Math.round(trust.confidence * 100)}%
            <span className="ws-trust-banner-disclaimer">— heuristics catch ~80%; final judgment is yours</span>
          </div>
        </div>
      </div>
      <ul className="ws-trust-banner-list">
        {trust.concerns.map((c, i) => (
          <li key={i} className={`sev-${c.severity}`}>
            <span className="ws-trust-banner-dot"/>
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RelationshipPill({ relationship }) {
  if (!relationship || !relationship.state) return null;
  const meta = (window.RELATIONSHIP_LABELS || {})[relationship.state] || { label: relationship.state, tone: "n", explainer: "" };
  const detail = relationship.state === "first-contact"
    ? "Never received mail from this sender"
    : `${relationship.count} message${relationship.count === 1 ? "" : "s"} from them, ${relationship.sentCount} from you${relationship.lastReceivedDays !== null ? `. Last received ${relationship.lastReceivedDays}d ago` : ""}${relationship.lastSentDays !== null ? `, last sent ${relationship.lastSentDays}d ago.` : ""}`;

  const tipContent = (
    <div className="stedly-tooltip-rich">
      <div className="stedly-tooltip-title">{meta.label}</div>
      {meta.explainer && <div className="stedly-tooltip-body">{meta.explainer}</div>}
      <div className="stedly-tooltip-detail">{detail}</div>
    </div>
  );

  const PillEl = <span className={`ws-rel-pill tone-${meta.tone}`} tabIndex={0}>{meta.label}</span>;
  if (window.Tooltip) {
    return <window.Tooltip content={tipContent} placement="top">{PillEl}</window.Tooltip>;
  }
  return PillEl;
}

// Sender category pill — Personal / Client / Promo / etc.
function CategoryPill({ category, tone, knownBrand, senderTypeReason, flowSignals }) {
  if (!category) return null;
  const tipContent = (
    <div className="stedly-tooltip-rich">
      <div className="stedly-tooltip-title">{category}</div>
      {senderTypeReason && <div className="stedly-tooltip-body">Sender: {senderTypeReason}</div>}
      {knownBrand && (
        <div className="stedly-tooltip-detail">
          ✓ Verified <strong>{knownBrand.name}</strong> ({knownBrand.category})
        </div>
      )}
      {flowSignals && flowSignals.length > 0 && (
        <div className="stedly-tooltip-detail">Flow signals: {flowSignals.slice(0, 3).join(", ")}</div>
      )}
    </div>
  );
  const PillEl = (
    <span className={`ws-cat-pill tone-${tone || "n"}`} tabIndex={0}>
      {knownBrand && <span className="ws-cat-verified" aria-label="Verified brand">✓</span>}
      {category}
    </span>
  );
  if (window.Tooltip) {
    return <window.Tooltip content={tipContent} placement="top">{PillEl}</window.Tooltip>;
  }
  return PillEl;
}

// Compact summary chip — opens a SideDrawer with the full link forensics.
// Replaces the long inline list that used to push the Draft section below
// the fold. One click; ESC or click-outside closes.
function LinkSummaryChip({ links, onLinkClick }) {
  const [open, setOpen] = useStateD(false);
  if (!links || links.length === 0) return null;

  const counts = links.reduce((acc, l) => {
    acc[l.severity || "safe"] = (acc[l.severity || "safe"] || 0) + 1;
    return acc;
  }, {});
  const danger = counts.block || 0;
  const warn   = counts.warn  || 0;
  const safe   = counts.safe  || 0;

  // Worst severity wins for the chip color.
  const sev = danger > 0 ? "block" : warn > 0 ? "warn" : "safe";
  const summaryParts = [];
  if (danger > 0) summaryParts.push(`${danger} dangerous`);
  if (warn   > 0) summaryParts.push(`${warn} suspicious`);
  if (summaryParts.length === 0) summaryParts.push(`${safe} safe`);

  const sorted = [...links].sort((a, b) => {
    const order = { block: 0, warn: 1, safe: 2 };
    return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
  });

  return (
    <>
      <button
        type="button"
        className={`ws-link-chip sev-${sev}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
        </svg>
        <span className="ws-link-chip-num">{links.length}</span>
        <span className="ws-link-chip-label">link{links.length === 1 ? "" : "s"}</span>
        {(danger + warn) > 0 && (
          <>
            <span className="ws-link-chip-sep">·</span>
            <span className="ws-link-chip-warn">{summaryParts.join(", ")}</span>
          </>
        )}
      </button>

      {window.SideDrawer && (
        <window.SideDrawer
          open={open}
          onClose={() => setOpen(false)}
          title="Link forensics"
          subtitle={`${links.length} link${links.length === 1 ? "" : "s"} detected · ${summaryParts.join(", ")}`}
          width={460}>
          <ul className="ws-links-list">
            {sorted.map((link, i) => (
              <li key={i} className={`ws-link-row sev-${link.severity || "safe"}`}>
                <button
                  type="button"
                  className="ws-link-btn"
                  onClick={() => { setOpen(false); onLinkClick(link); }}>
                  <div className="ws-link-row-l">
                    <div className="ws-link-row-head">
                      <span className="ws-link-host">{link.host}</span>
                      <span className={`ws-link-sev sev-${link.severity || "safe"}`}>
                        {link.severity === "block" ? "Dangerous" :
                         link.severity === "warn"  ? "Verify"    :
                                                     "Open"}
                      </span>
                    </div>
                    {link.displayText && link.displayText !== link.url && (
                      <span className="ws-link-displayed">Shown as: "{link.displayText.slice(0, 60)}"</span>
                    )}
                    {link.reasons && link.reasons.length > 0 && (
                      <ul className="ws-link-reasons">
                        {link.reasons.map((r, j) => (<li key={j}>{r.text}</li>))}
                      </ul>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="ws-link-drawer-foot">
            Click any link to leave Stedly through the safety interstitial. Heuristics catch ~80% of phishing — final judgment is yours.
          </div>
        </window.SideDrawer>
      )}
    </>
  );
}

function RelatedThreads({ threads }) {
  if (!threads || threads.length === 0) return null;
  return (
    <div className="ws-related-panel">
      <div className="ws-related-head">
        <span className="ws-related-eyebrow">Related earlier conversations</span>
        <span className="ws-related-count">{threads.length}</span>
      </div>
      <ul className="ws-related-list">
        {threads.map((t) => (
          <li key={t.id} className="ws-related-row">
            <div className="ws-related-row-l">
              <div className="ws-related-subj">{t.subject || "(no subject)"}</div>
              <div className="ws-related-meta">
                {t.reasons?.join(" · ") || ""}
              </div>
            </div>
            <span className="ws-related-score">
              {Math.round((t.score || 0) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Renders a single line of text with any contained URLs replaced by
// click-guarded buttons. Plain-text lines pass through unchanged.
function renderInlineLinks(line, analyzedLinks, guard) {
  if (!line) return null;
  // Markdown link first: [text](url)
  const mdRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  // Then bare URLs.
  const urlRe = /(https?:\/\/[^\s<>()\]"']+)/g;
  // Strategy: walk the string, splice in <a-button> for each match.
  const out = [];
  let cursor = 0;
  // Find all matches of either regex, by position.
  const matches = [];
  let m;
  while ((m = mdRe.exec(line)) !== null) {
    matches.push({ kind: "md", index: m.index, length: m[0].length, text: m[1], url: m[2] });
  }
  // Reset and find bare URLs that aren't inside a markdown match.
  while ((m = urlRe.exec(line)) !== null) {
    const overlap = matches.some((mm) => m.index >= mm.index && m.index < mm.index + mm.length);
    if (!overlap) matches.push({ kind: "bare", index: m.index, length: m[0].length, text: m[0], url: m[0] });
  }
  matches.sort((a, b) => a.index - b.index);
  matches.forEach((mt, i) => {
    if (mt.index > cursor) out.push(line.slice(cursor, mt.index));
    const analyzed = (analyzedLinks || []).find((l) => l.url === mt.url) || { url: mt.url, host: (() => { try { return new URL(mt.url).hostname; } catch (_) { return ""; } })(), displayText: mt.text, severity: "safe", reasons: [] };
    const sevClass = `sev-${analyzed.severity || "safe"}`;
    out.push(
      <button
        key={`l-${i}`}
        type="button"
        className={`ws-inline-link ${sevClass}`}
        onClick={(e) => { e.preventDefault(); guard(analyzed); }}
        title={analyzed.reasons?.length ? analyzed.reasons.map((r) => r.text).join(" · ") : `Open ${analyzed.host}`}>
        {mt.text}
        {analyzed.severity === "block" && <span className="ws-inline-warn">⚠</span>}
        {analyzed.severity === "warn"  && <span className="ws-inline-warn warn">⚠</span>}
      </button>
    );
    cursor = mt.index + mt.length;
  });
  if (cursor < line.length) out.push(line.slice(cursor));
  return out;
}

function GmailIndicator({ gmail }) {
  // System-active pulse (small green dot, breathing). Visible only when
  // Stedly is fully online: Gmail connected AND inbox classifier ready.
  if (gmail.status === "connected") {
    const tipContent = (
      <div className="stedly-tooltip-rich">
        <div className="stedly-tooltip-title">System active</div>
        <div className="stedly-tooltip-body">Connected to {gmail.profile?.emailAddress}</div>
        <div className="stedly-tooltip-detail">Token expires in {formatTokenTtl(gmail.expiresAt)}</div>
      </div>
    );
    const Pill = (
      <div className="ws-gmail-pill ok" tabIndex={0}>
        <span className="ws-gmail-dot live" aria-hidden="true"/>
        <span className="ws-gmail-mail">{gmail.profile?.emailAddress}</span>
      </div>
    );
    return window.Tooltip ? <window.Tooltip content={tipContent} placement="bottom">{Pill}</window.Tooltip> : Pill;
  }
  if (gmail.status === "connecting") {
    return <div className="ws-gmail-pill"><span className="ws-gmail-dot pulse"/>Connecting…</div>;
  }
  return (
    <button className="ws-gmail-pill warn" onClick={gmail.connect}>
      <span className="ws-gmail-dot warn"/>
      {gmail.isConfigured ? "Gmail not connected" : "Setup Gmail"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function PdfPreview({ pdf, active, stamp }) {
  if (pdf.kind === "invoice") {
    return (
      <div className="ws-pdf-canvas ws-pdf-fresh">
        <div className="af-pdf-page">
          <div className="af-pdf-brand">
            <span className="af-pdf-mark"/>
            <div>
              <div className="af-pdf-co">STUDIO &amp; CO</div>
              <div className="af-pdf-doc">INVOICE · INV-2026-03-014</div>
            </div>
            <div className="af-pdf-date">Mar 14, 2026</div>
          </div>
          <div className="af-pdf-meta">
            <div><span>Bill to</span><strong>Cross Cabinetry</strong></div>
            <div><span>Project</span><strong>Atherton residence</strong></div>
            <div><span>Terms</span><strong>Net-15</strong></div>
          </div>
          <div className="af-pdf-table">
            <div className="af-pdf-row head"><span>Item</span><span>Qty</span><span>Rate</span><span>Total</span></div>
            <div className="af-pdf-row"><span>Cabinet design — kitchen</span><span>1</span><span>$8,200</span><span>$8,200</span></div>
            <div className="af-pdf-row"><span>Cabinet design — main bath</span><span>1</span><span>$4,800</span><span>$4,800</span></div>
            <div className="af-pdf-row"><span>Site visits</span><span>3</span><span>$1,140</span><span>$3,420</span></div>
            <div className="af-pdf-row"><span>Drawings + spec sheets</span><span>1</span><span>$2,000</span><span>$2,000</span></div>
            <div className="af-pdf-row total"><span style={{ gridColumn: "1 / span 3" }}>Net total</span><span>$18,420</span></div>
          </div>
          <div className="af-pdf-footer">Net-15 from invoice date · ACH preferred · Wire details on request</div>
        </div>
      </div>
    );
  }
  if (pdf.kind === "onboarding") {
    return (
      <div className="ws-pdf-canvas ws-pdf-fresh">
        <div className="af-pdf-page">
          <div className="af-pdf-brand">
            <span className="af-pdf-mark"/>
            <div>
              <div className="af-pdf-co">STUDIO &amp; CO</div>
              <div className="af-pdf-doc">ONBOARDING · WELCOME PACK</div>
            </div>
            <div className="af-pdf-date">Mar 14, 2026</div>
          </div>
          <div className="af-pdf-onboard">
            <div className="afo-row"><span className="afo-num">01</span><div><strong>Welcome &amp; how we work</strong><span>What to expect in the first two weeks · primary contacts</span></div></div>
            <div className="afo-row"><span className="afo-num">02</span><div><strong>Statement of Work</strong><span>Scope, milestones, change-order protocol</span></div></div>
            <div className="afo-row"><span className="afo-num">03</span><div><strong>Master Services Agreement</strong><span>Pre-filled · countersigned by Studio</span></div></div>
            <div className="afo-row"><span className="afo-num">04</span><div><strong>W-9 / banking forms</strong><span>For your accounting team</span></div></div>
            <div className="afo-row"><span className="afo-num">05</span><div><strong>Brand &amp; access kit</strong><span>Drive folder, Slack channel, dashboard link</span></div></div>
            <div className="afo-row"><span className="afo-num">06</span><div><strong>Kickoff agenda</strong><span>Pre-filled, suggested 60-min slot</span></div></div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="ws-pdf-canvas ws-pdf-fresh">
      <div className="af-pdf-page">
        <div className="af-pdf-brand">
          <span className="af-pdf-mark"/>
          <div>
            <div className="af-pdf-co">STUDIO &amp; CO</div>
            <div className="af-pdf-doc">QUOTE · Q2-1042</div>
          </div>
          <div className="af-pdf-date">Mar 14, 2026</div>
        </div>
        <div className="af-pdf-meta">
          <div><span>To</span><strong>{active.co}</strong></div>
          <div><span>Attn</span><strong>{active.from}</strong></div>
          <div><span>Terms</span><strong>Net-30</strong></div>
        </div>
        <div className="af-pdf-table">
          <div className="af-pdf-row head"><span>Lane</span><span>Vol</span><span>Rate</span><span>Total</span></div>
          <div className="af-pdf-row"><span>OAK → DFW</span><span>120</span><span>$1,840</span><span>$220,800</span></div>
          <div className="af-pdf-row"><span>OAK → SEA</span><span>88</span><span>$1,210</span><span>$106,480</span></div>
          <div className="af-pdf-row"><span>LAX → PHX</span><span>54</span><span>$960</span><span>$51,840</span></div>
          <div className="af-pdf-row sub"><span style={{ gridColumn: "1 / span 3" }}>Subtotal</span><span>$379,120</span></div>
          <div className="af-pdf-row total"><span style={{ gridColumn: "1 / span 3" }}>Net total</span><span>{pdf.total}</span></div>
        </div>
        <div className="af-pdf-footer">90-day price lock · Net-30 · Standard fuel surcharge per Schedule A</div>
      </div>
    </div>
  );
}

function Dashboard(props) { return <Workstation {...props}/>; }
Object.assign(window, { Workstation, Dashboard });

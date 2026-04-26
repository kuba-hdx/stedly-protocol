// Stedly Protocol — Approval Feed mockup + Connect Inbox UI + feature mini-vizzes
// Reused macOS chrome for visual continuity with the original handoff.

function ApprovalFeedMock() {
  const queue = [
    { id: "q1", from: "Daniel Park", co: "Harbor Logistics", subj: "Re: Quote for Q2 freight contract",
      intent: "Quote", value: "$42,800", lane: "active", time: "07:14" },
    { id: "q2", from: "Mira Tanaka", co: "Tanaka & Co Studio", subj: "Onboarding paperwork — new client",
      intent: "Onboarding", value: "3 docs", lane: "queued", time: "06:58" },
    { id: "q3", from: "Aiyana Cross", co: "Cross Cabinetry", subj: "Final invoice — Atherton job",
      intent: "Invoice", value: "$18,420", lane: "queued", time: "06:31" },
    { id: "q4", from: "Owen Ashby", co: "Ashby Capital", subj: "Re: NDA + scope of work",
      intent: "Reply", value: "draft", lane: "queued", time: "05:47" },
  ];
  return (
    <div className="macos-dashboard af-shell" aria-hidden="true">
      <div className="md-titlebar">
        <div className="md-traffic"><span className="r"/><span className="y"/><span className="g"/></div>
        <div className="md-title-tabs">
          <div className="md-title-tab active">Approval Feed</div>
          <div className="md-title-tab">Vault</div>
          <div className="md-title-tab">Audit log</div>
        </div>
        <div className="md-window-title">Stedly Protocol — Eliana's Workspace</div>
      </div>
      <div className="md-body af-body">
        <aside className="md-sidebar">
          <div className="md-side-brand">
            <span className="md-side-brand-mark">S</span>
            <span className="md-side-brand-name">Stedly</span>
          </div>
          <div className="md-side-section">Workspace</div>
          <div className="md-side-item active"><IconInbox size={14}/> Approval Feed <span className="md-side-count">4</span></div>
          <div className="md-side-item"><IconDoc size={14}/> Drafts <span className="md-side-count">12</span></div>
          <div className="md-side-item"><IconPdf size={14}/> Documents <span className="md-side-count">38</span></div>
          <div className="md-side-item"><IconVault size={14}/> Vault</div>
          <div className="md-side-section">Inboxes</div>
          <div className="md-side-item"><IconGmail size={14}/> eliana@studio.co</div>
          <div className="md-side-item"><IconOutlook size={14}/> ops@studio.co</div>
          <div className="md-side-footer">
            <div className="md-profile">
              <div className="md-avatar">EM</div>
              <div>
                <div className="md-profile-name">Eliana Mendez</div>
                <div className="md-profile-plan">Studio · 3 mailboxes</div>
              </div>
            </div>
          </div>
        </aside>
        <div className="md-main af-main">
          <div className="md-toolbar">
            <div className="md-breadcrumb">Workspace <span style={{color:"var(--md-subtle)"}}>/</span> <strong>Approval Feed</strong></div>
            <div className="md-search"><IconSearch size={13}/> Search drafts, threads, documents… <kbd>⌘K</kbd></div>
            <div className="md-tb-icon has-badge"><IconBell size={13}/></div>
            <div className="md-tb-icon"><IconSettings size={13}/></div>
          </div>
          <div className="md-content af-content">
            <div className="af-greet">
              <div>
                <h2>Good morning, Eliana</h2>
                <div className="md-greet-sub">Stedly drafted <strong>4 replies</strong> overnight · <strong>2 PDFs</strong> ready to attach. Nothing has been sent.</div>
              </div>
              <div className="md-greet-actions">
                <button className="md-pill ghost"><IconRefresh size={12}/> Re-sync inbox</button>
                <button className="md-pill"><IconSend size={12}/> Approve all safe</button>
              </div>
            </div>

            <div className="af-grid">
              {/* Left: queue */}
              <div className="af-queue">
                <div className="af-queue-head">
                  <h4>Review Queue</h4>
                  <div className="md-tabs">
                    <span className="active">All · 4</span>
                    <span>Replies</span>
                    <span>Documents</span>
                  </div>
                </div>
                {queue.map((q, i) => (
                  <div key={q.id} className={`af-queue-item ${i === 0 ? "active" : ""}`}>
                    <div className="af-qi-l">
                      <div className="af-qi-avatar" data-tone={i % 4}>{q.from.split(" ").map(s=>s[0]).join("")}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="af-qi-from">{q.from} <span className="af-qi-co">· {q.co}</span></div>
                        <div className="af-qi-subj">{q.subj}</div>
                      </div>
                    </div>
                    <div className="af-qi-r">
                      <span className={`af-intent intent-${q.intent.toLowerCase()}`}>{q.intent}</span>
                      <span className="af-value">{q.value}</span>
                      <span className="af-time">{q.time}</span>
                    </div>
                  </div>
                ))}
                <div className="af-queue-foot">
                  <span className="af-tip"><IconShield size={12}/> Approve-to-send · nothing leaves until you tap Send.</span>
                </div>
              </div>

              {/* Right: side-by-side draft + PDF */}
              <div className="af-review">
                <div className="af-review-head">
                  <div className="af-rh-l">
                    <div className="af-rh-from">Daniel Park <span style={{ color: "var(--md-muted)" }}>· Harbor Logistics</span></div>
                    <div className="af-rh-subj">Re: Quote for Q2 freight contract</div>
                  </div>
                  <div className="af-rh-r">
                    <span className="af-chip green"><IconBolt size={11}/> Drafted in 0.74s</span>
                    <span className="af-chip"><IconShield size={11}/> 6 vault citations</span>
                  </div>
                </div>

                <div className="af-split">
                  {/* Drafted reply */}
                  <div className="af-pane af-pane-mail">
                    <div className="af-pane-head">
                      <span><IconReply size={12}/> Drafted Reply</span>
                      <span className="af-pane-meta">in your voice · 142 words</span>
                    </div>
                    <div className="af-mail-body">
                      <p>Daniel —</p>
                      <p>Thanks for the freight volumes. I've put together the Q2 quote on the same lane structure we used for the Q4 run, with the rate adjustment we agreed to last September.</p>
                      <p>You'll see the full breakdown in <span className="af-link"><IconPdf size={11}/> Q2-Quote-Harbor.pdf</span> — net-30 terms, the standard fuel surcharge clause, and a 90-day price lock on the 12 highest-volume lanes.</p>
                      <p>Happy to walk through it Wednesday morning if useful.</p>
                      <p>— Eliana</p>
                    </div>
                    <div className="af-pane-foot">
                      <button className="md-pill ghost"><IconEye size={11}/> Edit</button>
                      <button className="md-pill ghost"><IconPause size={11}/> Hold</button>
                      <button className="md-pill primary"><IconSend size={11}/> Approve & send</button>
                    </div>
                  </div>

                  {/* Generated PDF */}
                  <div className="af-pane af-pane-pdf">
                    <div className="af-pane-head">
                      <span><IconPdf size={12}/> Generated PDF</span>
                      <span className="af-pane-meta">Q2-Quote-Harbor.pdf · 2 pages</span>
                    </div>
                    <div className="af-pdf-canvas">
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
                          <div><span>To</span><strong>Harbor Logistics</strong></div>
                          <div><span>Attn</span><strong>Daniel Park</strong></div>
                          <div><span>Terms</span><strong>Net-30</strong></div>
                        </div>
                        <div className="af-pdf-table">
                          <div className="af-pdf-row head">
                            <span>Lane</span><span>Vol</span><span>Rate</span><span>Total</span>
                          </div>
                          <div className="af-pdf-row"><span>OAK → DFW</span><span>120</span><span>$1,840</span><span>$220,800</span></div>
                          <div className="af-pdf-row"><span>OAK → SEA</span><span>88</span><span>$1,210</span><span>$106,480</span></div>
                          <div className="af-pdf-row"><span>LAX → PHX</span><span>54</span><span>$960</span><span>$51,840</span></div>
                          <div className="af-pdf-row sub"><span style={{ gridColumn: "1 / span 3"}}>Subtotal</span><span>$379,120</span></div>
                          <div className="af-pdf-row total"><span style={{ gridColumn: "1 / span 3"}}>Net total</span><span>$42,800 / mo</span></div>
                        </div>
                        <div className="af-pdf-footer">
                          90-day price lock · Net-30 · Standard fuel surcharge per Schedule A
                        </div>
                      </div>
                    </div>
                    <div className="af-pane-foot">
                      <button className="md-pill ghost"><IconEye size={11}/> Open</button>
                      <button className="md-pill ghost"><IconRefresh size={11}/> Regenerate</button>
                      <button className="md-pill primary"><IconCheck size={11}/> Attach &amp; ship</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Connect Inbox — REAL Google Identity Services OAuth (Gmail)
// =====================================================================
function ConnectInbox({ onConnected }) {
  const auth = useGmailAuth();
  React.useEffect(() => {
    if (auth.status === "connected" && onConnected) onConnected(auth);
  }, [auth.status, onConnected]);

  const isSetup = auth.isConfigured;
  const isConnecting = auth.status === "connecting";
  const isConnected  = auth.status === "connected";
  const hasError     = auth.status === "error" || auth.status === "setup-required";

  return (
    <div className={`connect-card connect-state-${auth.status}`}>
      <div className="connect-head">
        <span className="connect-eyebrow">
          <IconLock size={11}/> Real OAuth 2.0 · Google Identity Services · gmail.readonly + gmail.compose
        </span>
        <h3>Connect your inbox</h3>
        <p>
          {isConnected
            ? <>Connected to <strong>{auth.profile?.emailAddress}</strong>. Stedly is reading your recent mail, classifying intent, and drafting replies. Nothing sends without your tap.</>
            : <>Real Google sign-in. Stedly asks for two narrow scopes — <code>gmail.readonly</code> to classify what's coming in, and <code>gmail.compose</code> to write drafts. Never <code>gmail.modify</code> (no labels, no delete).</>
          }
        </p>
      </div>

      {!isSetup && (
        <div className="connect-setup-banner">
          <strong>Setup required.</strong>{" "}
          The Google OAuth client ID isn't configured in <code>config.js</code>. Without it the Connect button can't open a real consent screen — see the README's "Real Gmail integration setup" section for the 3-minute walkthrough.
        </div>
      )}

      <div className="connect-providers">
        {/* Gmail — real */}
        {!isConnected ? (
          <button
            className={`connect-provider ${isConnecting ? "picked" : ""} ${!isSetup ? "is-disabled" : ""}`}
            onClick={isSetup ? auth.connect : undefined}
            disabled={!isSetup || isConnecting}>
            <span className="cp-logo"><IconGmail size={26}/></span>
            <span className="cp-body">
              <span className="cp-name">Gmail / Google Workspace</span>
              <span className="cp-meta">
                {isConnecting
                  ? "Awaiting Google sign-in…"
                  : !auth.gisReady
                    ? "Google Identity Services loading…"
                    : !isSetup
                      ? "Setup required — see README"
                      : "Real OAuth · drafts written to Gmail Drafts"}
              </span>
            </span>
            <span className="cp-cta">
              {isConnecting ? "Connecting…" : "Connect"} <IconArrowRight size={12}/>
            </span>
          </button>
        ) : (
          <div className="connect-connected">
            <span className="cp-logo"><IconGmail size={26}/></span>
            <div className="cp-connected-body">
              <div className="cp-connected-row">
                <span className="cp-connected-name">{auth.profile?.emailAddress}</span>
                <span className="cp-connected-badge"><span className="cp-connected-dot"/> Connected</span>
              </div>
              <div className="cp-connected-meta">
                {auth.profile?.messagesTotal?.toLocaleString()} messages · {auth.profile?.threadsTotal?.toLocaleString()} threads · token expires in {formatTokenTtl(auth.expiresAt)}
              </div>
            </div>
            <button className="cp-disconnect" onClick={auth.disconnect}>Disconnect</button>
          </div>
        )}

        {/* Outlook — placeholder, honest about not being wired */}
        <button className="connect-provider is-disabled" disabled title="Outlook integration ships in v2 — Microsoft Graph + MSAL.">
          <span className="cp-logo"><IconOutlook size={26}/></span>
          <span className="cp-body">
            <span className="cp-name">Microsoft 365 / Outlook</span>
            <span className="cp-meta">Coming in v2 · Microsoft Graph + MSAL</span>
          </span>
          <span className="cp-cta cp-cta-muted">Soon</span>
        </button>
      </div>

      {hasError && auth.error && (
        <div className="connect-error">
          <strong>{auth.status === "setup-required" ? "Setup needed:" : "Couldn't connect:"}</strong> {auth.error}
        </div>
      )}

      <div className="connect-trust">
        <div className="ct-item"><IconShield size={13}/><span><strong>Read-only on your existing mail.</strong> Stedly classifies and drafts but never modifies, labels, or deletes anything in your inbox.</span></div>
        <div className="ct-item"><IconLock size={13}/><span><strong>Browser-only token.</strong> Token lives in <code>sessionStorage</code> for this prototype — clears when you close the tab.</span></div>
        <div className="ct-item"><IconBolt size={13}/><span><strong>Revoke instantly.</strong> Disconnect calls Google's revoke endpoint and clears the token. You can also revoke from your Google Account.</span></div>
      </div>
    </div>
  );
}

// =====================================================================
// Feature mini-visualizations — three pillars
// =====================================================================

// Shadow Inbox: incoming mail line slides in, becomes a "Drafts" card
function MiniInboxViz() {
  return (
    <div className="feat-mini" style={{ position: "relative" }}>
      <svg viewBox="0 0 280 80" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id="inboxG" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22C55E" stopOpacity="0"/>
            <stop offset="55%" stopColor="#22C55E" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="#22C55E" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {/* Inbox tray */}
        <rect x="14" y="16" width="120" height="48" rx="6" fill="none" stroke="#E4E4E7"/>
        <text x="22" y="30" fontSize="8" fill="#71717A" fontFamily="Inter">INBOX</text>
        {[36, 46, 56].map((y, i) => (
          <rect key={i} x="22" y={y} width={100 - i*14} height="3" rx="1.5" fill="#D4D4D8"/>
        ))}
        {/* Arrow */}
        <path d="M138 40 L160 40" stroke="#A1A1AA" strokeWidth="1.5" strokeDasharray="3 3"/>
        <path d="M156 36 L162 40 L156 44" stroke="#A1A1AA" strokeWidth="1.5" fill="none"/>
        {/* Drafts tray */}
        <rect x="166" y="16" width="100" height="48" rx="6" fill="#FAFAF9" stroke="#22C55E"/>
        <text x="174" y="30" fontSize="8" fill="#15803D" fontFamily="Inter" fontWeight="600">DRAFTS</text>
        <rect x="174" y="36" width="84" height="3" rx="1.5" fill="#22C55E" opacity="0.6"/>
        <rect x="174" y="44" width="64" height="3" rx="1.5" fill="#22C55E" opacity="0.45"/>
        <rect x="174" y="52" width="74" height="3" rx="1.5" fill="#22C55E" opacity="0.55"/>
        {/* Sliding bolt */}
        <rect x="0" y="36" width="280" height="22" fill="url(#inboxG)">
          <animateTransform attributeName="transform" type="translate" values="-280 0; 0 0; 280 0" dur="3s" repeatCount="indefinite"/>
        </rect>
      </svg>
    </div>
  );
}

// PDF Factory: stamping pages from a stack
function MiniFactoryViz() {
  return (
    <div className="feat-mini" style={{ position: "relative" }}>
      <svg viewBox="0 0 280 80" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id="pdfG" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF"/>
            <stop offset="100%" stopColor="#F4F4F5"/>
          </linearGradient>
        </defs>
        {/* Conveyor */}
        <line x1="0" y1="62" x2="280" y2="62" stroke="#E4E4E7" strokeWidth="1.5"/>
        <line x1="0" y1="62" x2="280" y2="62" stroke="#22C55E" strokeWidth="1.5" strokeDasharray="6 6">
          <animate attributeName="stroke-dashoffset" values="0;-12" dur="0.6s" repeatCount="indefinite"/>
        </line>
        {/* Three sliding pages */}
        {[0, 1, 2].map((k) => (
          <g key={k} transform={`translate(${20 + k * 80} 18)`}>
            <rect width="44" height="40" rx="3" fill="url(#pdfG)" stroke="#D4D4D8"/>
            <rect x="6" y="6" width="28" height="2" rx="1" fill="#22C55E"/>
            <rect x="6" y="12" width="32" height="2" rx="1" fill="#D4D4D8"/>
            <rect x="6" y="18" width="22" height="2" rx="1" fill="#D4D4D8"/>
            <rect x="6" y="24" width="32" height="2" rx="1" fill="#D4D4D8"/>
            <rect x="6" y="30" width="18" height="2" rx="1" fill="#D4D4D8"/>
            <animateTransform attributeName="transform" type="translate"
              values={`${20 + k * 80} 18; ${20 + k * 80 - 60} 18`}
              dur="3s" begin={`${k * 0.4}s`} repeatCount="indefinite"/>
          </g>
        ))}
      </svg>
    </div>
  );
}

// Vault Context: floating fact-chips orbiting a vault tile
function MiniVaultViz() {
  const facts = [
    { x: 38,  y: 18, t: "Net-30" },
    { x: 198, y: 14, t: "TREC §7.B" },
    { x: 30,  y: 56, t: "Voice: terse" },
    { x: 200, y: 56, t: "Last Q4 rate" },
  ];
  return (
    <div className="feat-mini" style={{ position: "relative" }}>
      <svg viewBox="0 0 280 80" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {/* Vault tile in center */}
        <rect x="118" y="22" width="44" height="36" rx="6" fill="#FAFAF9" stroke="#15803D"/>
        <rect x="128" y="32" width="24" height="3" rx="1.5" fill="#15803D"/>
        <rect x="128" y="38" width="20" height="3" rx="1.5" fill="#22C55E" opacity="0.6"/>
        <rect x="128" y="44" width="22" height="3" rx="1.5" fill="#22C55E" opacity="0.45"/>
        <text x="140" y="54" fontSize="6" fill="#15803D" textAnchor="middle" fontFamily="Inter" fontWeight="600">VAULT</text>
        {/* Fact chips with pulse */}
        {facts.map((f, i) => (
          <g key={i}>
            <line x1="140" y1="40" x2={f.x + 18} y2={f.y + 6} stroke="#D4D4D8" strokeDasharray="2 2"/>
            <rect x={f.x} y={f.y} width={f.t.length * 4.4 + 14} height="12" rx="6" fill="#fff" stroke="#E4E4E7"/>
            <circle cx={f.x + 6} cy={f.y + 6} r="2.5" fill="#22C55E">
              <animate attributeName="opacity" values="0.4;1;0.4" dur={`${1.6 + i * 0.3}s`} repeatCount="indefinite"/>
            </circle>
            <text x={f.x + 12} y={f.y + 8.5} fontSize="6.5" fill="#3F3F46" fontFamily="Inter">{f.t}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

Object.assign(window, { ApprovalFeedMock, ConnectInbox, MiniInboxViz, MiniFactoryViz, MiniVaultViz });

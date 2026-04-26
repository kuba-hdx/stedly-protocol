// Icons (lucide-style, stroke-width 1.5) — Stedly Protocol
const Icon = ({ children, size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    {...props}>{children}</svg>
);

// Primitive UI
const IconArrowRight = (p) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Icon>;
const IconCheck      = (p) => <Icon {...p}><path d="M20 6L9 17l-5-5"/></Icon>;
const IconPlay       = (p) => <Icon {...p}><path d="M6 4l14 8-14 8V4z" fill="currentColor" stroke="none"/></Icon>;
const IconX          = (p) => <Icon {...p}><path d="M18 6L6 18M6 6l12 12"/></Icon>;
const IconMenu       = (p) => <Icon {...p}><path d="M4 6h16M4 12h16M4 18h16"/></Icon>;
const IconSearch     = (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></Icon>;
const IconMore       = (p) => <Icon {...p}><circle cx="12" cy="6"  r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="18" r="1"/></Icon>;
const IconSettings   = (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></Icon>;

// App-shell icons
const IconHome  = (p) => <Icon {...p}><path d="M3 10l9-7 9 7v10a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2V10z"/></Icon>;
const IconFile  = (p) => <Icon {...p}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/><path d="M14 2v6h6"/></Icon>;
const IconUsers = (p) => <Icon {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></Icon>;
const IconBell  = (p) => <Icon {...p}><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></Icon>;

// Stedly Protocol — domain icons
const IconInbox    = (p) => <Icon {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></Icon>;
const IconMail     = (p) => <Icon {...p}><path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"/><path d="M22 6l-10 7L2 6"/></Icon>;
const IconReply    = (p) => <Icon {...p}><path d="M9 17l-5-5 5-5"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></Icon>;
const IconDoc      = (p) => <Icon {...p}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/></Icon>;
const IconPdf      = (p) => <Icon {...p}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/><path d="M14 2v6h6"/><path d="M8 14h.5a1.5 1.5 0 010 3H8m4-3v3m0-3h1.4a1.5 1.5 0 010 3H12m4-3h2m-2 1.5h1.5"/></Icon>;
const IconVault    = (p) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M12 9v.01M12 15v.01M9 12h.01M15 12h.01"/></Icon>;
const IconShield   = (p) => <Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></Icon>;
const IconLock     = (p) => <Icon {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></Icon>;
const IconPlug     = (p) => <Icon {...p}><path d="M9 2v6M15 2v6M5 8h14v3a7 7 0 01-14 0V8z"/><path d="M12 18v3"/></Icon>;
const IconSparkle  = (p) => <Icon {...p}><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z"/><path d="M19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8L16.5 16.5l1.8-.7z"/></Icon>;
const IconBolt     = (p) => <Icon {...p}><path d="M13 2L3 14h7l-1 8 11-13h-7l0-7z"/></Icon>;
const IconClock    = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>;
const IconBrain    = (p) => <Icon {...p}><path d="M9.5 4a3.5 3.5 0 00-3.4 4.3A3 3 0 005 13.5 3.5 3.5 0 008.5 17a3 3 0 003 3 3 3 0 003-3 3.5 3.5 0 003.5-3.5 3 3 0 00-1.1-5.2A3.5 3.5 0 0014.5 4a3 3 0 00-2.5 1.3A3 3 0 009.5 4z"/></Icon>;
const IconExternal = (p) => <Icon {...p}><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h5"/></Icon>;
const IconRefresh  = (p) => <Icon {...p}><path d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5"/></Icon>;
const IconSend     = (p) => <Icon {...p}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></Icon>;
const IconPause    = (p) => <Icon {...p}><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></Icon>;
const IconEye      = (p) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></Icon>;
const IconChevronDown = (p) => <Icon {...p}><path d="M6 9l6 6 6-6"/></Icon>;
const IconPaperclip   = (p) => <Icon {...p}><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></Icon>;

// Brand wordmarks for Connect UI
const IconGmail = (p) => (
  <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" {...p}>
    <path d="M2 6.5a2 2 0 012-2h.5L12 11l7.5-6.5H20a2 2 0 012 2v11a2 2 0 01-2 2h-2V11l-6 5.2L6 11v8.5H4a2 2 0 01-2-2v-11z" fill="#EA4335"/>
    <path d="M2 6.5L12 13l10-6.5v0a2 2 0 00-2-2h-.5L12 11 4.5 4.5H4a2 2 0 00-2 2z" fill="#C5221F"/>
    <path d="M16 19.5h4a2 2 0 002-2v-11L16 11v8.5z" fill="#FBBC05"/>
    <path d="M2 17.5a2 2 0 002 2h4V11L2 6.5v11z" fill="#34A853"/>
  </svg>
);
const IconOutlook = (p) => (
  <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" {...p}>
    <rect x="2" y="5" width="13" height="14" rx="1.5" fill="#0078D4"/>
    <circle cx="8.5" cy="12" r="3" fill="#fff"/>
    <circle cx="8.5" cy="12" r="1.5" fill="#0078D4"/>
    <path d="M15 9l4 2.4 3-1.6V18a1 1 0 01-1 1h-6V9z" fill="#28A8EA"/>
    <path d="M15 9v9h6a1 1 0 001-1V10l-3 1.6L15 9z" fill="#0078D4" opacity=".7"/>
  </svg>
);

// Social
const IconTwitter  = (p) => <Icon {...p}><path d="M22 4.01c-1 .49-1.98.689-3 .99-1.121-1.265-2.783-1.335-4.38-.737C13.022 4.86 11.977 6.356 12 8v1C8.243 9.095 4.927 7.193 3 4c0 0-3.955 7.026 4 10.5-1.685 1.124-3.362 2.155-6 2 3.5 2 7.5 3 10 2 5.5-3 8-7 8-13v-.99c.98-.5 1-1.5 2-3l-1 .49.01.01z"/></Icon>;
const IconLinkedin = (p) => <Icon {...p}><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></Icon>;
const IconGithub   = (p) => <Icon {...p}><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></Icon>;

Object.assign(window, {
  Icon,
  IconArrowRight, IconCheck, IconPlay, IconX, IconMenu, IconSearch, IconMore, IconSettings,
  IconHome, IconFile, IconUsers, IconBell,
  IconInbox, IconMail, IconReply, IconDoc, IconPdf, IconVault, IconShield, IconLock,
  IconPlug, IconSparkle, IconBolt, IconClock, IconBrain, IconExternal, IconRefresh, IconSend, IconPause, IconEye,
  IconChevronDown, IconPaperclip,
  IconGmail, IconOutlook,
  IconTwitter, IconLinkedin, IconGithub,
});

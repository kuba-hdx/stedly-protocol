// Stedly Protocol — Real Gmail integration via Google Identity Services
//
// This is REAL OAuth — no fake button. The flow:
//   1. user clicks Connect → window.google.accounts.oauth2 popup opens
//   2. user picks a Google account, grants gmail.compose scope
//   3. we get a real access token (1h expiry) and the user's Gmail profile
//   4. Sync calls users.drafts.create — the draft appears in their Drafts
//
// What it does NOT do (prototype constraints):
//   - No refresh tokens (browser-only flow). Tokens expire after 1h, then
//     the user re-authorizes. Production wants the server-side code flow
//     with refresh tokens — that lives in the Next.js app, not here.
//   - No persistent storage. Tokens live in sessionStorage and die with
//     the tab.
//   - No PKCE / state validation. Implicit-grant via GIS handles that.

const { useState, useEffect, useCallback, useRef } = React;
const STEDLY_GMAIL_STORAGE_KEY = "stedly:gmail:v1";

function readStoredToken() {
  try {
    const raw = sessionStorage.getItem(STEDLY_GMAIL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(STEDLY_GMAIL_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch (_) {
    return null;
  }
}

async function fetchGmailProfile(token) {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gmail profile fetch failed (${res.status}): ${txt.slice(0, 140)}`);
  }
  return await res.json(); // { emailAddress, messagesTotal, threadsTotal, historyId }
}

// RFC 2822 message → base64url for the Gmail API.
//
// New: when inReplyTo (the original Message-ID) is provided, we set the
// In-Reply-To and References headers so Gmail (and any other RFC-compliant
// client) groups the new draft into the original thread. This is what makes
// Stedly's reply *look like a reply* in your inbox, not a new conversation.
function buildRawMessage({
  to, subject, body, fromName,
  inReplyTo, references,
  attachmentName, attachmentMime, attachmentBase64,
}) {
  const boundary = "stedly_" + Math.random().toString(36).slice(2, 10);

  const headers = [];
  if (fromName) headers.push(`From: ${fromName}`);
  headers.push(`To: ${to}`);
  headers.push(`Subject: ${subject || "(no subject)"}`);
  if (inReplyTo)  headers.push(`In-Reply-To: ${inReplyTo}`);
  if (references) headers.push(`References: ${references}`);
  headers.push("MIME-Version: 1.0");
  headers.push(
    attachmentBase64
      ? `Content-Type: multipart/mixed; boundary="${boundary}"`
      : `Content-Type: text/plain; charset="UTF-8"`
  );
  const headerBlock = headers.join("\r\n");

  let raw;
  if (attachmentBase64) {
    raw = [
      headerBlock,
      "",
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      "Content-Transfer-Encoding: 7bit",
      "",
      body,
      "",
      `--${boundary}`,
      `Content-Type: ${attachmentMime || "application/pdf"}; name="${attachmentName}"`,
      `Content-Disposition: attachment; filename="${attachmentName}"`,
      "Content-Transfer-Encoding: base64",
      "",
      // Gmail wants base64 with no line wrapping > 76 chars; jsPDF gives
      // us unwrapped, so we wrap defensively.
      (attachmentBase64.match(/.{1,76}/g) || []).join("\r\n"),
      "",
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    raw = [headerBlock, "", body].join("\r\n");
  }

  // base64url
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function createGmailDraft({
  token, to, subject, body, fromName,
  threadId,            // Gmail threadId of the conversation we're replying to
  inReplyTo,           // RFC Message-ID of the original message
  references,          // chain of Message-IDs (defaults to inReplyTo)
  attachment,
}) {
  const raw = buildRawMessage({
    to, subject, body, fromName,
    inReplyTo,
    references: references || inReplyTo,
    attachmentName: attachment?.name,
    attachmentMime: attachment?.mime,
    attachmentBase64: attachment?.base64,
  });

  // When we pass threadId in the message body, Gmail attaches the draft to
  // that thread — but only if the Subject also matches the thread's subject
  // (Gmail's threading rule). The In-Reply-To header is what makes other
  // clients show it as a reply.
  const messagePayload = { raw };
  if (threadId) messagePayload.threadId = threadId;

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: messagePayload }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Draft create failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  return await res.json(); // { id, message: { id, threadId, ... } }
}

// Gmail web-app deep link — opens the user's Drafts folder filtered to the
// specific draft we just created. Works whether the user has split-pane,
// right-pane, or default view.
function gmailDraftUrl({ messageId, threadId }) {
  // The "all/<id>" path is the most reliable across Gmail UI variants.
  const id = messageId || threadId;
  if (!id) return "https://mail.google.com/mail/u/0/#drafts";
  return `https://mail.google.com/mail/u/0/#drafts/${id}`;
}

// React hook — single source of truth for Gmail auth state.
function useGmailAuth() {
  const clientId = window.__STEDLY_GOOGLE_CLIENT_ID || "";
  const scopes = window.__STEDLY_GOOGLE_SCOPES || "https://www.googleapis.com/auth/gmail.compose";

  const [auth, setAuth] = useState(() => {
    const stored = readStoredToken();
    if (stored) return { status: "connected", token: stored.token, profile: stored.profile, error: null, expiresAt: stored.expiresAt };
    return { status: "idle", token: null, profile: null, error: null, expiresAt: null };
  });
  const [gisReady, setGisReady] = useState(!!(window.google && window.google.accounts && window.google.accounts.oauth2));
  const tokenClientRef = useRef(null);

  // Detect when Google Identity Services finishes loading (CDN script async).
  useEffect(() => {
    if (gisReady) return;
    let raf;
    const probe = () => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        setGisReady(true);
        return;
      }
      raf = requestAnimationFrame(probe);
    };
    probe();
    return () => cancelAnimationFrame(raf);
  }, [gisReady]);

  // Initialize the token client once GIS is ready and a clientId is set.
  useEffect(() => {
    if (!gisReady || !clientId) return;
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: scopes,
      callback: async (response) => {
        if (response.error) {
          setAuth({ status: "error", token: null, profile: null, expiresAt: null, error: response.error_description || response.error });
          return;
        }
        try {
          const profile = await fetchGmailProfile(response.access_token);
          const expiresAt = Date.now() + (response.expires_in || 3600) * 1000;
          const next = { status: "connected", token: response.access_token, profile, expiresAt, error: null };
          sessionStorage.setItem(STEDLY_GMAIL_STORAGE_KEY, JSON.stringify({ token: next.token, profile: next.profile, expiresAt: next.expiresAt }));
          setAuth(next);
        } catch (err) {
          setAuth({ status: "error", token: null, profile: null, expiresAt: null, error: err.message });
        }
      },
      error_callback: (err) => {
        setAuth({ status: "error", token: null, profile: null, expiresAt: null, error: err?.message || "Authorization cancelled" });
      },
    });
  }, [gisReady, clientId, scopes]);

  const connect = useCallback(() => {
    if (!clientId) {
      setAuth((a) => ({ ...a, status: "setup-required", error: "Google OAuth client ID is not configured. See config.js." }));
      return;
    }
    if (!tokenClientRef.current) {
      setAuth((a) => ({ ...a, status: "error", error: "Google Identity Services hasn't loaded yet — try again in a moment." }));
      return;
    }
    setAuth((a) => ({ ...a, status: "connecting", error: null }));
    tokenClientRef.current.requestAccessToken({ prompt: "consent" });
  }, [clientId]);

  const disconnect = useCallback(() => {
    const token = auth.token;
    if (token && window.google && window.google.accounts && window.google.accounts.oauth2) {
      window.google.accounts.oauth2.revoke(token, () => {});
    }
    sessionStorage.removeItem(STEDLY_GMAIL_STORAGE_KEY);
    setAuth({ status: "idle", token: null, profile: null, expiresAt: null, error: null });
  }, [auth.token]);

  const syncDraft = useCallback(async (payload) => {
    if (auth.status !== "connected" || !auth.token) {
      throw new Error("Not connected — call connect() first.");
    }
    return await createGmailDraft({ token: auth.token, ...payload });
  }, [auth.status, auth.token]);

  const isConfigured = !!clientId;
  return { ...auth, connect, disconnect, syncDraft, isConfigured, gisReady };
}

// Small helper for the UI to know how long until token expiry.
function formatTokenTtl(expiresAt) {
  if (!expiresAt) return "—";
  const ms = expiresAt - Date.now();
  if (ms <= 0) return "expired";
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inbox reading + intent classification
//
// Real Gmail API calls. We list the most recent N messages, fetch each in
// "metadata" format first (cheap — just headers + snippet), then fetch full
// payloads only for the items the user actually opens. Classification is
// keyword-scoring based — fast, transparent, and good enough for a prototype.
// Production would swap classify() for an LLM call (Claude/GPT) over the
// full message body and prior-thread context from the Vault.
// ─────────────────────────────────────────────────────────────────────────────

const INTENT_KEYWORDS = {
  Quote: [
    "quote", "quotation", "estimate", "pricing", "rate card", "rates",
    "proposal", "scope of work", "sow", "ballpark", "how much",
    "cost", "freight rate", "lock in",
  ],
  Invoice: [
    "invoice", "billing", "bill", "payable", "payment", "remittance",
    "net-15", "net-30", "ach", "wire", "owed", "amount due",
    "final invoice", "outstanding",
  ],
  Onboarding: [
    "onboard", "onboarding", "kickoff", "kick-off", "welcome", "getting started",
    "intake", "new client", "paperwork", "msa", "nda + sow",
    "kick off", "first steps", "go-live",
  ],
};

function classifyMessage({ subject = "", snippet = "", from = "" }) {
  const haystack = `${subject} ${snippet}`.toLowerCase();
  const scores = { Quote: 0, Invoice: 0, Onboarding: 0 };
  const matched = { Quote: [], Invoice: [], Onboarding: [] };
  for (const [intent, words] of Object.entries(INTENT_KEYWORDS)) {
    for (const w of words) {
      if (haystack.includes(w)) {
        scores[intent] += 1;
        matched[intent].push(w);
      }
    }
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] === 0) {
    return { intent: "Reply", confidence: 0.4, signals: [] };
  }
  // confidence = winner score / (winner score + 1) so single hits land ~0.5
  const confidence = Math.min(0.95, best[1] / (best[1] + 1) + 0.05);
  return { intent: best[0], confidence, signals: matched[best[0]] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Priority axis (orthogonal to intent).
//
// Sources of signal:
//   1. Gmail's own labelIds — IMPORTANT, SPAM, CATEGORY_PROMOTIONS,
//      CATEGORY_UPDATES, CATEGORY_SOCIAL, STARRED, UNREAD. Gmail has spent
//      a decade tuning these; we trust them as ground truth.
//   2. Keyword urgency detection on subject + snippet (urgent, asap, EOD,
//      deadline, today, tomorrow, by [time]).
//   3. Date heuristics — explicit due dates within next 48h.
//
// Output buckets in display order:
//   urgent     — keyword urgency or due ≤48h
//   important  — has IMPORTANT label, or unread + STARRED, or starred
//   standard   — default
//   promotion  — CATEGORY_PROMOTIONS (newsletters, marketing)
//   spam       — SPAM (Gmail flagged)
// ─────────────────────────────────────────────────────────────────────────────

const URGENCY_KEYWORDS = [
  "urgent", "asap", "as soon as possible", "immediately",
  "deadline", "due today", "due tomorrow", "by today", "by tomorrow",
  "eod", "end of day", "end of business", "cob",
  "time-sensitive", "time sensitive", "rush", "expedite",
  "blocker", "blocked on", "critical", "p0", "p1",
];

function detectUrgency({ subject = "", snippet = "" }) {
  const haystack = `${subject} ${snippet}`.toLowerCase();
  const hits = URGENCY_KEYWORDS.filter((w) => haystack.includes(w));
  // Pattern: "by 3pm", "by EOD friday", "due wednesday"
  const datePattern = /\b(by|due|before)\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(:\d{2})?\s*(am|pm)|eod|cob)/i;
  const dateHit = datePattern.test(`${subject} ${snippet}`);
  return { urgent: hits.length > 0 || dateHit, signals: dateHit ? [...hits, "date-binding"] : hits };
}

function classifyPriority({ subject = "", snippet = "", labelIds = [], from = "" }) {
  const labels = new Set(labelIds || []);
  const reasons = [];

  // Spam — trust Gmail completely.
  if (labels.has("SPAM")) {
    return { priority: "spam", reasons: ["gmail-spam-label"] };
  }
  // Promotional / category buckets.
  if (labels.has("CATEGORY_PROMOTIONS")) {
    return { priority: "promotion", reasons: ["gmail-promotions-category"] };
  }
  if (labels.has("CATEGORY_SOCIAL") || labels.has("CATEGORY_FORUMS")) {
    return { priority: "promotion", reasons: ["gmail-social-or-forums-category"] };
  }
  if (labels.has("CATEGORY_UPDATES")) {
    // Updates are "automated but you might care" — keep at standard, not promotion.
    reasons.push("gmail-updates-category");
  }

  // Urgent — explicit keywords or date-binding language.
  const urgency = detectUrgency({ subject, snippet });
  if (urgency.urgent) {
    return { priority: "urgent", reasons: ["urgency-keywords", ...urgency.signals.slice(0, 3)] };
  }

  // Important — Gmail's own importance signal, or starred, or starred + unread.
  const isStarred  = labels.has("STARRED");
  const isImportant = labels.has("IMPORTANT");
  const isUnread   = labels.has("UNREAD");
  if (isImportant) {
    return { priority: "important", reasons: ["gmail-important-label", ...(isStarred ? ["starred"] : []), ...(isUnread ? ["unread"] : [])] };
  }
  if (isStarred) {
    return { priority: "important", reasons: ["starred"] };
  }

  return { priority: "standard", reasons };
}

// Display metadata so the UI doesn't bake strings.
const PRIORITY_META = {
  urgent:    { label: "Urgent",        order: 0, tone: "r" },
  important: { label: "Important",     order: 1, tone: "g" },
  standard:  { label: "Standard",      order: 2, tone: "n" },
  promotion: { label: "Promotion",     order: 3, tone: "b" },
  spam:      { label: "Spam",          order: 4, tone: "muted" },
};

// Parse a "From: Name <addr@host>" header into name + email.
function parseFrom(fromHeader = "") {
  const m = fromHeader.match(/^\s*(?:"?([^"<]*?)"?\s+)?<([^>]+)>\s*$/);
  if (m) return { name: (m[1] || m[2]).trim(), email: m[2].trim() };
  // No angle brackets — bare email
  return { name: fromHeader.split("@")[0] || fromHeader, email: fromHeader.trim() };
}

function findHeader(payload, name) {
  if (!payload || !payload.headers) return "";
  const want = name.toLowerCase();
  const h = payload.headers.find((x) => x.name && x.name.toLowerCase() === want);
  return h ? h.value : "";
}

function _decodeB64url(b64url) {
  if (!b64url) return "";
  try {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(escape(atob(b64)));
  } catch (_) {
    try { return atob(b64url); } catch (__) { return ""; }
  }
}

// Find the first text/plain part anywhere in the MIME tree.
function _findPlainTextPart(payload) {
  if (!payload) return null;
  if (payload.mimeType === "text/plain" && payload.body && payload.body.data) return payload;
  if (payload.parts) {
    for (const p of payload.parts) {
      const found = _findPlainTextPart(p);
      if (found) return found;
    }
  }
  return null;
}

// Find the first text/html part anywhere in the MIME tree.
function _findHtmlPart(payload) {
  if (!payload) return null;
  if (payload.mimeType === "text/html" && payload.body && payload.body.data) return payload;
  if (payload.parts) {
    for (const p of payload.parts) {
      const found = _findHtmlPart(p);
      if (found) return found;
    }
  }
  return null;
}

// Strip an HTML body to plain text (defensive copy of the old logic).
function htmlToPlainText(raw) {
  if (!raw) return "";
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

// Walk the MIME tree, return the first text/plain (or fallback text/html stripped).
// LEGACY shape: returns just plain text. Kept for back-compat with old callers.
function decodeBody(payload) {
  if (!payload) return "";
  const plain = _findPlainTextPart(payload);
  if (plain) return _decodeB64url(plain.body.data);
  const html = _findHtmlPart(payload);
  if (html) return htmlToPlainText(_decodeB64url(html.body.data));
  return "";
}

// New: returns BOTH the plain-text and HTML body so the trust module can
// analyze anchor tags + the renderer can later use the HTML safely.
function decodeBodyParts(payload) {
  if (!payload) return { plain: "", html: "" };
  const plainPart = _findPlainTextPart(payload);
  const htmlPart  = _findHtmlPart(payload);
  const plain = plainPart ? _decodeB64url(plainPart.body.data) : "";
  const html  = htmlPart  ? _decodeB64url(htmlPart.body.data)  : "";
  // If no plain-text part exists, derive one from HTML so callers that
  // need plain text always have a fallback.
  const derivedPlain = plain || (html ? htmlToPlainText(html) : "");
  return { plain: derivedPlain, html };
}

async function listInboxMessages({ token, maxResults = 10, includePromotions = true, includeSpam = false }) {
  // Build the q expression. We want to see Important + Standard, surface
  // Promotions in their own section, and (by default) hide Spam since most
  // users don't care to see junk. The dashboard re-queries with includeSpam:
  // true if the user opens the Spam filter.
  const parts = ["in:inbox", "-from:me"];
  if (!includePromotions) parts.push("-category:promotions");
  if (!includeSpam) parts.push("-in:spam");
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    q: parts.join(" "),
  });
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Inbox list failed (${res.status}): ${txt.slice(0, 160)}`);
  }
  const json = await res.json();
  return json.messages || [];
}

async function getMessage({ token, id, format = "metadata", metadataHeaders }) {
  const params = new URLSearchParams({ format });
  if (metadataHeaders && metadataHeaders.length) {
    metadataHeaders.forEach((h) => params.append("metadataHeaders", h));
  }
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?${params.toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Message fetch failed (${res.status}): ${txt.slice(0, 160)}`);
  }
  return await res.json();
}

// Build a starter draft based on intent. Templates are deliberately
// hand-written — production swaps these for an LLM call grounded in the
// user's Vault (past threads, brand voice profile, prior pricing).
function generateStarterDraft({ intent, fromName, subject, body }) {
  const firstName = (fromName || "").split(/\s+/)[0] || "there";
  const subjLower = (subject || "").toLowerCase();
  const reSubject = subjLower.startsWith("re:") ? subject : `Re: ${subject}`;

  let draftBody;
  switch (intent) {
    case "Quote":
      draftBody =
`${firstName} —

Thanks for the request — I'll have a quote put together by tomorrow morning. I'll pull from the same rate structure we used last quarter and flag anything that's moved.

Quick question: any volume changes I should know about, or are we holding to the same baseline?

— stedly`;
      break;

    case "Invoice":
      draftBody =
`${firstName} —

Final invoice attached. Net-15 from today, payable to the same account on file. The total reflects the original SOW plus the items we agreed to mid-project.

Let me know if you'd like anything broken out differently for your books.

— stedly`;
      break;

    case "Onboarding":
      draftBody =
`${firstName} —

Welcome aboard. Attached you'll find the onboarding pack — welcome doc, SOW template, master services agreement (countersigned by our side), and the access kit.

I've held a 60-min slot for kickoff next week. Reply with whichever morning works and I'll lock it.

— stedly`;
      break;

    default:
      draftBody =
`${firstName} —

Got this — I'll come back to you on it shortly. Need a quick beat to read it properly and pull the right numbers.

— stedly`;
  }

  return { subject: reSubject, body: draftBody };
}

// Hook — load + classify the user's recent inbox once they're connected.
function useGmailInbox(auth) {
  const [state, setState] = useState({ status: "idle", items: [], error: null });
  const limit = window.__STEDLY_INBOX_LIMIT || 10;

  const refresh = useCallback(async () => {
    if (auth.status !== "connected" || !auth.token) {
      setState({ status: "idle", items: [], error: null });
      return;
    }
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const list = await listInboxMessages({ token: auth.token, maxResults: limit });
      // Pull full payloads (so we can render the body in section 01).
      const fulls = await Promise.all(list.map((m) =>
        getMessage({ token: auth.token, id: m.id, format: "full" })
      ));
      const items = fulls.map((msg) => {
        const fromHdr      = findHeader(msg.payload, "From");
        const replyToHdr   = findHeader(msg.payload, "Reply-To");
        const authResHdr   = findHeader(msg.payload, "Authentication-Results");
        const subject      = findHeader(msg.payload, "Subject") || "(no subject)";
        const dateHdr      = findHeader(msg.payload, "Date");
        const messageIdHdr = findHeader(msg.payload, "Message-ID") || findHeader(msg.payload, "Message-Id");
        const referencesHdr = findHeader(msg.payload, "References");
        const inReplyToHdr = findHeader(msg.payload, "In-Reply-To") || findHeader(msg.payload, "In-Reply-to");
        const listUnsubHdr = findHeader(msg.payload, "List-Unsubscribe");
        const { name, email } = parseFrom(fromHdr);
        const { plain: plainBody, html: htmlBody } = decodeBodyParts(msg.payload);
        const body       = plainBody || msg.snippet || "";
        const labelIds   = msg.labelIds || [];
        const cls        = classifyMessage({ subject, snippet: msg.snippet || "", from: fromHdr });
        const prio       = classifyPriority({ subject, snippet: msg.snippet || "", labelIds, from: fromHdr });
        const draft      = generateStarterDraft({ intent: cls.intent, fromName: name, subject, body });
        const date       = dateHdr ? new Date(dateHdr) : new Date(parseInt(msg.internalDate || "0", 10));
        const newReferences = [referencesHdr, messageIdHdr].filter(Boolean).join(" ").trim();
        const isUnread = labelIds.includes("UNREAD");

        // Trust assessment — runs all heuristics from trust.jsx.
        const trust = (typeof window.assessTrust === "function")
          ? window.assessTrust({
              headers: { From: fromHdr, "Reply-To": replyToHdr, "Authentication-Results": authResHdr },
              fromEmail: email,
              subject,
              plainBody: body,
              htmlBody,
              senderHistory: null, // dashboard re-runs with senderHistory once loaded
            })
          : null;

        const baseItem = {
          id: msg.id,
          threadId: msg.threadId,
          gmailMessageId: messageIdHdr,
          gmailReferences: newReferences,
          gmailLabelIds: labelIds,
          gmailFromHeader: fromHdr,
          gmailReplyTo: replyToHdr,
          gmailAuthResults: authResHdr,
          gmailInReplyTo: inReplyToHdr,
          gmailListUnsubscribe: listUnsubHdr,
          source: "gmail",
          from: name,
          fromEmail: email,
          co: email.split("@")[1] || "",
          received: formatRelativeTime(date),
          receivedTs: date.getTime(),
          subj: subject,
          intent: cls.intent,
          intentConfidence: cls.confidence,
          intentSignals: cls.signals,
          priority: prio.priority,
          priorityReasons: prio.reasons,
          unread: isUnread,
          inquiry: body,
          inquiryHtml: htmlBody,
          original: draft.body,
          replySubject: draft.subject,
          status: cls.intent === "Reply" ? "Drafting" : "Ready to sync",
          trust,
          pdf: null,
        };

        // Categorizer (sender-type × flow-type → display category). Runs
        // without senderHistory at queue-load time; dashboard re-runs with
        // senderHistory once it's available so "Client" / "Potential client"
        // / "Pending reply" can resolve correctly.
        const cat = (typeof window.categorizeEmail === "function")
          ? window.categorizeEmail({ message: baseItem, senderHistory: null })
          : null;
        return cat ? { ...baseItem, ...cat, _category: cat } : baseItem;
      });
      // Newest first
      items.sort((a, b) => b.receivedTs - a.receivedTs);
      setState({ status: "ready", items, error: null });
    } catch (err) {
      setState((s) => ({ ...s, status: "error", error: err.message || String(err) }));
    }
  }, [auth.status, auth.token, limit]);

  // Auto-refresh when auth flips to connected.
  useEffect(() => {
    if (auth.status === "connected") refresh();
    if (auth.status === "idle") setState({ status: "idle", items: [], error: null });
  }, [auth.status, refresh]);

  return { ...state, refresh };
}

function formatRelativeTime(date) {
  const now = Date.now();
  const t = date instanceof Date ? date.getTime() : Number(date);
  const diff = now - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

Object.assign(window, {
  useGmailAuth,
  useGmailInbox,
  createGmailDraft,
  fetchGmailProfile,
  listInboxMessages,
  getMessage,
  decodeBody,
  decodeBodyParts,
  htmlToPlainText,
  parseFrom,
  classifyMessage,
  classifyPriority,
  detectUrgency,
  PRIORITY_META,
  generateStarterDraft,
  formatTokenTtl,
  formatRelativeTime,
  gmailDraftUrl,
  STEDLY_GMAIL_STORAGE_KEY,
});

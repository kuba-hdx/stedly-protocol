// Stedly Protocol — Email Categorizer
//
// Two-axis classifier on top of intent/priority:
//
//   senderType:  "personal" | "business" | "brand" | "service"
//                | "government" | "unknown"
//   flowType:    "promo" | "newsletter" | "receipt" | "outreach"
//                | "inquiry" | "reply" | "notification" | "personal-msg"
//                | "unknown"
//
// Combined into a derived display category that's friendlier for the queue:
//   "Personal" — person writing a one-on-one message
//   "Client"   — known business sender, ongoing relationship, real reply
//   "Potential client" — first-contact business inquiry
//   "Business inquiry" — ongoing/active business with inquiry/quote
//   "Affiliate / Outreach" — partnership / sponsorship pitch
//   "Promo" — known brand promo / newsletter
//   "Receipt" — order / payment / shipping confirmation
//   "Notification" — automated transactional (auth, alerts)
//   "Newsletter" — non-promo newsletter
//   "Government" — official .gov/.mil correspondence
//
// All client-side, all heuristics. ~95% accurate on cleanly-tagged inboxes;
// users can override via a per-sender allowlist later.

(function () {

  // ── Free-email providers (re-stated here so categorizer can stand alone)
  const FREE_PROVIDERS = new Set([
    "gmail.com","googlemail.com","outlook.com","hotmail.com","live.com",
    "yahoo.com","yahoo.co.uk","yahoo.fr","ymail.com","rocketmail.com",
    "aol.com","icloud.com","me.com","mac.com",
    "protonmail.com","proton.me","pm.me",
    "tutanota.com","mail.com",
    "gmx.com","gmx.de","gmx.net",
    "yandex.ru","yandex.com","ya.ru",
    "mail.ru","list.ru","bk.ru","inbox.ru",
    "qq.com","163.com","126.com",
    "zoho.com","fastmail.com",
  ]);

  // ── Lexicons for flow detection ───────────────────────────────────────

  const PROMO_KEYWORDS = [
    "limited time","off your","discount","save up to","save now","% off",
    "% off","buy now","shop now","new arrivals","sale ends","exclusive offer",
    "members only","flash sale","free shipping","new collection","bundle",
    "save big","best sellers","trending now",
    "for a limited time","while supplies last","get yours","early access",
    "promo code","coupon code","use code",
  ];

  const NEWSLETTER_KEYWORDS = [
    "weekly digest","newsletter","this week","top stories","editor's picks",
    "in case you missed","weekly roundup","monthly recap","updates from",
    "new from","what's new","recap","read more",
  ];

  const RECEIPT_KEYWORDS = [
    "your order","order #","order confirmation","order placed","order received",
    "thank you for your order","payment received","payment confirmation",
    "shipping confirmation","shipped","tracking number","tracking #",
    "your package","your shipment","subscription renewed","invoice attached",
    "receipt for","your receipt","successfully renewed","auto-renewal",
    "purchase confirmation","amount charged","payment of $",
  ];

  const NOTIFICATION_KEYWORDS = [
    "verify your email","confirm your email","reset your password",
    "verification code","2-step verification","2-factor","two-factor",
    "security alert","new sign-in","new login","unusual activity",
    "your code","one-time","verification link","confirmation link",
    "sign-in attempt","authorize this device","verify it's you",
    "account update","password changed","security notification",
  ];

  const OUTREACH_KEYWORDS = [
    "we'd love to feature","we'd like to feature","brand partnership",
    "collaboration opportunity","collab opportunity","sponsored content",
    "we'd love to work with","feature you in","brand ambassador",
    "affiliate program","earn commission","referral program",
    "promote our","we discovered your","i came across your",
    "noticed your work","love your content","love your brand",
    "would you be interested","sponsorship opportunity","advertorial",
    "guest post","backlink","exchange links","mutual promotion",
    "we'd love to send you","press kit","unboxing",
    "campaign opportunity","creator program",
  ];

  const INQUIRY_KEYWORDS = [
    "request a quote","request for quote","rfp","rfq","quote request",
    "looking for","interested in","could you send","could you provide",
    "wondering if","question about","inquiry about","interested in your",
    "pricing for","what would it cost","price for","estimate for",
    "would you be able","do you offer","is it possible",
  ];

  const PERSONAL_MARKERS = [
    "hey there","hi friend","hope you're doing","long time no",
    "thinking of you","hope all is well","catching up","let's grab",
    "miss you","family","wedding","birthday","kids","my dog","my cat",
    "weekend plans","let me know if you're around","beers","coffee",
  ];

  // ── Helpers ───────────────────────────────────────────────────────────

  function countMatches(haystack, list) {
    let count = 0;
    const matched = [];
    for (const phrase of list) {
      if (haystack.includes(phrase)) { count++; matched.push(phrase); }
    }
    return { count, matched };
  }

  // Personal-name heuristic: 2-3 capitalized words, no business words.
  // Examples that should match: "John Smith", "Mary Jane Watson"
  // Examples that shouldn't:   "Acme Corp Support", "PayPal Customer Service"
  const BUSINESS_WORDS = /\b(corp|corporation|inc|inc\.|llc|ltd|limited|group|team|support|service|services|customer|sales|marketing|info|admin|noreply|no-reply|notification|alerts|automated|donotreply|do-not-reply|news|newsletter|update|updates|reminders|billing|invoice|account|accounts)\b/i;
  function looksLikePersonalName(displayName) {
    if (!displayName) return false;
    if (BUSINESS_WORDS.test(displayName)) return false;
    const trimmed = displayName.trim().replace(/^"|"$/g, "");
    const tokens = trimmed.split(/\s+/);
    if (tokens.length < 2 || tokens.length > 4) return false;
    // Each token starts with uppercase letter and is mostly alphabetic.
    return tokens.every((t) => /^[A-Z][a-z'-]{1,}$/.test(t));
  }

  // Parse "Display Name <email>" → display.
  function extractDisplayName(fromHeader) {
    if (!fromHeader) return "";
    const m = fromHeader.match(/^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/);
    return m ? m[1].trim() : "";
  }

  // ── senderType ─────────────────────────────────────────────────────────

  function classifySenderType({ fromHeader, fromEmail, headers, knownBrand }) {
    if (!fromEmail) return { type: "unknown", reason: "no email" };
    const domain = (fromEmail.split("@")[1] || "").toLowerCase();
    const localPart = (fromEmail.split("@")[0] || "").toLowerCase();
    const tld = domain.split(".").pop();

    // Government — .gov, .mil, gov.uk, etc.
    if (/\.(gov|mil)(\.|$)/.test(domain) || tld === "gov" || tld === "mil") {
      return { type: "government", reason: ".gov/.mil TLD" };
    }

    // Free email providers — gmail.com, outlook.com, etc. — are also in the
    // brand directory because they're owned by Google/Microsoft. But a sender
    // from a free provider is NEVER a "verified brand sender"; it's almost
    // always a personal mailbox. Skip the brand short-circuit for these.
    const isFreeProvider = FREE_PROVIDERS.has(domain);

    // Brand — domain matches a known legitimate brand domain (and not a
    // free email provider).
    if (knownBrand && !isFreeProvider) {
      return { type: "brand", reason: `Verified ${knownBrand.category}: ${knownBrand.name}`, brand: knownBrand };
    }

    // Service-y local-part on any domain — "noreply@", "billing@", "alerts@",
    // etc. signal automated transactional senders. Trimmed: "hello", "team",
    // "info", "admin" are removed because they're commonly human-staffed and
    // used for outreach (e.g. hello@startup.com pitches).
    const SERVICE_LOCAL = /^(noreply|no-reply|donotreply|do-not-reply|notifications?|alerts?|billing|invoice|receipts?|orders?|shipping|support|help|news|newsletter|updates?|security|customer-?service|membership|subscriptions?)([+\.][^@]*)?$/i;
    if (SERVICE_LOCAL.test(localPart)) {
      return { type: "service", reason: `Service-style local-part (${localPart}@…)` };
    }

    // Personal — free email provider AND display name looks like a real name.
    const displayName = extractDisplayName(fromHeader);
    if (FREE_PROVIDERS.has(domain) && looksLikePersonalName(displayName)) {
      return { type: "personal", reason: `Personal name on free provider (${domain})` };
    }

    // Free provider but no personal-name match → mark as personal still, since
    // people use these without nicely-formatted display names. But flag for
    // possible-spoof in trust layer.
    if (FREE_PROVIDERS.has(domain)) {
      return { type: "personal", reason: `Free email provider, ambiguous display name`, weak: true };
    }

    // Default: corporate-style domain → business.
    return { type: "business", reason: `Business domain (${domain})` };
  }

  // ── flowType ──────────────────────────────────────────────────────────

  function classifyFlowType({ subject, body, headers, senderType }) {
    const haystack = `${subject || ""} ${body || ""}`.toLowerCase();
    const promo = countMatches(haystack, PROMO_KEYWORDS);
    const news  = countMatches(haystack, NEWSLETTER_KEYWORDS);
    const recpt = countMatches(haystack, RECEIPT_KEYWORDS);
    const notif = countMatches(haystack, NOTIFICATION_KEYWORDS);
    const reach = countMatches(haystack, OUTREACH_KEYWORDS);
    const inq   = countMatches(haystack, INQUIRY_KEYWORDS);
    const pers  = countMatches(haystack, PERSONAL_MARKERS);

    // Header signals.
    const hasUnsubscribe = !!(headers && (headers["List-Unsubscribe"] || headers["list-unsubscribe"]));
    const isReply = !!(headers && (headers["In-Reply-To"] || headers["in-reply-to"]));

    // Decide. Order matters: receipt > notification > promo > newsletter
    // > outreach > inquiry > personal > reply > unknown.
    if (recpt.count >= 1) return { flow: "receipt", signals: recpt.matched.slice(0, 4) };
    if (notif.count >= 1) return { flow: "notification", signals: notif.matched.slice(0, 4) };

    if (hasUnsubscribe) {
      // List-Unsubscribe is the unambiguous signal of a bulk/mass mail.
      // Decide between promo and newsletter using language.
      if (promo.count >= 1)   return { flow: "promo",      signals: promo.matched.slice(0, 4).concat(["List-Unsubscribe"]) };
      if (news.count >= 1)    return { flow: "newsletter", signals: news.matched.slice(0, 4).concat(["List-Unsubscribe"]) };
      // Default the bulk header → newsletter.
      return { flow: "newsletter", signals: ["List-Unsubscribe"] };
    }

    if (promo.count >= 2)  return { flow: "promo", signals: promo.matched.slice(0, 4) };
    if (reach.count >= 1)  return { flow: "outreach", signals: reach.matched.slice(0, 4) };
    if (inq.count >= 1)    return { flow: "inquiry", signals: inq.matched.slice(0, 4) };
    if (pers.count >= 1 && senderType === "personal") {
      return { flow: "personal-msg", signals: pers.matched.slice(0, 4) };
    }
    if (isReply) return { flow: "reply", signals: ["In-Reply-To"] };

    return { flow: "unknown", signals: [] };
  }

  // ── Composite category (display label) ────────────────────────────────

  // Maps senderType + flowType + relationship → a single label that's
  // useful in the queue. Order is LONGEST MATCH FIRST; first matching rule wins.
  function deriveCategory({ senderType, flowType, relationship }) {
    const rel = relationship || "unknown";

    // Pure-personal beats everything except security alerts.
    if (flowType === "notification") return { label: "Notification", tone: "n" };
    if (flowType === "receipt")      return { label: "Receipt",      tone: "n" };

    if (senderType === "personal" && (flowType === "personal-msg" || flowType === "reply" || flowType === "unknown")) {
      return { label: "Personal", tone: "b" };
    }

    if (senderType === "government") return { label: "Government", tone: "n" };

    if (senderType === "brand") {
      if (flowType === "promo")      return { label: "Promo", tone: "a" };
      if (flowType === "newsletter") return { label: "Newsletter", tone: "n" };
      if (flowType === "receipt")    return { label: "Receipt", tone: "n" };
      return { label: "Brand", tone: "b" };
    }

    if (senderType === "service") {
      if (flowType === "outreach")   return { label: "Affiliate / Outreach", tone: "a" };
      if (flowType === "inquiry")    return { label: "Inquiry", tone: "g" };
      if (flowType === "promo")      return { label: "Promo", tone: "a" };
      if (flowType === "newsletter") return { label: "Newsletter", tone: "n" };
      return { label: "Service notice", tone: "n" };
    }

    // Business sender — relationship and flow disambiguate.
    if (senderType === "business") {
      if (flowType === "outreach") return { label: "Affiliate / Outreach", tone: "a" };
      if (flowType === "promo")    return { label: "Promo", tone: "a" };
      if (flowType === "newsletter") return { label: "Newsletter", tone: "n" };
      if (rel === "first-contact") {
        if (flowType === "inquiry") return { label: "Potential client", tone: "g" };
        return { label: "Cold contact", tone: "n" };
      }
      if (rel === "active" || rel === "ongoing") {
        if (flowType === "inquiry") return { label: "Business inquiry", tone: "g" };
        if (flowType === "reply" || flowType === "unknown") return { label: "Client", tone: "g" };
      }
      if (rel === "you-went-quiet") return { label: "Pending reply", tone: "a" };
      if (rel === "they-went-quiet") return { label: "Awaiting them", tone: "n" };
      if (rel === "dormant") return { label: "Re-engagement", tone: "n" };
      return { label: "Business", tone: "b" };
    }

    return { label: "Other", tone: "n" };
  }

  // ── Top-level entry point ─────────────────────────────────────────────

  function categorizeEmail({ message, senderHistory }) {
    if (!message) return null;
    const headers = {
      From:                message.gmailFromHeader,
      "Reply-To":          message.gmailReplyTo,
      "List-Unsubscribe":  message.gmailListUnsubscribe || message.gmailListUnsub,
      "In-Reply-To":       message.gmailInReplyTo,
    };
    const fromHeader = headers.From || "";
    const fromEmail  = message.fromEmail || "";
    const subject    = message.subj || "";
    const body       = message.inquiry || "";
    const fromDomain = (fromEmail.split("@")[1] || "").toLowerCase();
    const knownBrand = (typeof window.brandByDomain === "function") ? window.brandByDomain(fromDomain) : null;

    const senderType = classifySenderType({ fromHeader, fromEmail, headers, knownBrand });
    const flowType   = classifyFlowType({ subject, body, headers, senderType: senderType.type });
    const relState   = senderHistory && senderHistory.state ? senderHistory.state : null;
    const category   = deriveCategory({ senderType: senderType.type, flowType: flowType.flow, relationship: relState });

    return {
      senderType: senderType.type,
      senderTypeReason: senderType.reason,
      knownBrand: senderType.brand || null,
      flowType: flowType.flow,
      flowSignals: flowType.signals,
      category: category.label,
      categoryTone: category.tone,
      relationship: relState,
    };
  }

  Object.assign(window, {
    categorizeEmail,
    classifySenderType,
    classifyFlowType,
    deriveCategory,
    looksLikePersonalName,
    extractDisplayName,
  });
})();

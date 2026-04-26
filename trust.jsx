// Stedly Protocol — Trust & Safety forensics (Phase 1)
//
// Pure heuristics, runs entirely client-side, costs zero.
// Sources of signal, in order of reliability:
//   1. RFC 8601 Authentication-Results header (SPF/DKIM/DMARC verdicts from
//      the receiving mail server) — ground truth for sender authentication
//   2. Reply-To divergence from From — classic phishing tell
//   3. Display-name vs email-domain mismatch against brand impersonation list
//   4. BEC (Business Email Compromise) pattern — urgency × payment ×
//      account-change × first-contact, weighted score
//   5. Link forensics — display-vs-href mismatch, lookalike domains
//      (visual-edit-distance against brand list), IDN/Punycode, shorteners,
//      suspicious TLDs
//
// Every verdict carries a confidence score so the UI never shows false
// certainty — heuristics catch ~80%, never claim 100%.

(function () {
  const { useState, useEffect, useRef, useCallback, useMemo } = React;

  // ════════════════════════════════════════════════════════════════════
  //   AUTHENTICATION-RESULTS PARSER
  //   Format (RFC 8601): "<authserv-id>; method=result reason=... ;
  //                       method=result ...; ..."
  //   Plus chained ARC-Authentication-Results with arc=pass/fail
  // ════════════════════════════════════════════════════════════════════

  function parseAuthResults(rawHeader) {
    if (!rawHeader || typeof rawHeader !== "string") {
      return { spf: "none", dkim: "none", dmarc: "none", raw: "" };
    }
    const out = { spf: "none", dkim: "none", dmarc: "none", raw: rawHeader };
    // Strip the authserv-id prefix (everything up to the first semicolon).
    const body = rawHeader.includes(";") ? rawHeader.slice(rawHeader.indexOf(";") + 1) : rawHeader;
    // Match each method=result pair. Methods we care about: spf, dkim, dmarc.
    const re = /\b(spf|dkim|dmarc)\s*=\s*(pass|fail|softfail|neutral|none|temperror|permerror|policy|bestguesspass)\b/gi;
    let m;
    while ((m = re.exec(body)) !== null) {
      const method = m[1].toLowerCase();
      const result = m[2].toLowerCase();
      // First occurrence wins for SPF/DMARC (single-value methods).
      // For DKIM, prefer "pass" over later failures (multiple signatures
      // are common; one valid signature is sufficient).
      if (method === "dkim") {
        if (out.dkim === "none" || result === "pass") out.dkim = result;
      } else {
        if (out[method] === "none") out[method] = result;
      }
    }
    return out;
  }

  function assessAuth(authResults) {
    if (!authResults || authResults.raw === "") {
      return { verdict: "unknown", score: 0.5, reason: "No Authentication-Results header" };
    }
    const { spf, dkim, dmarc } = authResults;
    // DMARC is the strongest single signal — it requires SPF or DKIM alignment.
    if (dmarc === "fail") {
      return { verdict: "failed", score: 0.95, reason: `DMARC fail (spf=${spf}, dkim=${dkim})` };
    }
    if (dmarc === "pass") {
      return { verdict: "verified", score: 0.95, reason: `DMARC pass (spf=${spf}, dkim=${dkim})` };
    }
    // No DMARC verdict — fall back to SPF + DKIM.
    if (spf === "fail" && dkim === "fail") {
      return { verdict: "failed", score: 0.85, reason: "SPF + DKIM both fail" };
    }
    if (spf === "pass" || dkim === "pass") {
      return { verdict: "verified", score: 0.75, reason: `${spf === "pass" ? "SPF" : "DKIM"} pass` };
    }
    if (spf === "softfail" || spf === "neutral") {
      return { verdict: "unverified", score: 0.5, reason: `SPF ${spf}` };
    }
    return { verdict: "unverified", score: 0.4, reason: "No clear pass/fail" };
  }

  // ════════════════════════════════════════════════════════════════════
  //   DISPLAY-NAME SPOOF DETECTION
  //   Catches: "PayPal Customer Service" <random@gmail.com>
  //   Logic: if display name contains a brand keyword AND the email domain
  //   isn't the legitimate domain for that brand, flag it.
  // ════════════════════════════════════════════════════════════════════

  // BRAND_DOMAINS is now sourced from brands.js (window.BRAND_DIRECTORY,
  // ~300 entries across 14 categories). We adapt the shape on the fly so
  // existing call sites that expect { brand: [domains] } keep working.
  function getBrandDomains() {
    const dir = window.BRAND_DIRECTORY || {};
    const out = {};
    for (const [name, entry] of Object.entries(dir)) {
      out[name] = entry.domains;
    }
    return out;
  }
  // Lazy-evaluated proxy so changes to window.BRAND_DIRECTORY are picked up.
  // (Critical because brands.js may load after trust.jsx in the script tag order.)
  const BRAND_DOMAINS = new Proxy({}, {
    get: (_, prop) => {
      const all = getBrandDomains();
      return all[prop];
    },
    ownKeys:  () => Object.keys(getBrandDomains()),
    getOwnPropertyDescriptor: (_, prop) => {
      const all = getBrandDomains();
      return { configurable: true, enumerable: true, value: all[prop] };
    },
    has: (_, prop) => prop in getBrandDomains(),
  });

  // Mass-market free email providers — claiming a brand identity from one
  // of these is almost always a spoof.
  const FREE_EMAIL_PROVIDERS = new Set([
    "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
    "yahoo.com", "yahoo.co.uk", "yahoo.fr", "ymail.com", "rocketmail.com",
    "aol.com", "icloud.com", "me.com", "mac.com",
    "protonmail.com", "proton.me", "pm.me",
    "tutanota.com", "mail.com",
    "gmx.com", "gmx.de", "gmx.net",
    "yandex.ru", "yandex.com", "ya.ru",
    "mail.ru", "list.ru", "bk.ru", "inbox.ru",
    "qq.com", "163.com", "126.com",
    "zoho.com", "fastmail.com",
  ]);

  function detectDisplayNameSpoof(fromHeader, fromEmail) {
    if (!fromHeader || !fromEmail) return { spoofed: false };
    // Extract display name from "Name <email>" — empty if bare email.
    const m = fromHeader.match(/^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/);
    const displayName = m ? m[1].trim() : "";
    if (!displayName) return { spoofed: false };
    const dnLower = displayName.toLowerCase();
    const emailDomain = (fromEmail.split("@")[1] || "").toLowerCase();
    if (!emailDomain) return { spoofed: false };

    for (const [brand, legitDomains] of Object.entries(BRAND_DOMAINS)) {
      if (!dnLower.includes(brand)) continue;
      // Does the email domain match (or end with) one of the legit domains?
      const legit = legitDomains.some((d) => emailDomain === d || emailDomain.endsWith("." + d));
      if (!legit) {
        return {
          spoofed: true,
          claimed: brand,
          displayName,
          actualDomain: emailDomain,
          legitDomains,
          severity: FREE_EMAIL_PROVIDERS.has(emailDomain) ? "high" : "medium",
          reason: FREE_EMAIL_PROVIDERS.has(emailDomain)
            ? `Display name claims "${brand}" but the email is on a free provider (${emailDomain})`
            : `Display name claims "${brand}" but the email is on ${emailDomain}, not ${legitDomains.join(" / ")}`,
        };
      }
    }
    return { spoofed: false };
  }

  // ════════════════════════════════════════════════════════════════════
  //   REPLY-TO DIVERGENCE
  //   Pattern: From: ceo@company.com    Reply-To: ceo@gmail.com
  //   Catches the "respond to my personal account" CEO-fraud variant.
  // ════════════════════════════════════════════════════════════════════

  function detectReplyToDivergence(replyToHeader, fromEmail) {
    if (!replyToHeader || !fromEmail) return { diverges: false };
    const replyMatch = replyToHeader.match(/<([^>]+)>/) || [null, replyToHeader.trim()];
    const replyEmail = (replyMatch[1] || "").toLowerCase();
    if (!replyEmail) return { diverges: false };
    const replyDomain = replyEmail.split("@")[1] || "";
    const fromDomain  = (fromEmail.split("@")[1] || "").toLowerCase();
    if (!replyDomain || !fromDomain) return { diverges: false };
    if (replyDomain === fromDomain) return { diverges: false };
    // Exception: many legitimate orgs use mailbox aliases on shared domains
    // (e.g., FROM noreply@company.com REPLY-TO support@company.com on same
    // domain — already handled). Cross-domain divergence is the red flag.
    return {
      diverges: true,
      replyEmail,
      replyDomain,
      fromDomain,
      severity: FREE_EMAIL_PROVIDERS.has(replyDomain) ? "high" : "medium",
      reason: `Reply-To points to ${replyDomain} (different from sender domain ${fromDomain})`,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //   BEC (Business Email Compromise) PATTERN DETECTOR
  //   Weighted scoring across four signal classes.
  // ════════════════════════════════════════════════════════════════════

  const BEC_URGENCY = [
    "urgent", "asap", "as soon as possible", "immediately", "right away",
    "by today", "by end of day", "before close of business", "eod", "cob",
    "today only", "expires today", "last chance", "final notice", "act now",
    "time-sensitive", "time sensitive", "don't delay", "do not delay",
    "right now", "this minute",
  ];
  const BEC_PAYMENT = [
    "wire transfer", "wire payment", "ach transfer", "ach payment",
    "bank transfer", "make a payment", "send payment", "process payment",
    "invoice attached", "outstanding invoice", "overdue invoice",
    "iban", "swift", "swift code", "routing number", "account number",
    "remittance", "wire instructions", "payment instructions", "wire details",
    "balance due", "amount due", "payable", "transfer funds",
  ];
  const BEC_ACCOUNT_CHANGE = [
    "new bank account", "updated bank account", "new banking details",
    "changed banking details", "updated payment instructions",
    "new wire instructions", "new account number", "new routing",
    "we have changed banks", "switched banks", "different account",
    "use this account instead", "do not use the previous", "old account is closed",
    "new payment details", "updated wire details",
  ];
  const BEC_AUTHORITY = [
    "ceo", "cfo", "coo", "chairman", "president", "managing director",
    "from the ceo", "ceo's request", "executive request", "board request",
    "personal request", "discreet", "confidential", "keep this between us",
    "do not discuss", "i need this done", "as your boss",
  ];

  function countMatches(haystack, list) {
    let count = 0;
    const matched = [];
    for (const phrase of list) {
      if (haystack.includes(phrase)) { count++; matched.push(phrase); }
    }
    return { count, matched };
  }

  function detectBEC({ subject = "", body = "", senderHistory = null, fromEmail = "" }) {
    const haystack = (subject + " " + body).toLowerCase();
    const u = countMatches(haystack, BEC_URGENCY);
    const p = countMatches(haystack, BEC_PAYMENT);
    const a = countMatches(haystack, BEC_ACCOUNT_CHANGE);
    const auth = countMatches(haystack, BEC_AUTHORITY);

    // Weighted score: BEC requires payment + at least one corroborating signal.
    let score = 0;
    const signals = [];
    if (u.count >= 1) { score += 0.20; signals.push(`urgency: ${u.matched.slice(0,3).join(", ")}`); }
    if (u.count >= 2) { score += 0.10; }
    if (p.count >= 1) { score += 0.25; signals.push(`payment: ${p.matched.slice(0,3).join(", ")}`); }
    if (p.count >= 2) { score += 0.10; }
    if (a.count >= 1) { score += 0.30; signals.push(`account-change: ${a.matched.slice(0,3).join(", ")}`); }
    if (auth.count >= 1) { score += 0.10; signals.push(`authority claim: ${auth.matched.slice(0,2).join(", ")}`); }

    // First-contact multiplier — BEC is dramatically more dangerous from a
    // sender we've never heard from.
    if (senderHistory && (senderHistory.relationship === "first-contact")) {
      score = Math.min(1, score * 1.4);
      signals.push("first-contact sender");
    }
    // Free-provider multiplier — even worse from a free-email sender.
    if (fromEmail) {
      const dom = (fromEmail.split("@")[1] || "").toLowerCase();
      if (FREE_EMAIL_PROVIDERS.has(dom)) {
        score = Math.min(1, score * 1.2);
        signals.push("free-provider sender");
      }
    }

    // Verdict thresholds — calibrated by observation, not a perfect model.
    let verdict = "ok";
    if (score >= 0.65) verdict = "high";
    else if (score >= 0.45) verdict = "medium";
    else if (score >= 0.25) verdict = "low";

    return { bec: verdict !== "ok", verdict, score: Math.round(score * 100) / 100, signals };
  }

  // ════════════════════════════════════════════════════════════════════
  //   LINK ANALYSIS
  //   Inputs: plain-text body (for raw URLs) + optional HTML body (for
  //   anchor display-text/href pairs).
  // ════════════════════════════════════════════════════════════════════

  // Common URL shorteners that hide the destination.
  const URL_SHORTENERS = new Set([
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd",
    "buff.ly", "rebrand.ly", "shorturl.at", "cutt.ly", "tiny.cc",
    "rb.gy", "soo.gd", "v.gd", "t.ly",
    "bitly.com", "snip.ly", "lnkd.in",
  ]);

  // High-spam free TLDs (Freenom-era + others). Not all messages from these
  // are spam, but they're disproportionate.
  const SUSPICIOUS_TLDS = new Set([
    "tk", "ml", "ga", "cf", "gq",
    "xyz", "top", "loan", "click", "country", "stream", "download",
    "racing", "win", "review", "party", "trade", "date", "faith",
    "science", "men", "bid", "accountant",
  ]);

  // Visual-substitution-aware edit distance — `paypa1.com` vs `paypal.com`
  // is distance 1 letter-wise but distance 0.5 visually (1 vs l look alike).
  const VISUAL_SUBS = new Map([
    ["0", "o"], ["o", "0"],
    ["1", "l"], ["l", "1"], ["1", "i"], ["i", "1"],
    ["5", "s"], ["s", "5"],
    ["3", "e"], ["e", "3"],
    ["4", "a"], ["a", "4"],
    ["6", "g"], ["g", "6"],
    ["7", "t"], ["t", "7"],
    ["8", "b"], ["b", "8"],
  ]);

  function visualEditDistance(a, b) {
    // Modified Levenshtein where visual substitutions cost 0.5.
    // Also handles "rn" → "m" and "vv" → "w" as 1-step transforms cost 0.5.
    a = a.toLowerCase(); b = b.toLowerCase();
    const m = a.length, n = b.length;
    // Pre-process: normalize visual digraphs in a copy for cheap comparison.
    const norm = (s) => s.replace(/rn/g, "m").replace(/vv/g, "w");
    const aN = norm(a), bN = norm(b);
    if (aN === bN) return 0.5;
    // DP grid.
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i-1] === b[j-1]) {
          dp[i][j] = dp[i-1][j-1];
        } else {
          // Visual sub cost?
          const cost = (VISUAL_SUBS.get(a[i-1]) === b[j-1]) ? 0.5 : 1;
          dp[i][j] = Math.min(
            dp[i-1][j] + 1,             // delete
            dp[i][j-1] + 1,             // insert
            dp[i-1][j-1] + cost         // substitute
          );
        }
      }
    }
    return dp[m][n];
  }

  // Pull the registrable domain (ignore subdomains) for comparison.
  // Naive but adequate — proper PSL would be heavier than warranted.
  function registrableDomain(host) {
    if (!host) return "";
    const parts = host.toLowerCase().split(".");
    if (parts.length < 2) return host.toLowerCase();
    // Two-part TLD heuristics: co.uk, com.au, co.jp, etc.
    const TWO_PART_SUFFIXES = new Set([
      "co.uk","co.jp","co.kr","co.nz","co.za","co.in","com.au","com.br",
      "com.cn","com.mx","com.tr","com.sg","com.hk","com.tw","org.uk",
      "ne.jp","ac.uk","gov.uk",
    ]);
    const last2 = parts.slice(-2).join(".");
    const last3 = parts.slice(-3).join(".");
    if (TWO_PART_SUFFIXES.has(last2) && parts.length >= 3) return last3;
    return last2;
  }

  function detectLookalikeDomain(host) {
    if (!host) return { lookalike: false };
    const reg = registrableDomain(host);
    const regCore = reg.split(".")[0]; // e.g. "paypa1" out of "paypa1.com"
    if (!regCore) return { lookalike: false };

    // Check Punycode / IDN — `xn--` prefix.
    const isPunycode = host.split(".").some((p) => p.startsWith("xn--"));
    if (isPunycode) {
      return {
        lookalike: true,
        kind: "punycode",
        host,
        reason: "Domain uses Punycode (xn--), often used for visually-confusing IDN attacks",
      };
    }

    // Compare against brand list.
    for (const brand of Object.keys(BRAND_DOMAINS)) {
      const brandCore = brand.replace(/\s+/g, ""); // "wellsfargo" not "wells fargo"
      if (regCore === brandCore) continue; // exact match isn't a lookalike
      const dist = visualEditDistance(regCore, brandCore);
      // Tight threshold: distance ≤ 1.5 on a brand of length ≥ 4.
      if (brandCore.length >= 4 && dist > 0 && dist <= 1.5) {
        // Confirm the legit domain doesn't include this — paypal.com isn't a
        // lookalike of paypal :)
        const legitDomains = BRAND_DOMAINS[brand];
        const isLegit = legitDomains.some((d) => host === d || host.endsWith("." + d));
        if (isLegit) continue;
        return {
          lookalike: true,
          kind: "edit-distance",
          host,
          reg,
          suspectedBrand: brand,
          distance: dist,
          reason: `${reg} is ${dist} edits from "${brandCore}" — likely typosquat / lookalike`,
        };
      }
    }
    return { lookalike: false };
  }

  // Extract URL list from plain-text + Markdown-style links + HTML body.
  // Returns objects with { url, displayText, source }.
  function extractLinks({ plainText = "", htmlBody = "" }) {
    const links = [];
    const seen = new Set();

    const pushLink = (url, displayText, source) => {
      if (!url) return;
      try {
        const u = new URL(url);
        const k = `${u.href}::${displayText || ""}`;
        if (seen.has(k)) return;
        seen.add(k);
        links.push({ url: u.href, host: u.hostname, displayText: displayText || "", source });
      } catch (_) { /* malformed URL, skip */ }
    };

    // 1. Markdown links [text](url) — common in plain-text formatted emails.
    const mdRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let m;
    while ((m = mdRe.exec(plainText)) !== null) {
      pushLink(m[2], m[1], "markdown");
    }

    // 2. Bare URLs in plain text.
    const urlRe = /(https?:\/\/[^\s<>()\]"']+)/g;
    while ((m = urlRe.exec(plainText)) !== null) {
      pushLink(m[1], "", "plaintext");
    }

    // 3. Anchor tags in HTML body.
    if (htmlBody) {
      const anchorRe = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      while ((m = anchorRe.exec(htmlBody)) !== null) {
        const href = m[1].trim();
        if (!/^https?:/.test(href)) continue;
        const displayText = m[2].replace(/<[^>]*>/g, "").trim().slice(0, 200);
        pushLink(href, displayText, "html-anchor");
      }
    }

    return links;
  }

  // For each link, run all detectors and compose a verdict.
  function analyzeLink(link) {
    const reasons = [];
    let severity = "safe"; // safe | warn | block

    const host = (link.host || "").toLowerCase();
    const reg = registrableDomain(host);

    // 1. Display-text vs href mismatch.
    let displayMismatch = false;
    if (link.displayText && link.displayText.length > 3) {
      // Display text contains a URL or known brand?
      const dtLower = link.displayText.toLowerCase();
      // (a) Does display text look like a URL? Compare its domain.
      const dtUrlMatch = dtLower.match(/(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})/);
      if (dtUrlMatch) {
        const claimedHost = dtUrlMatch[1];
        const claimedReg = registrableDomain(claimedHost);
        if (claimedReg && claimedReg !== reg) {
          displayMismatch = true;
          reasons.push({ kind: "display-mismatch", text: `Display says "${claimedHost}" but link goes to ${host}` });
          severity = "block";
        }
      }
      // (b) Does display text mention a brand whose link doesn't match?
      for (const brand of Object.keys(BRAND_DOMAINS)) {
        if (!dtLower.includes(brand)) continue;
        const legit = BRAND_DOMAINS[brand];
        const matchesLegit = legit.some((d) => host === d || host.endsWith("." + d));
        if (!matchesLegit) {
          displayMismatch = true;
          reasons.push({ kind: "brand-mismatch", text: `Display says "${brand}" but link goes to ${host}` });
          severity = "block";
        }
      }
    }

    // 2. Lookalike domain.
    const lookalike = detectLookalikeDomain(host);
    if (lookalike.lookalike) {
      reasons.push({ kind: "lookalike", text: lookalike.reason });
      if (severity !== "block") severity = "warn";
    }

    // 3. URL shortener.
    if (URL_SHORTENERS.has(reg)) {
      reasons.push({ kind: "shortener", text: `Shortened URL — true destination is hidden` });
      if (severity === "safe") severity = "warn";
    }

    // 4. Suspicious TLD.
    const tld = reg.split(".").pop();
    if (SUSPICIOUS_TLDS.has(tld)) {
      reasons.push({ kind: "suspicious-tld", text: `.${tld} is a high-spam TLD` });
      if (severity === "safe") severity = "warn";
    }

    // 5. IP literals — phishing kit pattern.
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
      reasons.push({ kind: "ip-literal", text: `Link goes to a raw IP address — almost always malicious` });
      severity = "block";
    }

    // 6. Suspicious userinfo (`https://paypal.com@evil.com` confusion).
    if (/^https?:\/\/[^\/]*@/.test(link.url)) {
      reasons.push({ kind: "userinfo", text: `URL embeds a userinfo segment (visually misleading)` });
      severity = "block";
    }

    // 7. Excessive subdomains hiding a brand (e.g. paypal.com.evil.ru).
    const parts = host.split(".");
    if (parts.length >= 4) {
      // Does an early subdomain match a brand?
      const earlyParts = parts.slice(0, -2).join(".");
      for (const brand of Object.keys(BRAND_DOMAINS)) {
        if (earlyParts.includes(brand)) {
          const legit = BRAND_DOMAINS[brand];
          const matchesLegit = legit.some((d) => host === d || host.endsWith("." + d));
          if (!matchesLegit) {
            reasons.push({ kind: "subdomain-spoof", text: `Brand "${brand}" used as subdomain of ${reg}` });
            severity = "block";
            break;
          }
        }
      }
    }

    return { ...link, reasons, severity, registrableDomain: reg };
  }

  // ════════════════════════════════════════════════════════════════════
  //   COMPOSITE TRUST ASSESSMENT
  //   Aggregates all signals into a single verdict per message.
  // ════════════════════════════════════════════════════════════════════

  // Returns the brand entry if the sender's email is on a known-legitimate
  // brand domain. Used to display a "verified sender" badge in the UI.
  function verifiedSender(fromEmail) {
    if (!fromEmail) return null;
    const domain = (fromEmail.split("@")[1] || "").toLowerCase();
    if (!domain) return null;
    if (typeof window.brandByDomain === "function") {
      return window.brandByDomain(domain);
    }
    return null;
  }

  function assessTrust({ headers = {}, fromEmail = "", subject = "", plainBody = "", htmlBody = "", senderHistory = null }) {
    const auth = parseAuthResults(headers["Authentication-Results"] || headers["authentication-results"]);
    const authVerdict = assessAuth(auth);
    const spoof = detectDisplayNameSpoof(headers.From || headers.from || "", fromEmail);
    const replyTo = detectReplyToDivergence(headers["Reply-To"] || headers["reply-to"] || "", fromEmail);
    const bec = detectBEC({ subject, body: plainBody, senderHistory, fromEmail });
    const links = extractLinks({ plainText: plainBody, htmlBody }).map(analyzeLink);

    // Compose verdict — worst signal wins.
    const concerns = [];
    let verdict = "safe";
    let confidence = 0.6;

    if (authVerdict.verdict === "failed") {
      concerns.push({ kind: "auth-fail", text: authVerdict.reason, severity: "block" });
      verdict = "phishing";
      confidence = Math.max(confidence, authVerdict.score);
    } else if (authVerdict.verdict === "verified") {
      // Verified senders get a small confidence boost but verdict can still
      // flip if other heavy signals fire.
    }

    if (spoof.spoofed) {
      concerns.push({ kind: "display-spoof", text: spoof.reason, severity: spoof.severity === "high" ? "block" : "warn" });
      if (spoof.severity === "high" && verdict === "safe") verdict = "phishing";
      else if (verdict === "safe") verdict = "suspicious";
      confidence = Math.max(confidence, 0.85);
    }

    if (replyTo.diverges) {
      concerns.push({ kind: "reply-to-diverges", text: replyTo.reason, severity: replyTo.severity === "high" ? "block" : "warn" });
      if (verdict === "safe") verdict = "suspicious";
      confidence = Math.max(confidence, 0.7);
    }

    if (bec.bec) {
      const sev = bec.verdict === "high" ? "block" : "warn";
      concerns.push({ kind: "bec", text: `BEC pattern (${bec.verdict}, score ${bec.score}): ${bec.signals.join("; ")}`, severity: sev });
      if (bec.verdict === "high" && verdict !== "phishing") verdict = "scam";
      else if (verdict === "safe") verdict = "suspicious";
      confidence = Math.max(confidence, 0.5 + bec.score * 0.4);
    }

    // Link-level severity bubbles up.
    const blockingLinks = links.filter((l) => l.severity === "block");
    const warningLinks  = links.filter((l) => l.severity === "warn");
    if (blockingLinks.length > 0) {
      concerns.push({ kind: "links-block", text: `${blockingLinks.length} dangerous link${blockingLinks.length > 1 ? "s" : ""}`, severity: "block" });
      if (verdict === "safe") verdict = "suspicious";
      confidence = Math.max(confidence, 0.8);
    } else if (warningLinks.length > 0) {
      concerns.push({ kind: "links-warn", text: `${warningLinks.length} suspicious link${warningLinks.length > 1 ? "s" : ""}`, severity: "warn" });
      confidence = Math.max(confidence, 0.6);
    }

    const verifiedBrand = verifiedSender(fromEmail);

    return {
      verdict,                          // safe | suspicious | scam | phishing
      confidence,
      auth: { ...auth, ...authVerdict },
      spoof,
      replyTo,
      bec,
      links,
      concerns,
      verifiedBrand,                    // brand entry if sender is on a known-legitimate domain
      summary: concerns.length === 0
        ? "No concerns detected by Stedly heuristics. (Heuristics catch ~80% — final judgment is yours.)"
        : concerns.map((c) => `[${c.severity}] ${c.text}`).join("\n"),
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //   <ClickWarningModal> — accessible click-redirect interstitial
  //   Focus-trap, ESC, ARIA, full destination URL parsed into parts.
  // ════════════════════════════════════════════════════════════════════

  function parseUrlForDisplay(url) {
    try {
      const u = new URL(url);
      return {
        scheme: u.protocol.replace(":", ""),
        host:   u.hostname,
        path:   u.pathname,
        query:  u.search,
        hash:   u.hash,
        full:   u.href,
      };
    } catch (_) {
      return { full: url };
    }
  }

  function ClickWarningModal({ link, onCancel, onConfirm }) {
    const overlayRef = useRef(null);
    const confirmRef = useRef(null);

    // Focus trap + ESC.
    useEffect(() => {
      if (!link) return;
      const prevActive = document.activeElement;
      // Move focus into the modal.
      setTimeout(() => { confirmRef.current && confirmRef.current.focus(); }, 0);
      const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); onCancel(); return; }
        if (e.key === "Tab") {
          const focusables = overlayRef.current?.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
          if (!focusables || focusables.length === 0) return;
          const first = focusables[0], last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("keydown", onKey);
        if (prevActive && prevActive.focus) prevActive.focus();
      };
    }, [link, onCancel]);

    if (!link) return null;
    const parts = parseUrlForDisplay(link.url);
    const sev = link.severity || "safe";
    const reasons = link.reasons || [];

    // PORTAL: render to document.body so backdrop-filter / transform
    // ancestors don't trap our position:fixed overlay inside a sub-region.
    const modal = (
      <div className="trust-modal-overlay" ref={overlayRef} role="dialog" aria-modal="true" aria-labelledby="trust-modal-title" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
        <div className={`trust-modal sev-${sev}`}>
          <header className="trust-modal-head">
            <span className="trust-modal-eyebrow">Leaving Stedly</span>
            <h3 id="trust-modal-title">
              {sev === "block" ? "This link looks dangerous" :
               sev === "warn"  ? "Verify this link before continuing" :
                                 "You're about to leave Stedly"}
            </h3>
          </header>

          <div className="trust-modal-url">
            <div className="trust-url-row">
              <span className="trust-url-label">Destination</span>
              <code className="trust-url-host">{parts.host}</code>
            </div>
            <div className="trust-url-full">
              {parts.scheme && <span className="part-scheme">{parts.scheme}://</span>}
              <span className="part-host">{parts.host}</span>
              <span className="part-path">{parts.path}</span>
              {parts.query && <span className="part-query">{parts.query}</span>}
              {parts.hash  && <span className="part-hash">{parts.hash}</span>}
            </div>
          </div>

          {reasons.length > 0 && (
            <div className="trust-modal-reasons">
              <div className="trust-modal-reasons-label">What Stedly noticed</div>
              <ul>
                {reasons.map((r, i) => (
                  <li key={i} className={`reason-${r.kind}`}>{r.text}</li>
                ))}
              </ul>
            </div>
          )}

          {link.displayText && (
            <div className="trust-modal-displayed">
              <span className="trust-url-label">Shown as</span>
              <span className="trust-displayed-text">{link.displayText}</span>
            </div>
          )}

          <footer className="trust-modal-foot">
            <button className="trust-btn trust-btn-cancel" onClick={onCancel} autoFocus={sev === "block"}>
              Cancel
            </button>
            <button
              ref={confirmRef}
              className={`trust-btn trust-btn-continue sev-${sev}`}
              onClick={onConfirm}
              autoFocus={sev !== "block"}>
              {sev === "block" ? "Continue anyway (not recommended)" :
               sev === "warn"  ? "I trust this — continue" :
                                 "Continue"}
            </button>
          </footer>
        </div>
      </div>
    );
    return ReactDOM.createPortal(modal, document.body);
  }

  // Hook for components to use the click-guard. Returns a `guard` function
  // that wraps any link-clicking action through the modal, plus the modal
  // props to spread onto <ClickWarningModal>.
  function useClickGuard() {
    const [pending, setPending] = useState(null); // currently-pending link

    const guard = useCallback((link) => {
      // Always show the modal — no skipping. Stedly is a trust product.
      setPending(link);
    }, []);

    const onCancel = useCallback(() => setPending(null), []);
    const onConfirm = useCallback(() => {
      if (pending && pending.url) {
        window.open(pending.url, "_blank", "noopener,noreferrer");
      }
      setPending(null);
    }, [pending]);

    return {
      guard,
      modalProps: { link: pending, onCancel, onConfirm },
    };
  }

  // Convenience component that wraps an entire DOM subtree and intercepts
  // all <a> clicks, routing them through the click-guard.
  function ClickGuardScope({ children, links }) {
    const { guard, modalProps } = useClickGuard();
    const ref = useRef(null);

    // Index analyzed links by URL for fast lookup.
    const linkIndex = useMemo(() => {
      const idx = new Map();
      (links || []).forEach((l) => idx.set(l.url, l));
      return idx;
    }, [links]);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const onClick = (e) => {
        const a = e.target.closest && e.target.closest("a[href]");
        if (!a) return;
        const href = a.getAttribute("href");
        if (!href || !/^https?:/i.test(href)) return; // ignore mailto:, anchors, etc.
        e.preventDefault();
        e.stopPropagation();
        const analyzed = linkIndex.get(href) || analyzeLink({ url: href, host: parseUrlForDisplay(href).host || "", displayText: a.textContent || "", source: "html-anchor" });
        guard(analyzed);
      };
      el.addEventListener("click", onClick);
      return () => el.removeEventListener("click", onClick);
    }, [guard, linkIndex]);

    return (
      <>
        <div ref={ref}>{children}</div>
        <ClickWarningModal {...modalProps}/>
      </>
    );
  }

  // Public exports.
  Object.assign(window, {
    parseAuthResults,
    assessAuth,
    detectDisplayNameSpoof,
    detectReplyToDivergence,
    detectBEC,
    extractLinks,
    analyzeLink,
    detectLookalikeDomain,
    visualEditDistance,
    registrableDomain,
    parseUrlForDisplay,
    assessTrust,
    verifiedSender,
    ClickWarningModal,
    ClickGuardScope,
    useClickGuard,
    BRAND_DOMAINS,
    FREE_EMAIL_PROVIDERS,
    URL_SHORTENERS,
    SUSPICIOUS_TLDS,
  });
})();

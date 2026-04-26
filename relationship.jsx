// Stedly Protocol — Sender history + cross-thread reference detection
//
// Free, browser-side, fueled by Gmail API queries the user has already
// authorized. Two main capabilities:
//
//   1. useSenderHistory({ email, gmailAuth })
//      Hook — fetches all messages between user and this sender,
//      computes a relationship state machine (first-contact / ongoing /
//      active / dormant / you-went-quiet / they-went-quiet), and caches
//      per-email in sessionStorage with a 24h TTL.
//
//   2. findRelatedThreads({ message, history })
//      Synchronous — given a new message and the sender's history, find
//      related prior threads even when threadId differs. Uses subject
//      Jaccard, recency weighting, and continuation-phrase signals
//      ("as discussed", "circling back", etc.).

(function () {
  const { useState, useEffect, useCallback, useMemo, useRef } = React;
  const STEDLY_REL_KEY = "stedly:rel:v1";
  const TTL_MS = 24 * 60 * 60 * 1000;
  // Cap the number of historical messages we pull per sender — Gmail has
  // generous quota, but a 1000-message thread for one sender is overkill
  // and would burn quota across many senders.
  const MAX_HISTORY = 50;

  // ════════════════════════════════════════════════════════════════════
  //   CACHE (sessionStorage, keyed by lower-cased email)
  // ════════════════════════════════════════════════════════════════════

  function readCache() {
    try {
      const raw = sessionStorage.getItem(STEDLY_REL_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      // Strip stale entries.
      const now = Date.now();
      const fresh = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v && v.cachedAt && (now - v.cachedAt) < TTL_MS) fresh[k] = v;
      }
      return fresh;
    } catch (_) { return {}; }
  }

  function writeCache(cache) {
    try { sessionStorage.setItem(STEDLY_REL_KEY, JSON.stringify(cache)); } catch (_) {}
  }

  // ════════════════════════════════════════════════════════════════════
  //   GMAIL QUERIES
  //   We do two queries per sender:
  //     - q=from:<email>            → all messages they sent us
  //     - q=to:<email> from:me      → all our replies to them
  //   Each message is fetched in metadata format (cheap) for headers.
  // ════════════════════════════════════════════════════════════════════

  async function listFromSender({ token, email, max = MAX_HISTORY }) {
    if (!email) return [];
    const params = new URLSearchParams({
      maxResults: String(max),
      q: `from:${email}`,
    });
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Sender history fetch failed (${res.status})`);
    const j = await res.json();
    return j.messages || [];
  }

  async function listRepliesTo({ token, email, max = MAX_HISTORY }) {
    if (!email) return [];
    const params = new URLSearchParams({
      maxResults: String(max),
      q: `to:${email} from:me`,
    });
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Reply history fetch failed (${res.status})`);
    const j = await res.json();
    return j.messages || [];
  }

  async function getMessageMetadata({ token, id }) {
    const params = new URLSearchParams({ format: "metadata" });
    ["From", "To", "Subject", "Date", "Message-ID", "Message-Id", "In-Reply-To", "References"]
      .forEach((h) => params.append("metadataHeaders", h));
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?${params}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Metadata fetch failed (${res.status})`);
    return await res.json();
  }

  function getHeader(msg, name) {
    if (!msg || !msg.payload || !msg.payload.headers) return "";
    const want = name.toLowerCase();
    const h = msg.payload.headers.find((x) => x.name && x.name.toLowerCase() === want);
    return h ? h.value : "";
  }

  function normalizeSubject(s) {
    if (!s) return "";
    return s
      .replace(/^(re|fwd|fw|tr)\s*:\s*/gi, "")
      .replace(/\s*\[\s*[^\]]*\s*\]\s*/g, " ") // strip [tag] prefixes
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  // Tokenize a subject into bag-of-words for Jaccard similarity.
  // Filter stop words; emails carry a lot of noise like "the / a / from".
  const STOP = new Set([
    "the","a","an","and","or","of","to","for","in","on","at","by","with",
    "is","are","be","was","were","this","that","these","those","it","as",
    "from","but","if","not","you","we","i","me","us","our","your","my",
    "re","fw","fwd","tr",
  ]);
  function subjectTokens(subject) {
    const norm = normalizeSubject(subject);
    return new Set(
      norm.split(/\W+/).filter((t) => t.length >= 3 && !STOP.has(t))
    );
  }

  function jaccard(setA, setB) {
    if (setA.size === 0 && setB.size === 0) return 0;
    let inter = 0;
    for (const t of setA) if (setB.has(t)) inter++;
    const union = setA.size + setB.size - inter;
    return union === 0 ? 0 : inter / union;
  }

  // ════════════════════════════════════════════════════════════════════
  //   RELATIONSHIP STATE MACHINE
  // ════════════════════════════════════════════════════════════════════

  function computeRelationship({ received, sent }) {
    const now = Date.now();
    const DAY = 86_400_000;
    const recvCount = received.length;
    const sentCount = sent.length;

    if (recvCount === 0 && sentCount === 0) {
      return { state: "first-contact", count: 0, sentCount: 0, lastReceivedDays: null, lastSentDays: null };
    }

    const lastRecv = received[0];          // queries return newest-first
    const lastSent = sent[0];
    const lastRecvDays = lastRecv ? Math.floor((now - lastRecv.ts) / DAY) : null;
    const lastSentDays = lastSent ? Math.floor((now - lastSent.ts) / DAY) : null;

    let state = "ongoing"; // default
    if (recvCount === 0) {
      // We've sent to them but never received — outbound-only contact.
      state = "outbound-only";
    } else if (sentCount === 0) {
      // They've sent but we never replied.
      state = "you-went-quiet";
    } else if (lastRecvDays !== null && lastRecvDays > 60 && lastSentDays !== null && lastSentDays > 60) {
      state = "dormant";
    } else if (lastRecv && lastSent && lastRecv.ts > lastSent.ts && lastSentDays !== null && lastSentDays > 14) {
      // Asymmetry — they wrote more recently than us, and we haven't
      // replied in 14+ days. Check this BEFORE the "active" window since
      // we want to flag the gap even if both sides happened ≤30d ago.
      state = "you-went-quiet";
    } else if (lastSent && lastRecv && lastSent.ts > lastRecv.ts && lastRecvDays !== null && lastRecvDays > 14) {
      // Asymmetry — we wrote more recently, they haven't replied in 14+ days.
      state = "they-went-quiet";
    } else if (lastRecvDays !== null && lastRecvDays <= 30 && lastSentDays !== null && lastSentDays <= 30) {
      // Both sides recent and roughly balanced — true active conversation.
      state = "active";
    }

    return {
      state,
      count: recvCount,
      sentCount,
      lastReceivedDays: lastRecvDays,
      lastSentDays: lastSentDays,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //   CONTINUATION PHRASE DETECTION
  // ════════════════════════════════════════════════════════════════════

  const REFERENCE_PHRASES = [
    "as discussed", "as we discussed", "as mentioned", "as i mentioned", "as you mentioned",
    "per my last", "per our last", "per the last", "per our previous",
    "circling back", "circling around",
    "following up on", "following up with", "checking in on", "checking back",
    "regarding our", "regarding the", "regarding my", "in reference to",
    "in your last", "in your previous", "in my last",
    "as per", "per our discussion", "per our conversation",
    "you mentioned", "you said", "you noted", "you wrote",
    "last week's", "last month's", "yesterday's",
    "from our call", "from our meeting", "from our conversation",
    "to your point", "to follow up", "wanted to follow up",
  ];

  function detectReferencePhrases(text) {
    if (!text) return [];
    const lower = text.toLowerCase();
    const found = [];
    for (const phrase of REFERENCE_PHRASES) {
      if (lower.includes(phrase)) found.push(phrase);
    }
    return found;
  }

  // ════════════════════════════════════════════════════════════════════
  //   CROSS-THREAD RELATED-MESSAGE FINDER
  //   Given a target message + a list of historical messages from the same
  //   sender, score each historical message by:
  //     - threadId match (1.0 — same conversation)
  //     - subject Jaccard (up to 0.7)
  //     - recency (logistic decay, up to 0.2)
  //     - continuation phrase signal in target body (+0.1 if any)
  //   Return top N above a threshold.
  // ════════════════════════════════════════════════════════════════════

  function findRelatedThreads({ targetMessage, history, maxResults = 3, threshold = 0.25 }) {
    if (!targetMessage || !history || history.length === 0) return [];
    const targetTokens = subjectTokens(targetMessage.subject || "");
    const targetThreadId = targetMessage.threadId;
    const phraseHits = detectReferencePhrases(`${targetMessage.subject || ""} ${targetMessage.snippet || ""} ${targetMessage.body || ""}`);
    const phraseBonus = phraseHits.length > 0 ? 0.1 : 0;
    const now = Date.now();

    const scored = history
      .filter((h) => h.id !== targetMessage.id) // exclude self
      .map((h) => {
        let score = 0;
        const reasons = [];

        if (targetThreadId && h.threadId === targetThreadId) {
          score += 1.0;
          reasons.push("same thread");
        }
        const sJaccard = jaccard(targetTokens, subjectTokens(h.subject || ""));
        if (sJaccard > 0) {
          score += Math.min(0.7, sJaccard * 0.9);
          reasons.push(`subject overlap ${Math.round(sJaccard * 100)}%`);
        }
        // Recency — exponential decay over 60 days.
        const ageDays = (now - (h.ts || 0)) / 86_400_000;
        const recencyWeight = Math.max(0, Math.exp(-ageDays / 60) * 0.2);
        score += recencyWeight;
        if (ageDays < 7) reasons.push("recent");

        score += phraseBonus;
        if (phraseBonus > 0) reasons.push(`reference phrase: "${phraseHits[0]}"`);

        return { ...h, score, reasons };
      })
      .filter((h) => h.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return scored;
  }

  // ════════════════════════════════════════════════════════════════════
  //   useSenderHistory hook
  // ════════════════════════════════════════════════════════════════════

  function useSenderHistory({ email, gmailAuth }) {
    const [state, setState] = useState({
      status: "idle",            // idle | loading | ready | error
      received: [],              // messages from this sender (newest first)
      sent: [],                  // user's replies (newest first)
      relationship: null,
      error: null,
    });
    const inflight = useRef(null);

    const refresh = useCallback(async () => {
      if (!email || !gmailAuth || gmailAuth.status !== "connected" || !gmailAuth.token) {
        setState((s) => ({ ...s, status: "idle", relationship: null }));
        return;
      }
      const key = email.toLowerCase();
      const cache = readCache();
      // Hit cache?
      if (cache[key]) {
        const c = cache[key];
        setState({
          status: "ready",
          received: c.received || [],
          sent: c.sent || [],
          relationship: c.relationship || null,
          fromCache: true,
          error: null,
        });
        return;
      }
      // De-duplicate inflight.
      if (inflight.current === key) return;
      inflight.current = key;

      setState((s) => ({ ...s, status: "loading", error: null }));

      try {
        const [recvList, sentList] = await Promise.all([
          listFromSender({ token: gmailAuth.token, email }),
          listRepliesTo({ token: gmailAuth.token, email }),
        ]);

        // Pull metadata for each. Cap concurrency to avoid quota spikes.
        const fetchAll = async (list) => {
          const out = [];
          const concurrency = 5;
          for (let i = 0; i < list.length; i += concurrency) {
            const batch = list.slice(i, i + concurrency);
            const got = await Promise.all(batch.map((m) =>
              getMessageMetadata({ token: gmailAuth.token, id: m.id }).catch(() => null)
            ));
            for (const msg of got) {
              if (!msg) continue;
              const subject = getHeader(msg, "Subject");
              const dateStr = getHeader(msg, "Date");
              const ts = dateStr ? new Date(dateStr).getTime() : parseInt(msg.internalDate || "0", 10);
              const messageId = getHeader(msg, "Message-ID") || getHeader(msg, "Message-Id");
              out.push({
                id: msg.id,
                threadId: msg.threadId,
                subject,
                snippet: msg.snippet || "",
                ts,
                messageId,
              });
            }
          }
          return out;
        };

        const received = (await fetchAll(recvList)).sort((a, b) => b.ts - a.ts);
        const sent     = (await fetchAll(sentList)).sort((a, b) => b.ts - a.ts);
        const relationship = computeRelationship({ received, sent });

        const next = { received, sent, relationship, cachedAt: Date.now() };
        const cacheNow = readCache();
        cacheNow[key] = next;
        writeCache(cacheNow);

        setState({
          status: "ready",
          received,
          sent,
          relationship,
          fromCache: false,
          error: null,
        });
      } catch (err) {
        setState((s) => ({ ...s, status: "error", error: err.message || String(err) }));
      } finally {
        inflight.current = null;
      }
    }, [email, gmailAuth]);

    useEffect(() => {
      refresh();
    }, [refresh]);

    return { ...state, refresh };
  }

  // Force-clear a sender's cache entry (useful on Disconnect or per-sender refresh).
  function clearSenderCache(email) {
    if (!email) return;
    const cache = readCache();
    delete cache[email.toLowerCase()];
    writeCache(cache);
  }
  function clearAllSenderCache() {
    try { sessionStorage.removeItem(STEDLY_REL_KEY); } catch (_) {}
  }

  // ════════════════════════════════════════════════════════════════════
  //   Pretty-printer for relationship state — used in queue pills.
  // ════════════════════════════════════════════════════════════════════

  const RELATIONSHIP_LABELS = {
    "first-contact":   { label: "First contact",  tone: "b", explainer: "You've never received mail from this sender before" },
    "outbound-only":   { label: "Outbound only",  tone: "n", explainer: "You've written to them but never received a reply" },
    "active":          { label: "Active",         tone: "g", explainer: "Both sides exchanging within the last 30 days" },
    "ongoing":         { label: "Ongoing",        tone: "g", explainer: "Established relationship with prior exchanges" },
    "you-went-quiet":  { label: "You went quiet", tone: "a", explainer: "They wrote, your last reply was 14+ days ago" },
    "they-went-quiet": { label: "They went quiet",tone: "n", explainer: "You wrote, no reply for 14+ days" },
    "dormant":         { label: "Dormant",        tone: "n", explainer: "No activity from either side in 60+ days" },
  };

  Object.assign(window, {
    useSenderHistory,
    findRelatedThreads,
    detectReferencePhrases,
    computeRelationship,
    normalizeSubject,
    subjectTokens,
    jaccard,
    clearSenderCache,
    clearAllSenderCache,
    RELATIONSHIP_LABELS,
    REFERENCE_PHRASES,
  });
})();

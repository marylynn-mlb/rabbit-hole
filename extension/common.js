/* Shared by the service worker, the side panel and the book page.
   Everything here is plain functions: no network, no storage writes. */
var RH = (function () {
  "use strict";

  var DEFAULT_DENY = [
    "mail.google.com", "outlook.live.com", "outlook.office.com", "outlook.office365.com",
    "accounts.google.com", "paypal.com", "1password.com", "lastpass.com", "bitwarden.com",
    "mychart", "bank"
  ];
  var DEFAULT_SETTINGS = { deny: DEFAULT_DENY, quietMinutes: 45, glimpseSeconds: 8 };

  /* Pages where the search words are the point. Only the named parameter is kept. */
  var SEARCH = [
    { host: /(^|\.)google\.[a-z.]+$/, path: /^\/(search|scholar)$/, param: "q" },
    { host: /(^|\.)bing\.com$/, path: /^\/search$/, param: "q" },
    { host: /(^|\.)duckduckgo\.com$/, path: /^\/$/, param: "q" },
    { host: /(^|\.)search\.brave\.com$/, path: /^\/search$/, param: "q" },
    { host: /(^|\.)ecosia\.org$/, path: /^\/search$/, param: "q" },
    { host: /(^|\.)kagi\.com$/, path: /^\/search$/, param: "q" },
    { host: /(^|\.)search\.yahoo\.com$/, path: /^\/search$/, param: "p" },
    { host: /(^|\.)youtube\.com$/, path: /^\/results$/, param: "search_query" },
    { host: /(^|\.)wikipedia\.org$/, path: /^\/w\/index\.php$/, param: "search" }
  ];
  /* Pages that are meaningless without one parameter. */
  var KEEP = [
    { host: /(^|\.)youtube\.com$/, path: /^\/watch$/, param: "v" }
  ];
  /* Redirect and ad hops that are not places anyone visited. */
  var NOISE = [
    { host: /(^|\.)google\.[a-z.]+$/, path: /^\/(url|aclk|imgres|sorry)/ },
    { host: /^(www\.)?bing\.com$/, path: /^\/(aclk|ck)\// }
  ];

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* Returns { url, host, query } or null when the page should not be recorded. */
  function scrub(raw) {
    var u;
    try { u = new URL(raw); } catch (e) { return null; }
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    var host = u.hostname.toLowerCase(), i;
    for (i = 0; i < NOISE.length; i++) if (NOISE[i].host.test(host) && NOISE[i].path.test(u.pathname)) return null;
    for (i = 0; i < SEARCH.length; i++) {
      var s = SEARCH[i];
      if (s.host.test(host) && s.path.test(u.pathname)) {
        var q = (u.searchParams.get(s.param) || "").trim();
        if (q) return { url: u.origin + u.pathname + "?" + s.param + "=" + encodeURIComponent(q), host: host, query: q };
      }
    }
    for (i = 0; i < KEEP.length; i++) {
      var k = KEEP[i];
      if (k.host.test(host) && k.path.test(u.pathname)) {
        var v = u.searchParams.get(k.param);
        if (v) return { url: u.origin + u.pathname + "?" + k.param + "=" + encodeURIComponent(v), host: host, query: null };
      }
    }
    return { url: u.origin + u.pathname, host: host, query: null };
  }

  function isDenied(host, deny) {
    host = String(host || "").toLowerCase();
    return (deny || []).some(function (d) { d = String(d || "").trim().toLowerCase(); return d && host.indexOf(d) !== -1; });
  }

  function kindFor(s) {
    if (s.query) return "question";
    if (/(^|\.)youtube\.com$/.test(s.host) && /\/watch\?v=/.test(s.url)) return "watch";
    return "read";
  }

  /* Page titles are sometimes junk: a notification count in front, or (for PDFs) a file path left in by the author. */
  function cleanTitle(title, url) {
    var t = (title || "").trim().replace(/^\(\d+\+?\)\s*/, "");
    if (/^([\/~\\]|[A-Za-z]:[\\\/])/.test(t) || /\/Users\/|\\Users\\/.test(t)) {
      t = "";
      try {
        var seg = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "");
        t = seg.replace(/\.[A-Za-z0-9]{2,4}$/, "").replace(/[_+]+/g, " ").trim();
      } catch (e) { t = ""; }
    }
    return t;
  }
  function prettyTitle(node) {
    if (node.query) return node.query;
    var t = cleanTitle(node.title, node.url);
    if (t) return t;
    try { var u = new URL(node.url); return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : ""); } catch (e) { return node.url || "Untitled stop"; }
  }

  /* Tree helpers shared by the panel and the book. */
  function childrenMap(nodes) {
    var ids = {}, kids = {}, roots = [];
    nodes.forEach(function (n) { ids[n.id] = true; });
    nodes.forEach(function (n) {
      if (n.parent && ids[n.parent]) (kids[n.parent] = kids[n.parent] || []).push(n); else roots.push(n);
    });
    return { kids: kids, roots: roots };
  }
  function depths(nodes) {
    var cm = childrenMap(nodes), d = {}, maxD = 0;
    (function walk(list, depth) {
      list.forEach(function (n) {
        if (d[n.id] != null) return;
        d[n.id] = depth; if (depth > maxD) maxD = depth;
        walk(cm.kids[n.id] || [], depth + 1);
      });
    })(cm.roots, 0);
    return { depth: d, max: maxD, cm: cm };
  }

  function effectiveState(node, hasKids, trailRecording) {
    if (node.state) return node.state;
    return (!hasKids && trailRecording) ? "falling" : "landed";
  }
  function isGlimpse(node, glimpseSeconds) {
    return !node.mattered && node.kind !== "question" && (node.dwellMs || 0) < glimpseSeconds * 1000;
  }

  function fmtDuration(ms) {
    var m = Math.round(ms / 60000);
    if (m < 1) return "under a minute";
    if (m < 60) return m + (m === 1 ? " minute" : " minutes");
    var h = Math.floor(m / 60), r = m % 60;
    return h + (h === 1 ? " hour" : " hours") + (r ? " " + r + " min" : "");
  }
  function fmtDate(ts) {
    try { return new Date(ts).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }); } catch (e) { return ""; }
  }
  function fmtTime(ts) {
    try { return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; }
  }

  async function getSettings() {
    var r = await chrome.storage.local.get("settings");
    return Object.assign({}, DEFAULT_SETTINGS, r.settings || {});
  }
  async function getAllTrails() {
    var all = await chrome.storage.local.get(null), out = [];
    Object.keys(all).forEach(function (k) { if (k.indexOf("trail:") === 0) out.push(all[k]); });
    out.sort(function (a, b) { return (b.startedAt || 0) - (a.startedAt || 0); });
    return out;
  }

  return {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS, uid: uid, scrub: scrub, isDenied: isDenied, kindFor: kindFor,
    prettyTitle: prettyTitle, cleanTitle: cleanTitle, childrenMap: childrenMap, depths: depths, effectiveState: effectiveState,
    isGlimpse: isGlimpse, fmtDuration: fmtDuration, fmtDate: fmtDate, fmtTime: fmtTime,
    getSettings: getSettings, getAllTrails: getAllTrails
  };
})();

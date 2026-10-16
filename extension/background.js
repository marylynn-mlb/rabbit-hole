/* Rabbit Hole: capture engine.
   Follows ONE trail at a time: the tab you started it in, plus every tab that opens from it.
   Nothing else in the browser is looked at. All data stays in this browser (chrome.storage.local). */
importScripts("common.js");

var LOCAL = chrome.storage.local;
var SESSION = chrome.storage.session;
/* Reading a long page involves very little clicking, so be generous: up to five quiet minutes still count as reading. */
var IDLE_SECONDS = 300;

/* ---------- one write at a time ---------- */
var chain = Promise.resolve();
function enqueue(fn) {
  var run = chain.then(fn);
  chain = run.catch(function (e) { console.error("[rabbit-hole]", e); });
  return run;
}

/* ---------- storage ---------- */
async function getTrail(id) {
  var k = "trail:" + id;
  return (await LOCAL.get(k))[k] || null;
}
async function loadState(any) {
  var active = (await LOCAL.get("active")).active;
  if (!active) return null;
  if (!any && active.status !== "recording") return null;
  var trail = await getTrail(active.trailId);
  if (!trail) { await LOCAL.remove("active"); return null; }
  var ss = await SESSION.get(["tabs", "focus", "idle"]);
  return { active: active, trail: trail, tabs: ss.tabs || {}, focus: ss.focus || null, idle: !!ss.idle, settings: await RH.getSettings(), finished: false };
}
async function saveState(st) {
  var o = { active: st.active };
  o["trail:" + st.trail.id] = st.trail;
  await LOCAL.set(o);
  await SESSION.set({ tabs: st.tabs, focus: st.focus, idle: st.idle });
  setBadge(st);
}
function withState(fn, any) {
  return enqueue(async function () {
    var st = await loadState(any);
    if (!st) return null;
    var r = await fn(st);
    if (!st.finished) await saveState(st);
    return r;
  });
}

function setBadge(st) {
  try {
    if (!st) { chrome.action.setBadgeText({ text: "" }); return; }
    var paused = st.active.status === "paused";
    chrome.action.setBadgeText({ text: paused ? "II" : String(st.trail.nodes.length) });
    chrome.action.setBadgeBackgroundColor({ color: paused ? "#7B6A72" : "#7A2742" });
    if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: "#FBF3EF" });
  } catch (e) { /* badge is cosmetic */ }
}

/* ---------- time spent on each stop ---------- */
function settle(st, now) {
  var f = st.focus;
  if (!f || !f.nodeId || !f.since) return;
  now = now || Date.now();
  var n = st.trail.nodes.find(function (x) { return x.id === f.nodeId; });
  if (n) n.dwellMs = (n.dwellMs || 0) + Math.max(0, now - f.since);
  f.since = now;
}
async function activeTabId() {
  try {
    var w = await chrome.windows.getLastFocused();
    if (!w || !w.focused) return null;
    var tabs = await chrome.tabs.query({ active: true, windowId: w.id });
    return tabs[0] ? tabs[0].id : null;
  } catch (e) { return null; }
}
async function refocus(st) {
  var now = Date.now();
  var tabId = st.idle ? null : await activeTabId();
  var tb = tabId != null ? st.tabs[tabId] : null;
  if (tb && tb.lastNode) {
    st.focus = { tabId: tabId, nodeId: tb.lastNode, since: now };
    st.active.lastEventAt = now;
  } else {
    st.focus = null;
  }
}

/* ---------- recording a navigation ---------- */
function recordNav(st, tabId, rawUrl, title, transition) {
  var tb = st.tabs[tabId];
  if (!tb) return null;
  var s = RH.scrub(rawUrl);
  if (!s) return null;
  if (RH.isDenied(s.host, st.settings.deny)) { tb.skipped = true; return null; }
  tb.skipped = false;
  var last = tb.lastNode ? st.trail.nodes.find(function (n) { return n.id === tb.lastNode; }) : null;
  var clean = RH.cleanTitle(title, s.url);
  if (last && last.url === s.url) {
    if (clean && !last.query) last.title = clean;
    return last;
  }
  /* Coming back to a stop already on this trail is a return, not a new stop. */
  var seen = st.trail.nodes.find(function (n) { return n.url === s.url; });
  if (seen) {
    seen.returns = (seen.returns || 0) + 1;
    seen.returnedAt = (seen.returnedAt || []).concat(Date.now()).slice(-20);
    if (clean && !seen.query && !seen.title) seen.title = clean;
    tb.lastNode = seen.id;
    tb.pendingParent = null;
    return seen;
  }
  var node = {
    id: RH.uid(), parent: tb.lastNode || tb.pendingParent || null, url: s.url, host: s.host, query: s.query,
    title: s.query ? s.query : clean, kind: RH.kindFor(s), transition: transition,
    createdAt: Date.now(), dwellMs: 0, mattered: false, note: "", state: null
  };
  tb.pendingParent = null;
  tb.lastNode = node.id;
  st.trail.nodes.push(node);
  if (!st.trail.title) { st.trail.title = RH.prettyTitle(node); st.trail.titleAuto = true; }
  return node;
}

/* ---------- trail lifecycle ---------- */
async function finishFromState(st, reason) {
  settle(st);
  st.trail.state = "done";
  st.trail.endedAt = Date.now();
  st.trail.endReason = reason;
  var o = {};
  o["trail:" + st.trail.id] = st.trail;
  await LOCAL.set(o);
  await LOCAL.remove("active");
  await SESSION.set({ tabs: {}, focus: null, idle: false });
  st.finished = true;
  setBadge(null);
  return st.trail.id;
}
async function finishInner(reason) {
  var st = await loadState(true);
  if (!st) return null;
  return finishFromState(st, reason);
}
async function startInner(tab) {
  await finishInner("replaced");
  var now = Date.now();
  var trail = { id: RH.uid(), title: "", titleAuto: true, startedAt: now, endedAt: null, state: "recording", nodes: [], landing: "" };
  var st = {
    active: { trailId: trail.id, status: "recording", lastEventAt: now, startedAt: now },
    trail: trail, tabs: {}, focus: null, idle: false, settings: await RH.getSettings(), finished: false
  };
  st.tabs[tab.id] = { lastNode: null, pendingParent: null };
  recordNav(st, tab.id, tab.url || "", tab.title || "", "start");
  if (!trail.title) trail.title = "A new trail";
  await refocus(st);
  await saveState(st);
}

/* ---------- browser events ---------- */
chrome.webNavigation.onCommitted.addListener(function (d) {
  if (d.frameId !== 0 || d.transitionType === "reload") return;
  withState(async function (st) {
    if (!st.tabs[d.tabId]) return;
    settle(st);
    var node = recordNav(st, d.tabId, d.url, "", d.transitionType);
    await refocus(st);
    if (node) refreshTitleSoon(d.tabId, node.id);
  });
});

/* Single-page sites change the address without announcing a new title, so look again a moment later. */
function refreshTitleSoon(tabId, nodeId) {
  setTimeout(function () {
    chrome.tabs.get(tabId).then(function (tab) {
      withState(async function (st) {
        var tb = st.tabs[tabId];
        if (!tb || tb.lastNode !== nodeId) return;
        var n = st.trail.nodes.find(function (x) { return x.id === nodeId; });
        var s = RH.scrub(tab.url || "");
        if (!n || n.query || !s || s.url !== n.url) return;
        var t = RH.cleanTitle(tab.title, n.url);
        if (t && t !== n.title) {
          n.title = t;
          if (st.trail.titleAuto && !n.parent) st.trail.title = RH.prettyTitle(n);
        }
      });
    }).catch(function () {});
  }, 1500);
}

chrome.webNavigation.onHistoryStateUpdated.addListener(function (d) {
  if (d.frameId !== 0) return;
  withState(async function (st) {
    if (!st.tabs[d.tabId]) return;
    settle(st);
    var node = recordNav(st, d.tabId, d.url, "", "spa");
    await refocus(st);
    if (node) refreshTitleSoon(d.tabId, node.id);
  });
});

function adoptOpener(st, newTabId, openerTabId) {
  var src = st.tabs[openerTabId];
  if (!src || st.tabs[newTabId]) return;
  st.tabs[newTabId] = { lastNode: null, pendingParent: src.lastNode || src.pendingParent || null };
}
chrome.webNavigation.onCreatedNavigationTarget.addListener(function (d) {
  withState(async function (st) { adoptOpener(st, d.tabId, d.sourceTabId); });
});
chrome.tabs.onCreated.addListener(function (tab) {
  if (tab.incognito || tab.openerTabId == null) return;
  withState(async function (st) { adoptOpener(st, tab.id, tab.openerTabId); });
});

chrome.tabs.onUpdated.addListener(function (tabId, change, tab) {
  if (change.title === undefined) return;
  withState(async function (st) {
    var tb = st.tabs[tabId];
    if (!tb || !tb.lastNode || tb.skipped) return;
    var n = st.trail.nodes.find(function (x) { return x.id === tb.lastNode; });
    var s = RH.scrub(tab.url || "");
    if (!n || !s || s.url !== n.url || n.query) return;
    n.title = RH.cleanTitle(change.title, n.url);
    if (st.trail.titleAuto && !n.parent) st.trail.title = RH.prettyTitle(n);
  });
});

chrome.tabs.onRemoved.addListener(function (tabId) {
  withState(async function (st) {
    if (!st.tabs[tabId]) return;
    settle(st);
    delete st.tabs[tabId];
    if (!Object.keys(st.tabs).length) { await finishFromState(st, "closed"); return; }
    await refocus(st);
  }, true);
});

chrome.tabs.onActivated.addListener(function () {
  withState(async function (st) { settle(st); await refocus(st); });
});
chrome.windows.onFocusChanged.addListener(function () {
  withState(async function (st) { settle(st); await refocus(st); });
});

chrome.idle.setDetectionInterval(IDLE_SECONDS);
chrome.idle.onStateChanged.addListener(function (state) {
  withState(async function (st) {
    /* The quiet stretch before going idle still counts as reading; the clock stops from here. */
    settle(st);
    st.idle = state !== "active";
    await refocus(st);
  });
});

/* A trail ends by itself after a quiet stretch with no tracked tab in use. */
chrome.alarms.get("quiet").then(function (a) { if (!a) chrome.alarms.create("quiet", { periodInMinutes: 1 }); });
chrome.alarms.onAlarm.addListener(function (a) {
  if (a.name !== "quiet") return;
  enqueue(async function () {
    var st = await loadState(true);
    if (!st) return;
    if (st.active.status === "recording" && st.focus && !st.idle) {
      st.active.lastEventAt = Date.now();
      await LOCAL.set({ active: st.active });
      return;
    }
    if (Date.now() - (st.active.lastEventAt || 0) > st.settings.quietMinutes * 60000) await finishFromState(st, "quiet");
  });
});

/* ---------- setup ---------- */
function setup() {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(function () {});
}
setup();
chrome.runtime.onInstalled.addListener(function () { setup(); });
chrome.runtime.onStartup.addListener(function () {
  /* Tab ids do not survive a browser restart, so a trail cannot carry on across one. */
  enqueue(async function () { await finishInner("browser-closed"); });
});

/* ---------- messages from the side panel and the book ---------- */
var NODE_KEYS = ["title", "note", "kind", "state", "mattered"];
var TRAIL_KEYS = ["title", "landing"];

async function handle(msg) {
  switch (msg.type) {
    case "start":
      await enqueue(function () { return startInner(msg.tab); });
      return {};
    case "pause":
      await withState(async function (st) { settle(st); st.active.status = "paused"; st.focus = null; });
      return {};
    case "resume":
      await withState(async function (st) { st.active.status = "recording"; await refocus(st); }, true);
      return {};
    case "surface":
      return { trailId: await enqueue(function () { return finishInner("surfaced"); }) };
    case "patchNode":
      await enqueue(async function () {
        var t = await getTrail(msg.trailId);
        var n = t && t.nodes.find(function (x) { return x.id === msg.nodeId; });
        if (!n) return;
        NODE_KEYS.forEach(function (k) { if (k in msg.patch) n[k] = msg.patch[k]; });
        var o = {}; o["trail:" + t.id] = t; await LOCAL.set(o);
      });
      return {};
    case "patchTrail":
      await enqueue(async function () {
        var t = await getTrail(msg.trailId);
        if (!t) return;
        TRAIL_KEYS.forEach(function (k) { if (k in msg.patch) t[k] = msg.patch[k]; });
        if ("title" in msg.patch) t.titleAuto = false;
        var o = {}; o["trail:" + t.id] = t; await LOCAL.set(o);
      });
      return {};
    case "deleteNode":
      await enqueue(async function () {
        var t = await getTrail(msg.trailId);
        var n = t && t.nodes.find(function (x) { return x.id === msg.nodeId; });
        if (!n) return;
        t.nodes.forEach(function (x) { if (x.parent === n.id) x.parent = n.parent || null; });
        t.nodes = t.nodes.filter(function (x) { return x.id !== n.id; });
        var o = {}; o["trail:" + t.id] = t; await LOCAL.set(o);
        var ss = await SESSION.get(["tabs", "focus"]);
        var tabs = ss.tabs || {};
        Object.keys(tabs).forEach(function (k) {
          if (tabs[k].lastNode === n.id) tabs[k].lastNode = n.parent || null;
          if (tabs[k].pendingParent === n.id) tabs[k].pendingParent = n.parent || null;
        });
        var focus = ss.focus && ss.focus.nodeId === n.id ? null : ss.focus;
        await SESSION.set({ tabs: tabs, focus: focus || null });
      });
      return {};
    case "deleteTrail":
      await enqueue(async function () {
        var active = (await LOCAL.get("active")).active;
        if (active && active.trailId === msg.trailId) await finishInner("deleted");
        await LOCAL.remove("trail:" + msg.trailId);
      });
      return {};
    case "forgetAll":
      await enqueue(async function () {
        var all = await LOCAL.get(null);
        var keys = Object.keys(all).filter(function (k) { return k.indexOf("trail:") === 0; });
        keys.push("active");
        await LOCAL.remove(keys);
        await SESSION.set({ tabs: {}, focus: null, idle: false });
        setBadge(null);
      });
      return {};
    default:
      return {};
  }
}
chrome.runtime.onMessage.addListener(function (msg, sender, send) {
  if (sender.id !== chrome.runtime.id) return;
  handle(msg).then(function (r) { send(Object.assign({ ok: true }, r)); }, function (e) { send({ ok: false, error: String(e) }); });
  return true;
});

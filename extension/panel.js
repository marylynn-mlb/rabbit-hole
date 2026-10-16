(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var active = null, trails = [];
  var SEAL = Art.sealPath(13);

  $("#mascot").innerHTML = Art.mascot();

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function send(msg) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage(msg, function (r) { void chrome.runtime.lastError; resolve(r || {}); });
    });
  }
  function openBook(hash) { chrome.tabs.create({ url: chrome.runtime.getURL("book.html") + (hash ? "#" + hash : "") }); }

  async function refresh() {
    active = (await chrome.storage.local.get("active")).active || null;
    trails = await RH.getAllTrails();
    render();
  }

  function pathRow(n, d, newest, glimpseSeconds, trailId) {
    var glimpse = RH.isGlimpse(n, glimpseSeconds);
    var pad = Math.min(d, 5) * 10;
    return '<li class="' + (glimpse ? "glimpse " : "") + (n.mattered ? "matt " : "") + (newest ? "newest" : "") + '" style="margin-left:' + pad + 'px">' +
      '<button class="seal" type="button" data-node="' + esc(n.id) + '" data-trail="' + esc(trailId) + '" aria-pressed="' + (!!n.mattered) + '" aria-label="Mark this stop as one that mattered: ' + esc(RH.prettyTitle(n)) + '" title="This one mattered">' +
      '<svg viewBox="-16 -16 32 32"><path class="disc" d="' + SEAL + '"/><g transform="translate(-8 -8) scale(.667)" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (Art.ICON[n.kind] || Art.ICON.read) + "</g></svg></button>" +
      '<div><span class="t">' + esc(RH.prettyTitle(n)) + '</span><span class="h">' + esc(n.host || "") + "</span></div></li>";
  }

  async function render() {
    var trail = active ? trails.filter(function (t) { return t.id === active.trailId; })[0] : null;
    var settings = await RH.getSettings();
    var live = !!(active && trail);
    $("#idleBox").hidden = live;
    $("#liveBox").hidden = !live;
    $("#pathBox").hidden = !live;
    $("#recentBox").hidden = live;

    if (live) {
      var paused = active.status === "paused";
      $("#liveBox").classList.toggle("paused", paused);
      $("#liveState").textContent = paused ? "Paused. Nothing is being recorded" : "Falling";
      $("#liveTitle").textContent = trail.title || "A new trail";
      var n = trail.nodes.length;
      $("#liveStats").textContent = n + (n === 1 ? " stop" : " stops") + " · " + RH.fmtDuration(Date.now() - trail.startedAt) + " since " + RH.fmtTime(trail.startedAt);
      $("#pause").hidden = paused;
      $("#resume").hidden = !paused;
      var dp = RH.depths(trail.nodes), html = "";
      if (!n) html = '<li class="hint">Nothing recorded yet. Search or follow a link in this tab.</li>';
      trail.nodes.forEach(function (node, i) { html += pathRow(node, dp.depth[node.id] || 0, i === n - 1, settings.glimpseSeconds, trail.id); });
      var list = $("#path"), atEnd = list.parentNode.scrollTop;
      list.innerHTML = html;
      void atEnd;
    } else {
      var rec = trails.slice(0, 6), r = "";
      rec.forEach(function (t) {
        var c = t.nodes.length;
        r += '<li><button type="button" data-open="' + esc(t.id) + '"><span class="t">' + esc(t.title || "A trail") + '</span><span class="h">' + esc(RH.fmtDate(t.startedAt)) + " · " + c + (c === 1 ? " stop" : " stops") + "</span></button></li>";
      });
      $("#recent").innerHTML = r;
      $("#recentBox").hidden = !rec.length;
    }
  }

  $("#start").addEventListener("click", async function () {
    var note = $("#startNote");
    note.hidden = true;
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var tab = tabs[0];
    if (!tab) { note.textContent = "Couldn’t find the tab you are on. Click into a browser tab and try again."; note.hidden = false; return; }
    var s = RH.scrub(tab.url || "");
    if (s && RH.isDenied(s.host, (await RH.getSettings()).deny)) {
      note.textContent = "This site is on the skip list, so it won’t be recorded. The trail will start from the next page you open in this tab.";
      note.hidden = false;
    } else if (!s) {
      note.textContent = "This tab isn’t a web page yet. The trail begins with the first page you open in it.";
      note.hidden = false;
    }
    await send({ type: "start", tab: { id: tab.id, url: tab.url || "", title: tab.title || "" } });
  });
  $("#pause").addEventListener("click", function () { send({ type: "pause" }); });
  $("#resume").addEventListener("click", function () { send({ type: "resume" }); });
  $("#surface").addEventListener("click", async function () {
    var r = await send({ type: "surface" });
    if (r && r.trailId) openBook(r.trailId);
  });
  $("#book").addEventListener("click", function () { openBook(""); });
  $("#report").addEventListener("click", function () { chrome.tabs.create({ url: chrome.runtime.getURL("report.html") }); });
  document.addEventListener("click", function (e) {
    var seal = e.target.closest(".seal");
    if (seal) {
      var on = seal.getAttribute("aria-pressed") !== "true";
      send({ type: "patchNode", trailId: seal.dataset.trail, nodeId: seal.dataset.node, patch: { mattered: on } });
      return;
    }
    var o = e.target.closest("[data-open]");
    if (o) openBook(o.dataset.open);
  });

  chrome.storage.onChanged.addListener(function (changes, area) { if (area === "local") refresh(); });
  setInterval(function () { if (active) render(); }, 30000);
  refresh();
})();

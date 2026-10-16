(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };

  var DEPTHS = ["the doorstep", "down the burrow", "tea-party depth", "over your head", "where the clocks stop", "no one has been this far"];
  var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  var KIND_LABEL = { question: "Question", read: "Read", watch: "Watched", person: "Person", idea: "Idea" };
  var STATE_LABEL = { falling: "Still falling", landed: "Landed", dead: "Dead end" };
  var END_TEXT = {
    surfaced: "You surfaced.", quiet: "Ended on its own after a quiet stretch.", closed: "Ended when its tabs were closed.",
    "browser-closed": "Ended when the browser closed.", replaced: "Ended when you started another trail.", deleted: "Ended."
  };
  function depthLabel(d) { return DEPTHS[d] || (d + " levels down"); }
  function chapter(d) { return "Chapter " + (ROMAN[d] || (d + 1)) + " · " + depthLabel(d); }

  var trails = [], settings = RH.DEFAULT_SETTINGS, active = null, selTrail = null, selNode = null;
  var drafts = {}, timers = {}, confirmAction = null, layoutCache = null;
  var SLOT = 140, R = 27, ROW_FULL = 152, ROW_BEAD = 66, CY = 66, BEAD_Y = 42, PADX = 24, GAPX = 30, BEAD_W = 46, BEAD_R = 8;
  var SEAL = Art.sealPath(R);
  var scroller = $("#scroller"), svg = $("#map"), panel = $("#panel");

  $("#mascotTop").innerHTML = Art.mascot();
  $("#mascotEmpty").innerHTML = Art.mascot();
  $("#plateArt").innerHTML = Art.plateArt();
  $("#cornerA").innerHTML = Art.cornerArt();
  $("#cornerB").innerHTML = Art.cornerArt();
  $("#divider").innerHTML = Art.dividerArt();

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function send(msg) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage(msg, function (r) { void chrome.runtime.lastError; resolve(r || {}); });
    });
  }
  var toastT;
  function toast(m) { var t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("on"); }, 3200); }
  function wrap(s, max, maxLines) {
    var words = String(s || "Untitled stop").trim().split(/\s+/), out = [], cur = "";
    words.forEach(function (w) {
      if (!cur) cur = w; else if ((cur + " " + w).length <= max) cur += " " + w; else { out.push(cur); cur = w; }
    });
    if (cur) out.push(cur);
    var res = out.slice(0, maxLines);
    if (out.length > maxLines) res[maxLines - 1] = res[maxLines - 1].slice(0, max - 1).replace(/[\s.,;:!?-]+$/, "") + "…";
    return res.map(function (l) { return l.length > max + 3 ? l.slice(0, max + 2) + "…" : l; });
  }
  function curTrail() { return trails.filter(function (t) { return t.id === selTrail; })[0] || null; }
  function findNode(trailId, nodeId) {
    var t = trails.filter(function (x) { return x.id === trailId; })[0];
    return t ? t.nodes.filter(function (n) { return n.id === nodeId; })[0] || null : null;
  }

  /* ---------- load ---------- */
  async function load() {
    active = (await chrome.storage.local.get("active")).active || null;
    trails = await RH.getAllTrails();
    settings = await RH.getSettings();
    if (!selTrail) {
      var h = decodeURIComponent((location.hash || "").slice(1));
      if (h && trails.some(function (t) { return t.id === h; })) selTrail = h;
    }
    if (!selTrail || !trails.some(function (t) { return t.id === selTrail; })) selTrail = trails[0] ? trails[0].id : null;
    if (selNode && !findNode(selTrail, selNode)) selNode = null;
    renderAll();
  }

  /* ---------- drafts: edits are saved shortly after you stop typing ---------- */
  function draftNode(trailId, nodeId, patch) {
    var n = findNode(trailId, nodeId); if (!n) return;
    Object.assign(n, patch);
    var key = "n/" + trailId + "/" + nodeId;
    var d = drafts[key] || (drafts[key] = { kind: "node", trailId: trailId, nodeId: nodeId, patch: {} });
    Object.assign(d.patch, patch);
    clearTimeout(timers[key]); timers[key] = setTimeout(function () { flush(key); }, 500);
  }
  function draftTrail(trailId, patch) {
    var t = trails.filter(function (x) { return x.id === trailId; })[0]; if (!t) return;
    Object.assign(t, patch);
    var key = "t/" + trailId;
    var d = drafts[key] || (drafts[key] = { kind: "trail", trailId: trailId, patch: {} });
    Object.assign(d.patch, patch);
    clearTimeout(timers[key]); timers[key] = setTimeout(function () { flush(key); }, 500);
  }
  function flush(key) {
    clearTimeout(timers[key]);
    var d = drafts[key]; if (!d) return;
    delete drafts[key];
    send(d.kind === "node" ? { type: "patchNode", trailId: d.trailId, nodeId: d.nodeId, patch: d.patch } : { type: "patchTrail", trailId: d.trailId, patch: d.patch });
  }
  function flushAll() { Object.keys(drafts).forEach(flush); }
  addEventListener("pagehide", flushAll);
  function setField(el, val) {
    if (!el || document.activeElement === el) return;
    if (Object.keys(drafts).length) return;
    if (el.value !== val) el.value = val;
  }

  /* ---------- picker and trail head ---------- */
  function renderPicker() {
    var html = "";
    trails.forEach(function (t) {
      var live = active && active.trailId === t.id, c = t.nodes.length;
      html += '<button class="chip' + (live ? " live" : "") + '" type="button" data-trail="' + esc(t.id) + '" aria-pressed="' + (t.id === selTrail) + '">' +
        '<span class="t">' + esc(t.title || "A trail") + '</span><span class="h">' + esc(RH.fmtDate(t.startedAt)) + " · " + c + (c === 1 ? " stop" : " stops") + "</span></button>";
    });
    $("#picker").innerHTML = html;
  }
  function renderHead(t) {
    var live = active && active.trailId === t.id;
    setField($("#tTitle"), t.title || "");
    setField($("#tLanding"), t.landing || "");
    $("#landLbl").textContent = live ? "Where is it heading?" : "Where did it land?";
    var searches = t.nodes.filter(function (n) { return n.query; }).length;
    var parts = [RH.fmtDate(t.startedAt), RH.fmtDuration((t.endedAt || Date.now()) - t.startedAt),
      t.nodes.length + (t.nodes.length === 1 ? " stop" : " stops") + (searches ? ", " + searches + (searches === 1 ? " search" : " searches") : "")];
    $("#trailMeta").textContent = parts.join(" · ") + ". " + (live ? (active.status === "paused" ? "Paused." : "Still falling.") : (END_TEXT[t.endReason] || ""));
  }

  /* ---------- the map ---------- */
  function computeLayout(t) {
    var nodes = t.nodes, cm = RH.childrenMap(nodes), dp = RH.depths(nodes);
    var isGl = function (n) { return RH.isGlimpse(n, settings.glimpseSeconds); };
    var wOf = function (n) { return isGl(n) ? BEAD_W : SLOT; };
    var wid = {};
    function W(n) {
      if (wid[n.id] != null) return wid[n.id];
      var kids = cm.kids[n.id] || [], sum = kids.reduce(function (a, k) { return a + W(k); }, 0);
      return (wid[n.id] = Math.max(wOf(n), sum));
    }
    var pos = {};
    function place(n, d, start) {
      var kids = cm.kids[n.id] || [], Wn = W(n);
      if (!kids.length) { pos[n.id] = { x: start + Wn / 2, d: d }; return; }
      var sum = kids.reduce(function (a, k) { return a + W(k); }, 0), cur = start + (Wn - sum) / 2;
      kids.forEach(function (k) { place(k, d + 1, cur); cur += W(k); });
      pos[n.id] = { x: (pos[kids[0].id].x + pos[kids[kids.length - 1].id].x) / 2, d: d };
    }
    var cursor = PADX;
    cm.roots.forEach(function (r, i) { place(r, 0, cursor); cursor += W(r) + (i < cm.roots.length - 1 ? GAPX : 0); });
    var rowFull = {};
    nodes.forEach(function (n) { if (pos[n.id] && !isGl(n)) rowFull[pos[n.id].d] = true; });
    var top = [], y = 0;
    for (var d = 0; d <= dp.max; d++) { top[d] = y; y += rowFull[d] ? ROW_FULL : ROW_BEAD; }
    nodes.forEach(function (n) { var p = pos[n.id]; if (p) p.cy = top[p.d] + (isGl(n) ? BEAD_Y : CY); });
    return { pos: pos, top: top, rowFull: rowFull, maxD: dp.max, width: cursor + PADX, height: y + 12, cm: cm, isGl: isGl };
  }

  function renderMap() {
    var t = curTrail(); if (!t) { svg.innerHTML = ""; return; }
    var ae = document.activeElement, focusId = null;
    if (ae && ae.closest && ae.closest(".node")) focusId = ae.closest(".node").dataset.id;
    var cw = scroller.clientWidth || 600;
    if (!t.nodes.length) {
      svg.setAttribute("width", cw); svg.setAttribute("height", 90); svg.setAttribute("viewBox", "0 0 " + cw + " 90");
      svg.innerHTML = '<text class="band-label" x="24" y="48">Nothing recorded in this trail yet.</text>';
      return;
    }
    var lay = computeLayout(t); layoutCache = lay;
    var recording = active && active.trailId === t.id;
    var W = Math.max(lay.width, cw), off = (W - lay.width) / 2;
    var bands = "", edges = "", out = "", lines = {};
    t.nodes.forEach(function (n) { lines[n.id] = wrap(RH.prettyTitle(n), 18, 3); });
    for (var d = 0; d <= lay.maxD; d++) {
      var h = lay.rowFull[d] ? ROW_FULL : ROW_BEAD;
      if (d % 2 === 0) bands += '<rect class="band" x="0" y="' + lay.top[d] + '" width="' + W + '" height="' + h + '"/>';
      if (d > 0) bands += '<line class="rule" x1="0" x2="' + W + '" y1="' + lay.top[d] + '" y2="' + lay.top[d] + '"/>';
      bands += '<text class="band-label" x="16" y="' + (lay.top[d] + 22) + '">' + esc(chapter(d)) + "</text>";
    }
    t.nodes.forEach(function (n) {
      var p = lay.pos[n.id]; if (!p || !n.parent || !lay.pos[n.parent]) return;
      var pp = lay.pos[n.parent], par = findNode(t.id, n.parent);
      var y0 = pp.cy + (lay.isGl(par) ? BEAD_R + 4 : R + 10 + lines[par.id].length * 17 + 2);
      var y1 = p.cy - (lay.isGl(n) ? BEAD_R + 4 : R + 5);
      var x0 = pp.x + off, x1 = p.x + off, dy = Math.max(14, (y1 - y0) / 2);
      edges += '<path class="thread' + (n.state === "dead" ? " dead" : "") + '" d="M' + x0 + " " + y0 + " C" + x0 + " " + (y0 + dy) + " " + x1 + " " + (y1 - dy) + " " + x1 + " " + y1 + '"/>';
    });
    t.nodes.forEach(function (n) {
      var p = lay.pos[n.id]; if (!p) return;
      var hasKids = !!(lay.cm.kids[n.id] && lay.cm.kids[n.id].length);
      var st = RH.effectiveState(n, hasKids, recording), kind = Art.ICON[n.kind] ? n.kind : "read";
      var sel = n.id === selNode ? " sel" : "";
      var aria = esc(RH.prettyTitle(n) + ", " + KIND_LABEL[kind] + ", " + STATE_LABEL[st] + (n.mattered ? ", marked as mattering" : ""));
      var tr = "translate(" + (p.x + off) + " " + p.cy + ")";
      if (lay.isGl(n)) {
        out += '<g class="node glimpse' + sel + '" data-id="' + esc(n.id) + '" tabindex="0" role="button" aria-label="' + aria + '" transform="' + tr + '">' +
          "<title>" + esc(RH.prettyTitle(n)) + '</title><circle class="halo" r="15"/><circle class="bead" r="' + BEAD_R + '"/></g>';
        return;
      }
      var tsp = lines[n.id].map(function (l, i) { return '<tspan x="0" dy="' + (i ? 17 : 0) + '">' + esc(l) + "</tspan>"; }).join("");
      out += '<g class="node st-' + st + sel + '" data-id="' + esc(n.id) + '" tabindex="0" role="button" aria-label="' + aria + '" transform="' + tr + '">' +
        '<title>' + esc(RH.prettyTitle(n)) + '</title><circle class="halo" r="36"/>' + (st === "falling" ? '<circle class="ring" r="33"/>' : "") +
        '<path class="disc" d="' + SEAL + '"/><circle class="emboss" r="20"/>' +
        '<g class="ico" transform="translate(-12 -12)" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + Art.ICON[kind] + "</g>" +
        (st === "dead" ? '<path class="crack" d="M-9 -24L-2 -8L-10 2L-1 25"/>' : "") +
        (n.mattered ? '<path class="star" d="M21 -26l3.4 4.6-3.4 4.6-3.4-4.6z"/>' : "") +
        (n.returns ? '<g class="ret"><title>Came back here ' + n.returns + (n.returns === 1 ? " time" : " times") + '</title><circle cx="-22" cy="-22" r="9"/><text x="-22" y="-18.5" text-anchor="middle">↺' + (n.returns > 1 ? n.returns : "") + "</text></g>" : "") +
        '<text class="lbl" text-anchor="middle" y="' + (R + 19) + '">' + tsp + "</text></g>";
    });
    svg.setAttribute("width", W); svg.setAttribute("height", lay.height); svg.setAttribute("viewBox", "0 0 " + W + " " + lay.height);
    svg.innerHTML = bands + edges + out;
    if (focusId) {
      var f = svg.querySelector('[data-id="' + (window.CSS && CSS.escape ? CSS.escape(focusId) : focusId) + '"]');
      if (f) f.focus({ preventScroll: true });
    }
  }

  /* ---------- stop details ---------- */
  var HINT = '<div class="hint"><p class="hint-title">Nothing open.</p><p>Pick a seal on the map. Small beads are quick glances. Select one to see what it was.</p></div>';
  function panelHTML() {
    var kinds = Object.keys(KIND_LABEL).map(function (k) { return '<button type="button" data-kind="' + k + '" aria-pressed="false">' + Art.icon(k, 18) + "<span>" + KIND_LABEL[k] + "</span></button>"; }).join("");
    var states = Object.keys(STATE_LABEL).map(function (k) { return '<button type="button" data-state="' + k + '" aria-pressed="false"><span class="dot ' + k + '"></span><span>' + STATE_LABEL[k] + "</span></button>"; }).join("");
    return '<div class="panel-head"><p class="where" id="pWhere"></p><button class="x" type="button" id="pClose" aria-label="Close this stop">×</button></div>' +
      '<label class="fl" for="pTitle">The thing itself</label><input id="pTitle" type="text" maxlength="200">' +
      '<div class="urlrow" style="margin-top:6px"><span class="host" id="pHost"></span><a id="pOpen" href="#" target="_blank" rel="noopener noreferrer">Open the page</a></div>' +
      '<div class="fl" id="kLbl">What kind of stop</div><div class="seg" role="group" aria-labelledby="kLbl">' + kinds + "</div>" +
      '<label class="fl" for="pNote">In the margin</label><textarea id="pNote" maxlength="2000" rows="4" placeholder="What you found, or what is still nagging you"></textarea>' +
      '<div class="fl" id="sLbl">How is it going</div><div class="seg" role="group" aria-labelledby="sLbl">' + states + "</div>" +
      '<div class="fl" id="mLbl">Did it matter?</div><div class="seg" role="group" aria-labelledby="mLbl"><button type="button" data-matter="1" aria-pressed="false"><span>This one mattered</span></button></div>' +
      '<div class="foot-row"><p class="when" id="pWhen"></p><button class="ghost" type="button" id="pSkip">Remove this stop</button></div>';
  }
  function syncPanel() {
    var t = curTrail(), n = t && findNode(t.id, selNode);
    if (!n) { panel.innerHTML = HINT; panel.dataset.for = ""; return; }
    if (panel.dataset.for !== selNode) { panel.innerHTML = panelHTML(); panel.dataset.for = selNode; }
    var d = layoutCache && layoutCache.pos[n.id] ? layoutCache.pos[n.id].d : 0;
    var recording = active && active.trailId === t.id, hasKids = t.nodes.some(function (x) { return x.parent === n.id; });
    var st = RH.effectiveState(n, hasKids, recording);
    $("#pWhere").textContent = chapter(d);
    setField($("#pTitle"), RH.cleanTitle(n.title, n.url) || RH.prettyTitle(n));
    setField($("#pNote"), n.note || "");
    $("#pHost").textContent = n.host || "";
    $("#pOpen").href = n.url || "#";
    panel.querySelectorAll("[data-kind]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.kind === (n.kind || "read"))); });
    panel.querySelectorAll("[data-state]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.state === st)); });
    panel.querySelector("[data-matter]").setAttribute("aria-pressed", String(!!n.mattered));
    var stay = n.dwellMs >= 60000 ? "Stayed about " + RH.fmtDuration(n.dwellMs) : (n.dwellMs >= 8000 ? "Stayed about " + Math.round(n.dwellMs / 1000) + " seconds" : "A quick glance");
    $("#pWhen").textContent = RH.fmtTime(n.createdAt) + " · " + stay + (n.returns ? " · came back " + n.returns + (n.returns === 1 ? " time" : " times") : "");
  }

  /* ---------- patterns and settings ---------- */
  function fmtHour(h) { return h === 0 ? "midnight" : h === 12 ? "noon" : (h % 12) + (h < 12 ? " am" : " pm"); }
  function renderPatterns() {
    var nodes = [];
    trails.forEach(function (t) { t.nodes.forEach(function (n) { nodes.push(n); }); });
    var searches = nodes.filter(function (n) { return n.query; }).length;
    var hours = []; for (var i = 0; i < 24; i++) hours.push(0);
    nodes.forEach(function (n) { hours[new Date(n.createdAt).getHours()]++; });
    var mx = Math.max.apply(null, hours.concat([1])), peak = hours.indexOf(Math.max.apply(null, hours));
    var hc = {};
    nodes.forEach(function (n) { if (!n.query && n.host) hc[n.host] = (hc[n.host] || 0) + 1; });
    var top = Object.keys(hc).sort(function (a, b) { return hc[b] - hc[a]; }).slice(0, 6);
    var bars = "";
    hours.forEach(function (v, h) {
      var ht = Math.round(40 * v / mx);
      bars += '<rect class="bar" x="' + (h * 10 + 1) + '" y="' + (46 - ht) + '" width="8" height="' + Math.max(ht, v ? 1.5 : 0) + '"><title>' + fmtHour(h) + ": " + v + "</title></rect>";
    });
    var labels = [[0, "12a"], [6, "6a"], [12, "noon"], [18, "6p"]].map(function (x) { return '<text x="' + (x[0] * 10 + 1) + '" y="58">' + x[1] + "</text>"; }).join("");
    var enough = trails.length >= 3 && nodes.length >= 15;
    $("#patterns").innerHTML = "<h2>Patterns</h2>" +
      "<p>" + trails.length + (trails.length === 1 ? " trail" : " trails") + " · " + nodes.length + " stops · " + searches + (searches === 1 ? " search" : " searches") + "</p>" +
      (enough ? "<p>Most of your stops land around " + fmtHour(peak) + ".</p>" : '<p class="muted">Too early to say much. Patterns need a handful of trails across a few days.</p>') +
      '<svg class="hist" viewBox="0 0 240 62" role="img" aria-label="Stops by hour of day">' + bars + '<line x1="0" x2="240" y1="46.5" y2="46.5" stroke="var(--rule)"/>' + labels + "</svg>" +
      (top.length ? '<div class="fl">Where you went most</div><ul class="hosts">' + top.map(function (h) { return "<li><span>" + esc(h.replace(/^www\./, "")) + '</span><span class="n">' + hc[h] + "</span></li>"; }).join("") + "</ul>" : "") +
      '<p class="muted" style="margin-top:12px">These counts are worked out here in your browser. Nothing is sent anywhere.</p>';
  }
  function renderSettings() {
    var s = settings;
    var box = confirmAction ? '<div class="delbox"><p>' + esc(confirmAction.text) + '</p><div class="btnrow" style="margin-top:0"><button class="btn danger small" type="button" id="cYes">' + esc(confirmAction.yes) + '</button><button class="btn quiet small" type="button" id="cNo">Keep it</button></div></div>' : "";
    $("#settingsCard").innerHTML = "<h2>Settings and your data</h2>" +
      '<label class="fl" for="sDeny">Sites to skip, one per line</label>' +
      '<textarea id="sDeny" rows="6" spellcheck="false">' + esc((s.deny || []).join("\n")) + "</textarea>" +
      '<p class="muted" style="margin-top:6px">A site is skipped when its address contains the text on a line. Skipped pages are never recorded.</p>' +
      '<div class="two"><div><label class="fl" for="sQuiet">End a trail after (minutes quiet)</label><input id="sQuiet" type="number" min="5" max="240" value="' + esc(s.quietMinutes) + '"></div>' +
      '<div><label class="fl" for="sGlimpse">A glance is under (seconds)</label><input id="sGlimpse" type="number" min="0" max="120" value="' + esc(s.glimpseSeconds) + '"></div></div>' +
      '<div class="btnrow"><button class="btn small" type="button" id="sSave">Save settings</button><button class="linkbtn" type="button" id="sReset">Restore the defaults</button></div>' +
      '<div class="fl" style="margin-top:22px">Your data</div>' +
      '<div class="btnrow" style="margin-top:0"><button class="btn quiet small" type="button" id="exportAll">Export everything</button>' +
      '<button class="ghost" type="button" id="delTrail">Delete this trail</button><button class="ghost" type="button" id="forgetAll">Forget everything</button></div>' + box;
  }

  /* ---------- render everything ---------- */
  function renderAll() {
    var has = trails.length > 0;
    $("#emptyBook").hidden = has;
    $("#trailView").hidden = !has;
    $("#lower").hidden = !has;
    $("#picker").hidden = !has;
    if (!has) return;
    renderPicker();
    var t = curTrail(); if (!t) return;
    renderHead(t);
    renderMap();
    syncPanel();
    if (!document.activeElement || !document.activeElement.closest || !document.activeElement.closest("#settingsCard")) { renderSettings(); }
    renderPatterns();
  }

  /* ---------- events ---------- */
  $("#picker").addEventListener("click", function (e) {
    var b = e.target.closest("[data-trail]"); if (!b) return;
    flushAll(); selTrail = b.dataset.trail; selNode = null; confirmAction = null;
    history.replaceState(null, "", "#" + selTrail);
    renderAll();
  });
  svg.addEventListener("click", function (e) {
    var g = e.target.closest(".node"); if (!g) return;
    flushAll(); selNode = g.dataset.id; renderMap(); syncPanel();
  });
  svg.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var g = e.target.closest && e.target.closest(".node");
    if (g) { e.preventDefault(); flushAll(); selNode = g.dataset.id; renderMap(); syncPanel(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && selNode && !/^(INPUT|TEXTAREA)$/.test((e.target || {}).tagName || "")) { flushAll(); selNode = null; renderMap(); syncPanel(); }
  });
  panel.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b || !selNode) return;
    var t = curTrail(); if (!t) return;
    if (b.dataset.kind) { draftNode(t.id, selNode, { kind: b.dataset.kind }); flushAll(); renderMap(); syncPanel(); }
    else if (b.dataset.state) { draftNode(t.id, selNode, { state: b.dataset.state }); flushAll(); renderMap(); syncPanel(); }
    else if (b.dataset.matter) { var n = findNode(t.id, selNode); draftNode(t.id, selNode, { mattered: !n.mattered }); flushAll(); renderMap(); syncPanel(); }
    else if (b.id === "pClose") { flushAll(); selNode = null; renderMap(); syncPanel(); }
    else if (b.id === "pSkip") {
      var id = selNode; flushAll(); selNode = null;
      send({ type: "deleteNode", trailId: t.id, nodeId: id }).then(function () { toast("Stop removed."); });
      t.nodes = t.nodes.filter(function (x) { return x.id !== id; });
      renderAll();
    }
  });
  panel.addEventListener("input", function (e) {
    var t = curTrail(); if (!t || !selNode) return;
    if (e.target.id === "pTitle") draftNode(t.id, selNode, { title: e.target.value });
    else if (e.target.id === "pNote") draftNode(t.id, selNode, { note: e.target.value });
  });
  $("#trailHead").addEventListener("input", function (e) {
    var t = curTrail(); if (!t) return;
    if (e.target.id === "tTitle") draftTrail(t.id, { title: e.target.value });
    else if (e.target.id === "tLanding") draftTrail(t.id, { landing: e.target.value });
  });
  document.addEventListener("focusout", function (e) {
    if (e.target && /^(pTitle|pNote|tTitle|tLanding)$/.test(e.target.id || "")) flushAll();
  });

  $("#settingsCard").addEventListener("click", async function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.id === "sSave") {
      var deny = $("#sDeny").value.split("\n").map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
      var q = Math.min(240, Math.max(5, parseInt($("#sQuiet").value, 10) || 45));
      var g = Math.min(120, Math.max(0, parseInt($("#sGlimpse").value, 10) || 0));
      await chrome.storage.local.set({ settings: { deny: deny, quietMinutes: q, glimpseSeconds: g } });
      toast("Settings saved.");
    } else if (b.id === "sReset") {
      await chrome.storage.local.set({ settings: RH.DEFAULT_SETTINGS });
      toast("Defaults restored.");
    } else if (b.id === "exportAll") {
      var data = { app: "Rabbit Hole", version: 1, exportedAt: new Date().toISOString(), settings: settings, trails: trails };
      var url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      var a = document.createElement("a");
      a.href = url; a.download = "rabbit-hole-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    } else if (b.id === "delTrail") {
      confirmAction = { text: "This trail and everything on its map will be deleted.", yes: "Delete the trail", run: async function () { var id = selTrail; selNode = null; selTrail = null; await send({ type: "deleteTrail", trailId: id }); toast("Trail deleted."); } };
      renderSettings();
    } else if (b.id === "forgetAll") {
      confirmAction = { text: "Every trail will be deleted from this browser. Your settings stay.", yes: "Forget everything", run: async function () { selNode = null; selTrail = null; await send({ type: "forgetAll" }); toast("All trails forgotten."); } };
      renderSettings();
    } else if (b.id === "cNo") {
      confirmAction = null; renderSettings();
    } else if (b.id === "cYes" && confirmAction) {
      var act = confirmAction; confirmAction = null; await act.run(); await load();
    }
  });

  var reloadT;
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    clearTimeout(reloadT);
    reloadT = setTimeout(load, 200);
  });
  addEventListener("hashchange", function () {
    var h = decodeURIComponent((location.hash || "").slice(1));
    if (h && trails.some(function (t) { return t.id === h; })) { selTrail = h; selNode = null; renderAll(); }
  });
  var rz; addEventListener("resize", function () { cancelAnimationFrame(rz); rz = requestAnimationFrame(function () { if (curTrail()) renderMap(); }); });

  load();
})();

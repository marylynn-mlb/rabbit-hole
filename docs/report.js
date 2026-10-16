/* The reading page. Draws the report from RA.analyze(); no network, nothing written. */
(function () {
  "use strict";
  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function short(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1).trim() + "…" : s; }
  function dur(ms) {
    var m = Math.round(ms / 60000);
    if (m < 1) return Math.max(1, Math.round(ms / 1000)) + " s";
    if (m < 60) return m + " min";
    return Math.floor(m / 60) + "h " + (m % 60 ? (m % 60) + "m" : "");
  }
  function secs(s) { return s < 60 ? s + " s" : Math.floor(s / 60) + " min" + (s % 60 ? " " + (s % 60) + " s" : ""); }
  function when(ts) { return new Date(ts).toLocaleDateString(undefined, { weekday: "short" }) + " " + RA.clock(ts); }
  function joinList(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  var days = 7, settings = { glimpseSeconds: 8 }, trails = [];

  $("#mascot").innerHTML = Art.mascot("Alice, the rabbit");
  $("#plate").innerHTML = Art.plateArt();
  $("#divider").innerHTML = Art.dividerArt();

  function startsLine(S, n) {
    if (S.startsOnPage && S.startsOnSearch) return plural(S.startsOnPage, "trail", "trails") + " began on a page you were already reading and " + S.startsOnSearch + " began on a search.";
    if (S.startsOnPage) return (n === 1 ? "It" : "All of them") + " began on a page you were already reading.";
    return (n === 1 ? "It" : "All of them") + " began on a search.";
  }
  function cls(s, g) { return s < g ? "g" : s < 60 ? "s" : s < 300 ? "r" : "d"; }

  function render() {
    var R = RA.analyze(trails, { days: days || 0, glimpseSeconds: settings.glimpseSeconds });
    var out = $("#out"), g = settings.glimpseSeconds;
    $("#sub").textContent = R.trails ? "A reading of " + (days ? "the last " + days + " days" : "everything so far") + ", " + plural(R.trails, "trail", "trails") : "A reading of your trails";

    if (!R.trails) {
      out.innerHTML = '<section class="empty-book"><div class="mascot" id="m2"></div><h2>Nothing to read yet.</h2><p class="muted">' +
        (R.liveTrails ? "Your trail is still falling. Surface from the side panel and it will appear here." : "Finish a trail or two, then come back. Try a longer period above if you have older ones.") + "</p></section>";
      $("#m2").innerHTML = Art.mascot("Alice, the rabbit");
      return;
    }
    var S = R.stats, h = "";

    /* the shape of it */
    h += '<h2 class="sec">The shape of it</h2>';
    h += '<div class="framed card"><div class="stats">' +
      '<div class="stat"><b>' + R.trails + "</b><span>trails</span></div>" +
      '<div class="stat"><b>' + S.stops + "</b><span>stops</span></div>" +
      '<div class="stat"><b>' + S.searches + "</b><span>searches</span></div>" +
      '<div class="stat"><b>' + esc(dur(S.activeMs)) + "</b><span>on pages</span></div>" +
      '<div class="stat"><b>' + S.sites + "</b><span>different sites</span></div>" +
      (S.returns ? '<div class="stat"><b>' + S.returns + "</b><span>times you went back</span></div>" : "") +
      "</div>" +
      '<p style="margin-top:14px">' + S.glimpsePct + "% of your page stops were glimpses of under " + g + " seconds. " + startsLine(S, R.trails) + "</p></div>";

    /* ways of moving + beads */
    h += '<div class="framed card"><h3>How you moved</h3>';
    var m = [];
    if (R.modes.flips.length) m.push("You flipped quickly through " + joinList(R.modes.flips.map(function (r) { return "“" + short(r.title, 46) + "” (" + r.stops + " stops, median " + Math.round(r.median) + " seconds)"; })) + ".");
    if (R.modes.reads.length) m.push("You read slowly in " + joinList(R.modes.reads.map(function (r) { return "“" + short(r.title, 46) + "” (median " + secs(Math.round(r.median)) + ")"; })) + ".");
    if (m.length) h += "<p>" + esc(m.join(" ")) + "</p>";
    h += '<p class="muted">Each bead is a stop, in the order you reached it. Bigger means you stayed longer.</p>' +
      '<div class="key"><span><i class="bd g"></i> glimpse</span><span><i class="bd s"></i> skim, under 1 min</span><span><i class="bd r"></i> read, 1 to 5 min</span><span><i class="bd d"></i> deep, over 5 min</span>' +
      '<span><i class="sw search"></i> began on a search</span><span><i class="sw page"></i> began on a page</span></div>';
    var last = "";
    R.rows.forEach(function (r) {
      if (r.day !== last) { h += '<div class="day">' + esc(r.day) + "</div>"; last = r.day; }
      var beads = r.dwell.map(function (s) { return '<i class="bd ' + cls(s, g) + '" title="' + esc(secs(s)) + '"></i>'; }).join("");
      h += '<div class="rw ' + r.startedOn + '"><div class="lab"><b>' + esc(short(r.title, 70)) + "</b><i>" + esc(RA.clock(r.start)) + " · " + plural(r.stops, "stop", "stops") + " · " + (r.minutes < 1 ? "under 1 min" : Math.round(r.minutes) + " min") + '</i></div><div class="beads">' + beads + "</div></div>";
    });
    h += "</div>";

    /* where you stayed */
    h += '<h2 class="sec">Where you stayed</h2>';
    h += '<div class="framed card"><h3>Sites by time on page</h3>';
    var mx = Math.max.apply(null, R.hosts.map(function (x) { return x.ms; }).concat([1]));
    h += '<div class="bars">' + R.hosts.map(function (x) {
      return '<div class="bar"><span class="name">' + esc(x.host) + '</span><div class="track"><div class="fill" style="width:' + (100 * x.ms / mx).toFixed(1) + '%"></div></div><span class="v">' + esc(dur(x.ms)) + " · " + plural(x.trails, "trail", "trails") + "</span></div>";
    }).join("") + "</div>";
    if (R.longReads.length) {
      h += '<h3 style="margin-top:20px">Longest reads</h3><ul class="plain">' + R.longReads.map(function (x) {
        return '<li><span class="what">' + esc(short(x.label, 90)) + '</span><span class="when">' + esc(dur(x.ms)) + " · " + esc(x.host) + " · " + esc(when(x.ts)) + "</span></li>";
      }).join("") + "</ul>";
    }
    h += "</div>";

    /* connections */
    h += '<h2 class="sec">What came back</h2><p class="secnote">Matched by code, not interpreted. Open a word to see every stop it came from.</p>';
    if (R.returningWords.length) {
      h += '<div class="framed card"><h3>Words that came back</h3><p class="muted">Words that showed up in the pages and searches of more than one trail, on more than one day. Everyday words are skipped.</p><div class="chips">' +
        R.returningWords.map(function (w) {
          return '<details class="word"><summary>' + esc(w.terms.join(" · ")) + "<span>" + plural(w.trails, "trail", "trails") + " over " + plural(w.days, "day", "days") + "</span></summary><ul>" +
            w.stops.map(function (s) { return "<li>" + (s.query ? "searched “" : "") + esc(short(s.label, 80)) + (s.query ? "”" : "") + ' <span class="when">' + esc(when(s.ts)) + "</span></li>"; }).join("") + "</ul></details>";
        }).join("") + "</div></div>";
    } else {
      h += '<div class="framed card"><p class="muted">No word has come back across days yet. This needs at least three trails over two days.</p></div>';
    }
    if (R.seenThenSought.length) {
      h += '<div class="framed card"><h3>Seen in passing, then searched for</h3><p class="muted">Something you came across inside one trail, which later became its own search.</p><ul class="plain">' +
        R.seenThenSought.map(function (x) {
          var gap = x.gapMs >= 36e5 * 2 ? Math.round(x.gapMs / 36e5) + " hours" : Math.round(x.gapMs / 60000) + " minutes";
          return '<li><span class="what">“' + esc(x.query) + '”</span>' +
            "You came across <b>" + esc(x.terms.slice(0, 2).join(" and ")) + "</b> in “" + esc(short(x.seen, 80)) + "” (" + esc(when(x.seenTs)) + (x.seenTrail ? ", in the trail “" + esc(short(x.seenTrail, 40)) + "”" : "") + "). " + esc(gap) + " later you searched for it.</li>";
        }).join("") + "</ul></div>";
    }

    /* in time */
    h += '<h2 class="sec">In time</h2>';
    if (R.sessions.length) {
      h += '<div class="framed card"><h3>Sittings</h3><p class="muted">Trails that ran back to back, less than 20 minutes apart.</p><ul class="plain">' + R.sessions.map(function (s) {
        return '<li><span class="what">' + esc(s.when) + ", " + esc(s.from) + " to " + esc(s.to) + '</span><span class="when">' + plural(s.trails.length, "trail", "trails") + " · " + esc(dur(s.activeMs)) + " on pages" +
          (s.breaks.length ? " · " + esc(s.breaks.map(dur).join(", ")) + " break" : "") + "</span><br>" + esc(joinList(s.trails.map(function (t) { return "“" + short(t, 46) + "”"; }))) + "</li>";
      }).join("") + "</ul></div>";
    } else {
      h += '<div class="framed card"><p class="muted">No two trails ran back to back in this period.</p></div>';
    }
    if (S.days >= 5) {
      var mxh = Math.max.apply(null, R.hours.concat([1])), bars = "";
      R.hours.forEach(function (v, i) { var ht = Math.round(40 * v / mxh); bars += '<rect class="b" x="' + (i * 10 + 1) + '" y="' + (46 - ht) + '" width="8" height="' + Math.max(ht, v ? 1.5 : 0) + '"><title>' + i + ":00 – " + v + " stops</title></rect>"; });
      var lbl = [[0, "12a"], [6, "6a"], [12, "noon"], [18, "6p"]].map(function (x) { return '<text x="' + (x[0] * 10 + 1) + '" y="58">' + x[1] + "</text>"; }).join("");
      h += '<div class="framed card"><h3>Time of day</h3><svg class="hist" viewBox="0 0 240 60" role="img" aria-label="Stops by hour of the day">' + bars + lbl + "</svg></div>";
    } else {
      h += '<div class="framed card"><h3>Time of day</h3><p class="muted">Too early to say. This appears once you have stops on at least five different days (so far: ' + S.days + ").</p></div>";
    }

    /* loose ends */
    h += '<h2 class="sec">Loose ends</h2>';
    if (R.loose.length) {
      h += '<div class="framed card"><ul class="plain">' + R.loose.map(function (l) {
        if (l.kind === "search") return '<li><span class="what">“' + esc(short(l.text, 80)) + '”</span>You searched this (' + esc(when(l.ts)) + ") and left" + (l.secs ? " after " + l.secs + " seconds" : "") + " without opening a result.</li>";
        if (l.kind === "dead") return '<li><span class="what">' + esc(short(l.text, 80)) + "</span>This page didn’t load (" + esc(when(l.ts)) + ").</li>";
        return '<li><span class="what">' + esc(short(l.text, 80)) + "</span>You went through " + l.count + " pages on " + esc(l.host) + " in " + esc(secs(l.secs)) + " (" + esc(when(l.ts)) + "), without staying more than half a minute on any.</li>";
      }).join("") + "</ul></div>";
    } else {
      h += '<div class="framed card"><p class="muted">Nothing left hanging in this period.</p></div>';
    }

    /* what Claude could add */
    h += '<div class="framed card soon"><h3>A reading from Claude</h3><p>This page names what it can count. It does not tell you what the trails mean. An optional Claude step could name the threads running between trails and ask you questions about them. It isn’t set up, and nothing is sent anywhere unless you choose that.</p></div>';

    /* limits */
    h += '<h2 class="sec">What this can’t tell you yet</h2><div class="framed card"><ul class="limits">';
    h += "<li><b>Only trails you started are here.</b> The extension records after you press start" + (S.startsOnPage > S.startsOnSearch ? ", and most of yours (" + S.startsOnPage + " of " + R.trails + ") began on a page, not a search" : "") + ". Holes you fell into without pressing start aren’t counted.</li>";
    h += "<li><b>" + (S.days < 5 ? "This is " + plural(S.days, "day", "days") + " of data, so expect repeats, not habits." : "Patterns across weeks are firmer than patterns across days.") + "</b> A word that comes back is a lead, not a conclusion.</li>";
    h += "<li><b>It reads titles and search words, not pages.</b> Time on a page is the only hint of how closely you read it.</li>";
    if (R.liveTrails) h += "<li>A trail that is still falling isn’t counted until you surface.</li>";
    h += "</ul></div>";

    out.innerHTML = h;
  }

  $("#range").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-days]"); if (!b) return;
    days = parseInt(b.dataset.days, 10);
    document.querySelectorAll("#range button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    render();
  });

  (async function () {
    try { settings = await RH.getSettings(); trails = await RH.getAllTrails(); } catch (e) { trails = []; }
    render();
  })();
})();

/* Rabbit Hole: the report you can get without any AI.
   Everything here is counted or matched by plain code, so every line can be checked against the log.
   Input is the list of saved trails. Nothing here touches the network or storage. */
var RA = (function () {
  "use strict";

  var SESSION_GAP_MS = 20 * 60000;      // trails closer together than this count as one sitting
  var FLIP_DWELL_S = 30, FLIP_MIN_RUN = 6;
  var LONG_READ_S = 180;

  /* Words that carry no subject. Site furniture and function words. */
  var STOP = (
    "the and for with from that this what why how are was were you your our not but all any can will its it's " +
    "of to in on at by an as or is be if so do no up out about into over than then them they their there here " +
    "home page pages new best top more most one two three index main login log sign blog news article articles " +
    "free download borrow streaming internet archive wikipedia flickr substack pinterest youtube google search results " +
    "com org net www http https html pdf amp via vs part series post posts read reading view collection collections digital " +
    "library books book online catalog record guide guides example examples explained work works " +
    "need needs try make makes use used using get gets know way ways good great key tips ultimate introduction complete full early late"
  ).split(" ").reduce(function (o, w) { o[w] = 1; return o; }, {});
  /* "work" is a real subject for some people, so keep it out of the stop list. */
  delete STOP.work; delete STOP.works;

  function stem(w) {
    if (w.length > 4 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function words(text) {
    return String(text || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(function (w) {
      return w.length >= 2 && !/^\d+$/.test(w);
    });
  }
  function labelOf(n) {
    if (n.query) return n.query;
    var t = (typeof RH !== "undefined" && RH.cleanTitle) ? RH.cleanTitle(n.title, n.url) : (n.title || "");
    if (t) return t;
    try { var u = new URL(n.url); return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : ""); } catch (e) { return n.url || "A page"; }
  }
  function hostOf(n) { return String(n.host || "").replace(/^www\./, ""); }

  /* Title text with the site name stripped, and the site's own words removed. */
  function termsFor(n) {
    var text;
    if (n.query) text = n.query;
    else {
      text = (typeof RH !== "undefined" && RH.cleanTitle) ? RH.cleanTitle(n.title, n.url) : (n.title || "");
      var parts = text.split(" | ");
      if (parts.length > 1) parts.pop();
      text = parts.join(" ");
    }
    var hostWords = {};
    words(hostOf(n)).forEach(function (w) { hostWords[stem(w)] = 1; });
    var out = [];
    words(text).forEach(function (w) {
      if (STOP[w]) return;
      var s = stem(w);
      if (STOP[s] || hostWords[s]) return;
      if (out.indexOf(s) === -1) out.push(s);
    });
    return out;
  }

  function median(a) {
    if (!a.length) return 0;
    var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function dayName(ts) { return new Date(ts).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); }
  function weekday(ts) { return new Date(ts).toLocaleDateString(undefined, { weekday: "long" }); }
  function partOfDay(ts) { var h = new Date(ts).getHours(); return h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night"; }
  function clock(ts) { return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase(); }

  function analyze(allTrails, opts) {
    opts = opts || {};
    var glimpseS = opts.glimpseSeconds || 8;
    var now = opts.now || Date.now();
    var since = opts.days ? now - opts.days * 86400000 : 0;

    var live = 0;
    var trails = (allTrails || []).filter(function (t) {
      if (!t || !t.nodes || !t.nodes.length) return false;
      if (t.state === "recording") { live++; return false; }
      return (t.startedAt || 0) >= since;
    }).sort(function (a, b) { return a.startedAt - b.startedAt; });

    trails.forEach(function (t) {
      t._nodes = t.nodes.slice().sort(function (a, b) { return a.createdAt - b.createdAt; });
      var last = t._nodes[t._nodes.length - 1];
      t._end = last.createdAt + (last.dwellMs || 0);
      t._dwell = t._nodes.reduce(function (s, n) { return s + (n.dwellMs || 0); }, 0);
    });

    var R = { trails: trails.length, liveTrails: live, since: since };
    var all = [];
    trails.forEach(function (t) { t._nodes.forEach(function (n) { all.push({ t: t, n: n }); }); });

    /* ---- the shape of it ---- */
    var hosts = {}, glimpses = 0, searches = 0, returns = 0, days = {};
    all.forEach(function (x) {
      hosts[hostOf(x.n)] = 1;
      if (x.n.query) searches++;
      else if ((x.n.dwellMs || 0) < glimpseS * 1000) glimpses++;
      returns += x.n.returns || 0;
      days[dayKey(x.n.createdAt)] = 1;
    });
    var nonQuery = all.filter(function (x) { return !x.n.query; }).length;
    var starts = { search: 0, page: 0 };
    trails.forEach(function (t) { starts[t._nodes[0].query ? "search" : "page"]++; });
    R.stats = {
      stops: all.length, searches: searches, sites: Object.keys(hosts).length,
      activeMs: trails.reduce(function (s, t) { return s + t._dwell; }, 0),
      glimpses: glimpses, glimpsePct: nonQuery ? Math.round(100 * glimpses / nonQuery) : 0,
      returns: returns, days: Object.keys(days).length, startsOnSearch: starts.search, startsOnPage: starts.page,
      first: trails.length ? trails[0].startedAt : null, last: trails.length ? trails[trails.length - 1]._end : null
    };

    /* ---- one row per trail, for the bead chart ---- */
    R.rows = trails.map(function (t) {
      var d = t._nodes.map(function (n) { return Math.round((n.dwellMs || 0) / 1000); });
      return {
        id: t.id, title: (t.title && !t.titleAuto ? t.title : labelOf(t._nodes[0])), start: t.startedAt, end: t._end,
        stops: d.length, minutes: t._dwell / 60000, dwell: d, median: median(d),
        startedOn: t._nodes[0].query ? "search" : "page", day: dayName(t.startedAt)
      };
    });

    /* ---- two ways of moving ---- */
    R.modes = {
      flips: R.rows.filter(function (r) { return r.stops >= 15 && r.median < 5; }),
      reads: R.rows.filter(function (r) { return r.median >= 60; })
    };
    R.longReads = all.filter(function (x) { return !x.n.query && (x.n.dwellMs || 0) >= LONG_READ_S * 1000; })
      .sort(function (a, b) { return b.n.dwellMs - a.n.dwellMs; }).slice(0, 6)
      .map(function (x) { return { label: labelOf(x.n), host: hostOf(x.n), ms: x.n.dwellMs, ts: x.n.createdAt, trail: x.t.title || "" }; });

    /* ---- where you stayed ---- */
    var hostMs = {};
    all.forEach(function (x) {
      var h = hostOf(x.n);
      if (/(^|\.)google\.[a-z.]+$/.test(h)) return;
      var o = hostMs[h] || (hostMs[h] = { host: h, ms: 0, stops: 0, trails: {} });
      o.ms += x.n.dwellMs || 0; o.stops++; o.trails[x.t.id] = 1;
    });
    R.hosts = Object.keys(hostMs).map(function (h) { var o = hostMs[h]; return { host: h, ms: o.ms, stops: o.stops, trails: Object.keys(o.trails).length }; })
      .sort(function (a, b) { return b.ms - a.ms; }).slice(0, 7);

    /* ---- sittings: trails that ran back to back ---- */
    var sessions = [], cur = null;
    trails.forEach(function (t) {
      if (cur && t.startedAt - cur.end <= SESSION_GAP_MS) { cur.trails.push(t); cur.end = Math.max(cur.end, t._end); }
      else { cur = { start: t.startedAt, end: t._end, trails: [t] }; sessions.push(cur); }
    });
    R.sessions = sessions.filter(function (s) { return s.trails.length >= 2; }).map(function (s) {
      var active = s.trails.reduce(function (a, t) { return a + t._dwell; }, 0), window = s.end - s.start;
      var gaps = []; for (var i = 1; i < s.trails.length; i++) { var g = s.trails[i].startedAt - s.trails[i - 1]._end; if (g > 5 * 60000) gaps.push(g); }
      return {
        when: weekday(s.start) + " " + partOfDay(s.start), from: clock(s.start), to: clock(s.end), start: s.start,
        windowMs: window, activeMs: active, breaks: gaps,
        trails: s.trails.map(function (t) { return t.title && !t.titleAuto ? t.title : labelOf(t._nodes[0]); })
      };
    });

    /* ---- words that came back ---- */
    var termMap = {};
    trails.forEach(function (t) {
      t._nodes.forEach(function (n) {
        termsFor(n).forEach(function (w) {
          var o = termMap[w] || (termMap[w] = { term: w, occ: [], trails: {}, days: {}, surface: {} });
          o.occ.push({ t: t, n: n });
          o.trails[t.id] = 1; o.days[dayKey(n.createdAt)] = 1;
        });
      });
    });
    var N = trails.length;
    R.returningWords = [];
    if (N >= 3) {
      var cands = Object.keys(termMap).map(function (k) { return termMap[k]; }).filter(function (o) {
        var df = Object.keys(o.trails).length, dd = Object.keys(o.days).length;
        return df >= 2 && dd >= 2 && df / N <= 0.6;
      }).map(function (o) {
        var df = Object.keys(o.trails).length, dd = Object.keys(o.days).length;
        var mins = o.occ.reduce(function (m, x) { return m + (x.n.dwellMs || 0); }, 0) / 60000;
        var sought = o.occ.some(function (q) {
          return q.n.query && o.occ.some(function (e) { return !e.n.query && e.t.id !== q.t.id && e.t.startedAt < q.t.startedAt; });
        });
        o.df = df; o.dd = dd; o.score = dd * Math.log(N / df + 1) * Math.min(df, 4) * (1 + Math.log(1 + mins)) * (sought ? 2.5 : 1);
        return o;
      }).sort(function (a, b) { return b.score - a.score; });
      /* Words that always appear together are one idea: group by identical trail sets. */
      var groups = [];
      function stopIds(o) { var m = {}; o.occ.forEach(function (x) { m[x.n.id] = 1; }); return m; }
      function jaccard(a, b) {
        var ia = Object.keys(a), n = 0; ia.forEach(function (k) { if (b[k]) n++; });
        var u = ia.length + Object.keys(b).length - n; return u ? n / u : 0;
      }
      cands.forEach(function (o) {
        o._ids = stopIds(o);
        var home = groups.filter(function (g) { return jaccard(g[0]._ids, o._ids) >= 0.6; })[0];
        if (home) home.push(o); else groups.push([o]);
      });
      groups.sort(function (a, b) { return b[0].score - a[0].score; }).slice(0, 8).forEach(function (g) {
          var seen = {}, stops = [];
          g.forEach(function (o) { o.occ.forEach(function (x) { if (!seen[x.n.id]) { seen[x.n.id] = 1; stops.push(x); } }); });
          stops.sort(function (a, b) { return a.n.createdAt - b.n.createdAt; });
          R.returningWords.push({
            terms: g.slice(0, 3).map(function (o) { return o.term; }), trails: g[0].df, days: g[0].dd,
            first: stops[0].n.createdAt, last: stops[stops.length - 1].n.createdAt,
            stops: stops.slice(0, 40).map(function (x) { return { label: labelOf(x.n), ts: x.n.createdAt, trail: x.t.title || "", query: !!x.n.query, host: hostOf(x.n) }; })
          });
        });
    }

    /* ---- seen in passing, then searched for ---- */
    R.seenThenSought = [];
    var seenQ = {};
    all.forEach(function (x) {
      var q = x.n;
      if (!q.query || seenQ[q.query.toLowerCase()]) return;
      var qt = termsFor(q);
      if (!qt.length) return;
      var hits = [];
      qt.forEach(function (w) {
        var o = termMap[w]; if (!o) return;
        if (Object.keys(o.trails).length / Math.max(N, 1) > 0.4) return;
        var earlier = o.occ.filter(function (y) { return !y.n.query && y.t.id !== x.t.id && y.t.startedAt < x.t.startedAt && y.n.createdAt < q.createdAt; })
          .sort(function (a, b) { return a.n.createdAt - b.n.createdAt; })[0];
        if (earlier) hits.push({ term: w, from: earlier });
      });
      if (!hits.length || hits.length / qt.length <= 0.5 && qt.length > 1) return;
      hits.forEach(function (h) { h.df = Object.keys(termMap[h.term].trails).length; });
      hits.sort(function (a, b) { return a.df - b.df || a.from.n.createdAt - b.from.n.createdAt; });
      var f = hits[0].from, pk = x.t.id + "|" + hits[0].term;
      if (seenQ[pk]) return;
      seenQ[pk] = 1; seenQ[q.query.toLowerCase()] = 1;
      R.seenThenSought.push({
        query: q.query, ts: q.createdAt, terms: hits.map(function (h) { return h.term; }),
        seen: labelOf(f.n), seenTs: f.n.createdAt, seenTrail: f.t.title || "", gapMs: q.createdAt - f.n.createdAt
      });
    });
    R.seenThenSought.sort(function (a, b) { return b.gapMs - a.gapMs; });
    R.seenThenSought = R.seenThenSought.slice(0, 5);

    /* ---- loose ends ---- */
    var loose = [];
    trails.forEach(function (t) {
      var kids = {}; t._nodes.forEach(function (n) { if (n.parent) kids[n.parent] = 1; });
      t._nodes.forEach(function (n) {
        if (n.query && !kids[n.id]) loose.push({ kind: "search", ts: n.createdAt, text: n.query, secs: Math.round((n.dwellMs || 0) / 1000) });
        else if (!n.query && /(^|\W)(404|page not found|not found)(\W|$)/i.test(n.title || "")) loose.push({ kind: "dead", ts: n.createdAt, text: labelOf(n) === "(404)" ? hostOf(n) + " (404)" : labelOf(n), host: hostOf(n) });
      });
      var run = [];
      function flush() {
        if (run.length >= FLIP_MIN_RUN) {
          var h = hostOf(run[0]), idx = t._nodes.indexOf(run[0]), titled = null;
          for (var i = idx - 1; i >= 0 && !titled; i--) if (hostOf(t._nodes[i]) === h && t._nodes[i].title) titled = t._nodes[i];
          if (!titled) for (var j = 0; j < run.length && !titled; j++) if (run[j].title) titled = run[j];
          loose.push({ kind: "flip", ts: run[0].createdAt, count: run.length, host: h, text: titled ? labelOf(titled) : h,
            secs: Math.round(run.reduce(function (s, n) { return s + (n.dwellMs || 0); }, 0) / 1000) });
        }
        run = [];
      }
      t._nodes.forEach(function (n) {
        if (!n.query && (n.dwellMs || 0) < FLIP_DWELL_S * 1000 && (!run.length || hostOf(run[0]) === hostOf(n))) run.push(n);
        else { flush(); if (!n.query && (n.dwellMs || 0) < FLIP_DWELL_S * 1000) run.push(n); }
      });
      flush();
    });
    var flips = loose.filter(function (l) { return l.kind === "flip"; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 4);
    R.loose = loose.filter(function (l) { return l.kind !== "flip"; }).concat(flips).sort(function (a, b) { return a.ts - b.ts; });

    /* ---- rhythm ---- */
    var hours = []; for (var h = 0; h < 24; h++) hours.push(0);
    all.forEach(function (x) { hours[new Date(x.n.createdAt).getHours()]++; });
    R.hours = hours;
    return R;
  }

  var api = { analyze: analyze, labelOf: labelOf, termsFor: termsFor, dayName: dayName, clock: clock };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  return api;
})();

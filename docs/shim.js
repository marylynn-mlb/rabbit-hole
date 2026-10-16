/* Lets the real book and report pages run outside Chrome, on sample data.
   Times are shifted by whole days so the newest sample trail ends today and the
   "last 7 days" view has something to show. Nothing is stored or sent anywhere. */
(function () {
  var S = window.__RH_SAMPLE || { trails: [] }, DAY = 864e5, mem = {};
  var maxEnd = 0;
  S.trails.forEach(function (t) { if (t.endedAt > maxEnd) maxEnd = t.endedAt; });
  var shift = Math.floor((Date.now() - maxEnd) / DAY) * DAY;
  S.trails.forEach(function (t) {
    t.startedAt += shift; t.endedAt += shift;
    t.nodes.forEach(function (n) { n.createdAt += shift; if (n.returnedAt) n.returnedAt = n.returnedAt.map(function (x) { return x + shift; }); });
    mem["trail:" + t.id] = t;
  });
  function pick(keys) {
    var out = {};
    if (keys == null) { Object.keys(mem).forEach(function (k) { out[k] = mem[k]; }); return out; }
    [].concat(keys).forEach(function (k) { if (k in mem) out[k] = mem[k]; });
    return out;
  }
  window.chrome = {
    storage: {
      local: {
        get: function (k) { return Promise.resolve(pick(k)); },
        set: function (o) { Object.assign(mem, o); return Promise.resolve(); }
      },
      onChanged: { addListener: function () {} }
    },
    runtime: { sendMessage: function (m, cb) { if (cb) cb({}); }, lastError: null, getURL: function (p) { return p; } },
    tabs: { create: function (o) { location.href = o.url; }, query: function () { return Promise.resolve([]); } }
  };
})();

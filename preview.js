'use strict';

// ==========================================================
// DROPPLAY PREVIEW MODE
// Only turns on when the address ends with ?preview=1
// Example: https://dropplay-lake.vercel.app/?preview=1
// It swaps the real database for fake songs, albums and
// playlists so you can work on the layout. Without
// ?preview=1 this file does nothing and the app is real.
// ==========================================================
(function () {
  if (new URLSearchParams(location.search).get('preview') !== '1') return;

  // Keep preview data apart from your real saved data
  var P = Storage.prototype;
  var _get = P.getItem, _set = P.setItem, _rem = P.removeItem;
  P.getItem = function (k) { return _get.call(this, 'pv_' + k); };
  P.setItem = function (k, v) { return _set.call(this, 'pv_' + k, v); };
  P.removeItem = function (k) { return _rem.call(this, 'pv_' + k); };

  // ----- cover pictures (made on the fly, no internet needed) -----
  function cover(a, b, label) {
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>" +
      "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
      "<stop offset='0' stop-color='" + a + "'/><stop offset='1' stop-color='" + b + "'/>" +
      "</linearGradient></defs><rect width='300' height='300' fill='url(#g)'/>" +
      "<text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' " +
      "font-family='sans-serif' font-weight='800' font-size='110' fill='rgba(255,255,255,0.85)'>" +
      label + "</text></svg>";
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // ----- a short tune so the play button really plays -----
  var toneCache = {};
  function toneUri(freq) {
    if (toneCache[freq]) return toneCache[freq];
    var rate = 8000, secs = 30, n = rate * secs;
    var buf = new Uint8Array(44 + n);
    var dv = new DataView(buf.buffer);
    function txt(o, t) { for (var i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i)); }
    txt(0, 'RIFF'); dv.setUint32(4, 36 + n, true); txt(8, 'WAVE'); txt(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, rate, true); dv.setUint32(28, rate, true);
    dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
    txt(36, 'data'); dv.setUint32(40, n, true);
    var steps = [1, 1.25, 1.5, 1.25];
    for (var i = 0; i < n; i++) {
      var t = i / rate;
      var f = freq * steps[Math.floor(t * 2) % 4];
      var env = 1 - ((t * 2) % 1) * 0.7;
      buf[44 + i] = 128 + Math.round(Math.sin(2 * Math.PI * f * t) * 60 * env);
    }
    var bin = '';
    for (var j = 0; j < buf.length; j += 8192) {
      bin += String.fromCharCode.apply(null, buf.subarray(j, j + 8192));
    }
    toneCache[freq] = 'data:audio/wav;base64,' + btoa(bin);
    return toneCache[freq];
  }

  // ----- fake data (edit freely) -----
  var now = Date.now();

  var DB = { artists: [], albums: [], tracks: [], playlists: [], playlist_tracks: [] };

  [
    ['Nova Lane', 'Dreamy pop from the city.'],
    ['Kairo', 'Warm beats and late sunsets.'],
    ['Mina Vale', 'Soft vocals, big feelings.'],
    ['The Static Bloom', 'Four friends, one garage.'],
    ['Dre Waves', 'Night drives and heavy bass.'],
    ['Luma', 'Calm sounds for slow days.']
  ].forEach(function (a, i) {
    DB.artists.push({
      id: 'ar' + (i + 1), name: a[0], bio: a[1], verified: i < 3,
      image_url: cover('#FF8A00', '#E91E63', a[0].charAt(0)), created_at: now - i * 7200000
    });
  });

  var ALBUM_COLORS = [
    ['#FF512F', '#DD2476'], ['#F9D423', '#FF4E50'], ['#7F00FF', '#E100FF'],
    ['#11998E', '#38EF7D'], ['#2193B0', '#6DD5ED'], ['#434343', '#000000']
  ];
  [
    ['Neon Mornings', 'ar1', '2026-03-14'],
    ['Golden Hour Tapes', 'ar2', '2026-01-30'],
    ['Paper Planets', 'ar3', '2025-11-08'],
    ['Static Bloom', 'ar4', '2025-08-22'],
    ['Low Tide', 'ar6', '2026-05-02'],
    ['City Lights EP', 'ar5', '2026-06-19']
  ].forEach(function (al, i) {
    DB.albums.push({
      id: 'al' + (i + 1), title: al[0], artist_id: al[1], release_date: al[2],
      cover_url: cover(ALBUM_COLORS[i][0], ALBUM_COLORS[i][1], al[0].charAt(0)),
      created_at: now - i * 86400000
    });
  });

  // title, artist, album (or null for a single), plays, pitch
  [
    ['Neon Mornings', 'ar1', 'al1', 48210, 220], ['Slow Motion', 'ar1', 'al1', 31200, 247],
    ['Afterglow', 'ar1', 'al1', 22950, 262], ['Paper Hearts', 'ar1', 'al1', 17400, 196],
    ['Golden Hour', 'ar2', 'al2', 39880, 233], ['Sunday Drive', 'ar2', 'al2', 26100, 208],
    ['Tape Hiss', 'ar2', 'al2', 9800, 175],
    ['Paper Planets', 'ar3', 'al3', 27650, 294], ['Window Seat', 'ar3', 'al3', 15020, 262],
    ['Soft Landing', 'ar3', 'al3', 12480, 220],
    ['Static Bloom', 'ar4', 'al4', 18300, 247], ['Overgrown', 'ar4', 'al4', 11200, 196],
    ['Low Tide', 'ar6', 'al5', 21400, 233], ['Salt & Sun', 'ar6', 'al5', 14900, 277],
    ['Drift', 'ar6', 'al5', 8300, 208],
    ['City Lights', 'ar5', 'al6', 52300, 185], ['Midnight Run', 'ar5', 'al6', 33700, 165],
    ['Take Me Out', 'ar5', null, 41500, 220], ['Echoes', 'ar1', null, 7600, 247]
  ].forEach(function (t, i) {
    var album = t[2] ? DB.albums.filter(function (a) { return a.id === t[2]; })[0] : null;
    DB.tracks.push({
      id: 't' + (i + 1), title: t[0], artist_id: t[1], album_id: t[2], plays: t[3], _f: t[4],
      cover_url: album ? album.cover_url : cover('#FDC830', '#F37335', t[0].charAt(0)),
      created_at: now - i * 3600000
    });
  });

  var PL_COLORS = [['#8E2DE2', '#4A00E0'], ['#F85032', '#E73827'], ['#56CCF2', '#2F80ED'],
    ['#F7971E', '#FFD200'], ['#00B09B', '#96C93D'], ['#614385', '#516395']];
  [
    ['Late Night Drive', [16, 17, 1, 3, 13, 19]],
    ['Gym Energy', [18, 16, 17, 11, 5]],
    ['Chill Vibes', [13, 14, 15, 9, 10, 7]],
    ['New This Week', [1, 5, 8, 13, 16, 18]],
    ['Road Trip', [6, 5, 2, 14, 18, 4]],
    ['Focus', [15, 10, 12, 7, 9]]
  ].forEach(function (pl, i) {
    var id = 'pl' + (i + 1);
    DB.playlists.push({
      id: id, name: pl[0], created_at: now - i * 86400000,
      cover_url: cover(PL_COLORS[i][0], PL_COLORS[i][1], '\u266A')
    });
    pl[1].forEach(function (n, pos) {
      DB.playlist_tracks.push({ playlist_id: id, track_id: 't' + n, position: pos + 1 });
    });
  });

  // ----- a fake "database" that answers the same questions -----
  function find(table, id) {
    return (DB[table] || []).filter(function (r) { return r.id === id; })[0] || null;
  }
  function clone(row) {
    var c = Object.assign({}, row);
    delete c._f;
    if (row._f) {
      Object.defineProperty(c, 'audio_url', {
        enumerable: true, configurable: true, get: function () { return toneUri(row._f); }
      });
    }
    return c;
  }
  function joined(table, row) {
    var c = clone(row);
    if (table === 'tracks' || table === 'albums') {
      var ar = find('artists', row.artist_id);
      c.artists = { name: ar ? ar.name : 'Unknown Artist' };
    }
    if (table === 'playlist_tracks') {
      var tr = find('tracks', row.track_id);
      c.tracks = tr ? joined('tracks', tr) : null;
    }
    return c;
  }

  function run(q) {
    var list = DB[q.table];
    if (!list) return { data: null, error: { message: 'No table ' + q.table } };
    var rows = list.slice();
    q.filters.forEach(function (f) {
      rows = rows.filter(function (r) {
        if (f[0] === 'eq') return String(r[f[1]]) === String(f[2]);
        return String(r[f[1]] || '').toLowerCase() === String(f[2]).replace(/%/g, '').toLowerCase();
      });
    });

    if (q.op === 'insert') {
      var made = [].concat(q.payload).map(function (p) {
        var row = Object.assign({
          id: q.table.charAt(0) + Date.now() + Math.random().toString(36).slice(2, 5),
          created_at: Date.now(), plays: 0
        }, p);
        list.unshift(row);
        return row;
      });
      return { data: q.single ? made[0] : made, error: null };
    }
    if (q.op === 'update') {
      rows.forEach(function (r) {
        Object.keys(q.payload).forEach(function (k) {
          if (q.payload[k] !== undefined) r[k] = q.payload[k];
        });
      });
      return { data: null, error: null };
    }

    if (q.ord) {
      var k = q.ord[0], d = q.ord[1];
      rows.sort(function (a, b) { return (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * d; });
    }
    if (q.lim) rows = rows.slice(0, q.lim);
    if (q.head) return { data: null, count: rows.length, error: null };

    var out = rows.map(function (r) { return joined(q.table, r); });
    if (q.single) {
      return out[0] ? { data: out[0], error: null } : { data: null, error: { message: 'Not found' } };
    }
    return { data: out, count: out.length, error: null };
  }

  function from(table) {
    var q = { table: table, op: 'select', filters: [], ord: null, lim: null, head: false, single: false, payload: null };
    var chain = {
      select: function (cols, opts) { if (opts && opts.head) q.head = true; return chain; },
      insert: function (p) { q.op = 'insert'; q.payload = p; return chain; },
      update: function (p) { q.op = 'update'; q.payload = p; return chain; },
      eq: function (f, v) { q.filters.push(['eq', f, v]); return chain; },
      ilike: function (f, v) { q.filters.push(['ilike', f, v]); return chain; },
      order: function (f, o) { q.ord = [f, o && o.ascending === false ? -1 : 1]; return chain; },
      limit: function (n) { q.lim = n; return chain; },
      single: function () { q.single = true; return chain; },
      then: function (ok, fail) { return Promise.resolve(run(q)).then(ok, fail); }
    };
    return chain;
  }

  var files = {};
  var fakeDb = {
    from: from,
    storage: {
      from: function () {
        return {
          upload: function (path, file) {
            files[path] = URL.createObjectURL(file);
            return Promise.resolve({ data: { path: path }, error: null });
          },
          getPublicUrl: function (path) { return { data: { publicUrl: files[path] || '' } }; }
        };
      }
    }
  };

  // Hand the fake database to app.js
  window.supabase = window.supabase || {};
  window.supabase.createClient = function () { return fakeDb; };

  // Small badge so you always know you are in preview
  var badge = document.createElement('div');
  badge.textContent = 'PREVIEW';
  badge.style.cssText = 'position:fixed;top:6px;right:8px;z-index:100000;pointer-events:none;' +
    'background:#FFD60A;color:#121212;font:800 9px sans-serif;letter-spacing:1px;' +
    'padding:3px 7px;border-radius:999px;opacity:.9';
  document.body.appendChild(badge);
})();

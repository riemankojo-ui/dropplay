'use strict';

// ==========================================================
// DROPPLAY — one page. Home, Library and Studio are views
// inside this page, so the player never reloads.
// ==========================================================

// ===== Supabase =====
const SUPABASE_URL = 'https://jzmoquqwsymxmkqgxiys.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_WugzrmPmu9M_SyKiKJX7Hw_RWw9MQIJ';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== Small helpers =====
const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>" +
  "<rect width='120' height='120' fill='#333'/>" +
  "<text x='50%' y='56%' dominant-baseline='middle' text-anchor='middle' font-size='48' fill='#888'>♪</text></svg>"
);

const PLAY_SVG  = '<path d="M8 5v14l11-7z"/>';
const PAUSE_SVG = '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>';
const DOTS_SVG  = '<svg viewBox="0 0 24 24"><path d="M12 8a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4z"/></svg>';
const TRASH_SVG = '<svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

function store(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

// ==========================================================
// ROUTER — show one view, hide the others. Player stays put.
// ==========================================================
let currentView = 'home';

function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
  document.querySelectorAll('#bottom-nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  window.scrollTo(0, 0);
  store('dropplay_view', name);

  if (name === 'home') loadTracks();
  if (name === 'library') renderLibrary();
  if (name === 'studio') loadStudioTab(currentStudioTab);
}

document.querySelectorAll('#bottom-nav button').forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// Home sub tabs (only Music is built so far)
document.querySelectorAll('#home-tabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#home-tabs button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const isMusic = btn.dataset.htab === 'music';
    $('home-music').hidden = !isMusic;
    $('home-soon').hidden = isMusic;
  });
});

// ==========================================================
// PLAYER STATE
// ==========================================================
const audioEl      = $('audio');
const playBtn      = $('play-btn');
const playIcon     = $('play-icon');
const playerCover  = $('player-cover');
const playerTitle  = $('player-title');
const playerArtist = $('player-artist');
const miniPlayer   = $('mini-player');

let currentTrack = null;
playerCover.src = FALLBACK;

function markActive() {
  document.querySelectorAll('.track').forEach((row) => {
    row.classList.toggle('active', !!currentTrack && String(row.dataset.id) === String(currentTrack.id));
  });
}

async function countPlay(track) {
  if (!track || !track.id) return;
  try {
    let plays = track.plays;
    if (typeof plays !== 'number') {
      const { data } = await db.from('tracks').select('plays').eq('id', track.id).single();
      plays = (data && data.plays) || 0;
    }
    track.plays = plays + 1;
    await db.from('tracks').update({ plays: plays + 1 }).eq('id', track.id);
  } catch (e) { /* counting a play is never worth breaking playback */ }
}

function playTrack(track, artistName, cover) {
  if (!track.audio_url) { toast('This song has no audio file yet.'); return; }

  currentTrack = track;
  audioEl.src = track.audio_url;
  audioEl.play().catch((err) => { console.error(err); toast('Could not play this song.'); });

  playerCover.src = cover;
  playerTitle.textContent = track.title || 'Untitled';
  playerArtist.textContent = artistName;

  store('dropplay_last', JSON.stringify({ track, artistName, cover }));
  store('dropplay_time', '0');

  markActive();
  countPlay(track);

  if ('mediaSession' in navigator && window.MediaMetadata) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Untitled',
        artist: artistName,
        artwork: [{ src: cover }]
      });
      navigator.mediaSession.setActionHandler('play', () => audioEl.play());
      navigator.mediaSession.setActionHandler('pause', () => audioEl.pause());
    } catch (e) {}
  }
}

playBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!currentTrack) return;
  if (audioEl.paused) audioEl.play().catch(() => {});
  else audioEl.pause();
});

// ==========================================================
// SONG ROWS (shared by Home and Library)
// ==========================================================
function buildRow(track, artistName, cover, onRemove) {
  const el = document.createElement('div');
  el.className = 'track';
  el.dataset.id = track.id;
  el.innerHTML = `
    <img class="track-cover" src="${esc(cover)}" alt="">
    <div class="track-info">
      <div class="track-title">${esc(track.title || 'Untitled')}</div>
      <div class="track-artist">${esc(artistName)}</div>
    </div>
    <button class="track-menu-btn${onRemove ? ' remove' : ''}" aria-label="${onRemove ? 'Remove' : 'More'}">
      ${onRemove ? TRASH_SVG : DOTS_SVG}
    </button>
  `;
  el.querySelector('img').addEventListener('error', (e) => { e.target.src = FALLBACK; }, { once: true });

  el.addEventListener('click', (e) => {
    if (e.target.closest('.track-menu-btn')) return;
    playTrack(track, artistName, cover);
  });
  el.querySelector('.track-menu-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (onRemove) onRemove();
    else openSongSheet(track, artistName, cover);
  });
  return el;
}

// ==========================================================
// HOME
// ==========================================================
const trackListEl = $('track-list');
let lastHomeSig = '';

async function loadTracks() {
  try {
    if (!trackListEl.querySelector('.track')) {
      trackListEl.innerHTML = '<div class="loading">Loading tracks…</div>';
    }

    const { data, error } = await db
      .from('tracks')
      .select('id, title, audio_url, cover_url, plays, artist_id, artists ( name )')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;

    if (!data || data.length === 0) {
      lastHomeSig = '';
      trackListEl.innerHTML = '<div class="empty">No songs yet. Upload your first song in the Studio.</div>';
      return;
    }

    // Do not rebuild the list if nothing changed (keeps taps from being lost)
    const sig = JSON.stringify(data.map((t) => [t.id, t.title, t.cover_url, t.plays]));
    if (sig === lastHomeSig && trackListEl.querySelector('.track')) return;
    lastHomeSig = sig;

    trackListEl.innerHTML = '';
    data.forEach((track) => {
      const artistName = (track.artists && track.artists.name) || 'Unknown Artist';
      const cover = track.cover_url || FALLBACK;
      trackListEl.appendChild(buildRow(track, artistName, cover, null));
    });
    markActive();
  } catch (err) {
    console.error(err);
    if (!trackListEl.querySelector('.track')) {
      trackListEl.innerHTML = '<div class="empty">Could not load songs. Check your connection and try again.</div>';
    }
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && currentView === 'home') loadTracks();
});

// ==========================================================
// LIBRARY (songs saved with Download)
// ==========================================================
const LIB_KEY = 'dropplay_downloads';
const OLD_LIB_KEY = 'droplay_downloads'; // old spelling used by the old Library page

function getLibrary() {
  try {
    const list = JSON.parse(read(LIB_KEY) || '[]');
    const old = JSON.parse(read(OLD_LIB_KEY) || '[]');
    if (old.length) {
      old.forEach((o) => { if (!list.some((t) => t.id === o.id)) list.push(o); });
      store(LIB_KEY, JSON.stringify(list));
      try { localStorage.removeItem(OLD_LIB_KEY); } catch (e) {}
    }
    return list;
  } catch (e) { return []; }
}
function saveLibrary(list) { store(LIB_KEY, JSON.stringify(list)); }

function renderLibrary() {
  const list = getLibrary();
  const wrap = $('lib-list');
  $('count-pill').textContent = list.length + (list.length === 1 ? ' song' : ' songs');

  if (list.length === 0) {
    wrap.innerHTML = `
      <div class="empty">
        Nothing saved yet.<br><br>
        Find a song on the <span class="link" id="go-home">Home</span> tab,<br>
        tap the three dots, then tap <b>Download</b>.
      </div>`;
    const go = $('go-home');
    if (go) go.addEventListener('click', () => showView('home'));
    return;
  }

  wrap.innerHTML = '';
  list.forEach((item) => {
    const cover = item.cover_url || FALLBACK;
    const artistName = item.artist_name || 'Unknown Artist';
    const row = buildRow(item, artistName, cover, () => {
      if (!confirm('Remove "' + (item.title || 'this song') + '" from your library?')) return;
      saveLibrary(getLibrary().filter((t) => t.id !== item.id));
      renderLibrary();
    });
    wrap.appendChild(row);
  });
  markActive();
}

// ==========================================================
// SONG OPTIONS SHEET
// ==========================================================
const sheetBackdrop = $('sheet-backdrop');
const songSheet     = $('song-sheet');
const sheetCover    = $('sheet-cover');
const sheetTitle    = $('sheet-title');
const sheetArtist   = $('sheet-artist');
const downloadLabel = $('download-label');
let sheetTrack = null;

function openSongSheet(track, artistName, cover) {
  sheetTrack = track;
  sheetCover.src = cover;
  sheetTitle.textContent = track.title || 'Untitled';
  sheetArtist.textContent = artistName;
  downloadLabel.textContent = getLibrary().some((t) => t.id === track.id) ? 'Downloaded ✓' : 'Download';
  songSheet.classList.add('open');
  sheetBackdrop.classList.add('open');
}
function closeSongSheet() {
  songSheet.classList.remove('open');
  sheetBackdrop.classList.remove('open');
}
sheetBackdrop.addEventListener('click', closeSongSheet);

$('sheet-download').addEventListener('click', () => {
  if (!sheetTrack) return;
  const list = getLibrary();
  if (list.some((t) => t.id === sheetTrack.id)) {
    toast('Already in your Library ✓');
  } else {
    list.push({
      id: sheetTrack.id,
      title: sheetTrack.title,
      artist_name: sheetArtist.textContent,
      audio_url: sheetTrack.audio_url,
      cover_url: sheetTrack.cover_url,
      artist_id: sheetTrack.artist_id,
      downloaded_at: Date.now()
    });
    saveLibrary(list);
    toast('Saved to Library ✓');
  }
  closeSongSheet();
});

$('sheet-share').addEventListener('click', async () => {
  if (!sheetTrack) return;
  const url = location.href.split('#')[0];
  try {
    if (navigator.share) {
      await navigator.share({
        title: sheetTrack.title,
        text: 'Listen to "' + sheetTrack.title + '" on Dropplay',
        url
      });
    } else {
      await navigator.clipboard.writeText(url);
      toast('Link copied!');
    }
  } catch (e) {}
  closeSongSheet();
});

// ==========================================================
// BIG PLAYER (tap or drag the mini player up, drag down to close)
// ==========================================================
const fullPlayer = $('full-player');
const fpCover  = $('fp-cover');
const fpTitle  = $('fp-title');
const fpArtist = $('fp-artist');
const fpSeek   = $('fp-seek');
const fpCur    = $('fp-cur');
const fpDur    = $('fp-dur');
const fpPlay   = $('fp-play');
const fpIcon   = $('fp-icon');
let fpOpen = false;
let justDragged = false;
fpCover.src = FALLBACK;

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return m + ':' + (r < 10 ? '0' : '') + r;
}

function updatePlayIcon() {
  const svg = audioEl.paused ? PLAY_SVG : PAUSE_SVG;
  playIcon.innerHTML = svg;
  fpIcon.innerHTML = svg;
}

function syncFull() {
  if (fpCover.src !== playerCover.src) fpCover.src = playerCover.src;
  fpTitle.textContent = playerTitle.textContent;
  fpArtist.textContent = playerArtist.textContent;
  fpCur.textContent = fmtTime(audioEl.currentTime);
  fpDur.textContent = fmtTime(audioEl.duration);
  if (audioEl.duration) fpSeek.value = (audioEl.currentTime / audioEl.duration) * 100;
}

['play', 'pause', 'ended'].forEach((ev) => audioEl.addEventListener(ev, () => { updatePlayIcon(); syncFull(); }));
audioEl.addEventListener('loadedmetadata', syncFull);

let lastSavedTime = 0;
audioEl.addEventListener('timeupdate', () => {
  if (fpOpen) syncFull();
  if (Math.abs(audioEl.currentTime - lastSavedTime) > 1) {
    lastSavedTime = audioEl.currentTime;
    store('dropplay_time', String(audioEl.currentTime));
  }
});

fpSeek.addEventListener('input', () => {
  if (audioEl.duration) audioEl.currentTime = (fpSeek.value / 100) * audioEl.duration;
});
fpPlay.addEventListener('click', () => playBtn.click());

function miniTopY() {
  return window.innerHeight - 68 - miniPlayer.offsetHeight;
}

function setFull(open) {
  fpOpen = open;
  fullPlayer.style.transition = '';
  fullPlayer.style.transform = '';
  miniPlayer.style.transition = '';
  miniPlayer.style.transform = '';
  miniPlayer.style.opacity = '';
  miniPlayer.classList.toggle('hide', open);
  fullPlayer.classList.toggle('open', open);
  setTimeout(() => { if (!fpOpen) miniPlayer.style.zIndex = ''; }, 350);
  if (open) syncFull();
}

function addDrag(el) {
  let startY = 0, dy = 0, dragging = false, moved = false;

  el.addEventListener('touchstart', (e) => {
    if (e.target.closest('input')) return;
    if (!fpOpen && !currentTrack) return;
    startY = e.touches[0].clientY;
    dy = 0; moved = false; dragging = true;
    fullPlayer.style.transition = 'none';
    if (!fpOpen) syncFull();
  }, { passive: true });

  el.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    dy = e.touches[0].clientY - startY;
    if (Math.abs(dy) > 6) moved = true;

    const h = window.innerHeight;
    const miniTop = miniTopY();
    const pos = fpOpen ? Math.max(0, dy) : Math.max(0, miniTop + dy);
    const q = Math.max(0, Math.min(1, (miniTop - pos) / (miniTop * 0.35)));

    fullPlayer.style.transform = 'translateY(' + Math.min(pos, h) + 'px)';
    miniPlayer.style.transition = 'none';
    miniPlayer.style.zIndex = '1001';
    miniPlayer.style.transform = 'translateY(' + (Math.min(pos, miniTop) - miniTop) + 'px)';
    miniPlayer.style.opacity = String(1 - q);
  }, { passive: true });

  el.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    if (moved) {
      justDragged = true;
      setTimeout(() => { justDragged = false; }, 300);
      setFull(fpOpen ? !(dy > 80) : dy < -60);
    } else {
      setFull(fpOpen);
    }
  }, { passive: true });
}
addDrag(miniPlayer);
addDrag(fullPlayer);

miniPlayer.addEventListener('click', () => {
  if (justDragged || !currentTrack) return;
  fullPlayer.style.transition = 'none';
  fullPlayer.style.transform = 'translateY(' + miniTopY() + 'px)';
  void fullPlayer.offsetHeight;
  setFull(true);
});

// ==========================================================
// BRING BACK THE LAST SONG (paused, where you stopped)
// ==========================================================
(function restoreLast() {
  try {
    const last = JSON.parse(read('dropplay_last') || 'null');
    if (!last || !last.track || !last.track.audio_url) return;

    currentTrack = last.track;
    audioEl.src = last.track.audio_url;
    playerCover.src = last.cover || FALLBACK;
    playerTitle.textContent = last.track.title || 'Untitled';
    playerArtist.textContent = last.artistName || 'Unknown Artist';

    const t = parseFloat(read('dropplay_time') || '0');
    audioEl.addEventListener('loadedmetadata', () => {
      if (t > 0 && t < audioEl.duration - 1) audioEl.currentTime = t;
    }, { once: true });
    updatePlayIcon();
  } catch (e) {}
})();

// ==========================================================
// STUDIO
// ==========================================================
let currentStudioTab = 'dashboard';

$('studio-back').addEventListener('click', () => showView('home'));

document.querySelectorAll('#studio-tabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#studio-tabs button').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('#view-studio .tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    currentStudioTab = btn.dataset.stab;
    $('tab-' + currentStudioTab).classList.add('active');
    window.scrollTo(0, 0);
    loadStudioTab(currentStudioTab);
  });
});

function loadStudioTab(tab) {
  if (tab === 'dashboard') loadDashboard();
  if (tab === 'release') { loadAlbums(); loadAnalytics(); }
  if (tab === 'profile') loadProfileList();
}

// ----- image picker helper -----
function setupImagePicker(squareId, inputId, previewId, plusId, onPicked) {
  const square  = $(squareId);
  const input   = $(inputId);
  const preview = $(previewId);
  const plus    = $(plusId);
  square.addEventListener('click', () => input.click());
  input.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      preview.src = ev.target.result;
      preview.classList.add('show');
      plus.classList.add('hide');
    };
    reader.readAsDataURL(f);
    if (onPicked) onPicked(f);
  });
}

// ----- upload helper -----
async function uploadFile(bucket, file, prefix) {
  const ext = file.name.split('.').pop();
  const path = `${prefix}-${Date.now()}.${ext}`;
  const { error } = await db.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = db.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// ----- find or create artist by name -----
async function findOrCreateArtist(name) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Artist name required');
  const { data: existing } = await db.from('artists').select('id').ilike('name', trimmed).limit(1);
  if (existing && existing.length > 0) return existing[0].id;
  const { data: created, error } = await db.from('artists').insert({ name: trimmed }).select('id').single();
  if (error) throw error;
  return created.id;
}

// ----- DASHBOARD -----
async function loadDashboard() {
  try {
    const [tracks, plays, artists, albums] = await Promise.all([
      db.from('tracks').select('*', { count: 'exact', head: true }),
      db.from('tracks').select('plays'),
      db.from('artists').select('*', { count: 'exact', head: true }),
      db.from('albums').select('*', { count: 'exact', head: true })
    ]);
    $('stat-tracks').textContent  = tracks.count == null ? 0 : tracks.count;
    $('stat-artists').textContent = artists.count == null ? 0 : artists.count;
    $('stat-albums').textContent  = albums.count == null ? 0 : albums.count;
    $('stat-plays').textContent   = (plays.data || []).reduce((s, t) => s + (t.plays || 0), 0);

    const { data: recent } = await db.from('tracks')
      .select('id, title, cover_url, plays, artists ( name )')
      .order('created_at', { ascending: false }).limit(5);

    const wrap = $('recent-uploads');
    if (!recent || recent.length === 0) {
      wrap.innerHTML = '<div class="empty">No uploads yet.</div>';
      return;
    }
    wrap.innerHTML = '';
    recent.forEach((t) => {
      const el = document.createElement('div');
      el.className = 'recent-item';
      el.innerHTML = `
        <img class="recent-cover" src="${esc(t.cover_url || FALLBACK)}" alt="">
        <div class="recent-info">
          <div class="recent-title">${esc(t.title)}</div>
          <div class="recent-sub">${esc((t.artists && t.artists.name) || 'Unknown')}</div>
        </div>
        <div class="recent-plays">${t.plays || 0} ▶</div>
      `;
      el.querySelector('img').addEventListener('error', (e) => { e.target.src = FALLBACK; }, { once: true });
      wrap.appendChild(el);
    });
  } catch (e) { console.error(e); }
}

// ----- UPLOAD SONG -----
let coverFile = null, audioFile = null;
setupImagePicker('cover-square', 'cover-input', 'cover-preview', 'cover-plus', (f) => { coverFile = f; });

const audioPicker = $('audio-picker');
const audioInput  = $('audio-input');
audioPicker.addEventListener('click', () => audioInput.click());
audioInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  audioFile = f;
  audioPicker.classList.add('has-file');
  $('audio-title').textContent = 'Audio selected ✅';
  $('audio-sub').textContent = `${f.name} • ${(f.size / 1024 / 1024).toFixed(1)} MB`;
});

$('artist-name').addEventListener('change', async (e) => {
  const name = e.target.value.trim();
  const alSel = $('album-select');
  alSel.innerHTML = '<option value="">— Single —</option>';
  if (!name) return;
  const { data: arts } = await db.from('artists').select('id').ilike('name', name).limit(1);
  if (!arts || arts.length === 0) return;
  const { data: albums } = await db.from('albums').select('id, title').eq('artist_id', arts[0].id).order('title');
  (albums || []).forEach((al) => {
    const opt = document.createElement('option');
    opt.value = al.id;
    opt.textContent = al.title;
    alSel.appendChild(opt);
  });
});

$('publish-btn').addEventListener('click', async () => {
  const title = $('title').value.trim();
  const artistName = $('artist-name').value.trim();
  const albumId = $('album-select').value || null;
  const btn = $('publish-btn');

  if (!title)      return toast('Enter a song title');
  if (!artistName) return toast('Enter your artist name');
  if (!audioFile)  return toast('Choose an audio file');

  btn.disabled = true; btn.textContent = 'Publishing…';
  const box = $('progress-box');
  const bar = $('progress-bar');
  const lbl = $('progress-label');
  box.classList.add('show');

  try {
    bar.style.width = '10%'; lbl.textContent = 'Uploading cover…';
    let coverUrl = null;
    if (coverFile) coverUrl = await uploadFile('covers', coverFile, 'cover');

    bar.style.width = '35%'; lbl.textContent = 'Uploading audio…';
    const audioUrl = await uploadFile('audio', audioFile, 'track');

    bar.style.width = '70%'; lbl.textContent = 'Saving artist…';
    const artistId = await findOrCreateArtist(artistName);

    bar.style.width = '90%'; lbl.textContent = 'Saving track…';
    const { error } = await db.from('tracks').insert({
      title,
      artist_id: artistId,
      album_id: albumId ? albumId : null,
      audio_url: audioUrl,
      cover_url: coverUrl
    });
    if (error) throw error;

    bar.style.width = '100%'; lbl.textContent = 'Done ✅';
    toast('Song published! 🎵');
    setTimeout(() => {
      box.classList.remove('show');
      bar.style.width = '0%';
      $('title').value = '';
      audioPicker.classList.remove('has-file');
      $('audio-title').textContent = 'Choose audio file';
      $('audio-sub').textContent = 'MP3 · WAV · M4A · up to 50MB';
      audioFile = null; coverFile = null;
    }, 1500);
    lastHomeSig = '';
    loadDashboard();
  } catch (err) { toast('Error: ' + err.message); }
  finally { btn.disabled = false; btn.textContent = 'Publish Song'; }
});

// ----- ALBUMS -----
let albumCoverFile = null;
setupImagePicker('album-cover-square', 'album-cover-input', 'album-cover-preview', 'album-cover-plus',
  (f) => { albumCoverFile = f; });

$('create-album-btn').addEventListener('click', async () => {
  const title = $('album-title').value.trim();
  const artistName = $('album-artist-name').value.trim();
  const date = $('album-date').value || null;
  const btn = $('create-album-btn');

  if (!title)      return toast('Enter album title');
  if (!artistName) return toast('Enter artist name');

  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    let coverUrl = null;
    if (albumCoverFile) coverUrl = await uploadFile('covers', albumCoverFile, 'album');
    const artistId = await findOrCreateArtist(artistName);
    const { error } = await db.from('albums').insert({
      title, artist_id: artistId, cover_url: coverUrl, release_date: date
    });
    if (error) throw error;
    toast('Album created! 💿');
    $('album-title').value = '';
    loadAlbums(); loadDashboard();
  } catch (err) { toast('Error: ' + err.message); }
  finally { btn.disabled = false; btn.textContent = 'Create Album'; }
});

async function loadAlbums() {
  const { data } = await db.from('albums')
    .select('id, title, cover_url, release_date, artists ( name )')
    .order('created_at', { ascending: false }).limit(10);
  const wrap = $('album-list');
  if (!data || data.length === 0) {
    wrap.innerHTML = '<div class="empty">No albums yet.</div>';
    return;
  }
  wrap.innerHTML = '';
  data.forEach((al) => {
    const el = document.createElement('div');
    el.className = 'recent-item';
    el.innerHTML = `
      <img class="recent-cover" src="${esc(al.cover_url || FALLBACK)}" alt="">
      <div class="recent-info">
        <div class="recent-title">${esc(al.title)}</div>
        <div class="recent-sub">${esc((al.artists && al.artists.name) || 'Unknown')} • ${esc(al.release_date || '—')}</div>
      </div>
    `;
    el.querySelector('img').addEventListener('error', (e) => { e.target.src = FALLBACK; }, { once: true });
    wrap.appendChild(el);
  });
}

// ----- ANALYTICS -----
async function loadAnalytics() {
  const { data } = await db.from('tracks')
    .select('title, plays')
    .order('plays', { ascending: false }).limit(10);

  const wrap = $('top-tracks');
  if (!data || data.length === 0) {
    wrap.innerHTML = '<div class="empty">No data yet.</div>';
    return;
  }
  const maxPlays = Math.max(...data.map((t) => t.plays || 0), 1);
  wrap.innerHTML = '';
  data.forEach((t) => {
    const pct = ((t.plays || 0) / maxPlays) * 100;
    const el = document.createElement('div');
    el.style.marginBottom = '14px';
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
        <span style="font-weight:600;">${esc(t.title)}</span>
        <span style="color:#1db954;font-weight:700;">${t.plays || 0} ▶</span>
      </div>
      <div style="background:#2a2a2a;height:6px;border-radius:6px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:#1db954;border-radius:6px;"></div>
      </div>
    `;
    wrap.appendChild(el);
  });
}

// ----- PROFILE -----
let profileImgFile = null;
setupImagePicker('profile-img-circle', 'profile-img-input', 'profile-img-preview', 'profile-img-plus',
  (f) => { profileImgFile = f; });

$('save-profile-btn').addEventListener('click', async () => {
  const name = $('profile-name').value.trim();
  const bio  = $('profile-bio').value.trim();
  const btn  = $('save-profile-btn');

  if (!name) return toast('Enter artist name');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    let imgUrl = null;
    if (profileImgFile) imgUrl = await uploadFile('covers', profileImgFile, 'artist');

    const { data: existing } = await db.from('artists').select('id').ilike('name', name).limit(1);

    if (existing && existing.length > 0) {
      const { error } = await db.from('artists').update({
        bio: bio || null,
        image_url: imgUrl || undefined
      }).eq('id', existing[0].id);
      if (error) throw error;
    } else {
      const { error } = await db.from('artists').insert({ name, bio: bio || null, image_url: imgUrl });
      if (error) throw error;
    }
    toast('Profile saved! 🎤');
    $('profile-name').value = '';
    $('profile-bio').value = '';
    profileImgFile = null;
    loadProfileList();
    loadDashboard();
  } catch (err) { toast('Error: ' + err.message); }
  finally { btn.disabled = false; btn.textContent = 'Save Profile'; }
});

async function loadProfileList() {
  const { data } = await db.from('artists')
    .select('id, name, bio, image_url, verified')
    .order('created_at', { ascending: false }).limit(10);

  const wrap = $('profile-list');
  if (!data || data.length === 0) {
    wrap.innerHTML = '<div class="empty">No profiles yet.</div>';
    return;
  }
  wrap.innerHTML = '';
  data.forEach((a) => {
    const el = document.createElement('div');
    el.className = 'recent-item';
    el.innerHTML = `
      <img class="recent-cover" style="border-radius:50%;" src="${esc(a.image_url || FALLBACK)}" alt="">
      <div class="recent-info">
        <div class="recent-title">${esc(a.name)} ${a.verified ? '✔' : ''}</div>
        <div class="recent-sub">${esc(a.bio || 'No bio')}</div>
      </div>
    `;
    el.querySelector('img').addEventListener('error', (e) => { e.target.src = FALLBACK; }, { once: true });
    wrap.appendChild(el);
  });
}

// ==========================================================
// START
// ==========================================================
const startView = read('dropplay_view');
showView(['home', 'search', 'library', 'studio'].includes(startView) ? startView : 'home');

// ================================
// DROPPLAY — Main App Logic
// ================================

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentTrack = null;
let isPlaying = false;

const trackListEl = document.getElementById('track-list');
const audioEl = document.getElementById('audio');
const playBtn = document.getElementById('play-btn');
const playerCover = document.getElementById('player-cover');
const playerTitle = document.getElementById('player-title');
const playerArtist = document.getElementById('player-artist');

async function loadTracks() {
  const { data, error } = await db
    .from('tracks')
    .select(`
      id, title, audio_url, cover_url,
      artists ( name )
    `)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error(error);
    trackListEl.innerHTML = `<div class="empty">⚠️ Could not load tracks</div>`;
    return;
  }

  if (!data || data.length === 0) {
    trackListEl.innerHTML = `<div class="empty">🎵 No tracks yet. Upload your first song in Supabase!</div>`;
    return;
  }

  trackListEl.innerHTML = '';
  data.forEach(track => {
    const artistName = track.artists?.name || 'Unknown Artist';
    const cover = track.cover_url || 'https://via.placeholder.com/60/333/fff?text=♪';

    const el = document.createElement('div');
    el.className = 'track';
    el.innerHTML = `
      <img class="track-cover" src="${cover}" alt="">
      <div class="track-info">
        <div class="track-title">${track.title}</div>
        <div class="track-artist">${artistName}</div>
      </div>
    `;
    el.addEventListener('click', () => playTrack(track, artistName, cover));
    trackListEl.appendChild(el);
  });
}

function playTrack(track, artistName, cover) {
  if (!track.audio_url) {
    alert('This track has no audio file yet.');
    return;
  }

  currentTrack = track;
  audioEl.src = track.audio_url;
  audioEl.play();
  isPlaying = true;

  playerCover.src = cover;
  playerTitle.textContent = track.title;
  playerArtist.textContent = artistName;
  playBtn.textContent = '❚❚';
}

playBtn.addEventListener('click', () => {
  if (!currentTrack) return;
  if (isPlaying) {
    audioEl.pause();
    playBtn.textContent = '▶';
  } else {
    audioEl.play();
    playBtn.textContent = '❚❚';
  }
  isPlaying = !isPlaying;
});

audioEl.addEventListener('ended', () => {
  playBtn.textContent = '▶';
  isPlaying = false;
});

loadTracks();
/* =============================================================
   AUDIO SYSTEM — Premium Cinematic Music Engine v2
   romantic-flower website
   =============================================================
   Place music at:  music/song1.mp3   etc.
   Place covers at: assets/music-cover/song1.jpg  etc.
   ============================================================= */

'use strict';

/* ─────────────────────────────────────────────
   1. PLAYLIST — Edit your tracks here
   ───────────────────────────────────────────── */
const playlist = [
  {
    id:        'song1',
    title:     'Sampai Jadi Debu',
    artist:    'Banda Neira',
    file:      'music/song1.mp3',
    cover:     'assets/music-cover/song1.jpeg',
    startTime: 0,       // seconds — where playback begins
    endTime:   null,    // seconds — where it ends/loops (null = full track)
    loopStart: null,    // loop rewind point (null = startTime)
    volume:    0.75,
    loop:      true,
    fadeIn:    2.5,
    fadeOut:   2.0
  },
  {
    id:        'song2',
    title:     'Song Title 2',
    artist:    'Artist Name',
    file:      'music/song2.mp3',
    cover:     'assets/music-cover/song2.jpg',
    startTime: 0,
    endTime:   null,
    loopStart: null,
    volume:    0.75,
    loop:      true,
    fadeIn:    2.5,
    fadeOut:   2.0
  },
  {
    id:        'song3',
    title:     'Song Title 3',
    artist:    'Artist Name',
    file:      'music/song3.mp3',
    cover:     'assets/music-cover/song3.jpg',
    startTime: 0,
    endTime:   null,
    loopStart: null,
    volume:    0.75,
    loop:      true,
    fadeIn:    2.5,
    fadeOut:   2.0
  }
];

/* Section → track id map (leave empty to disable) */
const SECTION_MUSIC_MAP = {
  // 'hero':    'song1',
  // 'finale':  'song3'
};

/* ─────────────────────────────────────────────
   2. AUDIO ENGINE
   ───────────────────────────────────────────── */
const AudioEngine = (() => {
  let audioCtx      = null;
  let masterGain    = null;
  let analyserNode  = null;
  let currentSource = null;
  let currentBuffer = null;
  let currentConfig = null;
  let isPlaying     = false;
  let isUserPaused  = false;
  let autoplayReady = false;
  let currentIdx    = 0;
  let fadeRaf       = null;
  let loopRaf       = null;
  let bufferCache   = {};

  function initContext() {
    if (audioCtx) return;
    audioCtx     = new (window.AudioContext || window.webkitAudioContext)();
    masterGain   = audioCtx.createGain();
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 256;
    masterGain.connect(analyserNode);
    analyserNode.connect(audioCtx.destination);
    masterGain.gain.value = 0;
  }

  async function preloadTrack(cfg) {
    if (bufferCache[cfg.id]) return bufferCache[cfg.id];
    try {
      const res = await fetch(cfg.file);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ab  = await res.arrayBuffer();
      const buf = await audioCtx.decodeAudioData(ab);
      bufferCache[cfg.id] = buf;
      return buf;
    } catch(e) {
      console.warn('[AudioEngine] Could not load', cfg.file, e.message);
      return null;
    }
  }

  function fadeTo(target, duration, done) {
    if (fadeRaf) cancelAnimationFrame(fadeRaf);
    if (!audioCtx) { done && done(); return; }
    const startVol = masterGain.gain.value;
    const t0 = performance.now();
    function tick() {
      const p = Math.min((performance.now() - t0) / 1000 / duration, 1);
      const e = p < .5 ? 2*p*p : -1+(4-2*p)*p;
      masterGain.gain.value = startVol + (target - startVol) * e;
      if (p < 1) { fadeRaf = requestAnimationFrame(tick); }
      else { masterGain.gain.value = target; fadeRaf = null; done && done(); }
    }
    fadeRaf = requestAnimationFrame(tick);
  }

  function startLoopWatch(cfg, startedAt, offset) {
    if (loopRaf) cancelAnimationFrame(loopRaf);
    if (!cfg.endTime) return;
    function check() {
      if (!isPlaying) return;
      const elapsed   = audioCtx.currentTime - startedAt + offset;
      const remaining = cfg.endTime - elapsed;
      if (remaining <= cfg.fadeOut + 0.05) {
        cancelAnimationFrame(loopRaf); loopRaf = null;
        fadeTo(0, cfg.fadeOut, () => {
          if (!isPlaying) return;
          stopSource();
          playSegment(currentBuffer, cfg);
        });
      } else { loopRaf = requestAnimationFrame(check); }
    }
    loopRaf = requestAnimationFrame(check);
  }

  function stopSource() {
    if (loopRaf) { cancelAnimationFrame(loopRaf); loopRaf = null; }
    if (currentSource) {
      try { currentSource.disconnect(); currentSource.stop(); } catch(e) {}
      currentSource = null;
    }
  }

  function playSegment(buf, cfg) {
    stopSource();
    const src  = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(masterGain);
    const start = cfg.startTime || 0;
    const loop  = cfg.loopStart != null ? cfg.loopStart : start;
    const dur   = cfg.endTime ? cfg.endTime - start : undefined;
    const ctxNow = audioCtx.currentTime;
    if (dur !== undefined) { src.start(0, start, dur); }
    else {
      src.start(0, start);
      if (cfg.loop) { src.loop = true; src.loopStart = loop; src.loopEnd = buf.duration; }
    }
    currentSource = src;
    if (cfg.endTime && cfg.loop) startLoopWatch(cfg, ctxNow, start);
  }

  async function playTrack(idx, crossfade) {
    const cfg = playlist[idx];
    if (!cfg || !autoplayReady) return;
    currentIdx    = idx;
    currentConfig = cfg;
    const buf = await preloadTrack(cfg);
    if (!buf) { UI.showFallback(); return; }
    currentBuffer = buf;
    const go = () => { playSegment(buf, cfg); fadeTo(cfg.volume, cfg.fadeIn); isPlaying = true; isUserPaused = false; UI.sync(true, idx); };
    if (crossfade && isPlaying) { fadeTo(0, cfg.fadeOut, () => { stopSource(); go(); }); }
    else { stopSource(); go(); }
  }

  function pause() {
    if (!isPlaying) return;
    fadeTo(0, currentConfig ? currentConfig.fadeOut : 1.5, () => { stopSource(); isPlaying = false; isUserPaused = true; UI.sync(false, currentIdx); });
  }

  async function resume() {
    if (isPlaying || !currentConfig) return;
    const buf = currentBuffer || await preloadTrack(currentConfig);
    if (!buf) return;
    currentBuffer = buf;
    playSegment(buf, currentConfig);
    fadeTo(currentConfig.volume, currentConfig.fadeIn);
    isPlaying = true; isUserPaused = false; UI.sync(true, currentIdx);
  }

  function toggle() { isPlaying ? pause() : resume(); }

  function setVolume(v) {
    const c = Math.max(0, Math.min(1, v));
    if (isPlaying && masterGain) masterGain.gain.value = c;
    if (currentConfig) currentConfig.volume = c;
  }

  function nextTrack() { playTrack((currentIdx + 1) % playlist.length, true); }
  function prevTrack() { playTrack((currentIdx - 1 + playlist.length) % playlist.length, true); }
  function switchTo(id, x = true) { const i = playlist.findIndex(t => t.id === id); if (i >= 0 && i !== currentIdx) playTrack(i, x); }
  function cinematicFade(dur = 2)   { if (isPlaying) fadeTo(0, dur); }
  function cinematicFadeIn(dur = 2) { if (isPlaying && currentConfig) fadeTo(currentConfig.volume, dur); }
  function getAnalyser() { return analyserNode; }

  async function unlock() {
    if (autoplayReady) return;
    initContext();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    autoplayReady = true;
    preloadTrack(playlist[0]);
    playTrack(0, false);
  }

  /* Progress polling */
  let _playStartCtxTime = 0;
  let _playStartOffset  = 0;
  const _origPlaySeg = playSegment;

  function getProgress() {
    if (!isPlaying || !currentConfig || !audioCtx) return { current: 0, duration: 0, pct: 0 };
    const start    = currentConfig.startTime || 0;
    const end      = currentConfig.endTime || (currentBuffer ? currentBuffer.duration : 0);
    const segLen   = end - start;
    const elapsed  = (audioCtx.currentTime - _playStartCtxTime);
    const looped   = segLen > 0 ? elapsed % segLen : elapsed;
    const current  = start + looped;
    return { current, duration: end, pct: segLen > 0 ? (looped / segLen) : 0 };
  }

  /* Wrap playSegment to record timing */
  const _realPlaySeg = playSegment;
  function playSegmentTracked(buf, cfg) {
    _realPlaySeg(buf, cfg);
    _playStartCtxTime = audioCtx.currentTime;
    _playStartOffset  = cfg.startTime || 0;
  }
  // reassign reference used internally
  // (closure captured _realPlaySeg so this is fine)

  return { unlock, playTrack, pause, resume, toggle, nextTrack, prevTrack, switchTo, setVolume,
           cinematicFade, cinematicFadeIn, getAnalyser, getProgress,
           getState: () => ({ isPlaying, isUserPaused, currentIdx }) };
})();


/* ─────────────────────────────────────────────
   3. PREMIUM UI MODULE
   ───────────────────────────────────────────── */
const UI = (() => {
  let root, coverImg, coverBg, titleEl, artistEl;
  let playBtn, prevBtn, nextBtn;
  let progressBar, progressFill, progressDot;
  let timeEl, durEl;
  let volSlider, volFill;
  let vizCanvas, vizCtx;
  let fallbackEl, shineEl;
  let progressRaf, vizRaf;
  let mouseX = 0.5, mouseY = 0.5;
  let isMinimized = true;

  /* ── Format seconds → m:ss ── */
  const fmt = s => { const m = Math.floor(s/60); return `${m}:${String(Math.floor(s%60)).padStart(2,'0')}` };

  /* ── Build DOM ── */
  function build() {
    injectCSS();

    root = document.createElement('div');
    root.id = 'cp-root';
    /* Panel starts hidden — no cp-minimized class needed */
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Music Player');

    root.innerHTML = `
      <!-- Ambient blurred bg from cover -->
      <div class="cp-bg-blur">
        <img class="cp-bg-img" src="" alt="" aria-hidden="true" />
      </div>

      <!-- Animated border gradient ring -->
      <div class="cp-border-ring" aria-hidden="true"></div>

      <!-- Cinematic shine sweep -->
      <div class="cp-shine" aria-hidden="true"></div>

      <!-- Mouse-reactive lighting orb -->
      <div class="cp-light-orb" aria-hidden="true"></div>

      <!-- Inner card -->
      <div class="cp-card">

        <!-- Cover art — 3:4 portrait -->
        <div class="cp-cover-wrap">
          <img class="cp-cover" src="" alt="Album cover" />
          <div class="cp-cover-overlay"></div>
          <!-- Visualizer bars over cover -->
          <canvas class="cp-viz" width="120" height="36" aria-hidden="true"></canvas>
        </div>

        <!-- Info + controls -->
        <div class="cp-body">

          <!-- Track info -->
          <div class="cp-info">
            <p class="cp-title">♪ Loading…</p>
            <p class="cp-artist"></p>
          </div>

          <!-- Progress bar -->
          <div class="cp-progress-wrap" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="cp-progress-track">
              <div class="cp-progress-fill"></div>
              <div class="cp-progress-dot"></div>
            </div>
            <div class="cp-times">
              <span class="cp-time-cur">0:00</span>
              <span class="cp-time-dur">0:00</span>
            </div>
          </div>

          <!-- Controls -->
          <div class="cp-controls">
            <button class="cp-btn cp-prev-btn" aria-label="Previous track">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6V6zm3.5 6 8.5 5V7L9.5 12z"/></svg>
            </button>
            <button class="cp-btn cp-play-btn" aria-label="Play or pause">
              <svg class="cp-icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>
              <svg class="cp-icon-pause cp-hidden" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <button class="cp-btn cp-next-btn" aria-label="Next track">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          </div>

          <!-- Volume -->
          <div class="cp-vol-row">
            <svg class="cp-vol-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
            </svg>
            <div class="cp-vol-track">
              <div class="cp-vol-fill"></div>
              <input type="range" class="cp-vol-input" min="0" max="100" value="75" aria-label="Volume" />
            </div>
          </div>

        </div><!-- /cp-body -->
      </div><!-- /cp-card -->

      <!-- Minimise toggle -->
      <button class="cp-mini-btn" aria-label="Toggle player size">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>
      </button>

      <!-- Fallback tap notice -->
      <div class="cp-fallback cp-hidden">
        <span>♪ Tap to play music</span>
      </div>
    `;

    document.body.appendChild(root);

    /* Build floating toggle button */
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'cp-toggle-btn';
    toggleBtn.setAttribute('aria-label', 'Toggle music player');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.innerHTML = `
      <!-- Musical note icon -->
      <svg class="cp-toggle-icon cp-icon-note" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
      <!-- Close X icon -->
      <svg class="cp-toggle-icon cp-icon-close" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    `;
    toggleBtn.addEventListener('click', () => {
      togglePanel();
      /* First click also unlocks audio */
      AudioEngine.unlock();
    });
    document.body.appendChild(toggleBtn);

    /* Cache elements */
    coverImg     = root.querySelector('.cp-cover');
    coverBg      = root.querySelector('.cp-bg-img');
    titleEl      = root.querySelector('.cp-title');
    artistEl     = root.querySelector('.cp-artist');
    playBtn      = root.querySelector('.cp-play-btn');
    prevBtn      = root.querySelector('.cp-prev-btn');
    nextBtn      = root.querySelector('.cp-next-btn');
    progressFill = root.querySelector('.cp-progress-fill');
    progressDot  = root.querySelector('.cp-progress-dot');
    timeEl       = root.querySelector('.cp-time-cur');
    durEl        = root.querySelector('.cp-time-dur');
    volSlider    = root.querySelector('.cp-vol-input');
    volFill      = root.querySelector('.cp-vol-fill');
    vizCanvas    = root.querySelector('.cp-viz');
    vizCtx       = vizCanvas.getContext('2d');
    fallbackEl   = root.querySelector('.cp-fallback');
    shineEl      = root.querySelector('.cp-shine');

    /* Events */
    playBtn.addEventListener('click', () => AudioEngine.toggle());
    prevBtn.addEventListener('click', () => AudioEngine.prevTrack());
    nextBtn.addEventListener('click', () => AudioEngine.nextTrack());

    volSlider.addEventListener('input', e => {
      const v = +e.target.value / 100;
      AudioEngine.setVolume(v);
      volFill.style.width = e.target.value + '%';
    });

    /* Mouse-reactive lighting */
    root.addEventListener('mousemove', e => {
      const r = root.getBoundingClientRect();
      mouseX = (e.clientX - r.left) / r.width;
      mouseY = (e.clientY - r.top)  / r.height;
      root.querySelector('.cp-light-orb').style.transform =
        `translate(${mouseX * 100}%, ${mouseY * 100}%) translate(-50%, -50%)`;
    });

    /* Minimise button */
    root.querySelector('.cp-mini-btn').addEventListener('click', e => {
      e.stopPropagation();
      closePanel();
    });

    startProgressLoop();
    startVizLoop();
  }

  /* ── Progress update loop ── */
  function startProgressLoop() {
    function tick() {
      progressRaf = requestAnimationFrame(tick);
      const { current, duration, pct } = AudioEngine.getProgress();
      const p = Math.min(pct * 100, 100);
      progressFill.style.width  = p + '%';
      progressDot.style.left    = p + '%';
      if (timeEl) timeEl.textContent = fmt(current);
      if (durEl)  durEl.textContent  = fmt(duration);
    }
    tick();
  }

  /* ── Visualizer loop ── */
  function startVizLoop() {
    const analyser = AudioEngine.getAnalyser();
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const W = vizCanvas.width, H = vizCanvas.height;
    const bars = 20, step = Math.floor(data.length / bars);

    function draw() {
      vizRaf = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      vizCtx.clearRect(0, 0, W, H);
      const bw = W / bars - 1.5;
      for (let i = 0; i < bars; i++) {
        let s = 0;
        for (let j = 0; j < step; j++) s += data[i * step + j];
        const avg = s / step;
        const bh  = Math.max(2, (avg / 255) * H * 0.9);
        const x   = i * (bw + 1.5);
        const al  = 0.35 + (avg / 255) * 0.65;
        vizCtx.fillStyle = `rgba(255,200,220,${al})`;
        vizCtx.beginPath();
        vizCtx.roundRect(x, H - bh, bw, bh, 1.5);
        vizCtx.fill();
      }
    }
    draw();
  }

  /* ── Load cover image into player ── */
  function loadCover(src) {
    if (!src) {
      coverImg.src = '';
      coverBg.src  = '';
      return;
    }
    coverImg.src = src;
    coverBg.src  = src;
  }

  /* ── Public: sync state to a track index ── */
  function sync(playing, idx) {
    /* Play/pause icons */
    playBtn.querySelector('.cp-icon-play').classList.toggle('cp-hidden', playing);
    playBtn.querySelector('.cp-icon-pause').classList.toggle('cp-hidden', !playing);
    root.classList.toggle('cp-playing', playing);
    /* Update toggle button playing state */
    if (toggleBtn) toggleBtn.classList.toggle('cp-is-playing', playing);

    /* Track metadata */
    if (idx >= 0 && idx < playlist.length) {
      const t = playlist[idx];
      titleEl.textContent  = t.title  || 'Unknown';
      artistEl.textContent = t.artist || '';
      loadCover(t.cover || '');
      /* Update duration display immediately */
      if (durEl && t.endTime) durEl.textContent = fmt(t.endTime - (t.startTime || 0));
    }
  }

  function showFallback() {
    fallbackEl.classList.remove('cp-hidden');
    fallbackEl.addEventListener('click', () => {
      AudioEngine.unlock();
      fallbackEl.classList.add('cp-hidden');
    }, { once: true });
  }

  /* ── Inject all CSS ── */
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
/* =========================================
   CINEMATIC MUSIC PLAYER — Hidden-by-default v3
   Small floating note icon → slide-up panel
   ========================================= */

/* ── Floating music toggle button ── */
#cp-toggle-btn {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 9999;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  background: rgba(20, 5, 15, 0.88);
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  box-shadow:
    0 8px 32px rgba(0,0,0,0.6),
    0 0 0 1px rgba(255,150,180,0.18) inset,
    0 0 20px rgba(180,50,90,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform 0.3s cubic-bezier(.23,1,.32,1),
    box-shadow 0.3s ease,
    background 0.3s ease;
  animation: cp-toggle-float 5s ease-in-out infinite;
  will-change: transform;
  user-select: none;
}

@keyframes cp-toggle-float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-5px); }
}

#cp-toggle-btn:hover {
  background: rgba(40, 10, 25, 0.95);
  box-shadow:
    0 12px 40px rgba(0,0,0,0.7),
    0 0 0 1px rgba(255,150,180,0.3) inset,
    0 0 30px rgba(200,60,100,0.25);
  animation-play-state: paused;
}

#cp-toggle-btn:active { transform: scale(0.93); }

/* Pulsing ring when playing */
#cp-toggle-btn.cp-is-playing::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1.5px solid rgba(255,130,170,0.4);
  animation: cp-ring-pulse 2.5s ease-out infinite;
}
@keyframes cp-ring-pulse {
  0%   { transform: scale(1); opacity: 0.7; }
  100% { transform: scale(1.45); opacity: 0; }
}

.cp-toggle-icon {
  width: 22px;
  height: 22px;
  color: rgba(255,190,215,0.9);
  transition: transform 0.35s cubic-bezier(.23,1,.32,1), opacity 0.2s ease;
  position: absolute;
}
.cp-toggle-icon.cp-icon-note  { }
.cp-toggle-icon.cp-icon-close { opacity: 0; transform: rotate(-90deg) scale(0.6); }

#cp-toggle-btn.cp-panel-open .cp-icon-note  { opacity: 0; transform: rotate(90deg) scale(0.6); }
#cp-toggle-btn.cp-panel-open .cp-icon-close { opacity: 1; transform: rotate(0deg) scale(1); }

/* ── Slide-up music panel ── */
#cp-root {
  position: fixed;
  bottom: 92px;
  right: 28px;
  z-index: 9998;
  width: 230px;
  border-radius: 20px;
  overflow: hidden;
  background: rgba(8, 2, 14, 0.85);
  backdrop-filter: blur(28px) saturate(1.6);
  -webkit-backdrop-filter: blur(28px) saturate(1.6);
  box-shadow:
    0 24px 64px rgba(0,0,0,0.7),
    0 0 0 1px rgba(255,150,180,0.14) inset,
    0 0 40px rgba(120,20,60,0.12);
  /* Hidden by default */
  opacity: 0;
  transform: translateY(20px) scale(0.96);
  pointer-events: none;
  transition:
    opacity 0.4s cubic-bezier(.23,1,.32,1),
    transform 0.4s cubic-bezier(.23,1,.32,1);
  user-select: none;
  transform-origin: bottom right;
}

/* Revealed state */
#cp-root.cp-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

/* ── Ambient blurred bg ── */
.cp-bg-blur {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  opacity: 0;
  transition: opacity 0.8s ease;
  pointer-events: none;
  z-index: 0;
}
.cp-bg-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(28px) saturate(1.4) brightness(0.28);
  transform: scale(1.15);
}
#cp-root.cp-playing .cp-bg-blur { opacity: 1; }

/* ── Animated border ring ── */
.cp-border-ring {
  position: absolute;
  inset: -1px;
  border-radius: 21px;
  padding: 1px;
  background: conic-gradient(
    from var(--cp-angle, 0deg),
    transparent 0%,
    rgba(255,150,180,0.55) 20%,
    rgba(200,80,130,0.75) 40%,
    rgba(255,180,210,0.45) 60%,
    transparent 80%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 0.6s ease;
  pointer-events: none;
  z-index: 1;
  animation: cp-ring-spin 4s linear infinite paused;
}
@property --cp-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
@keyframes cp-ring-spin { to { --cp-angle: 360deg; } }
#cp-root.cp-playing .cp-border-ring { opacity: 1; animation-play-state: running; }

/* ── Shine sweep ── */
.cp-shine {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.04) 50%, transparent 70%);
  background-size: 200% 100%;
  animation: cp-shine-sweep 5s ease-in-out infinite 2s;
  pointer-events: none;
  z-index: 2;
}
@keyframes cp-shine-sweep {
  0%   { background-position: 200% 0; }
  50%  { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* ── Mouse-reactive light orb ── */
.cp-light-orb {
  position: absolute;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,140,190,0.16) 0%, transparent 70%);
  pointer-events: none;
  z-index: 2;
  top: 0; left: 0;
  transition: transform 0.1s linear;
  mix-blend-mode: screen;
}

/* ── Card inner ── */
.cp-card {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 16px 16px;
  gap: 12px;
}

/* ── Cover ── */
.cp-cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,150,180,0.1) inset;
  flex-shrink: 0;
  background: rgba(255,150,180,0.06);
}
.cp-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.6s cubic-bezier(.23,1,.32,1), filter 0.4s ease;
}
#cp-root:hover .cp-cover { transform: scale(1.03); }
.cp-cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(8,2,14,0.55) 0%, transparent 50%);
  pointer-events: none;
}
.cp-viz {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 36px;
  opacity: 0.85;
  pointer-events: none;
  mix-blend-mode: screen;
}

/* ── Body ── */
.cp-body { width: 100%; display: flex; flex-direction: column; gap: 10px; }

/* ── Track info ── */
.cp-info { text-align: center; }
.cp-title {
  font-family: 'Cormorant Garamond', 'Georgia', serif;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,235,245,0.95);
  letter-spacing: 0.02em;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cp-artist {
  font-family: 'Jost', 'Helvetica Neue', sans-serif;
  font-size: 10px;
  font-weight: 300;
  color: rgba(255,160,190,0.5);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 2px 0 0;
}

/* ── Progress ── */
.cp-progress-wrap { width: 100%; }
.cp-progress-track {
  position: relative;
  height: 3px;
  background: rgba(255,150,180,0.12);
  border-radius: 2px;
  overflow: visible;
}
.cp-progress-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, rgba(200,60,110,0.8), rgba(255,180,210,0.95));
  border-radius: 2px;
  transition: width 0.25s linear;
}
.cp-progress-dot {
  position: absolute;
  top: 50%;
  left: 0%;
  width: 9px; height: 9px;
  background: #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 6px rgba(255,120,170,0.8);
  transition: left 0.25s linear, transform 0.2s ease;
  pointer-events: none;
}
.cp-progress-track:hover .cp-progress-dot { transform: translate(-50%, -50%) scale(1.4); }
.cp-times {
  display: flex;
  justify-content: space-between;
  margin-top: 5px;
  font-family: 'Jost', monospace;
  font-size: 9px;
  font-weight: 300;
  color: rgba(255,150,180,0.38);
  letter-spacing: 0.04em;
}

/* ── Controls ── */
.cp-controls { display: flex; align-items: center; justify-content: center; gap: 12px; }
.cp-btn {
  background: none;
  border: none;
  color: rgba(255,190,215,0.7);
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, background 0.2s, transform 0.18s cubic-bezier(.23,1,.32,1);
  padding: 0;
}
.cp-btn svg { display: block; }
.cp-prev-btn, .cp-next-btn { width: 32px; height: 32px; }
.cp-prev-btn svg, .cp-next-btn svg { width: 18px; height: 18px; }
.cp-play-btn {
  width: 44px; height: 44px;
  background: rgba(255,150,180,0.1);
  border: 1px solid rgba(255,150,180,0.2);
}
.cp-play-btn svg { width: 22px; height: 22px; }
.cp-btn:hover { color: #fff; transform: scale(1.12); background: rgba(255,150,180,0.1); }
.cp-btn:active { transform: scale(0.93); }
.cp-play-btn:hover { background: rgba(255,150,180,0.2); border-color: rgba(255,150,180,0.4); }

@keyframes cp-play-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(200,60,110,0.4); }
  70%  { box-shadow: 0 0 0 10px rgba(200,60,110,0); }
  100% { box-shadow: 0 0 0 0 rgba(200,60,110,0); }
}
#cp-root.cp-playing .cp-play-btn { animation: cp-play-pulse 2.2s ease-out infinite; }

/* ── Volume ── */
.cp-vol-row { display: flex; align-items: center; gap: 7px; }
.cp-vol-icon { width: 14px; height: 14px; flex-shrink: 0; color: rgba(255,150,180,0.32); }
.cp-vol-track { position: relative; flex: 1; height: 3px; background: rgba(255,150,180,0.12); border-radius: 2px; }
.cp-vol-fill {
  position: absolute;
  inset: 0;
  width: 75%;
  background: linear-gradient(90deg, rgba(180,50,100,0.65), rgba(255,150,180,0.8));
  border-radius: 2px;
  pointer-events: none;
  transition: width 0.05s linear;
}
.cp-vol-input {
  position: absolute;
  inset: -8px 0;
  width: 100%;
  opacity: 0;
  cursor: pointer;
  height: 20px;
  margin: 0;
}

/* ── Close button inside panel (top-right) ── */
.cp-mini-btn {
  position: absolute;
  top: 8px; right: 8px;
  z-index: 10;
  background: rgba(255,150,180,0.07);
  border: 1px solid rgba(255,150,180,0.12);
  border-radius: 50%;
  width: 22px; height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255,150,180,0.4);
  transition: color 0.2s, background 0.2s, transform 0.15s;
  padding: 0;
}
.cp-mini-btn svg { width: 12px; height: 12px; }
.cp-mini-btn:hover { color: #fff; background: rgba(255,150,180,0.18); transform: scale(1.1); }

/* ── Fallback ── */
.cp-fallback {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8,2,14,0.88);
  border-radius: inherit;
  cursor: pointer;
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-size: 12px;
  color: rgba(255,180,210,0.8);
  letter-spacing: 0.05em;
  transition: opacity 0.3s ease;
}
.cp-hidden { display: none !important; }

@media (max-width: 600px) {
  #cp-toggle-btn { bottom: 16px; right: 16px; width: 46px; height: 46px; }
  #cp-root { bottom: 74px; right: 16px; width: 200px; border-radius: 16px; }
  .cp-title { font-size: 12px; }
  .cp-play-btn { width: 40px; height: 40px; }
  .cp-play-btn svg { width: 20px; height: 20px; }
}
    `;
    document.head.appendChild(s);
  }

  /* Panel open/close state */
  let isPanelOpen = false;
  let toggleBtn   = null;

  function openPanel() {
    isPanelOpen = true;
    root.classList.add('cp-visible');
    toggleBtn.classList.add('cp-panel-open');
    toggleBtn.setAttribute('aria-expanded', 'true');
  }

  function closePanel() {
    isPanelOpen = false;
    root.classList.remove('cp-visible');
    toggleBtn.classList.remove('cp-panel-open');
    toggleBtn.setAttribute('aria-expanded', 'false');
  }

  function togglePanel() {
    isPanelOpen ? closePanel() : openPanel();
  }

  return { build, sync, showFallback, openPanel, closePanel, togglePanel };
})();



/* ─────────────────────────────────────────────
   4. SECTION ATMOSPHERE
   ───────────────────────────────────────────── */
function initSectionAtmosphere() {
  if (!Object.keys(SECTION_MUSIC_MAP).length) return;
  const sections = document.querySelectorAll('section[id]');
  if (!sections.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const id = SECTION_MUSIC_MAP[e.target.id];
      if (id) AudioEngine.switchTo(id, true);
    });
  }, { threshold: 0.45 });
  sections.forEach(s => obs.observe(s));
}


/* ─────────────────────────────────────────────
   5. INTRO SYNC
   ───────────────────────────────────────────── */
function patchIntroForAudio() {
  const orig = window.transitionToMain;
  if (typeof orig === 'function') {
    window.transitionToMain = function () {
      AudioEngine.cinematicFade(1.2);
      orig.apply(this, arguments);
      setTimeout(() => AudioEngine.cinematicFadeIn(2.5), 1600);
    };
  }
  const gift = document.getElementById('gift-container');
  if (gift) gift.addEventListener('click', () => AudioEngine.unlock(), { once: true });
}


/* ─────────────────────────────────────────────
   6. AUTOPLAY GATE
   ───────────────────────────────────────────── */
function setupAutoplayGate() {
  const EVS = ['click','touchstart','keydown','pointerdown'];
  let done = false;
  function go() {
    if (done) return;
    done = true;
    EVS.forEach(e => document.removeEventListener(e, go, true));
    AudioEngine.unlock();
  }
  EVS.forEach(e => document.addEventListener(e, go, { capture: true }));
}


/* ─────────────────────────────────────────────
   7. BOOT
   ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  UI.build();
  patchIntroForAudio();
  setupAutoplayGate();
  initSectionAtmosphere();
});

window.AudioSystem = AudioEngine;

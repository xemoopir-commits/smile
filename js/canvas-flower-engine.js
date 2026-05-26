/* ================================================================
   CANVAS FLOWER ENGINE — Professional Cinematic Particle System
   ================================================================
   Core architecture:
   • Single RAF loop shared across ALL subsystems (zero racing loops)
   • Offscreen pre-rendered petal textures (no per-frame ctx.filter)
   • Gradient cache for orbs and dust (create once, reuse forever)
   • Particle pool recycling (zero GC pressure)
   • Device-adaptive quality with runtime FPS monitoring
   ================================================================ */

'use strict';

window.FlowerEngine = (() => {

  /* ── Constants ── */
  const TAU = Math.PI * 2;

  /* ── State ── */
  let canvas, ctx;
  let W = window.innerWidth;
  let H = window.innerHeight;
  let scrollVel = 0;
  let tick = 0;
  let lastFrame = 0;

  // Tier set by DeviceTierSystem before init
  const TIER = window.DeviceTier ? window.DeviceTier.tier : 'high';

  const CFG = {
    high: { l1:70, l2:45, l3:0, dust:50, l4Interval:99999, blur:true,  fps:60, dpr:Math.min(window.devicePixelRatio||1,2) },
    mid:  { l1:45, l2:28, l3:0, dust:30, l4Interval:99999, blur:false, fps:60, dpr:Math.min(window.devicePixelRatio||1,1.5) },
    low:  { l1:25, l2:14, l3:0, dust:16, l4Interval:99999, blur:false, fps:30, dpr:1 },
  }[TIER];

  const FRAME_MS = 1000 / CFG.fps;

  /* ════════════════════════════════════════════════════════════════
     OFFSCREEN PETAL TEXTURES
     Pre-render every petal shape + blur once. Re-use as bitmap.
     This completely eliminates ctx.filter on the main canvas.
  ═══════════════════════════════════════════════════════════════ */
  const TEX = {};

  function _makeOffscreen(size) {
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(size, size);
    }
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }

  function buildTextures() {
    // Sizes used: L1(6px), L2(13px), L3(22px), L4(93px), dust(9px)
    const defs = [
      { key:'sak_sm',  type:'sakura', sz:16,  blur: CFG.blur ? 1.5 : 0 },
      { key:'sak_md',  type:'sakura', sz:32,  blur: CFG.blur ? 0   : 0 },
      { key:'sak_lg',  type:'sakura', sz:64,  blur: CFG.blur ? 0   : 0 },
      { key:'sak_xl',  type:'sakura', sz:192, blur: CFG.blur ? 18  : 4  },
      { key:'rose_md', type:'rose',   sz:32,  blur: 0 },
      { key:'rose_lg', type:'rose',   sz:64,  blur: 0 },
      { key:'soft_sm', type:'soft',   sz:16,  blur: CFG.blur ? 1.5 : 0 },
      { key:'soft_md', type:'soft',   sz:32,  blur: 0 },
      { key:'dust',    type:'dust',   sz:24,  blur: 0 },
    ];

    const COLORS = {
      bg:     ['rgba(170,70,110,1)', 'rgba(130,50,90,1)',  'rgba(190,80,125,1)', 'rgba(150,60,100,1)'],
      mid:    ['rgba(215,95,145,1)', 'rgba(235,120,165,1)','rgba(250,140,175,1)','rgba(195,80,125,1)'],
      fg:     ['rgba(255,150,185,1)','rgba(255,120,165,1)','rgba(235,95,140,1)', 'rgba(255,170,205,1)'],
      cinema: ['rgba(255,130,175,1)','rgba(195,70,125,1)', 'rgba(255,95,145,1)'],
    };

    defs.forEach(d => {
      const pad  = d.blur + 4;
      const full = d.sz + pad * 2;
      const oc   = _makeOffscreen(full);
      const c    = oc.getContext('2d');
      c.clearRect(0, 0, full, full);

      const cx = full / 2, cy = full / 2, s = d.sz / 2;

      const palette = d.type === 'dust' ? null : (
        d.sz <= 16 ? COLORS.bg :
        d.sz <= 32 ? COLORS.mid :
        d.sz <= 64 ? COLORS.fg : COLORS.cinema
      );
      const color = palette ? palette[0] : 'rgba(255,195,215,1)';

      if (d.blur > 0) c.filter = `blur(${d.blur}px)`;

      if (d.type === 'sakura') {
        c.save();
        c.translate(cx, cy);
        c.beginPath();
        c.moveTo(0, -s);
        c.bezierCurveTo(s*0.8,-s*0.8, s*0.9,s*0.3, 0,s*0.6);
        c.bezierCurveTo(-s*0.9,s*0.3, -s*0.8,-s*0.8, 0,-s);
        c.fillStyle = color;
        c.fill();
        c.globalAlpha = 0.25;
        c.strokeStyle = 'rgba(255,255,255,0.6)';
        c.lineWidth = s * 0.07;
        c.beginPath(); c.moveTo(0,-s*0.75); c.lineTo(0,s*0.5); c.stroke();
        c.restore();
      } else if (d.type === 'rose') {
        c.save();
        c.translate(cx, cy);
        c.beginPath();
        c.ellipse(0, 0, s*0.5, s, 0, 0, TAU);
        c.fillStyle = color;
        c.fill();
        c.globalAlpha = 0.2;
        c.beginPath();
        c.ellipse(-s*0.1,-s*0.3, s*0.13,s*0.32, -0.3, 0, TAU);
        c.fillStyle = 'rgba(255,255,255,0.9)';
        c.fill();
        c.restore();
      } else if (d.type === 'soft') {
        c.save();
        c.translate(cx, cy);
        c.beginPath();
        c.ellipse(0, 0, s*0.38, s*0.85, 0, 0, TAU);
        c.fillStyle = color;
        c.fill();
        c.restore();
      } else if (d.type === 'dust') {
        // Micro petal teardrop — replaces circular glow dot
        c.save();
        c.translate(cx, cy);
        const ps = s * 1.2;
        c.beginPath();
        c.moveTo(0, -ps);
        c.bezierCurveTo(ps*0.7, -ps*0.7, ps*0.75, ps*0.2, 0, ps*0.5);
        c.bezierCurveTo(-ps*0.75, ps*0.2, -ps*0.7, -ps*0.7, 0, -ps);
        c.fillStyle = 'rgba(255,185,210,0.82)';
        c.fill();
        // subtle vein line
        c.strokeStyle = 'rgba(255,225,240,0.4)';
        c.lineWidth = ps * 0.08;
        c.beginPath();
        c.moveTo(0, -ps * 0.7);
        c.lineTo(0, ps * 0.42);
        c.stroke();
        c.restore();
      }

      if (d.blur > 0) c.filter = 'none';
      TEX[d.key] = { oc, full, pad, sz: d.sz };
    });
  }

  /* ════════════════════════════════════════════════════════════════
     GRADIENT CACHE for glow orbs — create once, reuse
  ═══════════════════════════════════════════════════════════════ */
  const GRAD_CACHE = new Map();
  function getOrbGrad(x, y, r, col) {
    // Key by rounded position (orbs move slowly, 4px precision is fine)
    const key = `${col}|${(x/4)|0}|${(y/4)|0}|${(r/4)|0}`;
    if (GRAD_CACHE.has(key)) return GRAD_CACHE.get(key);
    if (GRAD_CACHE.size > 32) GRAD_CACHE.clear(); // prevent unbounded growth
    const g = ctx.createRadialGradient(x,y,0, x,y,r);
    g.addColorStop(0,   col + ',0.07)');
    g.addColorStop(0.5, col + ',0.02)');
    g.addColorStop(1,   col + ',0)');
    GRAD_CACHE.set(key, g);
    return g;
  }

  /* ════════════════════════════════════════════════════════════════
     COLOR PALETTES
  ═══════════════════════════════════════════════════════════════ */
  const PAL = {
    bg:     ['rgba(170,70,110', 'rgba(130,50,90',  'rgba(190,80,125', 'rgba(150,60,100'],
    mid:    ['rgba(215,95,145', 'rgba(235,120,165','rgba(250,140,175','rgba(195,80,125'],
    fg:     ['rgba(255,150,185','rgba(255,120,165','rgba(235,95,140', 'rgba(255,170,205'],
    cinema: ['rgba(255,130,175','rgba(195,70,125', 'rgba(255,95,145'],
    dust:   ['rgba(255,195,215','rgba(247,195,110','rgba(255,175,200','rgba(255,215,235','rgba(195,145,200'],
  };
  const rc = p => p[(Math.random() * p.length) | 0];

  /* ════════════════════════════════════════════════════════════════
     PARTICLE POOLS — typed arrays where possible for speed
  ═══════════════════════════════════════════════════════════════ */
  const L1 = [], L2 = [], L3 = [], DUST = [], L4 = [];
  let l4Timer = 0;

  function _spawnL1(scatter) {
    return {
      x:     Math.random() * W,
      y:     scatter ? Math.random() * H * 1.5 : -20,
      sz:    Math.random() * 3.5 + 1.5,      // 1.5–5px, small elegant petals
      rot:   Math.random() * TAU,
      rspd:  (Math.random() - 0.5) * 0.009,
      vx:    (Math.random() - 0.5) * 0.28,
      vy:    Math.random() * 0.20 + 0.06,
      alpha: Math.random() * 0.25 + 0.06,
      phase: Math.random() * TAU,
      pspd:  Math.random() * 0.005 + 0.002,
      par:   0.06 + Math.random() * 0.09,
      type:  Math.random() > 0.5 ? 0 : 2,
      col:   rc(PAL.bg),
    };
  }
  function _spawnL2(scatter) {
    return {
      x:     Math.random() * W,
      y:     scatter ? Math.random() * H * 1.5 : -30,
      sz:    Math.random() * 5 + 4,           // 4–9px, medium petals (was 5–13!)
      rot:   Math.random() * TAU,
      rspd:  (Math.random() - 0.5) * 0.014,
      vx:    (Math.random() - 0.5) * 0.40,
      vy:    Math.random() * 0.32 + 0.12,
      alpha: Math.random() * 0.35 + 0.12,
      phase: Math.random() * TAU,
      pspd:  Math.random() * 0.007 + 0.003,
      sway:  Math.random() * 0.9 + 0.3,
      par:   0.14 + Math.random() * 0.14,
      type:  (Math.random() * 3) | 0,
      col:   rc(PAL.mid),
    };
  }
  function _spawnL3(scatter) {
    // L3 count is 0 — kept as stub so initPools doesn't break
    return {
      x: 0, y: -999, sz: 1, rot: 0, rspd: 0,
      vx: 0, vy: 0, alpha: 0, phase: 0, pspd: 0,
      sway: 0, par: 0, type: 0, col: rc(PAL.fg),
    };
  }
  function _spawnDust(scatter) {
    return {
      x:        Math.random() * W,
      y:        scatter ? Math.random() * H : -10,
      sz:       Math.random() * 2.8 + 1.2,
      vy:       Math.random() * 0.16 + 0.04,
      vx:       (Math.random() - 0.5) * 0.12,
      rot:      Math.random() * TAU,
      rspd:     (Math.random() - 0.5) * 0.022,
      alpha:    0,
      alphaMax: Math.random() * 0.38 + 0.08,
      phase:    Math.random() * TAU,
      pspd:     Math.random() * 0.016 + 0.004,
      par:      0.07 + Math.random() * 0.1,
      col:      rc(PAL.dust),
    };
  }
  function _spawnL4() {
    const left = Math.random() > 0.5;
    return {
      x:        left ? -130 : W + 130,
      y:        Math.random() * H * 0.85,
      sz:       Math.random() * 55 + 38,
      rot:      Math.random() * TAU,
      rspd:     (Math.random() - 0.5) * 0.004,
      vx:       left ? Math.random() * 1.1 + 0.35 : -(Math.random() * 1.1 + 0.35),
      vy:       (Math.random() - 0.5) * 0.25,
      alpha:    0,
      alphaMax: Math.random() * 0.16 + 0.05,
      phase:    Math.random() * TAU,
      col:      rc(PAL.cinema),
    };
  }

  function initPools() {
    L1.length = L2.length = L3.length = DUST.length = L4.length = 0;
    for (let i = 0; i < CFG.l1;   i++) L1.push(_spawnL1(true));
    for (let i = 0; i < CFG.l2;   i++) L2.push(_spawnL2(true));
    for (let i = 0; i < CFG.l3;   i++) L3.push(_spawnL3(true));
    for (let i = 0; i < CFG.dust; i++) DUST.push(_spawnDust(true));
  }

  /* ORBS / bokeh halos — removed entirely, full petal-only background */
  function buildOrbs() { /* no-op */ }

  /* ════════════════════════════════════════════════════════════════
     DRAW HELPERS — bitmap-based (no ctx.filter on hot path)
  ═══════════════════════════════════════════════════════════════ */
  function drawPetalBitmap(p, texKey) {
    const t = TEX[texKey];
    if (!t) return;
    const a = p.alpha * (0.75 + 0.25 * Math.sin(p.phase));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = a;
    // Tint: draw with composite to vary color per particle
    // Simple approach: draw white texture then multiply — but for perf,
    // we just draw the pre-colored texture and accept shared color within layer.
    ctx.drawImage(t.oc, -t.full/2, -t.full/2);
    ctx.restore();
  }

  // For L4 (rare big blurred petals), we use the xl texture (pre-blurred)
  function drawL4Petal(p) {
    const t = TEX['sak_xl'];
    if (!t) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.alpha;
    ctx.drawImage(t.oc, -t.full/2, -t.full/2);
    ctx.restore();
  }

  function drawDust(p) {
    const t = TEX['dust'];
    if (!t) return;
    const scale = p.sz / 1.5;
    const a = p.alpha * (0.6 + 0.4 * Math.sin(p.phase));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(scale, scale);
    ctx.globalAlpha = a;
    ctx.drawImage(t.oc, -t.full/2, -t.full/2);
    ctx.restore();
  }

  function getTexKey(type, sz) {
    if (type === 1) return sz > 10 ? 'rose_lg' : 'rose_md';
    if (type === 2) return sz > 8  ? 'soft_md' : 'soft_sm';
    // sakura
    if (sz > 15) return 'sak_lg';
    if (sz > 7)  return 'sak_md';
    return 'sak_sm';
  }

  /* ════════════════════════════════════════════════════════════════
     MAIN RENDER LOOP — single RAF, FPS-throttled
  ═══════════════════════════════════════════════════════════════ */
  let _rafId = null;
  let _running = false;

  function render(now) {
    if (!_running) return;
    _rafId = requestAnimationFrame(render);

    // FPS throttle for low-end
    if (now - lastFrame < FRAME_MS) return;
    lastFrame = now;

    if (document.hidden) return;
    tick++;

    ctx.clearRect(0, 0, W * CFG.dpr, H * CFG.dpr);

    // No orbs / blobs — pure petal rain only

    // Layer 1 — tiny blurred background petals (bitmap, pre-blurred)
    for (let i = 0; i < L1.length; i++) {
      const p = L1[i];
      p.phase += p.pspd; p.rot += p.rspd;
      p.x += p.vx + Math.sin(p.phase) * 0.35;
      p.y += p.vy - scrollVel * p.par * 0.015;
      if (p.y > H + 25 || p.x < -25 || p.x > W + 25) { L1[i] = _spawnL1(false); continue; }
      drawPetalBitmap(p, getTexKey(p.type, p.sz));
    }

    // Micro Petals (was: circular dust)
    for (let i = 0; i < DUST.length; i++) {
      const p = DUST[i];
      p.phase += p.pspd;
      p.rot   += p.rspd;
      p.x += p.vx + Math.sin(p.phase * 0.6) * 0.18;
      p.y += p.vy - scrollVel * p.par * 0.01;
      if (p.alpha < p.alphaMax) p.alpha = Math.min(p.alphaMax, p.alpha + 0.007);
      if (p.y > H + 15) { DUST[i] = _spawnDust(false); continue; }
      drawDust(p);
    }

    // Layer 2
    for (let i = 0; i < L2.length; i++) {
      const p = L2[i];
      p.phase += p.pspd; p.rot += p.rspd;
      p.x += p.vx + Math.sin(p.phase) * p.sway;
      p.y += p.vy - scrollVel * p.par * 0.015;
      if (p.y > H + 40 || p.x < -40 || p.x > W + 40) { L2[i] = _spawnL2(false); continue; }
      drawPetalBitmap(p, getTexKey(p.type, p.sz));
    }

    // Layer 3
    for (let i = 0; i < L3.length; i++) {
      const p = L3[i];
      p.phase += p.pspd; p.rot += p.rspd;
      p.x += p.vx + Math.sin(p.phase) * p.sway;
      p.y += p.vy - scrollVel * p.par * 0.015;
      if (p.y > H + 60 || p.x < -60 || p.x > W + 60) { L3[i] = _spawnL3(false); continue; }
      drawPetalBitmap(p, getTexKey(p.type, p.sz));
    }

    // Depth haze
    const fog = ctx.createLinearGradient(0, H * 0.72, 0, H);
    fog.addColorStop(0, 'rgba(25,4,16,0)');
    fog.addColorStop(1, 'rgba(25,4,16,0.09)');
    ctx.fillStyle = fog;
    ctx.globalAlpha = 1;
    ctx.fillRect(0, H * 0.72, W, H * 0.28);

    // Decay scroll velocity
    scrollVel *= 0.88;
  }

  /* ── Scroll ── */
  let lastSY = 0;
  function onScroll() {
    const sy = window.scrollY;
    scrollVel += (sy - lastSY) * 0.35;
    lastSY = sy;
  }

  /* ── Resize ── */
  let _resizeRaf = null;
  function onResize() {
    cancelAnimationFrame(_resizeRaf);
    _resizeRaf = requestAnimationFrame(() => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width  = (W * CFG.dpr) | 0;
      canvas.height = (H * CFG.dpr) | 0;
      canvas.style.width  = W + 'px';
      canvas.style.height = H + 'px';
      ctx.scale(CFG.dpr, CFG.dpr);
      buildOrbs();
    });
  }

  /* ── Init ── */
  function init() {
    canvas = document.createElement('canvas');
    canvas.id = 'floral-canvas';
    canvas.style.cssText = [
      'position:fixed','top:0','left:0',
      'width:100%','height:100%',
      'pointer-events:none',
      'z-index:2',
      'transform:translate3d(0,0,0)',
      'backface-visibility:hidden',
    ].join(';');
    canvas.width  = (W * CFG.dpr) | 0;
    canvas.height = (H * CFG.dpr) | 0;
    ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    ctx.scale(CFG.dpr, CFG.dpr);

    // Always insert at body level — fixed canvas must cover ALL sections during scroll
    document.body.insertBefore(canvas, document.body.firstChild);

    buildTextures();
    initPools();
    buildOrbs();

    window.addEventListener('resize',           onResize, { passive: true });
    window.addEventListener('scroll',           onScroll, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !_running) { _running = true; requestAnimationFrame(render); }
    });

    _running = true;
    requestAnimationFrame(render);
  }

  return { init };
})();

window.initFloralAtmosphere = () => window.FlowerEngine.init();

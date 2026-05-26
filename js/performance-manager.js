/* ================================================================
   PERFORMANCE MANAGER v2 — Adaptive quality + runtime FPS monitor
   ================================================================ */

'use strict';

window.PerfManager = (() => {

  const tier = (window.DeviceTier || { tier: 'high' }).tier;

  const PRESETS = {
    high: {
      mainParticles:   55, introParticles:  50, finaleParticles: 80,
      fallingPetals:   { normal: 18, slow: 6, faint: 10 },
      orbCount: 6, floralLayers: 4, backdropBlur: 18,
      useGlowGradient: true, useParallax: true, useCursorTrail: true,
    },
    mid: {
      mainParticles:   32, introParticles:  28, finaleParticles: 45,
      fallingPetals:   { normal: 10, slow: 3, faint: 5 },
      orbCount: 4, floralLayers: 2, backdropBlur: 12,
      useGlowGradient: false, useParallax: true, useCursorTrail: true,
    },
    low: {
      mainParticles:   18, introParticles:  14, finaleParticles: 22,
      fallingPetals:   { normal: 6, slow: 0, faint: 3 },
      orbCount: 2, floralLayers: 1, backdropBlur: 6,
      useGlowGradient: false, useParallax: false, useCursorTrail: false,
    },
  };

  const settings = PRESETS[tier];

  /* ── Runtime FPS monitor — downgrades quality if FPS is bad ── */
  let fpsFrames = 0, fpsStart = performance.now(), _downgraded = false;

  function monitorFPS() {
    fpsFrames++;
    const now = performance.now();
    if (now - fpsStart >= 3000) {
      const fps = fpsFrames / ((now - fpsStart) / 1000);
      fpsStart  = now;
      fpsFrames = 0;
      if (fps < 28 && !_downgraded) {
        _downgraded = true;
        document.documentElement.classList.replace('tier-' + tier, 'tier-low');
        document.body.classList.add('perf-low');
        document.body.classList.remove('perf-mid','perf-high');
        // Reduce particles at runtime
        if (window.FlowerEngine && window.FlowerEngine.downgrade) {
          window.FlowerEngine.downgrade();
        }
      }
    }
    requestAnimationFrame(monitorFPS);
  }

  function applyCSS() {
    if (tier !== 'high') {
      const s = document.createElement('style');
      s.textContent = `.glass{backdrop-filter:blur(${settings.backdropBlur}px)!important;-webkit-backdrop-filter:blur(${settings.backdropBlur}px)!important}`;
      document.head.appendChild(s);
    }
    document.querySelectorAll('.hero-flower,.heart-pulse').forEach(el => {
      el.style.willChange = 'transform';
    });
    ['particle-canvas','particle-canvas-intro','finale-canvas'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.transform = 'translate3d(0,0,0)';
    });
  }

  requestAnimationFrame(monitorFPS);

  return { tier, settings, applyCSS };
})();

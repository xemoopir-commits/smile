/* =============================================
   MAIN.JS — Optimized main site interactivity
   GPU-accelerated · RAF-batched · adaptive
   ============================================= */

'use strict';

window.initMainSite = function () {
  const perf = window.PerfManager ? window.PerfManager.settings : {};

  if (window.initFloralAtmosphere) window.initFloralAtmosphere();
  _spawnFallingPetals(perf);
  _spawnFloatingOrbs(perf);
  initScrollReveal();
  if (perf.useCursorTrail !== false) initCursorTrail();
  initSmoothScroll();
  if (perf.useParallax !== false) initScrollParallax();

  // Apply body perf class
  if (window.PerfManager) {
    document.body.classList.add('perf-' + window.PerfManager.tier);
    window.PerfManager.applyCSS();
  }
};

/* ===========================
   FALLING PETALS — adaptive
   =========================== */
const PETAL_SET = ['🌸','🌺','🌷','🌼','🌸','🌹','🪷','🌸','🌺','🌸'];

function _spawnFallingPetals(perf) {
  const container = document.getElementById('falling-petals');
  if (!container) return;

  // Increased counts for full-page ambient coverage
  const cfg = (perf && perf.fallingPetals) || { normal: 18, slow: 6, faint: 10 };

  // Use CSS animation only (no JS per-frame work)
  // Use animationend instead of setTimeout — no timer drift, no memory leaks
  function createPetal(group) {
    const p = document.createElement('div');
    p.className = 'falling-petal';
    p.textContent = PETAL_SET[(Math.random() * PETAL_SET.length) | 0];

    const left     = Math.random() * 108 - 4;
    const duration = group === 'slow'
      ? Math.random() * 14 + 14
      : Math.random() * 9 + 9;
    const delay   = Math.random() * 12;
    const size    = group === 'large' ? Math.random() * 0.5 + 1.1 : Math.random() * 0.5 + 0.4;
    const opacity = group === 'faint' ? 0.2 + Math.random() * 0.2 : 0.35 + Math.random() * 0.3;

    p.style.cssText = `left:${left}%;font-size:${size}rem;animation-duration:${duration}s;animation-delay:${delay}s;opacity:${opacity}`;
    container.appendChild(p);

    // Clean up and respawn on animation end — zero setTimeout, zero drift
    p.addEventListener('animationend', function recycle() {
      p.remove();
      createPetal(group);
    }, { once: true });
  }

  for (let i = 0; i < cfg.normal; i++) createPetal('normal');
  for (let i = 0; i < cfg.slow;   i++) createPetal('slow');
  for (let i = 0; i < cfg.faint;  i++) createPetal('faint');
}

/* _spawnFloatingOrbs removed — using canvas petal rain only */
function _spawnFloatingOrbs() { /* no-op */ }

/* ===========================
   SCROLL PARALLAX — RAF-batched
   =========================== */
function initScrollParallax() {
  // falling-petals is fixed — no scroll offset needed; applying translateY would push it offscreen
  // orbs layer similarly fixed. Keep this function as no-op to preserve call sites.
}

/* ===========================
   SCROLL REVEAL — IntersectionObserver
   =========================== */
function initScrollReveal() {
  const cards = document.querySelectorAll('.reveal-card');
  if (!cards.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target); // fire once, save memory
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });

  cards.forEach(c => io.observe(c));
}

/* ===========================
   CURSOR TRAIL — throttled
   =========================== */
const TRAIL_PETALS = ['🌸','✨','🌺','💖','🌷','⋆','🌹','✦'];
let _lastTrail = 0;

function initCursorTrail() {
  if (window.matchMedia('(hover: none)').matches) return;

  document.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - _lastTrail < 120) return;
    _lastTrail = now;

    const el = document.createElement('div');
    el.className = 'cursor-petal';
    el.textContent = TRAIL_PETALS[Math.floor(Math.random() * TRAIL_PETALS.length)];
    el.style.cssText = `
      left: ${e.clientX - 10}px;
      top:  ${e.clientY - 10}px;
      font-size: ${Math.random() * 9 + 10}px;
      animation-duration: ${Math.random() * 0.4 + 0.55}s;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }, { passive: true });
}

/* ===========================
   SMOOTH SCROLL — native
   =========================== */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ===========================
   GARDEN & GALLERY — interactions
   =========================== */
document.addEventListener('DOMContentLoaded', () => {

  /* Garden hover sparkles */
  document.querySelectorAll('.garden-flower').forEach(flower => {
    flower.addEventListener('mouseenter', () => {
      const frag = document.createDocumentFragment();
      const symbols = ['✨','⋆','✦','✧','🌸'];
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          const s = document.createElement('span');
          s.style.cssText = `
            position: absolute;
            pointer-events: none;
            font-size: ${Math.random() * 10 + 8}px;
            top: ${Math.random() * 60 - 30 + 28}px;
            left: ${Math.random() * 60 - 30 + 14}px;
            animation: cursor-fade 0.75s ease forwards;
            z-index: 20;
          `;
          s.textContent = symbols[Math.floor(Math.random() * symbols.length)];
          flower.appendChild(s);
          setTimeout(() => s.remove(), 750);
        }, i * 65);
      }
    });
  });

  /* Gallery 3D tilt */
  document.querySelectorAll('.gallery-card').forEach(card => {
    let animFrame;
    card.addEventListener('mousemove', e => {
      cancelAnimationFrame(animFrame);
      animFrame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const cx   = (e.clientX - rect.left) / rect.width  - 0.5;
        const cy   = (e.clientY - rect.top)  / rect.height - 0.5;
        card.style.transform = `perspective(700px) rotateY(${cx * 9}deg) rotateX(${-cy * 9}deg) scale3d(1.03,1.03,1)`;
      });
    }, { passive: true });
    card.addEventListener('mouseleave', () => {
      cancelAnimationFrame(animFrame);
      card.style.transform = '';
    });
  });

  /* Reason cards 3D tilt */
  document.querySelectorAll('.reason-card').forEach(card => {
    let animFrame;
    card.addEventListener('mousemove', e => {
      cancelAnimationFrame(animFrame);
      animFrame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const cx   = (e.clientX - rect.left) / rect.width  - 0.5;
        const cy   = (e.clientY - rect.top)  / rect.height - 0.5;
        card.style.transform = `perspective(900px) rotateY(${cx * 7}deg) rotateX(${-cy * 7}deg) translateY(-8px) scale3d(1.02,1.02,1)`;
      });
    }, { passive: true });
    card.addEventListener('mouseleave', () => {
      cancelAnimationFrame(animFrame);
      card.style.transform = '';
    });
  });

});

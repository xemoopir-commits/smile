/* =============================================
   PARTICLES.JS — Elegant falling petals
   Replaces all circular dots with organic
   sakura / rose / soft petal shapes.
   GPU-accelerated · adaptive particle counts
   ============================================= */

'use strict';

class ParticleSystem {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.particles = [];
    this.raf = null;
    this.active = true;

    const perf = window.PerfManager ? window.PerfManager.settings : {};

    this.options = {
      count:    options.count    || 40,
      colors:   options.colors   || ['rgba(200,60,100,', 'rgba(160,40,80,', 'rgba(220,80,120,'],
      minSize:  options.minSize  || 2,
      maxSize:  options.maxSize  || 7,
      speed:    options.speed    || 0.3,
    };

    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler, { passive: true });

    this._visHandler = () => {
      this.active = !document.hidden;
      if (this.active && !this.raf) this._loop();
    };
    document.addEventListener('visibilitychange', this._visHandler);

    this.resize();
    this.init();
    this._loop();
  }

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width  = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.scale(dpr, dpr);
    this._w = w;
    this._h = h;
  }

  init() {
    this.particles = [];
    for (let i = 0; i < this.options.count; i++) {
      this.particles.push(this._create());
    }
  }

  _create(atTop = false) {
    const color = this.options.colors[Math.floor(Math.random() * this.options.colors.length)];
    const w = this._w || window.innerWidth;
    const h = this._h || window.innerHeight;
    // 3 petal types: 0=sakura teardrop, 1=rose ellipse, 2=soft narrow petal
    const type = Math.floor(Math.random() * 3);
    return {
      x:      Math.random() * w,
      y:      atTop ? -20 : Math.random() * h,
      size:   Math.random() * (this.options.maxSize - this.options.minSize) + this.options.minSize,
      color,
      alpha:  Math.random() * 0.30 + 0.08,
      vx:     (Math.random() - 0.5) * this.options.speed,
      vy:     Math.random() * this.options.speed * 0.55 + 0.06,
      rot:    Math.random() * Math.PI * 2,
      rspd:   (Math.random() - 0.5) * 0.018,  // gentle rotation speed
      phase:  Math.random() * Math.PI * 2,
      pspd:   Math.random() * 0.012 + 0.003,  // breath oscillation
      sway:   Math.random() * 0.4 + 0.15,     // horizontal sway amplitude
      type,
    };
  }

  _drawPetal(p) {
    const ctx = this.ctx;
    const alpha = p.alpha * (0.55 + 0.45 * Math.sin(p.phase));
    const sz = p.size;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = alpha;

    if (p.type === 0) {
      // Sakura — classic teardrop
      ctx.beginPath();
      ctx.moveTo(0, -sz);
      ctx.bezierCurveTo(sz * 0.8, -sz * 0.8,  sz * 0.9,  sz * 0.3, 0,  sz * 0.55);
      ctx.bezierCurveTo(-sz * 0.9, sz * 0.3, -sz * 0.8, -sz * 0.8, 0, -sz);
      ctx.fillStyle = `${p.color}${alpha.toFixed(3)})`;
      ctx.fill();
      // delicate center vein
      ctx.globalAlpha = alpha * 0.28;
      ctx.strokeStyle = 'rgba(255,240,248,0.7)';
      ctx.lineWidth = sz * 0.07;
      ctx.beginPath();
      ctx.moveTo(0, -sz * 0.72);
      ctx.lineTo(0,  sz * 0.44);
      ctx.stroke();

    } else if (p.type === 1) {
      // Rose — slim upright ellipse with highlight
      ctx.beginPath();
      ctx.ellipse(0, 0, sz * 0.42, sz, 0, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color}${alpha.toFixed(3)})`;
      ctx.fill();
      // inner shimmer
      ctx.globalAlpha = alpha * 0.22;
      ctx.beginPath();
      ctx.ellipse(-sz * 0.1, -sz * 0.28, sz * 0.12, sz * 0.3, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();

    } else {
      // Soft narrow petal — tapered oval
      ctx.beginPath();
      ctx.ellipse(0, 0, sz * 0.32, sz * 0.88, 0, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color}${alpha.toFixed(3)})`;
      ctx.fill();
    }

    ctx.restore();
  }

  _loop() {
    if (!this.active) { this.raf = null; return; }
    this.raf = requestAnimationFrame(() => this._loop());

    const ctx = this.ctx;
    const w = this._w || window.innerWidth;
    const h = this._h || window.innerHeight;

    ctx.clearRect(0, 0, w, h);

    const particles = this.particles;
    const len = particles.length;
    for (let i = 0; i < len; i++) {
      const p = particles[i];
      p.phase += p.pspd;
      p.rot   += p.rspd;
      p.x     += p.vx + Math.sin(p.phase) * p.sway;
      p.y     += p.vy;

      if (p.y > h + 20) {
        particles[i] = this._create(true);
      } else {
        this._drawPetal(p);
      }
    }
  }

  destroy() {
    this.active = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._resizeHandler);
    document.removeEventListener('visibilitychange', this._visHandler);
  }
}

class FinaleParticles extends ParticleSystem {
  constructor(count) {
    super('finale-canvas', {
      count:   count || 60,
      colors:  ['rgba(220,80,120,', 'rgba(255,100,150,', 'rgba(247,160,80,', 'rgba(255,150,180,'],
      minSize: 2,
      maxSize: 6,
      speed:   0.22,
    });
  }

  resize() {
    if (!this.canvas) return;
    const section = document.getElementById('finale');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = section ? section.offsetWidth  : window.innerWidth;
    const h = section ? section.offsetHeight : window.innerHeight;
    this.canvas.width  = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.scale(dpr, dpr);
    this._w = w;
    this._h = h;
  }
}

window.__particleSystems = {};

window.initParticles = function () {
  const p = window.PerfManager ? window.PerfManager.settings : {};
  const mainCount   = p.mainParticles   || 38;
  const finaleCount = p.finaleParticles || 55;

  window.__particleSystems.main = new ParticleSystem('particle-canvas', {
    count:   mainCount,
    colors:  ['rgba(180,50,90,', 'rgba(140,30,70,', 'rgba(210,70,110,', 'rgba(160,40,80,', 'rgba(240,100,140,'],
    minSize: 1.5,
    maxSize: 6,
    speed:   0.25,
  });

  window.__particleSystems.finale = new FinaleParticles(finaleCount);
};

window.initIntroParticles = function () {
  const p = window.PerfManager ? window.PerfManager.settings : {};
  const introCount = p.introParticles || 32;

  window.__particleSystems.intro = new ParticleSystem('particle-canvas-intro', {
    count:   introCount,
    colors:  ['rgba(200,60,100,', 'rgba(160,40,80,', 'rgba(247,160,80,', 'rgba(220,80,120,'],
    minSize: 1.5,
    maxSize: 5,
    speed:   0.38,
  });
};

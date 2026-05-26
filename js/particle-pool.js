/* ================================================================
   PARTICLE POOL — Zero-allocation recycling pool
   Prevents GC pauses from constant new object creation.
   ================================================================ */

'use strict';

class ParticlePool {
  constructor(factory, size = 64) {
    this._factory = factory;
    this._pool    = [];
    this._active  = [];
    // Pre-warm
    for (let i = 0; i < size; i++) this._pool.push(factory());
  }

  acquire(init) {
    const p = this._pool.length > 0 ? this._pool.pop() : this._factory();
    if (init) Object.assign(p, init);
    this._active.push(p);
    return p;
  }

  release(p) {
    const idx = this._active.indexOf(p);
    if (idx !== -1) this._active.splice(idx, 1);
    this._pool.push(p);
  }

  releaseAll() {
    while (this._active.length) this._pool.push(this._active.pop());
  }

  get active() { return this._active; }
  get size()   { return this._active.length; }
}

window.ParticlePool = ParticlePool;

/* ================================================================
   RENDER LOOP — Unified RAF coordinator
   All animation systems register here; one loop runs all of them.
   Prevents multiple competing requestAnimationFrame loops.
   ================================================================ */

'use strict';

window.RenderLoop = (() => {
  const subscribers = new Map();
  let rafId = null;
  let running = false;
  let lastTime = 0;

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    if (document.hidden) return;
    const dt = Math.min(now - lastTime, 50); // cap at 50ms to prevent spiral
    lastTime = now;
    for (const fn of subscribers.values()) {
      try { fn(now, dt); } catch(e) { /* isolate subscriber errors */ }
    }
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Subscribe: fn(timestamp, deltaMs)
  function subscribe(id, fn) {
    subscribers.set(id, fn);
    if (!running) start();
  }

  function unsubscribe(id) {
    subscribers.delete(id);
    if (subscribers.size === 0) stop();
  }

  // Pause/resume on tab visibility
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    } else {
      if (running) { lastTime = performance.now(); rafId = requestAnimationFrame(tick); }
    }
  });

  return { subscribe, unsubscribe, start, stop };
})();

/* =============================================
   INTRO.JS — Gift box opening scene
   ============================================= */

let introStarted = false;

// Start intro particles immediately
document.addEventListener('DOMContentLoaded', () => {
  window.initIntroParticles();
  spawnIntroSparkles();
});

function spawnIntroSparkles() {
  const scene = document.getElementById('intro-scene');
  if (!scene) return;
  const symbols = ['✦', '✧', '⋆', '✸', '✹', '✺', '❋'];
  let count = 0;
  const max = 24;

  const interval = setInterval(() => {
    if (count >= max) { clearInterval(interval); return; }
    const s = document.createElement('div');
    s.className = 'sparkle';
    s.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    s.style.cssText = `
      left: ${Math.random() * 100}%;
      top:  ${Math.random() * 100}%;
      color: rgba(255,${Math.floor(Math.random()*80)+140},${Math.floor(Math.random()*60)+160},0.8);
      font-size: ${Math.random() * 16 + 8}px;
      animation-duration: ${Math.random() * 3 + 2}s;
      animation-delay: ${Math.random() * 2}s;
    `;
    scene.appendChild(s);
    count++;
  }, 200);
}

function openGift() {
  if (introStarted) return;
  introStarted = true;

  const container = document.getElementById('gift-container');
  const box       = document.getElementById('gift-box');
  const lid       = box.querySelector('.gift-lid');
  const hint      = container.querySelector('.gift-hint');

  // Remove hint
  hint.style.transition = 'opacity 0.3s';
  hint.style.opacity = '0';
  setTimeout(() => hint.remove(), 300);

  // Shake
  box.style.animation = 'gift-shake 0.6s ease';

  setTimeout(() => {
    // Fly lid
    lid.style.animation = 'lid-fly 0.9s cubic-bezier(0.25,0.46,0.45,0.94) forwards';

    // Bloom flowers burst
    setTimeout(() => burstFlowers(), 300);

    // Start petal rain
    setTimeout(() => startPetalRain(), 600);

    // Fade to main site
    setTimeout(() => transitionToMain(), 3200);
  }, 700);
}

const BLOOM_FLOWERS = ['🌸','🌺','🌹','🌷','🌼','🪷','💐','🌸','🌺','🌹','🌸','🌷'];

function burstFlowers() {
  const container = document.getElementById('bloom-container');
  if (!container) return;

  BLOOM_FLOWERS.forEach((flower, i) => {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'bloom-flower';
      el.textContent = flower;
      el.style.fontSize = `${Math.random() * 2 + 2}rem`;

      const angle  = (i / BLOOM_FLOWERS.length) * 360 + Math.random() * 30;
      const dist1  = Math.random() * 80 + 60;
      const dist2  = Math.random() * 140 + 100;
      const dist3  = Math.random() * 200 + 160;
      const rad    = (angle * Math.PI) / 180;

      const tx  = Math.cos(rad) * dist1 + 'px';
      const ty  = Math.sin(rad) * dist1 + 'px';
      const tx2 = Math.cos(rad) * dist2 + 'px';
      const ty2 = Math.sin(rad) * dist2 + 'px';
      const tx3 = Math.cos(rad) * dist3 + 'px';
      const ty3 = Math.sin(rad) * dist3 + 'px';
      const rot  = Math.random() * 180 - 90;
      const rot2 = Math.random() * 360 - 180;
      const rot3 = Math.random() * 540 - 270;

      el.style.setProperty('--tx',   tx);
      el.style.setProperty('--ty',   ty);
      el.style.setProperty('--tx2',  tx2);
      el.style.setProperty('--ty2',  ty2);
      el.style.setProperty('--tx3',  tx3);
      el.style.setProperty('--ty3',  ty3);
      el.style.setProperty('--rot',  `${rot}deg`);
      el.style.setProperty('--rot2', `${rot2}deg`);
      el.style.setProperty('--rot3', `${rot3}deg`);
      el.style.animation = 'bloom-burst 2.2s cubic-bezier(0.25,0.46,0.45,0.94) forwards';

      container.appendChild(el);
      setTimeout(() => el.remove(), 2400);
    }, i * 80);
  });
}

const PETAL_SYMBOLS = ['🌸','🌺','🌷','🌼','🌹','🪷','💐'];

function startPetalRain() {
  const rain = document.getElementById('petal-rain-intro');
  if (!rain) return;

  let count = 0;
  const maxPetals = 60;

  const interval = setInterval(() => {
    if (count >= maxPetals) { clearInterval(interval); return; }

    const p = document.createElement('div');
    p.className = 'intro-petal';
    p.textContent = PETAL_SYMBOLS[Math.floor(Math.random() * PETAL_SYMBOLS.length)];

    const left     = Math.random() * 100;
    const duration = Math.random() * 2 + 2;
    const delay    = Math.random() * 1.5;
    const size     = Math.random() * 1.2 + 0.8;

    p.style.cssText = `
      left: ${left}%;
      font-size: ${size}rem;
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
    `;

    rain.appendChild(p);
    setTimeout(() => p.remove(), (duration + delay + 0.5) * 1000);
    count++;
  }, 60);
}

function transitionToMain() {
  const overlay = document.getElementById('intro-overlay');
  const intro   = document.getElementById('intro-scene');
  const main    = document.getElementById('main-site');

  // Fade white overlay in
  overlay.classList.add('fade-in');

  setTimeout(() => {
    // Show main site
    main.classList.remove('hidden');
    main.classList.add('entering');
    window.initParticles();
    window.initMainSite();

    // Hide intro
    setTimeout(() => {
      intro.style.display = 'none';
    }, 400);
  }, 800);
}

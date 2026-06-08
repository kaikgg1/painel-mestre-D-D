// assets/js/polish.js
// Polimento de interface (auto-init, delegação global — funciona em qualquer tela):
//  • Ripple ao clicar em botões
//  • Tilt 3D em cards seguindo o mouse (desktop)
//  • Glow dourado ao focar inputs/selects/textareas
//  • Shimmer (classe .shimmer p/ skeletons de carregamento)
//  • Helper FX.contar(el, de, para) — contagem animada de número
// Respeita prefers-reduced-motion.

(function () {
  const reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CSS = `
  /* Ripple */
  .pl-ripple-host { position: relative; overflow: hidden; }
  .pl-ripple {
    position: absolute; border-radius: 50%; pointer-events: none;
    transform: translate(-50%, -50%) scale(0); opacity: 0.5;
    background: radial-gradient(circle, rgba(212,168,67,0.55), rgba(212,168,67,0) 70%);
    animation: plRipple 0.6s ease-out forwards;
  }
  @keyframes plRipple { to { transform: translate(-50%, -50%) scale(1); opacity: 0; } }

  /* Glow ao focar campos (sobrepõe a borda seca, sem quebrar layout) */
  input:focus-visible, select:focus-visible, textarea:focus-visible,
  [contenteditable="true"]:focus-visible {
    box-shadow: 0 0 0 2px rgba(184,138,44,0.35), 0 0 12px rgba(184,138,44,0.25) !important;
    transition: box-shadow 0.18s ease;
  }

  /* Tilt 3D — perspectiva aplicada via inline transform pelo JS */
  .pl-tilt { transition: transform 0.12s ease-out; transform-style: preserve-3d; will-change: transform; }

  /* Shimmer (skeleton de carregamento) */
  .shimmer {
    position: relative; overflow: hidden;
    background: rgba(255,255,255,0.04);
  }
  .shimmer::after {
    content: ''; position: absolute; inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(212,168,67,0.18), transparent);
    animation: plShimmer 1.3s infinite;
  }
  @keyframes plShimmer { 100% { transform: translateX(100%); } }

  @media (prefers-reduced-motion: reduce) {
    .pl-ripple, .shimmer::after { animation: none !important; }
    .pl-tilt { transition: none !important; }
  }
  `;

  function injetar() {
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ---- Ripple em botões ----
  function ligarRipple() {
    document.addEventListener('pointerdown', e => {
      const btn = e.target.closest('button, .btn, .tab, .back-link, .back-btn, .auth-btn');
      if (!btn || btn.disabled) return;
      const cs = getComputedStyle(btn);
      if (cs.position === 'static') btn.classList.add('pl-ripple-host');
      else btn.style.overflow = btn.style.overflow || 'hidden';
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 1.2;
      const sp = document.createElement('span');
      sp.className = 'pl-ripple';
      sp.style.width = sp.style.height = size + 'px';
      sp.style.left = (e.clientX - r.left) + 'px';
      sp.style.top = (e.clientY - r.top) + 'px';
      btn.appendChild(sp);
      setTimeout(() => sp.remove(), 620);
    }, { passive: true });
  }

  // ---- Tilt 3D em cards (só desktop com mouse fino) ----
  function ligarTilt() {
    if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const SEL = '.card, .criatura-card, .villain-card, .vilao-card, .slot-card';
    const MAX = 6; // graus
    let alvo = null;

    document.addEventListener('pointermove', e => {
      const card = e.target.closest(SEL);
      if (card !== alvo) {
        if (alvo) { alvo.style.transform = ''; alvo.classList.remove('pl-tilt'); }
        alvo = card;
        if (alvo) alvo.classList.add('pl-tilt');
      }
      if (!alvo) return;
      // não inclina enquanto interage com campos
      if (e.target.closest('input, textarea, select, button, [contenteditable="true"]')) {
        alvo.style.transform = ''; return;
      }
      const r = alvo.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      alvo.style.transform =
        `perspective(900px) rotateX(${(-py * MAX).toFixed(2)}deg) rotateY(${(px * MAX).toFixed(2)}deg)`;
    }, { passive: true });

    document.addEventListener('pointerleave', () => {
      if (alvo) { alvo.style.transform = ''; alvo.classList.remove('pl-tilt'); alvo = null; }
    }, true);
  }

  // ---- Helper: contagem animada de número ----
  function contar(el, de, para, dur) {
    if (!el) return;
    de = +de; para = +para;
    if (reduz || isNaN(de) || isNaN(para)) { el.textContent = para; return; }
    dur = dur || 450;
    const t0 = performance.now();
    function frame(t) {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(de + (para - de) * eased);
      if (k < 1) requestAnimationFrame(frame);
      else el.textContent = para;
    }
    requestAnimationFrame(frame);
  }

  injetar();
  if (!reduz) { ligarRipple(); ligarTilt(); }
  // expõe o helper de contagem (mescla com FX se já existir)
  window.FX = window.FX || {};
  window.FX.contar = contar;
})();

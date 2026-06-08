// assets/js/efeitos.js
// Efeitos visuais "dinâmicos" (juicy RPG) compartilhados por todas as telas.
// API global: window.FX
//   FX.dano(el, valor)      → shake + flash vermelho + número "-N" flutuante
//   FX.cura(el, valor)      → flash verde + número "+N" flutuante
//   FX.flutuante(el, txt, tipo)  tipo: 'dano'|'cura'|'arcano'|'neutro'|'critico'
//   FX.shake(el)            → tremor
//   FX.flash(el, tipo)      → flash de cor (dano|cura|arcano)
//   FX.pulso(el)            → pulso/scale rápido
//   FX.favorito(el, ativo)  → estrela bounce + faíscas douradas (só quando ativa)
//   FX.slot(el)             → glow arcano no pip
//   FX.novo(el)             → destaque "novo" ao adicionar
//   FX.salvo(el)            → pulso verde de confirmação
//   FX.rolar(el, final, cb) → embaralha números antes de assentar em `final`
//
// Respeita prefers-reduced-motion: efeitos de movimento são suprimidos,
// mas o resultado (ex.: número final do dado) é aplicado na hora.

(function () {
  const reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CSS = `
  @keyframes fxShake {
    0%,100% { transform: translateX(0); }
    15% { transform: translateX(-5px); } 30% { transform: translateX(5px); }
    45% { transform: translateX(-4px); } 60% { transform: translateX(4px); }
    75% { transform: translateX(-2px); } 90% { transform: translateX(2px); }
  }
  .fx-shake { animation: fxShake 0.45s ease-in-out; }

  @keyframes fxFlashDano { 0% { box-shadow: 0 0 0 0 rgba(196,48,43,0); } 25% { box-shadow: 0 0 24px 4px rgba(196,48,43,0.7); } 100% { box-shadow: 0 0 0 0 rgba(196,48,43,0); } }
  @keyframes fxFlashCura { 0% { box-shadow: 0 0 0 0 rgba(46,160,67,0); } 25% { box-shadow: 0 0 24px 4px rgba(80,200,100,0.7); } 100% { box-shadow: 0 0 0 0 rgba(46,160,67,0); } }
  @keyframes fxFlashArcano { 0% { box-shadow: 0 0 0 0 rgba(154,122,202,0); } 25% { box-shadow: 0 0 22px 4px rgba(184,138,44,0.6); } 100% { box-shadow: 0 0 0 0 rgba(154,122,202,0); } }
  .fx-flash-dano { animation: fxFlashDano 0.6s ease-out; }
  .fx-flash-cura { animation: fxFlashCura 0.6s ease-out; }
  .fx-flash-arcano { animation: fxFlashArcano 0.6s ease-out; }

  @keyframes fxPulso { 0% { transform: scale(1); } 40% { transform: scale(1.18); } 100% { transform: scale(1); } }
  .fx-pulso { animation: fxPulso 0.3s ease-out; }

  /* Número flutuante */
  .fx-float {
    position: fixed; z-index: 9999; pointer-events: none;
    transform: translate(-50%, 0);
    font-family: 'Cinzel', Georgia, serif; font-weight: 900;
    font-size: 22px; letter-spacing: 0.5px;
    text-shadow: 0 2px 4px rgba(0,0,0,0.9), 0 0 8px currentColor;
    animation: fxFloatUp 1.05s ease-out forwards;
    will-change: transform, opacity;
  }
  @keyframes fxFloatUp {
    0%   { opacity: 0; transform: translate(-50%, 4px) scale(0.7); }
    18%  { opacity: 1; transform: translate(-50%, -6px) scale(1.15); }
    35%  { transform: translate(-50%, -16px) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -52px) scale(1); }
  }
  .fx-float.fx-dano   { color: #ff5a4d; }
  .fx-float.fx-cura   { color: #6ee07a; }
  .fx-float.fx-arcano { color: #d4a843; }
  .fx-float.fx-neutro { color: #d4c5a0; }
  .fx-float.fx-critico { color: #ff3030; font-size: 30px; }

  /* Estrela favoritar */
  @keyframes fxFavBounce { 0% { transform: scale(1); } 35% { transform: scale(1.5) rotate(-12deg); } 70% { transform: scale(0.9) rotate(6deg); } 100% { transform: scale(1) rotate(0); } }
  .fx-fav-bounce { animation: fxFavBounce 0.5s cubic-bezier(.3,1.4,.5,1); }
  .fx-spark {
    position: fixed; z-index: 9999; pointer-events: none;
    width: 6px; height: 6px; border-radius: 50%;
    background: radial-gradient(circle, #ffe9a8, #d4a843);
    box-shadow: 0 0 6px #d4a843;
    will-change: transform, opacity;
  }

  /* Glow no slot/pip */
  @keyframes fxSlotGlow { 0% { box-shadow: 0 0 0 0 rgba(184,138,44,0.8); } 100% { box-shadow: 0 0 16px 6px rgba(184,138,44,0); } }
  .fx-slot { animation: fxSlotGlow 0.55s ease-out; }

  /* Card novo */
  @keyframes fxNovo {
    0% { opacity: 0; transform: translateY(-10px) scale(0.98); box-shadow: 0 0 0 2px rgba(184,138,44,0.8); }
    100% { opacity: 1; transform: translateY(0) scale(1); box-shadow: 0 0 0 0 rgba(184,138,44,0); }
  }
  .fx-novo { animation: fxNovo 0.6s ease-out; }

  /* Salvo */
  @keyframes fxSalvo { 0% { box-shadow: 0 0 0 0 rgba(80,200,100,0); } 30% { box-shadow: 0 0 14px 3px rgba(80,200,100,0.7); } 100% { box-shadow: 0 0 0 0 rgba(80,200,100,0); } }
  .fx-salvo { animation: fxSalvo 0.7s ease-out; }

  @media (prefers-reduced-motion: reduce) {
    .fx-shake, .fx-pulso, .fx-fav-bounce, .fx-slot, .fx-novo { animation: none !important; }
  }
  `;

  let _injetado = false;
  function injetar() {
    if (_injetado) return;
    _injetado = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function reanima(el, classe, dur) {
    if (!el) return;
    el.classList.remove(classe);
    void el.offsetWidth;           // força reflow pra reiniciar a animação
    el.classList.add(classe);
    setTimeout(() => el.classList.remove(classe), dur);
  }

  function shake(el) { if (!reduz) reanima(el, 'fx-shake', 480); }
  function flash(el, tipo = 'dano') { if (!reduz) reanima(el, 'fx-flash-' + tipo, 650); }
  function pulso(el) { if (!reduz) reanima(el, 'fx-pulso', 320); }
  function slot(el) { if (!reduz) reanima(el, 'fx-slot', 580); }
  function novo(el) { if (!reduz) reanima(el, 'fx-novo', 650); }
  function salvo(el) { if (!reduz) reanima(el, 'fx-salvo', 720); }

  function flutuante(el, texto, tipo = 'neutro') {
    injetar();
    if (!el || reduz) return;
    const r = el.getBoundingClientRect();
    const fx = document.createElement('div');
    fx.className = 'fx-float fx-' + tipo;
    fx.textContent = texto;
    fx.style.left = (r.left + r.width / 2) + 'px';
    fx.style.top  = (r.top + r.height * 0.25) + 'px';
    document.body.appendChild(fx);
    setTimeout(() => fx.remove(), 1100);
  }

  function dano(el, valor) {
    injetar();
    shake(el); flash(el, 'dano');
    const v = Math.abs(+valor || 0);
    if (v) flutuante(el, '-' + v, v >= 20 ? 'critico' : 'dano');
  }
  function cura(el, valor) {
    injetar();
    flash(el, 'cura'); pulso(el);
    const v = Math.abs(+valor || 0);
    if (v) flutuante(el, '+' + v, 'cura');
  }

  function favorito(el, ativo) {
    injetar();
    if (!el) return;
    pulso(el);
    if (!reduz) reanima(el, 'fx-fav-bounce', 520);
    if (!ativo || reduz) return;   // faíscas só ao ATIVAR
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const N = 7;
    for (let i = 0; i < N; i++) {
      const sp = document.createElement('div');
      sp.className = 'fx-spark';
      sp.style.left = cx + 'px'; sp.style.top = cy + 'px';
      document.body.appendChild(sp);
      const ang = (Math.PI * 2 * i) / N + Math.random() * 0.5;
      const dist = 18 + Math.random() * 16;
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
      sp.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) scale(0)`, opacity: 0 }
      ], { duration: 520, easing: 'cubic-bezier(.2,.8,.4,1)' });
      setTimeout(() => sp.remove(), 540);
    }
  }

  // Embaralha números no elemento até assentar em `final`. cb opcional ao terminar.
  function rolar(el, final, cb) {
    injetar();
    if (!el) { if (cb) cb(); return; }
    if (reduz) { el.textContent = final; if (cb) cb(); return; }
    const passos = 12;
    let i = 0;
    const alvo = Math.abs(+final) || 1;
    const timer = setInterval(() => {
      i++;
      el.textContent = 1 + Math.floor(Math.random() * Math.max(alvo, 6));
      if (i >= passos) {
        clearInterval(timer);
        el.textContent = final;
        pulso(el);
        if (cb) cb();
      }
    }, 45);
  }

  // Contagem animada do VALUE de um input (ex.: HP 26 → 21)
  function contarInput(input, de, para, dur) {
    if (!input) return;
    de = +de; para = +para;
    if (reduz || isNaN(de) || isNaN(para)) { input.value = para; return; }
    dur = dur || 420;
    const t0 = performance.now();
    function frame(t) {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      input.value = Math.round(de + (para - de) * e);
      if (k < 1) requestAnimationFrame(frame);
      else input.value = para;
    }
    requestAnimationFrame(frame);
  }

  injetar();
  window.FX = Object.assign(window.FX || {}, { dano, cura, flutuante, shake, flash, pulso, favorito, slot, novo, salvo, rolar, contarInput });
})();

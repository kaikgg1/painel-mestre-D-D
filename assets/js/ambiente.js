// assets/js/ambiente.js
// Atmosfera de fundo por tema — partículas leves num <canvas> fixo atrás de tudo.
// Tema via <body data-ambiente="brasas|poeira|fagulhas">. Padrão: fagulhas douradas.
// Respeita prefers-reduced-motion (não anima) e pausa quando a aba está oculta.

(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const TEMAS = {
    // brasas: sobem, avermelhadas (Barovia / vilões)
    brasas:   { n: 42, cor: ['#8b1d1d', '#b8431d', '#d4a843'], vy: [-0.5, -0.18], drift: 0.4, r: [0.8, 2.4], op: [0.15, 0.55], glow: true },
    // poeira: flutua devagar, dourada clara (painel do Mestre / pergaminho)
    poeira:   { n: 34, cor: ['#c9a24a', '#e8d5a8', '#8B6914'], vy: [-0.12, 0.12], drift: 0.25, r: [0.6, 1.8], op: [0.10, 0.30], glow: false },
    // fagulhas: douradas sutis subindo devagar (ficha / grimório / hub)
    fagulhas: { n: 30, cor: ['#d4a843', '#b88a2c', '#8B6914'], vy: [-0.35, -0.1], drift: 0.3, r: [0.7, 2.0], op: [0.12, 0.4], glow: true },
  };

  function iniciar() {
    const tipo = (document.body && document.body.dataset.ambiente) || 'fagulhas';
    const cfg = TEMAS[tipo] || TEMAS.fagulhas;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'fixed', inset: '0', width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '-1',
    });
    // insere como primeiro filho do body pra ficar atrás do conteúdo
    document.body.insertBefore(canvas, document.body.firstChild);

    const ctx = canvas.getContext('2d');
    let W, H, dpr, parts = [];
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = arr => arr[(Math.random() * arr.length) | 0];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function novaParticula(yInicial) {
      return {
        x: rnd(0, W),
        y: yInicial != null ? yInicial : rnd(0, H),
        r: rnd(cfg.r[0], cfg.r[1]),
        vy: rnd(cfg.vy[0], cfg.vy[1]),
        vx: rnd(-cfg.drift, cfg.drift),
        op: rnd(cfg.op[0], cfg.op[1]),
        cor: pick(cfg.cor),
        fase: rnd(0, Math.PI * 2),
      };
    }

    function semear() {
      parts = [];
      const n = Math.round(cfg.n * Math.min(1.4, Math.max(0.5, W / 1000)));
      for (let i = 0; i < n; i++) parts.push(novaParticula());
    }

    function passo() {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.y += p.vy;
        p.fase += 0.02;
        p.x += p.vx + Math.sin(p.fase) * 0.2;
        // reentra pelo lado oposto
        if (p.vy < 0 && p.y < -5) { Object.assign(p, novaParticula(H + 5)); }
        else if (p.vy >= 0 && p.y > H + 5) { Object.assign(p, novaParticula(-5)); }
        if (p.x < -5) p.x = W + 5; else if (p.x > W + 5) p.x = -5;

        const cintila = 0.75 + Math.sin(p.fase * 1.7) * 0.25;
        ctx.globalAlpha = p.op * cintila;
        ctx.fillStyle = p.cor;
        if (cfg.glow) { ctx.shadowColor = p.cor; ctx.shadowBlur = p.r * 3; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    let raf = null, rodando = true;
    function loop() { if (rodando) passo(); raf = requestAnimationFrame(loop); }

    resize(); semear(); loop();

    let t;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { resize(); semear(); }, 200); });
    document.addEventListener('visibilitychange', () => { rodando = !document.hidden; });
  }

  if (document.body) iniciar();
  else document.addEventListener('DOMContentLoaded', iniciar);
})();

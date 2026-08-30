// assets/js/lightbox.js
// Visualizador de imagem em tela cheia, reutilizável em qualquer tela do site.
//
// Uso automático (recomendado): marque a imagem/miniatura com data-lb.
//   <img src="foto.jpg" data-lb>                              (usa o próprio src)
//   <div data-lb="grande.jpg" data-lb-nome="Vampiro">…</div>   (fonte separada)
// O módulo captura o clique no document, então funciona também em conteúdo
// inserido depois (modais, listas renderizadas por JS) sem precisar re-ligar.
//
// Uso manual:
//   Lightbox.abrir('caminho.jpg', 'Legenda');
//   Lightbox.fechar();
//
// Acessibilidade: Esc fecha, foco vai pro botão fechar e volta pro elemento
// que abriu, e o fundo trava o scroll enquanto está aberto.

(function () {
  'use strict';

  const CSS = `
  .lbx-ov {
    position: fixed; inset: 0; z-index: 3000; display: none;
    background: rgba(3,2,3,0.94); backdrop-filter: blur(6px);
    align-items: center; justify-content: center;
    padding: 3vh 3vw; cursor: zoom-out;
  }
  .lbx-ov.aberto { display: flex; }
  .lbx-fig {
    margin: 0; display: flex; flex-direction: column; align-items: center; gap: 12px;
    max-width: 100%; max-height: 100%;
  }
  .lbx-img {
    max-width: 100%; max-height: 82vh; object-fit: contain;
    border-radius: 10px; border: 1px solid rgba(184,138,44,0.7);
    box-shadow: 0 20px 70px rgba(0,0,0,0.9); background: #0d0810;
    cursor: default;
  }
  .lbx-cap {
    font-family: 'Cinzel', serif; font-size: 14px; letter-spacing: 1.4px;
    color: #d4a843; text-transform: uppercase; text-align: center; max-width: 90vw;
  }
  .lbx-x {
    position: fixed; top: 18px; right: 22px; z-index: 3001;
    width: 44px; height: 44px; border-radius: 50%; cursor: pointer;
    background: rgba(26,16,24,0.92); border: 1px solid #8B6914; color: #d4a843;
    font-size: 26px; line-height: 1; display: flex; align-items: center; justify-content: center;
    font-family: inherit;
  }
  .lbx-x:hover { background: #8B6914; color: #050304; }
  .lbx-x:focus-visible { outline: 2px solid #d4a843; outline-offset: 3px; }
  /* dica de zoom em quem abre o lightbox */
  [data-lb] { cursor: zoom-in; }
  @media (max-width: 720px) {
    .lbx-ov { padding: 0; }
    .lbx-img { max-height: 76vh; border-radius: 0; border-width: 0; }
    .lbx-x { top: 10px; right: 12px; }
    .lbx-cap { font-size: 12px; padding: 0 12px; }
  }
  @media (prefers-reduced-motion: reduce) { .lbx-ov { backdrop-filter: none; } }
  `;

  let ov, img, cap, btnX, ultimoFoco = null, cssPronto = false;

  function montar() {
    if (ov) return;
    if (!cssPronto) {
      const s = document.createElement('style');
      s.textContent = CSS;
      document.head.appendChild(s);
      cssPronto = true;
    }
    ov = document.createElement('div');
    ov.className = 'lbx-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Imagem ampliada');
    ov.innerHTML =
      '<button class="lbx-x" type="button" aria-label="Fechar imagem">&times;</button>' +
      '<figure class="lbx-fig">' +
        '<img class="lbx-img" src="" alt="">' +
        '<figcaption class="lbx-cap"></figcaption>' +
      '</figure>';
    document.body.appendChild(ov);
    img  = ov.querySelector('.lbx-img');
    cap  = ov.querySelector('.lbx-cap');
    btnX = ov.querySelector('.lbx-x');

    btnX.addEventListener('click', fechar);
    // clicar fora da imagem fecha
    ov.addEventListener('click', e => { if (e.target !== img) fechar(); });
  }

  function abrir(src, legenda, origem) {
    if (!src) return;
    montar();
    ultimoFoco = origem || document.activeElement;
    img.src = src;
    img.alt = legenda ? ('Imagem ampliada: ' + legenda) : 'Imagem ampliada';
    cap.textContent = legenda || '';
    cap.style.display = legenda ? '' : 'none';
    ov.classList.add('aberto');
    document.body.dataset.lbxScroll = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
    btnX.focus();
  }

  function fechar() {
    if (!ov || !ov.classList.contains('aberto')) return;
    ov.classList.remove('aberto');
    img.src = '';
    // restaura o overflow que existia antes (respeita modal aberto por baixo)
    document.body.style.overflow = document.body.dataset.lbxScroll || '';
    delete document.body.dataset.lbxScroll;
    if (ultimoFoco && document.contains(ultimoFoco)) {
      try { ultimoFoco.focus(); } catch (e) {}
    }
    ultimoFoco = null;
  }

  function estaAberto() { return !!(ov && ov.classList.contains('aberto')); }

  /** Resolve a fonte da imagem a partir do elemento marcado com data-lb. */
  function fonteDe(el) {
    if (el.dataset.lb) return el.dataset.lb;          // data-lb="caminho.jpg"
    if (el.tagName === 'IMG') return el.src;           // <img data-lb>
    const dentro = el.querySelector('img');            // wrapper com <img> dentro
    return dentro ? dentro.src : null;
  }

  function legendaDe(el) {
    if (el.dataset.lbNome) return el.dataset.lbNome;
    if (el.tagName === 'IMG' && el.alt) return el.alt;
    const dentro = el.querySelector('img');
    return dentro && dentro.alt ? dentro.alt : '';
  }

  // Delegação global: pega inclusive conteúdo inserido depois.
  document.addEventListener('click', e => {
    const alvo = e.target.closest('[data-lb]');
    if (!alvo) return;
    const src = fonteDe(alvo);
    if (!src) return;
    e.preventDefault();
    abrir(src, legendaDe(alvo), alvo);
  });

  // Teclado: Enter/Espaço abre quem tem data-lb e é focável.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && estaAberto()) { e.stopPropagation(); fechar(); return; }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const alvo = e.target.closest && e.target.closest('[data-lb]');
    if (!alvo) return;
    const src = fonteDe(alvo);
    if (!src) return;
    e.preventDefault();
    abrir(src, legendaDe(alvo), alvo);
  }, true);   // captura: fecha antes de outros handlers de Esc da página

  window.Lightbox = { abrir, fechar, estaAberto };
})();

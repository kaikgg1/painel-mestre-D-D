// assets/js/ui.js
// Helpers de UI compartilhados pela ficha (jog-10/jog-11 da auditoria):
// accordion genérico e um modal dinâmico (cria/remove o próprio overlay,
// sem depender de markup fixo no HTML — cada abertura é um DOM novo).
//
// API:
//   UI.accordion(gatilho, resolverAlvo, opts?) → liga clique/Enter no
//     gatilho pra abrir/fechar um painel. `resolverAlvo(gatilho)` devolve o
//     elemento a expandir/recolher. opts.classe: nome da classe que marca
//     "aberto" (ex.: 'aberta'); sem opts.classe, alterna `.hidden` no alvo.
//     opts.onToggle(aberto, alvo): callback opcional pós-toggle.
//   UI.abrirModal({tituloHtml, corpoHtml, className, onFechar}) → cria o
//     overlay, injeta no <body>, fecha no backdrop/Esc, devolve
//     {overlay, card, fechar}.
window.UI = (function () {
  function accordion(gatilho, resolverAlvo, opts = {}) {
    const { classe = null, onToggle } = opts;
    const executar = () => {
      const alvo = resolverAlvo(gatilho);
      if (!alvo) return;
      let aberto;
      if (classe) {
        aberto = alvo.classList.toggle(classe);
      } else {
        alvo.hidden = !alvo.hidden;
        aberto = !alvo.hidden;
      }
      gatilho.setAttribute('aria-expanded', String(aberto));
      if (onToggle) onToggle(aberto, alvo);
    };
    gatilho.addEventListener('click', executar);
    // <button>/<a> já disparam 'click' sozinhos no Enter/Espaço — só liga o
    // keydown manual pra gatilhos "role=button" (ex.: <div>), senão o Enter
    // num <button> de verdade executaria duas vezes (click nativo + este) e
    // cancelaria a si mesmo (abre e fecha na mesma tecla).
    if (gatilho.tagName !== 'BUTTON' && gatilho.tagName !== 'A') {
      gatilho.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); executar(); }
      });
    }
  }

  // Contador pra gerar id único do título: dois modais abertos ao mesmo tempo
  // com o mesmo id="ui-modal-titulo" fariam o aria-labelledby apontar sempre
  // pro primeiro (id duplicado é inválido e o leitor de tela lê o errado).
  let _seqModal = 0;

  function abrirModal({ tituloHtml = '', corpoHtml = '', className = '', onFechar } = {}) {
    const tituloId = `ui-modal-titulo-${++_seqModal}`;
    // Guarda quem tinha o foco pra devolver no fechar (mesmo padrão de
    // lightbox.js/confirmar.js): sem isso o foco volta pro <body> e quem usa
    // teclado/leitor de tela perde o lugar na página.
    const focoAnterior = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = className ? `modal-overlay ${className}` : 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" tabindex="-1"${tituloHtml ? ` aria-labelledby="${tituloId}"` : ''}>
        ${tituloHtml ? `<h3 id="${tituloId}">${tituloHtml}</h3>` : ''}
        ${corpoHtml}
      </div>`;
    document.body.appendChild(overlay);

    const card = overlay.querySelector('.modal-card');

    const fechar = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      // Só devolve o foco se o elemento ainda existir no DOM (o modal pode ter
      // sido aberto a partir de um botão que a re-renderização já trocou).
      if (focoAnterior && document.contains(focoAnterior)) {
        try { focoAnterior.focus(); } catch (e) { /* elemento não focável */ }
      }
      if (onFechar) onFechar();
    };
    const onKey = e => { if (e.key === 'Escape') fechar(); };
    overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });
    document.addEventListener('keydown', onKey);

    // Foco no 1º controle do modal (ou no próprio card, que é tabindex="-1"):
    // leva o teclado/leitor de tela pra dentro do diálogo em vez de deixá-lo
    // preso no conteúdo do fundo.
    const primeiro = card.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    (primeiro || card).focus();

    return { overlay, card, fechar };
  }

  return { accordion, abrirModal };
})();

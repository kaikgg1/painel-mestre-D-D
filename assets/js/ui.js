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

  function abrirModal({ tituloHtml = '', corpoHtml = '', className = '', onFechar } = {}) {
    const overlay = document.createElement('div');
    overlay.className = className ? `modal-overlay ${className}` : 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true"${tituloHtml ? ' aria-labelledby="ui-modal-titulo"' : ''}>
        ${tituloHtml ? `<h3 id="ui-modal-titulo">${tituloHtml}</h3>` : ''}
        ${corpoHtml}
      </div>`;
    document.body.appendChild(overlay);

    const fechar = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      if (onFechar) onFechar();
    };
    const onKey = e => { if (e.key === 'Escape') fechar(); };
    overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });
    document.addEventListener('keydown', onKey);

    return { overlay, card: overlay.querySelector('.modal-card'), fechar };
  }

  return { accordion, abrirModal };
})();

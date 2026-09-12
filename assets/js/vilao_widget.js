// assets/js/vilao_widget.js
// Barra mínima de "vilões em jogo" dentro do painel de campanha (mst-7) —
// mostra PV ao vivo dos vilões tocados recentemente (assets/js/
// vilao_atividade.js) sem o Mestre precisar sair do painel dos PJs; clicar
// abre a ficha completa numa aba nova.
//
// Depende de window.VilaoAtividade (lista de quem foi tocado) e
// window.MasterState (o mesmo canal de sync usado pelas próprias fichas de
// vilão) — se qualquer um faltar, não desenha nada (degrada silenciosamente).
//
// API: VilaoWidget.montar(idContainer)
window.VilaoWidget = (function () {
  let _unsubs = [];

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function fmtHp(estado) {
    if (!estado || estado.hpCurrent == null || estado.hpMax == null) return '';
    return `${estado.hpCurrent}/${estado.hpMax} PV`;
  }

  function montar(idContainer) {
    if (!window.VilaoAtividade || !window.MasterState) return;
    const container = document.getElementById(idContainer);
    if (!container) return;

    const lista = window.VilaoAtividade.listar();
    _unsubs.forEach(fn => fn());
    _unsubs = [];

    if (!lista.length) { container.innerHTML = ''; container.hidden = true; return; }
    container.hidden = false;
    container.innerHTML = lista.map(x => `
      <a href="vilao/${encodeURIComponent(x.slug)}.html" target="_blank" rel="noopener" class="vw-chip" data-slug="${escapeHtml(x.slug)}">
        <span class="vw-nome">${escapeHtml(x.nome)}</span>
        <span class="vw-hp" id="vw-hp-${escapeHtml(x.slug)}"></span>
      </a>
    `).join('');

    lista.forEach(x => {
      const chave = 'vilao:' + x.slug;
      const atualizar = estado => {
        const el = document.getElementById('vw-hp-' + x.slug);
        if (el) el.textContent = fmtHp(estado);
      };
      window.MasterState.carregar(chave).then(atualizar);
      _unsubs.push(window.MasterState.iniciarRealtime(chave, atualizar));
    });
  }

  return { montar };
})();

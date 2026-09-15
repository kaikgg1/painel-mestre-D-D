// assets/js/ficha/nav_mobile.js
// Navegação inferior fixa do mobile (§18). Não hardcoda a lista de abas: lê
// os botões .tab reais de #tabs (já renderizados por render.js) e monta a
// barra a partir de uma lista de PRIORIDADE por data-tab, filtrada pelo que
// realmente existe naquele render — então a barra se adapta sozinha quando
// uma aba não existe (ex.: Magias só aparece pra classe conjuradora) ou
// quando abas novas entram no futuro (caem no "Mais" sem tocar aqui).
//
// A ordem pedida é fixa: [Resumo] [Combate] [Magias] [Equip.] [Mais] — e
// NÃO é a ordem do DOM das abas (onde Habilidades vem antes de Equipamento),
// por isso a prioridade explícita em vez de "os N primeiros".
//
// Selecionar um item aqui dispara um click() no botão .tab correspondente —
// reaproveita 100% da lógica de troca de aba já ligada em listeners.js
// (flush do formulário, tabAtiva, render(), animação, carregamento assíncrono
// da aba de magias) em vez de duplicá-la.

// Quem ganha lugar fixo na barra, nesta ordem. O resto vai pro "Mais".
const PRIORIDADE_NAV_INFERIOR = ['resumo', 'combate', 'magias', 'equipamento'];

// Emoji simples — o projeto já usa emoji em botões do header/menu ⋯, e um
// <iconify-icon> por item custaria rede numa barra que aparece sempre.
const ICONES_NAV_INFERIOR = {
  resumo: '📋', combate: '⚔️', magias: '✨', equipamento: '🎒',
  habilidades: '🌟', aliados: '🤝', personagem: '🧝', roleplay: '🎭',
};
// Rótulo curto SÓ na barra (o sheet "Mais" mostra o nome inteiro da aba).
const ROTULOS_NAV_INFERIOR = { equipamento: 'Equip.' };

function iconeNavInferior(chave) { return ICONES_NAV_INFERIOR[chave] || '•'; }
function rotuloNavInferior(tab) {
  return ROTULOS_NAV_INFERIOR[tab.dataset.tab] || tab.textContent.trim();
}

function renderBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;
  const tabs = Array.from(document.querySelectorAll('#tabs .tab'));
  if (!tabs.length) { nav.innerHTML = ''; return; }

  const principais = PRIORIDADE_NAV_INFERIOR
    .map(chave => tabs.find(t => t.dataset.tab === chave))
    .filter(Boolean);
  // filter() preserva a ordem real das abas — o "Mais" lista na mesma
  // sequência em que elas aparecem em #tabs.
  const resto = tabs.filter(t => !principais.includes(t));

  nav.innerHTML = principais.map(t => {
    const ativa = t.classList.contains('ativa');
    return `
      <button type="button" class="bn-item ${ativa ? 'ativa' : ''}" data-bn-tab="${t.dataset.tab}" ${ativa ? 'aria-current="page"' : ''}>
        <span class="bn-ico" aria-hidden="true">${iconeNavInferior(t.dataset.tab)}</span>
        <span class="bn-lbl">${escape(rotuloNavInferior(t))}</span>
      </button>`;
  }).join('')
    + (resto.length ? `
      <button type="button" class="bn-item ${resto.some(t => t.classList.contains('ativa')) ? 'ativa' : ''}" id="bn-mais" aria-haspopup="dialog">
        <span class="bn-ico" aria-hidden="true">⋯</span>
        <span class="bn-lbl">Mais</span>
      </button>` : '');

  nav.querySelectorAll('[data-bn-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const alvo = document.querySelector(`#tabs .tab[data-tab="${btn.dataset.bnTab}"]`);
      if (alvo) alvo.click();
    });
  });
  const maisBtn = document.getElementById('bn-mais');
  if (maisBtn) maisBtn.addEventListener('click', () => abrirSheetMais(resto));
}

// Bottom sheet simples com as abas que não couberam na barra. Uma versão
// mínima e local do padrão "BottomSheet" citado no plano — se Equipamento
// (Fase 7) ou Magias (Fase 8) precisarem de algo parecido, dá pra promover
// isso a um helper genérico então.
function abrirSheetMais(tabsRestantes) {
  if (!tabsRestantes.length) return;
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.innerHTML = `
    <div class="sheet-mais" role="dialog" aria-modal="true" aria-label="Mais opções">
      <div class="sheet-handle" aria-hidden="true"></div>
      ${tabsRestantes.map(t => `<button type="button" class="sheet-item ${t.classList.contains('ativa') ? 'ativa' : ''}" data-sheet-tab="${t.dataset.tab}">
        <span class="sheet-ico" aria-hidden="true">${iconeNavInferior(t.dataset.tab)}</span>
        <span>${escape(t.textContent.trim())}</span>
      </button>`).join('')}
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  const fechar = () => {
    overlay.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => overlay.remove(), 200);
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });
  overlay.querySelectorAll('[data-sheet-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const alvo = document.querySelector(`#tabs .tab[data-tab="${btn.dataset.sheetTab}"]`);
      fechar();
      if (alvo) alvo.click();
    });
  });
  const onKey = (e) => { if (e.key === 'Escape') fechar(); };
  document.addEventListener('keydown', onKey);
}

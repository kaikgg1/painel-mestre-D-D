// assets/js/ficha/nav_mobile.js
// Navegação inferior fixa do mobile (§18). Não hardcoda a lista de abas: lê
// os botões .tab reais de #tabs (já renderizados por render.js) e mostra os
// 4 primeiros + "Mais" para o resto — então esta barra se adapta sozinha
// conforme abas são adicionadas/renomeadas em fases futuras (Resumo entra na
// frente na Fase 3, Personagem substitui Identidade/Roleplay na Fase 9) sem
// precisar tocar neste arquivo.
//
// Selecionar um item aqui dispara um click() no botão .tab correspondente —
// reaproveita 100% da lógica de troca de aba já ligada em listeners.js
// (flush do formulário, tabAtiva, render(), animação, carregamento assíncrono
// da aba de magias) em vez de duplicá-la.

const LIMITE_NAV_INFERIOR = 4;

function renderBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;
  const tabs = Array.from(document.querySelectorAll('#tabs .tab'));
  if (!tabs.length) { nav.innerHTML = ''; return; }

  const principais = tabs.slice(0, LIMITE_NAV_INFERIOR);
  const resto = tabs.slice(LIMITE_NAV_INFERIOR);

  nav.innerHTML = principais.map(t => `
      <button type="button" class="bn-item ${t.classList.contains('ativa') ? 'ativa' : ''}" data-bn-tab="${t.dataset.tab}">
        <span class="bn-lbl">${escape(t.textContent.trim())}</span>
      </button>`).join('')
    + (resto.length ? `
      <button type="button" class="bn-item ${resto.some(t => t.classList.contains('ativa')) ? 'ativa' : ''}" id="bn-mais">
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
      ${tabsRestantes.map(t => `<button type="button" class="sheet-item" data-sheet-tab="${t.dataset.tab}">${escape(t.textContent.trim())}</button>`).join('')}
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

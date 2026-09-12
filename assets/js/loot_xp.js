// assets/js/loot_xp.js
// Ferramenta de distribuir XP/loot em lote entre os personagens ativos do
// painel (mst-10) — sem isso o Mestre tinha que abrir card por card e somar
// na mão toda vez que o grupo terminava um encontro.
//
// Self-contained como confirmar.js/rolador.js/iniciativa.js (injeta seu
// próprio CSS/DOM). Depende de `estado`/`salvar`/`toast`/`rerenderCard`
// (globais soltos do próprio painel, painel_mestre_dnd5e.html/
// painel_barovia_dnd5e.html) — só os referencia dentro de abrir()/aplicar(),
// então a ordem de load desses scripts não importa, contanto que abrir()
// seja chamado depois do painel já ter inicializado (ex.: clique num botão
// da toolbar).
//
// API: LootXP.abrir()
window.LootXP = (function () {
  const MOEDAS = [['po','Ouro (PO)'], ['pp','Platina (PP)'], ['pe','Eletro (PE)'], ['pc','Cobre (PC)'], ['pl','Prata (PL)']];

  const CSS = `
  .lx-overlay {
    position: fixed; inset: 0; z-index: 8600;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    opacity: 0; pointer-events: none;
    transition: opacity 0.15s ease-out;
  }
  .lx-overlay.open { opacity: 1; pointer-events: auto; }
  .lx-modal {
    background: linear-gradient(160deg, var(--surface-raised, #211012) 0%, var(--surface, #180b0d) 100%);
    border: 1px solid var(--border, #5f171b);
    border-radius: 8px;
    max-width: 400px; width: 100%; max-height: 85vh; max-height: 85dvh; overflow-y: auto;
    padding: 20px 22px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.7);
    font-family: var(--font-body, Georgia, serif);
    color: var(--text, #ddd0bc);
  }
  .lx-titulo {
    font-family: var(--font-heading, serif); font-size: 17px; font-weight: 700;
    color: var(--gold, #a8232b); letter-spacing: 1px; margin-bottom: 4px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .lx-fechar { background: none; border: none; color: var(--text-muted, #89776d); cursor: pointer; font-size: 18px; padding: 2px; }
  .lx-lista { font-size: 12px; color: var(--text-muted, #89776d); margin-bottom: 14px; }
  .lx-secao { margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--border, #5f171b); }
  .lx-secao:last-of-type { border-bottom: none; }
  .lx-secao-titulo { font-size: 12px; font-weight: 700; letter-spacing: 0.5px; color: var(--text, #ddd0bc); margin-bottom: 8px; }
  .lx-linha { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
  .lx-linha input[type="number"] { width: 90px; }
  .lx-linha select, .lx-linha input {
    background: rgba(0,0,0,0.3); border: 1px solid var(--border, #5f171b); border-radius: 4px;
    color: var(--text, #ddd0bc); padding: 6px 8px; font-size: 12px;
  }
  .lx-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted, #89776d); }
  .lx-btn {
    width: 100%; padding: 9px 14px; font-family: var(--font-heading, serif); font-size: 12px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase; border-radius: 5px; cursor: pointer; min-height: 40px;
    background: linear-gradient(180deg, var(--gold-light, #d14242), var(--gold, #a8232b)); border: 1px solid var(--gold, #a8232b); color: var(--bg, #070506);
  }
  .lx-btn:hover { filter: brightness(1.1); }
  .lx-btn:disabled { opacity: 0.4; cursor: default; filter: none; }
  `;

  let _montado = false;
  function montar() {
    if (_montado) return;
    _montado = true;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'lx-overlay';
    overlay.id = 'lx-overlay';
    overlay.innerHTML = `
      <div class="lx-modal" role="dialog" aria-modal="true">
        <div class="lx-titulo">Distribuir XP / Loot <button type="button" class="lx-fechar" id="lx-fechar" aria-label="Fechar">✕</button></div>
        <div class="lx-lista" id="lx-lista"></div>
        <div class="lx-secao">
          <div class="lx-secao-titulo">Experiência</div>
          <div class="lx-linha">
            <input type="number" id="lx-xp" placeholder="Quantidade" min="0" value="0">
            <label class="lx-check"><input type="checkbox" id="lx-xp-dividir"> Dividir entre o grupo</label>
          </div>
          <button type="button" class="lx-btn" id="lx-xp-aplicar">+ Adicionar XP</button>
        </div>
        <div class="lx-secao">
          <div class="lx-secao-titulo">Moedas</div>
          <div class="lx-linha">
            <input type="number" id="lx-moeda-valor" placeholder="Quantidade" min="0" value="0">
            <select id="lx-moeda-tipo">${MOEDAS.map(([k, nome]) => `<option value="${k}">${nome}</option>`).join('')}</select>
          </div>
          <div class="lx-linha"><label class="lx-check"><input type="checkbox" id="lx-moeda-dividir"> Dividir entre o grupo</label></div>
          <button type="button" class="lx-btn" id="lx-moeda-aplicar">+ Adicionar Moedas</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });
    document.getElementById('lx-fechar').addEventListener('click', fechar);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) fechar(); });

    document.getElementById('lx-xp-aplicar').addEventListener('click', aplicarXP);
    document.getElementById('lx-moeda-aplicar').addEventListener('click', aplicarMoeda);
  }

  // estado/salvar/toast/rerenderCard são `let`/`function` de topo do script
  // inline de cada painel (painel_mestre_dnd5e.html/painel_barovia_dnd5e.html)
  // — não são propriedades de `window`, mas continuam acessíveis como
  // globais soltos dentro de outro <script> no mesmo documento (mesmo
  // "Global Environment Record"). Por isso são referenciados sem "window."
  // aqui, e só dentro das funções (não no load do módulo, que roda antes
  // do script do painel existir).
  function personagensAlvo() {
    return (typeof estado !== 'undefined' ? estado.personagens || [] : []).filter(p => p.id);
  }

  function aplicarXP() {
    const alvo = personagensAlvo();
    if (!alvo.length) return;
    const total = Math.max(0, parseInt(document.getElementById('lx-xp').value, 10) || 0);
    if (!total) return;
    const dividir = document.getElementById('lx-xp-dividir').checked;
    const porPersonagem = dividir ? Math.floor(total / alvo.length) : total;
    alvo.forEach(p => { p.xp = (+p.xp || 0) + porPersonagem; salvar(p); rerenderCard?.(p); });
    toast?.(`✓ +${porPersonagem} XP pra cada um dos ${alvo.length} personagens`);
    fechar();
  }

  function aplicarMoeda() {
    const alvo = personagensAlvo();
    if (!alvo.length) return;
    const total = Math.max(0, parseInt(document.getElementById('lx-moeda-valor').value, 10) || 0);
    if (!total) return;
    const tipo = document.getElementById('lx-moeda-tipo').value;
    const dividir = document.getElementById('lx-moeda-dividir').checked;
    const porPersonagem = dividir ? Math.floor(total / alvo.length) : total;
    alvo.forEach(p => {
      if (!p.moedas || typeof p.moedas !== 'object') p.moedas = { pc:0, pp:0, pe:0, po:0, pl:0 };
      p.moedas[tipo] = (+p.moedas[tipo] || 0) + porPersonagem;
      if (!p.inventario || typeof p.inventario !== 'object') p.inventario = { moedas: {}, armas: [], armaduras: [], itens: [] };
      if (!p.inventario.moedas) p.inventario.moedas = {};
      p.inventario.moedas[tipo] = p.moedas[tipo];
      salvar(p);
      rerenderCard?.(p);
    });
    const nomeMoeda = MOEDAS.find(m => m[0] === tipo)?.[1] || tipo;
    toast?.(`✓ +${porPersonagem} ${nomeMoeda} pra cada um dos ${alvo.length} personagens`);
    fechar();
  }

  function abrir() {
    montar();
    const alvo = personagensAlvo();
    const lista = document.getElementById('lx-lista');
    lista.textContent = alvo.length
      ? `Será aplicado a: ${alvo.map(p => p.nome).join(', ')} (${alvo.length})`
      : 'Nenhum personagem ativo nesta campanha.';
    document.getElementById('lx-xp-aplicar').disabled = !alvo.length;
    document.getElementById('lx-moeda-aplicar').disabled = !alvo.length;
    document.getElementById('lx-overlay').classList.add('open');
  }
  function fechar() {
    if (!_montado) return;
    document.getElementById('lx-overlay').classList.remove('open');
  }

  return { abrir, fechar };
})();

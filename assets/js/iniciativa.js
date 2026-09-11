// assets/js/iniciativa.js
// Modal de iniciativa — lista os personagens ativos (bônus já preenchido a
// partir de characters.iniciativa_bonus), deixa adicionar combatentes
// avulsos (vilões/monstros que vivem em outra aba/ficha, sem sincronismo
// direto com o painel), rola 1d20+bônus pra todo mundo de uma vez e ordena
// decrescente — a ordem de turno de verdade sai daqui, sem precisar de
// papel/app externo.
//
// Self-contained como assets/js/confirmar.js e assets/js/rolador.js (injeta
// seu próprio CSS/DOM na primeira chamada). Não persiste no banco — é uma
// ferramenta de mesa efêmera, o estado reseta ao fechar a aba.
//
// API: Iniciativa.abrir(combatentes?) — combatentes: [{nome, bonus}, ...]
// (opcional; sem isso abre só com o que já estiver na lista/vazio).
(function () {
  const CSS = `
  .ini-overlay {
    position: fixed; inset: 0; z-index: 8600;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    opacity: 0; pointer-events: none;
    transition: opacity 0.15s ease-out;
  }
  .ini-overlay.open { opacity: 1; pointer-events: auto; }
  .ini-modal {
    background: linear-gradient(160deg, var(--surface-raised, #211012) 0%, var(--surface, #180b0d) 100%);
    border: 1px solid var(--border, #5f171b);
    border-radius: 8px;
    max-width: 420px; width: 100%; max-height: 85vh; max-height: 85dvh;
    overflow-y: auto;
    padding: 20px 22px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.7);
    font-family: var(--font-body, Georgia, serif);
    color: var(--text, #ddd0bc);
  }
  .ini-titulo {
    font-family: var(--font-heading, serif); font-size: 17px; font-weight: 700;
    color: var(--gold, #a8232b); letter-spacing: 1px; margin-bottom: 12px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .ini-fechar { background: none; border: none; color: var(--text-muted, #89776d); cursor: pointer; font-size: 18px; padding: 2px; }
  .ini-lista { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; max-height: 42vh; overflow-y: auto; }
  .ini-item {
    display: flex; align-items: center; gap: 8px;
    background: rgba(0,0,0,0.25); border: 1px solid var(--border, #5f171b); border-radius: 6px;
    padding: 6px 10px;
  }
  .ini-item-nome { flex: 1; min-width: 0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ini-item-bonus { width: 44px; background: rgba(0,0,0,0.3); border: 1px solid var(--border, #5f171b); border-radius: 4px; color: var(--text, #ddd0bc); text-align: center; font-size: 12px; padding: 3px; }
  .ini-item-total { width: 34px; text-align: center; font-weight: 700; color: var(--gold, #a8232b); font-size: 15px; }
  .ini-item-rm { background: none; border: none; color: var(--text-muted, #89776d); cursor: pointer; font-size: 14px; padding: 2px 4px; }
  .ini-item-rm:hover { color: var(--danger, #861820); }
  .ini-vazio { text-align: center; color: var(--text-muted, #89776d); font-style: italic; font-size: 12px; padding: 12px 0; }
  .ini-add-row { display: flex; gap: 6px; margin-bottom: 12px; }
  .ini-add-row input[type="text"] { flex: 1; min-width: 0; }
  .ini-add-row input {
    background: rgba(0,0,0,0.3); border: 1px solid var(--border, #5f171b); border-radius: 4px;
    color: var(--text, #ddd0bc); padding: 6px 8px; font-size: 12px;
  }
  .ini-add-row input[type="number"] { width: 52px; text-align: center; }
  .ini-acoes { display: flex; gap: 8px; flex-wrap: wrap; }
  .ini-btn {
    padding: 8px 14px; font-family: var(--font-heading, serif); font-size: 11px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase; border-radius: 5px; cursor: pointer;
    min-height: 38px; flex: 1;
  }
  .ini-btn-rolar { background: linear-gradient(180deg, var(--gold-light, #d14242), var(--gold, #a8232b)); border: 1px solid var(--gold, #a8232b); color: var(--bg, #070506); }
  .ini-btn-rolar:hover { filter: brightness(1.1); }
  .ini-btn-limpar { background: transparent; border: 1px solid var(--text-muted, #89776d); color: var(--text, #ddd0bc); }
  .ini-btn-limpar:hover { border-color: var(--danger, #861820); color: var(--danger, #861820); }
  @media (max-width: 480px) { .ini-modal { padding: 16px; } }
  `;

  let _combatentes = []; // {id, nome, bonus, total}
  let _proximoId = 1;

  function d20() { return 1 + Math.floor(Math.random() * 20); }
  function fmtMod(n) { return n >= 0 ? `+${n}` : `${n}`; }

  let _montado = false;
  function montar() {
    if (_montado) return;
    _montado = true;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'ini-overlay';
    overlay.id = 'ini-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="ini-modal" id="ini-modal">
        <div class="ini-titulo">Ordem de Iniciativa <button type="button" class="ini-fechar" id="ini-fechar" aria-label="Fechar">✕</button></div>
        <div class="ini-lista" id="ini-lista"></div>
        <div class="ini-add-row">
          <input type="text" id="ini-add-nome" placeholder="Nome (ex.: Lobo 2)" aria-label="Nome do combatente">
          <input type="number" id="ini-add-bonus" value="0" aria-label="Bônus de iniciativa">
          <button type="button" class="ini-btn ini-btn-limpar" id="ini-add-btn" style="flex:0 0 auto">+ Add</button>
        </div>
        <div class="ini-acoes">
          <button type="button" class="ini-btn ini-btn-rolar" id="ini-rolar-todos">🎲 Rolar todos e ordenar</button>
          <button type="button" class="ini-btn ini-btn-limpar" id="ini-limpar">Limpar lista</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });
    document.getElementById('ini-fechar').addEventListener('click', fechar);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) fechar(); });

    document.getElementById('ini-add-btn').addEventListener('click', adicionarManual);
    document.getElementById('ini-add-nome').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); adicionarManual(); } });
    document.getElementById('ini-rolar-todos').addEventListener('click', rolarTodos);
    document.getElementById('ini-limpar').addEventListener('click', () => { _combatentes = []; renderLista(); });
  }

  function adicionarManual() {
    const nomeInp = document.getElementById('ini-add-nome');
    const bonusInp = document.getElementById('ini-add-bonus');
    const nome = nomeInp.value.trim();
    if (!nome) return;
    const bonus = parseInt(bonusInp.value, 10) || 0;
    _combatentes.push({ id: _proximoId++, nome, bonus, total: null, _avulso: true });
    nomeInp.value = '';
    bonusInp.value = '0';
    renderLista();
    nomeInp.focus();
  }

  function rolarTodos() {
    _combatentes.forEach(c => { c.total = d20() + (+c.bonus || 0); });
    _combatentes.sort((a, b) => (b.total ?? -999) - (a.total ?? -999));
    renderLista();
  }

  function renderLista() {
    const lista = document.getElementById('ini-lista');
    if (!lista) return;
    if (!_combatentes.length) { lista.innerHTML = `<div class="ini-vazio">Sem combatentes ainda — adicione abaixo.</div>`; return; }
    lista.innerHTML = _combatentes.map(c => `
      <div class="ini-item" data-id="${c.id}">
        <span class="ini-item-nome">${(c.nome || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}</span>
        <input type="number" class="ini-item-bonus" data-ini-bonus="${c.id}" value="${c.bonus}" aria-label="Bônus de ${c.nome}">
        <span class="ini-item-total">${c.total ?? '—'}</span>
        <button type="button" class="ini-item-rm" data-ini-rm="${c.id}" aria-label="Remover ${c.nome}">✕</button>
      </div>
    `).join('');
    lista.querySelectorAll('[data-ini-bonus]').forEach(inp => {
      inp.addEventListener('change', () => {
        const c = _combatentes.find(x => x.id === +inp.dataset.iniBonus);
        if (c) c.bonus = parseInt(inp.value, 10) || 0;
      });
    });
    lista.querySelectorAll('[data-ini-rm]').forEach(btn => {
      btn.addEventListener('click', () => {
        _combatentes = _combatentes.filter(x => x.id !== +btn.dataset.iniRm);
        renderLista();
      });
    });
  }

  // Substitui a lista pelos combatentes informados (ex.: PJs ativos do
  // painel), preservando quaisquer entradas avulsas (monstros) já
  // adicionadas com o mesmo nome — evita duplicar ao reabrir o modal.
  function definirBase(combatentes) {
    if (!Array.isArray(combatentes)) return;
    const nomesBase = new Set(combatentes.map(c => c.nome));
    const avulsos = _combatentes.filter(c => c._avulso && !nomesBase.has(c.nome));
    _combatentes = combatentes.map(c => {
      const existente = _combatentes.find(x => x.nome === c.nome && !x._avulso);
      return { id: existente?.id ?? _proximoId++, nome: c.nome, bonus: +c.bonus || 0, total: existente?.total ?? null };
    }).concat(avulsos);
  }

  function abrir(combatentes) {
    montar();
    if (combatentes) definirBase(combatentes);
    // Marca quem veio da base (pra não duplicar em reaberturas futuras)
    renderLista();
    document.getElementById('ini-overlay').classList.add('open');
  }
  function fechar() {
    if (!_montado) return;
    document.getElementById('ini-overlay').classList.remove('open');
  }

  window.Iniciativa = { abrir, fechar };
})();

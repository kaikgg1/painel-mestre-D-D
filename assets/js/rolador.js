// assets/js/rolador.js
// FAB (botão flutuante) de rolador de dados genérico — d4/d6/d8/d10/d12/d20/
// d100 com modificador, mais fórmula livre (ex.: "2d6+3", "4d8-1"). Pros
// painéis do Mestre e fichas de vilão, pra rolar um dano/teste avulso sem
// precisar de calculadora externa nem abrir a ficha de um personagem.
//
// Self-contained como assets/js/confirmar.js — injeta seu próprio CSS/DOM,
// NÃO depende de assets/js/regras_base.js (a maioria das fichas de vilão não
// carrega esse módulo). Se mostra sozinho ao carregar (não precisa chamar
// nada pra aparecer); API pública só existe pra fechar/abrir programaticamente
// se algum dia for útil.
//
// API: Rolador.abrir() / Rolador.fechar()
(function () {
  const CSS = `
  .rd-fab {
    position: fixed; right: 18px; bottom: 18px; z-index: 8500;
    width: 52px; height: 52px; border-radius: 50%;
    background: linear-gradient(160deg, var(--gold-light, #d14242), var(--gold, #a8232b));
    border: 2px solid var(--gold, #a8232b);
    color: var(--bg, #070506);
    font-size: 22px; line-height: 1; cursor: pointer;
    box-shadow: 0 6px 18px rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.15s;
  }
  .rd-fab:hover { transform: scale(1.08); }
  .rd-painel {
    position: fixed; right: 18px; bottom: 80px; z-index: 8500;
    width: 260px; max-width: calc(100vw - 36px);
    background: linear-gradient(160deg, var(--surface-raised, #211012) 0%, var(--surface, #180b0d) 100%);
    border: 1px solid var(--border, #5f171b);
    border-radius: 10px;
    padding: 14px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    font-family: var(--font-body, Georgia, serif);
    color: var(--text, #ddd0bc);
    opacity: 0; transform: translateY(8px) scale(0.97); pointer-events: none;
    transition: opacity 0.15s, transform 0.15s;
  }
  .rd-painel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
  .rd-titulo {
    font-family: var(--font-heading, serif); font-size: 12px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase; color: var(--gold, #a8232b);
    margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;
  }
  .rd-fechar { background: none; border: none; color: var(--text-muted, #89776d); cursor: pointer; font-size: 16px; line-height: 1; padding: 2px; }
  .rd-dados-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
  .rd-dado-btn {
    padding: 7px 0; font-size: 12px; font-weight: 700;
    background: transparent; border: 1px solid var(--border, #5f171b); border-radius: 5px;
    color: var(--text, #ddd0bc); cursor: pointer; transition: all 0.12s;
  }
  .rd-dado-btn:hover { border-color: var(--gold, #a8232b); color: var(--gold-light, #d14242); }
  .rd-mod-row { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 11px; }
  .rd-mod-row input {
    width: 52px; background: rgba(0,0,0,0.3); border: 1px solid var(--border, #5f171b);
    border-radius: 4px; color: var(--text, #ddd0bc); padding: 4px 6px; font-size: 12px; text-align: center;
  }
  .rd-formula-row { display: flex; gap: 6px; margin-bottom: 10px; }
  .rd-formula-row input {
    flex: 1; min-width: 0; background: rgba(0,0,0,0.3); border: 1px solid var(--border, #5f171b);
    border-radius: 4px; color: var(--text, #ddd0bc); padding: 6px 8px; font-size: 12px;
  }
  .rd-formula-row button, .rd-mod-row + .rd-formula-row button {
    background: var(--gold, #a8232b); border: 1px solid var(--gold, #a8232b); color: var(--bg, #070506);
    border-radius: 4px; padding: 0 12px; font-size: 12px; font-weight: 700; cursor: pointer;
  }
  .rd-resultado {
    text-align: center; padding: 8px; margin-bottom: 8px;
    background: rgba(0,0,0,0.25); border-radius: 6px;
    font-size: 12px; color: var(--text-muted, #89776d); min-height: 34px;
  }
  .rd-resultado strong { display: block; font-size: 22px; color: var(--gold, #a8232b); }
  .rd-historico { max-height: 90px; overflow-y: auto; font-size: 10px; color: var(--text-muted, #89776d); }
  .rd-historico div { padding: 2px 0; border-bottom: 1px dashed rgba(255,255,255,0.06); }
  @media (max-width: 480px) {
    .rd-painel { right: 10px; left: 10px; width: auto; }
    .rd-fab { right: 12px; bottom: 12px; }
  }
  `;

  const DADOS_RAPIDOS = [4, 6, 8, 10, 12, 20, 100];
  let _historico = [];

  function rolarUmDado(faces) { return 1 + Math.floor(Math.random() * faces); }

  function fmtMod(n) { return n >= 0 ? `+${n}` : `${n}`; }

  function registrar(texto) {
    _historico.unshift(texto);
    _historico = _historico.slice(0, 8);
    const hist = document.getElementById('rd-historico');
    if (hist) hist.innerHTML = _historico.map(h => `<div>${h}</div>`).join('');
  }

  function mostrarResultado(rotulo, rolagens, total) {
    const el = document.getElementById('rd-resultado');
    if (el) el.innerHTML = `${rotulo}<strong>${total}</strong>${rolagens.length > 1 ? `(${rolagens.join(' + ')})` : ''}`;
    registrar(`${rotulo} → <strong>${total}</strong>`);
  }

  function rolarRapido(faces) {
    const mod = parseInt(document.getElementById('rd-mod')?.value, 10) || 0;
    const r = rolarUmDado(faces);
    const total = r + mod;
    mostrarResultado(`d${faces}${mod ? fmtMod(mod) : ''} `, [r], total);
  }

  function rolarFormula() {
    const inp = document.getElementById('rd-formula');
    const txt = (inp?.value || '').trim();
    const m = txt.match(/^(\d{1,2})?d(\d{1,3})\s*([+-]\s*\d{1,3})?$/i);
    const resEl = document.getElementById('rd-resultado');
    if (!m) {
      if (resEl) resEl.innerHTML = `<span style="color:var(--danger,#861820)">Fórmula inválida — ex.: 2d6+3</span>`;
      return;
    }
    const qtd = Math.max(1, Math.min(20, m[1] ? +m[1] : 1));
    const faces = Math.max(2, Math.min(100, +m[2]));
    const bonus = m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0;
    const rolagens = Array.from({ length: qtd }, () => rolarUmDado(faces));
    const total = rolagens.reduce((s, r) => s + r, 0) + bonus;
    mostrarResultado(`${qtd}d${faces}${bonus ? fmtMod(bonus) : ''} `, rolagens, total);
  }

  let _montado = false;
  function montar() {
    if (_montado) return;
    _montado = true;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'rd-fab';
    fab.id = 'rd-fab';
    fab.setAttribute('aria-label', 'Abrir rolador de dados');
    fab.setAttribute('aria-haspopup', 'true');
    fab.setAttribute('aria-expanded', 'false');
    fab.textContent = '🎲';
    document.body.appendChild(fab);

    const painel = document.createElement('div');
    painel.className = 'rd-painel';
    painel.id = 'rd-painel';
    painel.setAttribute('role', 'dialog');
    painel.setAttribute('aria-label', 'Rolador de dados');
    painel.innerHTML = `
      <div class="rd-titulo">Rolador de Dados <button type="button" class="rd-fechar" id="rd-fechar" aria-label="Fechar">✕</button></div>
      <div class="rd-dados-grid">
        ${DADOS_RAPIDOS.map(f => `<button type="button" class="rd-dado-btn" data-rd-dado="${f}">d${f}</button>`).join('')}
      </div>
      <div class="rd-mod-row">
        <label for="rd-mod">Modificador</label>
        <input type="text" inputmode="numeric" id="rd-mod" value="0">
      </div>
      <div class="rd-formula-row">
        <input type="text" id="rd-formula" placeholder="Fórmula: 2d6+3" aria-label="Fórmula de dados">
        <button type="button" id="rd-formula-btn">Rolar</button>
      </div>
      <div class="rd-resultado" id="rd-resultado">Escolha um dado ou digite uma fórmula.</div>
      <div class="rd-historico" id="rd-historico"></div>
    `;
    document.body.appendChild(painel);

    fab.addEventListener('click', () => (painel.classList.contains('open') ? fechar() : abrir()));
    document.getElementById('rd-fechar').addEventListener('click', fechar);
    painel.querySelectorAll('[data-rd-dado]').forEach(btn => {
      btn.addEventListener('click', () => rolarRapido(+btn.dataset.rdDado));
    });
    document.getElementById('rd-formula-btn').addEventListener('click', rolarFormula);
    document.getElementById('rd-formula').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); rolarFormula(); }
    });
    document.addEventListener('click', e => {
      if (painel.classList.contains('open') && !painel.contains(e.target) && e.target !== fab) fechar();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); });
  }

  function abrir() {
    montar();
    document.getElementById('rd-painel').classList.add('open');
    document.getElementById('rd-fab').setAttribute('aria-expanded', 'true');
  }
  function fechar() {
    if (!_montado) return;
    document.getElementById('rd-painel').classList.remove('open');
    document.getElementById('rd-fab').setAttribute('aria-expanded', 'false');
  }

  // Auto-monta o FAB ao carregar — é um botão sempre disponível na tela,
  // não algo que precisa ser "aberto" por outro código pra existir.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montar);
  } else {
    montar();
  }

  window.Rolador = { abrir, fechar };
})();

// assets/js/pericias_mestre.js
// Modal pro Mestre dar/tirar bônus em perícias de um jogador.
// O bônus é somado ao cálculo normal (mod + proficiência + expertise) na ficha.
// Persiste em characters.pericias[chave].bonus.
//
// API: AjustePericias.abrir(characterId, nomePersonagem)
// Dependências: window.sb, window.Auth (mestre).

(function () {
  // MESMAS chaves usadas na ficha (ficha.html → const PERICIAS)
  const PERICIAS = [
    ['acrobacia','Acrobacia','DES'],
    ['adestrar_animais','Adestrar Animais','SAB'],
    ['arcanismo','Arcanismo','INT'],
    ['atletismo','Atletismo','FOR'],
    ['atuacao','Atuação','CAR'],
    ['enganacao','Enganação','CAR'],
    ['furtividade','Furtividade','DES'],
    ['historia','História','INT'],
    ['intimidacao','Intimidação','CAR'],
    ['intuicao','Intuição','SAB'],
    ['investigacao','Investigação','INT'],
    ['medicina','Medicina','SAB'],
    ['natureza','Natureza','INT'],
    ['percepcao','Percepção','SAB'],
    ['persuasao','Persuasão','CAR'],
    ['prestidigitacao','Prestidigitação','DES'],
    ['religiao','Religião','INT'],
    ['sobrevivencia','Sobrevivência','SAB'],
  ];

  let _injetado = false;
  let _charId = null;
  let _pericias = {};   // cópia local editável

  const CSS = `
  .ap-overlay {
    position: fixed; inset: 0; z-index: 6000;
    background: rgba(0,0,0,0.82);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    display: none; align-items: center; justify-content: center; padding: 16px;
  }
  .ap-overlay.open { display: flex; animation: apFade 0.18s ease-out; }
  @keyframes apFade { from { opacity: 0; } to { opacity: 1; } }
  .ap-modal {
    background: linear-gradient(160deg, #1f1416 0%, #160c10 100%);
    border: 2px solid #8B6914; border-radius: 10px;
    max-width: 560px; width: 100%;
    max-height: 90vh; max-height: 90dvh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 0 0 1px #8b1d1d inset, 0 24px 70px rgba(0,0,0,0.85);
    font-family: 'EB Garamond', Georgia, serif; color: #d4c5a0;
    animation: apScale 0.2s ease-out;
  }
  @keyframes apScale { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .ap-header {
    padding: 16px 20px 14px; border-bottom: 1px solid #6b1010;
    display: flex; align-items: center; gap: 12px;
    background: linear-gradient(180deg, #251618, #1a1014);
    position: relative; flex-shrink: 0;
  }
  .ap-header::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(to right, transparent, #b88a2c, transparent);
  }
  .ap-title {
    font-family: 'Cinzel Decorative', serif; font-size: 17px; font-weight: 700;
    color: #b88a2c; letter-spacing: 1px; flex: 1; line-height: 1.2;
  }
  .ap-title small { display: block; font-family: 'Cinzel', serif; font-size: 11px; color: #a89878; font-weight: 400; letter-spacing: 0.5px; margin-top: 2px; }
  .ap-close {
    background: transparent; border: 1px solid #6b1010; color: #d4c5a0;
    padding: 8px 12px; border-radius: 4px; cursor: pointer;
    font-family: 'Cinzel', serif; font-size: 11px; font-weight: 700;
    letter-spacing: 1px; transition: all 0.15s; min-height: 38px;
  }
  .ap-close:hover { background: #6b1010; color: #fff; }
  .ap-body { flex: 1; overflow-y: auto; padding: 12px 16px 16px; }
  .ap-hint { font-size: 12px; font-style: italic; color: #8c7d5e; margin-bottom: 12px; line-height: 1.4; }
  .ap-row {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 8px; border-radius: 6px;
    border-bottom: 1px solid rgba(139,105,20,0.12);
  }
  .ap-row:hover { background: rgba(139,105,20,0.06); }
  .ap-nome { flex: 1; font-size: 14px; }
  .ap-nome .atr { font-family: 'Cinzel', serif; font-size: 9px; color: #8c7d5e; letter-spacing: 1px; margin-left: 6px; }
  .ap-ctrl { display: flex; align-items: center; gap: 4px; }
  .ap-btn {
    width: 36px; height: 36px; border-radius: 6px; cursor: pointer;
    font-family: 'Cinzel', serif; font-weight: 700; font-size: 16px;
    display: inline-flex; align-items: center; justify-content: center;
    transition: all 0.12s;
  }
  .ap-btn-menos { background: linear-gradient(180deg, rgba(107,16,16,0.5), rgba(56,8,8,0.6)); border: 1px solid #6b1010; color: #f4b8a8; }
  .ap-btn-menos:hover { background: linear-gradient(180deg, #8b1d1d, #6b1010); }
  .ap-btn-mais { background: linear-gradient(180deg, rgba(139,105,20,0.45), rgba(80,60,12,0.6)); border: 1px solid #8B6914; color: #f4d878; }
  .ap-btn-mais:hover { background: linear-gradient(180deg, #b88a2c, #8B6914); color: #1a1014; }
  .ap-val {
    min-width: 42px; text-align: center;
    font-family: 'Cinzel', serif; font-weight: 700; font-size: 15px;
  }
  .ap-val.zero { color: #6a5a3a; }
  .ap-val.pos { color: #b88a2c; }
  .ap-val.neg { color: #c4302b; }
  .ap-footer {
    padding: 12px 16px; border-top: 1px solid #6b1010;
    display: flex; gap: 10px; justify-content: space-between; align-items: center;
    background: rgba(0,0,0,0.2); flex-shrink: 0;
  }
  .ap-status { font-size: 11px; color: #8c7d5e; font-style: italic; }
  .ap-salvar {
    background: linear-gradient(180deg, #b88a2c, #6a4f0e);
    border: 1px solid #d4a843; color: #1a1014;
    font-family: 'Cinzel', serif; font-size: 12px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase;
    padding: 10px 20px; border-radius: 5px; cursor: pointer; min-height: 42px;
    transition: all 0.15s;
  }
  .ap-salvar:hover { background: linear-gradient(180deg, #d4a843, #b88a2c); }
  .ap-salvar:disabled { opacity: 0.5; cursor: wait; }
  @media (max-width: 600px) {
    .ap-overlay { padding: 0; }
    .ap-modal { max-width: 100%; max-height: 100vh; max-height: 100dvh; height: 100%; border-radius: 0; }
    .ap-btn { width: 44px; height: 44px; }
  }
  `;

  function montar() {
    if (_injetado) return;
    _injetado = true;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const ov = document.createElement('div');
    ov.className = 'ap-overlay';
    ov.id = 'ap-overlay';
    ov.innerHTML = `
      <div class="ap-modal" role="dialog" aria-modal="true" aria-labelledby="ap-title">
        <div class="ap-header">
          <div class="ap-title" id="ap-title">🎯 Ajustar Perícias<small id="ap-sub"></small></div>
          <button type="button" class="ap-close" id="ap-close">Fechar ✕</button>
        </div>
        <div class="ap-body">
          <div class="ap-hint">Bônus extra do Mestre (situacional, item, dádiva…). Soma ao cálculo normal da perícia na ficha do jogador. Use −/+ para ajustar.</div>
          <div id="ap-lista"></div>
        </div>
        <div class="ap-footer">
          <span class="ap-status" id="ap-status"></span>
          <button type="button" class="ap-salvar" id="ap-salvar">Salvar bônus</button>
        </div>
      </div>`;
    document.body.appendChild(ov);

    ov.addEventListener('click', e => { if (e.target === ov) fechar(); });
    document.getElementById('ap-close').addEventListener('click', fechar);
    document.getElementById('ap-salvar').addEventListener('click', salvar);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && ov.classList.contains('open')) fechar();
    });

    // Delegação dos botões +/-
    document.getElementById('ap-lista').addEventListener('click', e => {
      const btn = e.target.closest('.ap-btn');
      if (!btn) return;
      const k = btn.dataset.k;
      const delta = btn.dataset.act === 'mais' ? 1 : -1;
      const atual = +(_pericias[k]?.bonus) || 0;
      const novo = Math.max(-10, Math.min(10, atual + delta));
      if (!_pericias[k]) _pericias[k] = {};
      _pericias[k].bonus = novo;
      if (!novo) delete _pericias[k].bonus;
      atualizarLinha(k);
    });
  }

  function classeVal(v) { return v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero'; }
  function fmt(v) { return (v > 0 ? '+' : '') + v; }

  function atualizarLinha(k) {
    const el = document.querySelector(`.ap-val[data-val="${k}"]`);
    if (!el) return;
    const v = +(_pericias[k]?.bonus) || 0;
    el.textContent = fmt(v);
    el.className = 'ap-val ' + classeVal(v);
  }

  function renderLista() {
    const wrap = document.getElementById('ap-lista');
    wrap.innerHTML = PERICIAS.map(([k, nome, atr]) => {
      const v = +(_pericias[k]?.bonus) || 0;
      return `
        <div class="ap-row">
          <span class="ap-nome">${nome}<span class="atr">${atr}</span></span>
          <span class="ap-ctrl">
            <button type="button" class="ap-btn ap-btn-menos" data-k="${k}" data-act="menos" aria-label="Diminuir bônus de ${nome}">−</button>
            <span class="ap-val ${classeVal(v)}" data-val="${k}">${fmt(v)}</span>
            <button type="button" class="ap-btn ap-btn-mais" data-k="${k}" data-act="mais" aria-label="Aumentar bônus de ${nome}">+</button>
          </span>
        </div>`;
    }).join('');
  }

  async function abrir(characterId, nomePersonagem) {
    if (!window.sb || !window.Auth) { alert('Supabase não carregado.'); return; }
    if (!(await window.Auth.ehMestre())) { alert('Apenas o Mestre pode ajustar perícias.'); return; }
    montar();
    _charId = characterId;
    document.getElementById('ap-sub').textContent = nomePersonagem || '';
    document.getElementById('ap-status').textContent = 'Carregando…';
    document.getElementById('ap-lista').innerHTML = '';

    const ov = document.getElementById('ap-overlay');
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Busca perícias atuais
    const { data, error } = await window.sb.from('characters')
      .select('pericias').eq('id', characterId).maybeSingle();
    if (error) { document.getElementById('ap-status').textContent = '⚠ Erro ao carregar'; return; }
    // Cópia profunda pra editar sem afetar o original até salvar
    _pericias = JSON.parse(JSON.stringify(data?.pericias || {}));
    document.getElementById('ap-status').textContent = '';
    renderLista();
  }

  function fechar() {
    const ov = document.getElementById('ap-overlay');
    if (ov) ov.classList.remove('open');
    document.body.style.overflow = '';
  }

  async function salvar() {
    const btn = document.getElementById('ap-salvar');
    btn.disabled = true;
    const status = document.getElementById('ap-status');
    status.textContent = 'Salvando…';

    // Re-busca o estado atual pra fazer MERGE (não sobrescrever prof/exp que o
    // jogador possa ter mudado enquanto o modal estava aberto).
    const { data, error: errLoad } = await window.sb.from('characters')
      .select('pericias').eq('id', _charId).maybeSingle();
    if (errLoad) { btn.disabled = false; status.textContent = '⚠ ' + errLoad.message; return; }
    const atual = JSON.parse(JSON.stringify(data?.pericias || {}));

    // Aplica só os bônus que defini, mantendo prof/exp do banco
    PERICIAS.forEach(([k]) => {
      const novoBonus = +(_pericias[k]?.bonus) || 0;
      if (novoBonus) {
        if (!atual[k]) atual[k] = {};
        atual[k].bonus = novoBonus;
      } else if (atual[k]) {
        delete atual[k].bonus;
        if (!atual[k].prof && !atual[k].exp) delete atual[k];
      }
    });

    const { error } = await window.sb.from('characters')
      .update({ pericias: atual }).eq('id', _charId);
    btn.disabled = false;
    if (error) { status.textContent = '⚠ ' + error.message; return; }
    status.textContent = '✓ Salvo!';
    setTimeout(fechar, 700);
  }

  window.AjustePericias = { abrir };
})();

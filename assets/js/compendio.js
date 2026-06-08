// assets/js/compendio.js
// Compêndio reutilizável: modal de busca para ITENS MÁGICOS e MONSTROS.
// Uso:  window.Compendio.abrir('itens')   |   window.Compendio.abrir('monstros')
// Lê data/itens_data.json e data/monstros_data.json (caminho relativo configurável
// via window.Compendio.base, padrão '../data/').
// Auto-contido: injeta CSS + modal no DOM sob demanda.

(function () {
  const cache = {};
  let _tipoAtual = null;

  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = s => (s == null ? '' : String(s)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const titulo = s => (s || '').toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase());

  const CFG = {
    itens:    { arquivo: 'itens_data.json',    titulo: '📜 Itens Mágicos', ph: 'Buscar item (nome, tipo)…' },
    monstros: { arquivo: 'monstros_data.json', titulo: '🐉 Bestiário',      ph: 'Buscar criatura (nome, tipo)…' },
  };
  const RARIDADES = ['comum', 'incomum', 'raro', 'muito raro', 'lendário', 'artefato', 'variável'];
  const CORES_RAR = { comum: '#9aa0a6', incomum: '#4caf6a', raro: '#4a90d9', 'muito raro': '#9b59b6', 'lendário': '#d4a843', artefato: '#c0392b', 'variável': '#7f8c8d' };

  const CSS = `
  .cp-ov { position: fixed; inset: 0; z-index: 1200; display: none; background: rgba(5,3,4,0.82); backdrop-filter: blur(4px); padding: 3vh 2vw; }
  .cp-ov.open { display: flex; }
  .cp-modal {
    margin: auto; width: 100%; max-width: 920px; max-height: 94vh; display: flex; flex-direction: column;
    background: linear-gradient(160deg, #1a1018, #120b10);
    border: 2px solid #8B6914; border-radius: 12px; box-shadow: 0 12px 50px rgba(0,0,0,0.8); overflow: hidden;
    font-family: 'EB Garamond','Libre Baskerville',Georgia,serif; color: #d4c5a0;
  }
  .cp-head { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-bottom: 1px solid rgba(139,105,20,0.5); }
  .cp-head h2 { margin: 0; font-family: 'Cinzel','Cinzel Decorative',serif; font-size: 19px; color: #b88a2c; letter-spacing: 1px; flex: 1; }
  .cp-x { background: none; border: none; color: #a89878; font-size: 26px; cursor: pointer; line-height: 1; padding: 2px 8px; }
  .cp-x:hover { color: #d4a843; }
  .cp-busca { padding: 12px 18px 8px; }
  .cp-busca input {
    width: 100%; padding: 11px 14px; font-size: 16px; border-radius: 8px;
    background: rgba(0,0,0,0.35); border: 1px solid #8B6914; color: #f0e6cf; font-family: inherit;
  }
  .cp-busca input:focus { outline: none; box-shadow: 0 0 0 2px rgba(184,138,44,0.4); }
  .cp-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 18px 10px; }
  .cp-chip {
    font-family: 'Cinzel',serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px;
    padding: 4px 10px; border-radius: 20px; cursor: pointer; background: rgba(255,255,255,0.05);
    border: 1px solid rgba(139,105,20,0.5); color: #a89878;
  }
  .cp-chip.on { background: #8B6914; color: #120b10; border-color: #b88a2c; }
  .cp-corpo { flex: 1; overflow-y: auto; padding: 4px 18px 18px; }
  .cp-lista { display: grid; gap: 8px; }
  .cp-item {
    display: flex; align-items: center; gap: 12px; padding: 10px 12px; cursor: pointer;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(139,105,20,0.3); border-radius: 8px; transition: .15s;
  }
  .cp-item:hover { border-color: #b88a2c; background: rgba(184,138,44,0.08); transform: translateX(2px); }
  .cp-thumb { flex-shrink: 0; width: 48px; height: 48px; border-radius: 6px; overflow: hidden; background: rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; font-size: 20px; border: 1px solid rgba(139,105,20,.3); }
  .cp-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .cp-item-nome { font-family: 'Cinzel',serif; font-weight: 700; color: #d4a843; font-size: 15px; }
  .cp-item-meta { font-size: 12px; color: #a89878; font-style: italic; }
  .cp-tag { display: inline-block; font-family: 'Cinzel',serif; font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 7px; border-radius: 4px; margin-left: 6px; }
  .cp-vazio, .cp-dica { text-align: center; color: #8c7d5e; font-style: italic; padding: 24px 10px; }
  .cp-dica { padding: 8px; font-size: 12px; }

  /* Detalhe (ficha) */
  .cp-voltar { background: none; border: 1px solid #8B6914; color: #a89878; font-family: 'Cinzel',serif; font-size: 11px; padding: 6px 12px; border-radius: 6px; cursor: pointer; margin-bottom: 12px; }
  .cp-voltar:hover { background: #8B6914; color: #120b10; }
  .cp-ficha h3 { font-family: 'Cinzel Decorative','Cinzel',serif; color: #b88a2c; font-size: 22px; margin: 0 0 2px; }
  .cp-ficha .cp-sub { font-style: italic; color: #a89878; margin-bottom: 10px; }
  .cp-ficha .cp-img { float: right; width: 160px; max-width: 40%; border-radius: 8px; border: 1px solid #8B6914; margin: 0 0 10px 14px; }
  .cp-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(80px,1fr)); gap: 6px; margin: 10px 0; }
  .cp-stat { background: rgba(0,0,0,.3); border: 1px solid rgba(139,105,20,.4); border-radius: 6px; padding: 6px; text-align: center; }
  .cp-stat .l { font-family: 'Cinzel',serif; font-size: 9px; color: #8c7d5e; text-transform: uppercase; }
  .cp-stat .v { font-weight: 700; color: #d4c5a0; font-size: 15px; }
  .cp-linha { margin: 4px 0; font-size: 14px; line-height: 1.5; }
  .cp-linha b { color: #b88a2c; }
  .cp-sec { font-family: 'Cinzel',serif; color: #b88a2c; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 14px 0 6px; border-bottom: 1px solid rgba(139,105,20,.4); padding-bottom: 3px; }
  .cp-bloco { margin: 6px 0; font-size: 14px; line-height: 1.55; }
  .cp-bloco b { color: #d4a843; }
  .cp-desc { font-size: 15px; line-height: 1.65; white-space: pre-wrap; }
  @media (max-width: 600px) { .cp-modal { max-height: 96vh; } .cp-ficha .cp-img { float: none; width: 100%; max-width: 100%; margin: 0 0 12px; } }
  `;

  let _ov;
  function montar() {
    const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
    _ov = document.createElement('div');
    _ov.className = 'cp-ov';
    _ov.innerHTML = `
      <div class="cp-modal" role="dialog" aria-modal="true">
        <div class="cp-head"><h2 id="cp-titulo"></h2><button class="cp-x" aria-label="Fechar">✕</button></div>
        <div class="cp-busca"><input id="cp-input" type="search" autocomplete="off"></div>
        <div class="cp-chips" id="cp-chips"></div>
        <div class="cp-corpo" id="cp-corpo"></div>
      </div>`;
    document.body.appendChild(_ov);
    _ov.addEventListener('click', e => { if (e.target === _ov || e.target.classList.contains('cp-x')) fechar(); });
    _ov.querySelector('#cp-input').addEventListener('input', e => renderLista(e.target.value));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && _ov.classList.contains('open')) fechar(); });
  }

  let _filtroRar = '';
  async function abrir(tipo) {
    if (!CFG[tipo]) return;
    if (!_ov) montar();
    _tipoAtual = tipo; _filtroRar = '';
    _ov.querySelector('#cp-titulo').textContent = CFG[tipo].titulo;
    _ov.querySelector('#cp-input').value = '';
    _ov.querySelector('#cp-input').placeholder = CFG[tipo].ph;
    // chips de raridade só p/ itens
    const chips = _ov.querySelector('#cp-chips');
    if (tipo === 'itens') {
      chips.style.display = 'flex';
      chips.innerHTML = `<span class="cp-chip on" data-rar="">Todos</span>` +
        RARIDADES.map(r => `<span class="cp-chip" data-rar="${r}" style="border-color:${CORES_RAR[r]}55">${titulo(r)}</span>`).join('');
      chips.querySelectorAll('.cp-chip').forEach(c => c.addEventListener('click', () => {
        _filtroRar = c.dataset.rar;
        chips.querySelectorAll('.cp-chip').forEach(x => x.classList.toggle('on', x === c));
        renderLista(_ov.querySelector('#cp-input').value);
      }));
    } else { chips.style.display = 'none'; chips.innerHTML = ''; }

    _ov.classList.add('open');
    document.body.style.overflow = 'hidden';
    const corpo = _ov.querySelector('#cp-corpo');
    corpo.innerHTML = '<div class="cp-dica">Carregando…</div>';
    const dados = await carregar(tipo);
    if (!dados) { corpo.innerHTML = '<div class="cp-vazio">⚠ Não foi possível carregar.</div>'; return; }
    renderLista('');
    setTimeout(() => _ov.querySelector('#cp-input').focus(), 60);
  }

  function fechar() { if (_ov) { _ov.classList.remove('open'); document.body.style.overflow = ''; } }

  async function carregar(tipo) {
    if (cache[tipo]) return cache[tipo];
    const base = window.Compendio.base || '../data/';
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(base + CFG[tipo].arquivo, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error(r.status);
      cache[tipo] = await r.json();
      return cache[tipo];
    } catch (e) { console.warn('[compendio]', e); return null; }
  }

  function renderLista(termo) {
    const corpo = _ov.querySelector('#cp-corpo');
    const dados = cache[_tipoAtual] || [];
    const q = norm(termo).trim();
    let lista = dados;
    if (_tipoAtual === 'itens' && _filtroRar) lista = lista.filter(i => i.raridade === _filtroRar);
    if (q) lista = lista.filter(x => norm(x.nome).includes(q) || norm(x.tipo).includes(q));

    if (!lista.length) { corpo.innerHTML = '<div class="cp-vazio">Nada encontrado.</div>'; return; }
    const cab = `<div class="cp-dica">${lista.length} ${_tipoAtual === 'itens' ? 'itens' : 'criaturas'}${q || _filtroRar ? ' (filtrado)' : ''}</div>`;
    const html = lista.slice(0, 300).map((x, i) => _tipoAtual === 'itens' ? itemHTML(x, dados.indexOf(x)) : monstroHTML(x, dados.indexOf(x))).join('');
    corpo.innerHTML = cab + `<div class="cp-lista">${html}</div>` + (lista.length > 300 ? '<div class="cp-dica">Refine a busca para ver mais.</div>' : '');
    corpo.querySelectorAll('[data-idx]').forEach(el => el.addEventListener('click', () => abrirDetalhe(+el.dataset.idx)));
    corpo.scrollTop = 0;
  }

  function itemHTML(it, idx) {
    const cor = CORES_RAR[it.raridade] || '#a89878';
    return `<div class="cp-item" data-idx="${idx}">
      <div class="cp-thumb">${{Poção:'🧪',Anel:'💍',Varinha:'🪄',Cajado:'🪄',Bastão:'🦯',Arma:'⚔️',Armadura:'🛡️',Escudo:'🛡️',Manto:'🧥',Botas:'🥾',Pergaminho:'📜'}[it.tipo.split(' ')[0]] || '✨'}</div>
      <div style="flex:1;min-width:0">
        <div class="cp-item-nome">${esc(titulo(it.nome))}<span class="cp-tag" style="background:${cor}22;color:${cor};border:1px solid ${cor}66">${esc(it.raridade)}</span></div>
        <div class="cp-item-meta">${esc(it.tipo)}${it.sintonia ? ' · requer sintonização' : ''}</div>
      </div></div>`;
  }
  function monstroHTML(m, idx) {
    return `<div class="cp-item" data-idx="${idx}">
      <div class="cp-thumb">${m.imagem ? `<img src="${esc(m.imagem)}" alt="" loading="lazy" onerror="this.parentElement.textContent='🐲'">` : '🐲'}</div>
      <div style="flex:1;min-width:0">
        <div class="cp-item-nome">${esc(titulo(m.nome))}</div>
        <div class="cp-item-meta">${esc(m.tipo || '')} · 🛡️${m.ca} ❤️${m.hp_max} ⚔${esc(m.nd || '—')}</div>
      </div></div>`;
  }

  function abrirDetalhe(idx) {
    const corpo = _ov.querySelector('#cp-corpo');
    const x = (cache[_tipoAtual] || [])[idx];
    if (!x) return;
    corpo.innerHTML = `<button class="cp-voltar" id="cp-voltar">← Voltar à lista</button>` +
      (_tipoAtual === 'itens' ? fichaItem(x) : fichaMonstro(x));
    corpo.querySelector('#cp-voltar').addEventListener('click', () => renderLista(_ov.querySelector('#cp-input').value));
    corpo.scrollTop = 0;
  }

  function fichaItem(it) {
    const cor = CORES_RAR[it.raridade] || '#a89878';
    return `<div class="cp-ficha">
      <h3>${esc(titulo(it.nome))}</h3>
      <div class="cp-sub">${esc(it.tipo)}, <b style="color:${cor}">${esc(it.raridade)}</b>${it.sintonia ? ` · requer sintonização${it.sintonia_detalhe ? ' ' + esc(it.sintonia_detalhe) : ''}` : ''}</div>
      <div class="cp-desc">${esc(it.descricao)}</div>
    </div>`;
  }
  function fichaMonstro(m) {
    const a = m.atributos || {};
    const mod = v => { const x = Math.floor(((+v || 10) - 10) / 2); return (x >= 0 ? '+' : '') + x; };
    const atr = [['FOR', a.for], ['DES', a.dex], ['CON', a.con], ['INT', a.int], ['SAB', a.sab], ['CAR', a.car]]
      .map(([l, v]) => `<div class="cp-stat"><div class="l">${l}</div><div class="v">${v ?? 10}</div><div class="l">${mod(v)}</div></div>`).join('');
    const linha = (lbl, val) => val ? `<div class="cp-linha"><b>${lbl}:</b> ${esc(val)}</div>` : '';
    const blocos = arr => (arr || []).map(t => `<div class="cp-bloco"><b>${esc(t.nome)}.</b> ${esc(t.desc)}</div>`).join('');
    return `<div class="cp-ficha">
      ${m.imagem ? `<img class="cp-img" src="${esc(m.imagem)}" alt="" onerror="this.style.display='none'">` : ''}
      <h3>${esc(titulo(m.nome))}</h3>
      <div class="cp-sub">${esc(m.tipo || '')}</div>
      <div class="cp-stats">
        <div class="cp-stat"><div class="l">CA</div><div class="v">${m.ca}</div></div>
        <div class="cp-stat"><div class="l">PV</div><div class="v">${m.hp_max}</div><div class="l">${esc(m.pv_dados || '')}</div></div>
        <div class="cp-stat"><div class="l">Deslocamento</div><div class="v" style="font-size:12px">${esc(m.deslocamento || '—')}</div></div>
        <div class="cp-stat"><div class="l">ND</div><div class="v" style="font-size:13px">${esc(m.nd || '—')}</div></div>
      </div>
      <div class="cp-stats">${atr}</div>
      ${linha('Salvaguardas', m.salvaguardas)}
      ${linha('Perícias', m.pericias)}
      ${linha('Resistências', m.resistencias)}
      ${linha('Vulnerabilidades', m.vulnerabilidades)}
      ${linha('Imunidades', m.imunidades)}
      ${linha('Sentidos', m.sentidos)}
      ${linha('Idiomas', m.idiomas)}
      ${(m.tracos && m.tracos.length) ? `<div class="cp-sec">Traços</div>${blocos(m.tracos)}` : ''}
      ${(m.acoes && m.acoes.length) ? `<div class="cp-sec">Ações</div>${blocos(m.acoes)}` : ''}
      ${m.notas ? `<div class="cp-linha" style="margin-top:12px;font-style:italic;color:#8c7d5e">${esc(m.notas)}</div>` : ''}
    </div>`;
  }

  window.Compendio = { abrir, fechar, base: '../data/' };
})();

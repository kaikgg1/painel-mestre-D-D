// assets/js/compendio.js
// Compêndio reutilizável: busca de ITENS MÁGICOS e MONSTROS.
// Dois modos:
//   • Modal:  window.Compendio.abrir('itens' | 'monstros')      (usado em painéis)
//   • Página: window.Compendio.inline(containerEl, 'itens'|'monstros')  (página dedicada)
// Lê data/itens_data.json e data/monstros_data.json (base configurável via Compendio.base).
// Auto-contido: injeta CSS sob demanda.

(function () {
  const cache = {};
  let _tipo = null;      // tipo atual
  let _root = null;      // elemento que contém .cp-input/.cp-chips/.cp-corpo
  let _filtroRar = '';

  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // Fonte única em assets/js/regras_base.js (também escapa aspas simples,
  // diferente da versão anterior daqui — carregar regras_base.js antes deste arquivo).
  const esc = window.Regras.escapeHtml;
  // "POÇÃO DE ESCALAR" -> "Poção de Escalar"
  // Não usar \b aqui: em JS ele é ASCII, então "ç"/"ã" viram fronteira de palavra
  // e o resultado sai "PoÇãO". Capitalizamos só depois de início/espaço/pontuação,
  // e deixamos as preposições curtas em minúsculo.
  const MINUSCULAS = new Set(['de','da','do','das','dos','e','em','na','no','nas','nos','a','o','as','os','com','para','por','ao','à']);
  const titulo = s => (s || '').toLowerCase()
    .replace(/(^|[\s\-–—'"(\[/])(\p{L})/gu, (m, sep, letra, i) =>
      sep + letra.toUpperCase())
    .replace(/\s(\p{L}+)/gu, (m, p) => MINUSCULAS.has(p.toLowerCase()) ? ' ' + p.toLowerCase() : m);

  // Ícones vetoriais (assets/js/icones.js). Degrada pra string vazia se a
  // página não carregou o módulo — nenhum emoji de sistema fica pra trás.
  const ico = (chave, opts) => (window.Icones ? window.Icones.html(chave, opts) : '');

  const CFG = {
    itens:    { arquivo: 'itens_data.json',    titulo: 'Itens Mágicos', ico: 'itens',     ph: 'Buscar item (nome, tipo)…' },
    monstros: { arquivo: 'monstros_data.json', titulo: 'Bestiário',     ico: 'bestiario', ph: 'Buscar criatura (nome, tipo)…' },
  };

  // Ícone do item a partir do TIPO COMPLETO (não só da 1ª palavra): assim
  // "Arma (espada longa)" vira espada e "Armadura (escudo)" vira escudo,
  // em vez de caírem num genérico. A ordem importa — o mais específico primeiro.
  const REGRAS_ICONE = [
    [/escudo/i,                          'armadura_escudo'],
    [/armadura.*(malha|brunea)/i,        'armadura_malha'],
    [/armadura/i,                        'armadura_placas'],
    [/espada|cimitarra/i,                'arma_espada'],
    [/machado|malho/i,                   'arma_machado'],
    [/martelo/i,                         'arma_martelo'],
    [/ma[çc]a/i,                         'arma_maca'],
    [/arco|flecha|besta/i,               'arma_arco'],
    [/adaga/i,                           'arma_adaga'],
    [/tridente|azagaia|lan[çc]a/i,       'arma_tridente'],
    [/arma/i,                            'arma_generica'],
    [/po[çc][ãa]o/i,                     'pocao'],
    [/anel/i,                            'anel'],
    [/cajado/i,                          'cajado'],
    [/varinha/i,                         'varinha'],
    [/bast[ãa]o/i,                       'bastao'],
    [/pergaminho/i,                      'pergaminho_item'],
  ];
  // "Item maravilhoso" cobre metade do catálogo (mantos, botas, elmos, gemas…),
  // então quando o TIPO não diz nada, olhamos o NOME do item.
  const REGRAS_NOME = [
    [/^manto|^capa/i,        'manto_item'],
    [/^botas?/i,             'botas_item'],
    [/^robe/i,               'robe_item'],
    [/^elmo|^chapéu/i,       'elmo_item'],
    [/^manual|^tomo|^livro/i,'livro_item'],
    [/^gema|^pedra d/i,      'gema_item'],
    [/^luvas|^manoplas/i,    'luvas_item'],
    [/^olhos|^lentes/i,      'olhos_item'],
    [/^pedra/i,              'pedra_item'],
    [/^pó\b|^po\b/i,         'po_item'],
    [/^periapto|^talismã|^amuleto|^colar/i, 'talisma_item'],
    [/^baralho|^cartas/i,    'baralho_item'],
    [/^bolsa|^saco|^mochila/i, 'bolsa_item'],
    [/^corda/i,              'corda_item'],
    [/^flauta/i,             'flauta_item'],
    [/^garrafa|^frasco|^cantil/i, 'garrafa_item'],
    [/^cubo/i,               'cubo_item'],
    [/^ferradura/i,          'ferradura_item'],
    [/^trombeta|^corneta/i,  'trombeta_item'],
    [/^aljava/i,             'aljava_item'],
    [/^braçadeira|^bracelete/i, 'braçadeira_item'],
    [/^espelho/i,            'espelho_item'],
    [/^baú|^cofre/i,         'bau_item'],
    [/^chave/i,              'chave_item'],
    [/^tambor/i,             'tambor_item'],
    [/^lira|^alaúde|^harpa/i,'lira_item'],
    [/^vela/i,               'vela_item'],
    [/^bola|^orbe|^esfera/i, 'bola_item'],
    [/^brincos?|^broche/i,   'gema_item'],
  ];

  function chaveIconeItem(tipo, nome) {
    const t = tipo || '';
    for (const [re, chave] of REGRAS_ICONE) if (re.test(t)) return chave;
    const n = nome || '';
    for (const [re, chave] of REGRAS_NOME) if (re.test(n)) return chave;
    return 'item_maravilhoso';   // genérico de último caso
  }
  // Ordem canônica só para ORDENAR os chips. A lista de chips em si é derivada
  // das raridades que existem de fato no JSON carregado — a lista fixa incluía
  // 'variável', que não existe em itens_data.json, e o chip sempre dava
  // "Nada encontrado".
  const ORDEM_RAR = ['comum', 'incomum', 'raro', 'muito raro', 'lendário', 'artefato', 'variável'];
  const CORES_RAR = { comum: '#9aa0a6', incomum: '#4caf6a', raro: '#4a90d9', 'muito raro': '#9b59b6', 'lendário': '#d4a843', artefato: '#c0392b', 'variável': '#7f8c8d' };

  const CSS = `
  .cp-ov { position: fixed; inset: 0; z-index: 1200; display: none; background: rgba(5,3,4,0.82); backdrop-filter: blur(4px); padding: 3vh 2vw; }
  .cp-ov.open { display: flex; }
  .cp-modal { margin: auto; width: 100%; max-width: 920px; max-height: 94vh; display: flex; flex-direction: column;
    background: linear-gradient(160deg, #1a1018, #120b10); border: 2px solid #8B6914; border-radius: 12px; box-shadow: 0 12px 50px rgba(0,0,0,0.8); overflow: hidden; }
  .cp-head { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-bottom: 1px solid rgba(139,105,20,0.5); }
  .cp-head h2 { margin: 0; font-family: 'Cinzel','Cinzel Decorative',serif; font-size: 19px; color: #b88a2c; letter-spacing: 1px; flex: 1; display: flex; align-items: center; gap: 8px; }
  .cp-x { background: none; border: none; color: #a89878; font-size: 26px; cursor: pointer; line-height: 1; padding: 2px 8px; }
  .cp-x:hover { color: #d4a843; }
  /* host (modal-body ou container inline) */
  .cp-host { display: flex; flex-direction: column; min-height: 0; font-family: 'EB Garamond','Libre Baskerville',Georgia,serif; color: #d4c5a0; }
  .cp-host.cp-inline { flex: 1; }
  .cp-busca { padding: 12px 4px 8px; }
  .cp-busca input { width: 100%; padding: 11px 14px; font-size: 16px; border-radius: 8px; background: rgba(0,0,0,0.35); border: 1px solid #8B6914; color: #f0e6cf; font-family: inherit; }
  .cp-busca input:focus { outline: none; box-shadow: 0 0 0 2px rgba(184,138,44,0.4); }
  .cp-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 4px 10px; }
  /* <button> (não <span>) para funcionar no teclado; o reset abaixo mantém a
     aparência que o chip já tinha. */
  .cp-chip { display: inline-block; -webkit-appearance: none; appearance: none; line-height: 1.4; margin: 0;
    font-family: 'Cinzel',serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; padding: 4px 10px; border-radius: 20px; cursor: pointer; background: rgba(255,255,255,0.05); border: 1px solid rgba(139,105,20,0.5); color: #a89878; }
  .cp-chip:focus-visible, .cp-item:focus-visible { outline: 2px solid #d4a843; outline-offset: 2px; }
  .cp-chip.on { background: #8B6914; color: #120b10; border-color: #b88a2c; }
  .cp-corpo { flex: 1; overflow-y: auto; padding: 4px 4px 18px; }
  .cp-lista { display: grid; gap: 8px; }
  /* também <button>: a lista inteira era um <div> com onclick, inacessível
     por teclado. width/text-align/font/color desfazem o estilo padrão do botão. */
  .cp-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; cursor: pointer; background: rgba(255,255,255,0.03); border: 1px solid rgba(139,105,20,0.3); border-radius: 8px; transition: .15s;
    width: 100%; text-align: left; font: inherit; color: inherit; -webkit-appearance: none; appearance: none; }
  .cp-item:hover { border-color: #b88a2c; background: rgba(184,138,44,0.08); transform: translateX(2px); }
  .cp-thumb { position: relative; flex-shrink: 0; width: 48px; height: 48px; border-radius: 6px; overflow: hidden; background: rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; font-size: 22px; color: #b88a2c; border: 1px solid rgba(139,105,20,.3); }
  /* A imagem cobre o ícone; se falhar (onerror -> remove) o ícone reaparece. */
  .cp-thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .cp-item-meta iconify-icon { vertical-align: -2px; margin-right: 2px; color: #b88a2c; }
  /* display:block porque agora são <span> dentro do <button> da linha */
  .cp-item-nome { display: block; font-family: 'Cinzel',serif; font-weight: 700; color: #d4a843; font-size: 15px; }
  .cp-item-meta { display: block; font-size: 12px; color: #a89878; font-style: italic; }
  .cp-tag { display: inline-block; font-family: 'Cinzel',serif; font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 7px; border-radius: 4px; margin-left: 6px; }
  .cp-vazio, .cp-dica { text-align: center; color: #8c7d5e; font-style: italic; padding: 24px 10px; }
  .cp-dica { padding: 8px; font-size: 12px; }
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

  /* --- Responsivo (mobile) --------------------------------------------
     O compêndio é usado tanto em página cheia (itens_magicos.html) quanto
     em modal dentro dos painéis; estes ajustes valem para os dois. */
  @media (max-width: 767px) {
    .cp-ov { padding: 0; }
    .cp-modal { max-width: 100%; max-height: 100vh; max-height: 100dvh; border-radius: 0; border-width: 0 0 1px 0; }
    .cp-head { padding: 12px 14px; }
    .cp-head h2 { font-size: 16px; }
    .cp-x { min-width: 44px; min-height: 44px; padding: 0; }
    .cp-busca input { font-size: 16px; padding: 12px 14px; }  /* >=16px evita zoom no iOS */
    .cp-chips { gap: 5px; }
    /* padding maior já existia ("alvo de toque maior") mas só chegava a
       31px — min-height fecha nos 44px (--touch-target) sem inchar a
       largura, que é o que empilha vários chips numa fileira. */
    .cp-chip { padding: 7px 12px; font-size: 11px; min-height: 44px; display: inline-flex; align-items: center; }
    .cp-item { padding: 12px 10px; gap: 10px; }
    .cp-thumb { width: 54px; height: 54px; }                  /* miniatura maior no toque */
    .cp-item-nome { font-size: 16px; }
    .cp-stats { grid-template-columns: repeat(3, 1fr); }
    .cp-ficha h3 { font-size: 20px; }
    /* alvo de toque: o "voltar" é o único caminho de saída da ficha */
    .cp-voltar { padding: 10px 16px; font-size: 12px; min-height: 44px; }
  }
  @media (max-width: 420px) {
    .cp-stats { grid-template-columns: repeat(2, 1fr); }
    .cp-thumb { width: 46px; height: 46px; }
  }
  /* imagens nunca estouram o container */
  .cp-ficha img, .cp-item img { max-width: 100%; height: auto; }
  `;

  let _cssInjetado = false;
  function injetarCSS() { if (_cssInjetado) return; _cssInjetado = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }

  // HTML interno de busca/lista, montado em qualquer host
  function montarUI(host) {
    host.classList.add('cp-host');
    host.innerHTML = `
      <div class="cp-busca"><input class="cp-input" type="search" autocomplete="off"></div>
      <div class="cp-chips"></div>
      <div class="cp-corpo"></div>`;
    host.querySelector('.cp-input').addEventListener('input', e => renderLista(e.target.value));
    return host;
  }

  // Chips de raridade a partir dos DADOS: nunca oferece um filtro vazio.
  function montarChips(chips, dados) {
    const presentes = [...new Set(dados.map(i => i.raridade).filter(Boolean))]
      .sort((a, b) => {
        const ia = ORDEM_RAR.indexOf(a), ib = ORDEM_RAR.indexOf(b);
        // raridade desconhecida vai pro fim, em ordem alfabética
        if (ia < 0 && ib < 0) return a.localeCompare(b);
        if (ia < 0) return 1;
        if (ib < 0) return -1;
        return ia - ib;
      });
    if (!presentes.length) { chips.style.display = 'none'; chips.innerHTML = ''; return; }
    chips.style.display = 'flex';
    chips.innerHTML = `<button type="button" class="cp-chip on" data-rar="" aria-pressed="true">Todos</button>` +
      presentes.map(r => `<button type="button" class="cp-chip" data-rar="${esc(r)}" aria-pressed="false"`
        + ` style="border-color:${CORES_RAR[r] || '#a89878'}55">${esc(titulo(r))}</button>`).join('');
    chips.querySelectorAll('.cp-chip').forEach(c => c.addEventListener('click', () => {
      _filtroRar = c.dataset.rar;
      chips.querySelectorAll('.cp-chip').forEach(x => {
        const on = x === c;
        x.classList.toggle('on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      renderLista(_root.querySelector('.cp-input').value);
    }));
  }

  async function popular(tipo) {
    _tipo = tipo; _filtroRar = '';
    const inp = _root.querySelector('.cp-input');
    inp.value = ''; inp.placeholder = CFG[tipo].ph;
    const chips = _root.querySelector('.cp-chips');
    chips.style.display = 'none'; chips.innerHTML = '';

    const corpo = _root.querySelector('.cp-corpo');
    corpo.innerHTML = '<div class="cp-dica">Carregando…</div>';
    const dados = await carregar(tipo);
    if (!dados) { corpo.innerHTML = `<div class="cp-vazio">${ico('aviso')} Não foi possível carregar.</div>`; return; }
    // Depois da carga: os chips dependem do conteúdo do JSON.
    if (tipo === 'itens') montarChips(chips, dados);
    renderLista('');
    setTimeout(() => inp.focus(), 60);
  }

  // ---- MODAL ----
  let _ov;
  async function abrir(tipo) {
    if (!CFG[tipo]) return;
    injetarCSS();
    if (!_ov) {
      _ov = document.createElement('div');
      _ov.className = 'cp-ov';
      _ov.innerHTML = `<div class="cp-modal"><div class="cp-head"><h2 class="cp-titulo"></h2><button class="cp-x" aria-label="Fechar">✕</button></div><div class="cp-host cp-modal-body" style="flex:1;min-height:0;padding:0 18px 12px"></div></div>`;
      document.body.appendChild(_ov);
      _ov.addEventListener('click', e => { if (e.target === _ov || e.target.classList.contains('cp-x')) fechar(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && _ov.classList.contains('open')) fechar(); });
      montarUI(_ov.querySelector('.cp-modal-body'));
    }
    _root = _ov.querySelector('.cp-modal-body');
    _ov.querySelector('.cp-titulo').innerHTML = ico(CFG[tipo].ico) + '<span>' + esc(CFG[tipo].titulo) + '</span>';
    _ov.classList.add('open');
    document.body.style.overflow = 'hidden';
    await popular(tipo);
  }
  function fechar() { if (_ov) { _ov.classList.remove('open'); document.body.style.overflow = ''; } }

  // ---- PÁGINA (inline) ----
  async function inline(container, tipo) {
    if (!CFG[tipo] || !container) return;
    injetarCSS();
    container.classList.add('cp-inline');
    _root = montarUI(container);
    await popular(tipo);
  }

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
    const corpo = _root.querySelector('.cp-corpo');
    const dados = cache[_tipo] || [];
    const q = norm(termo).trim();
    let lista = dados;
    if (_tipo === 'itens' && _filtroRar) lista = lista.filter(i => i.raridade === _filtroRar);
    if (q) lista = lista.filter(x => norm(x.nome).includes(q) || norm(x.tipo).includes(q));
    if (!lista.length) { corpo.innerHTML = '<div class="cp-vazio">Nada encontrado.</div>'; return; }
    const cab = `<div class="cp-dica">${lista.length} ${_tipo === 'itens' ? 'itens' : 'criaturas'}${q || _filtroRar ? ' (filtrado)' : ''}</div>`;
    const html = lista.slice(0, 300).map(x => _tipo === 'itens' ? itemHTML(x, dados.indexOf(x)) : monstroHTML(x, dados.indexOf(x))).join('');
    corpo.innerHTML = cab + `<div class="cp-lista">${html}</div>` + (lista.length > 300 ? '<div class="cp-dica">Refine a busca para ver mais.</div>' : '');
    corpo.querySelectorAll('[data-idx]').forEach(el => el.addEventListener('click', () => abrirDetalhe(+el.dataset.idx)));
    corpo.scrollTop = 0;
  }

  function itemHTML(it, idx) {
    const cor = CORES_RAR[it.raridade] || '#a89878';
    const icone = ico(chaveIconeItem(it.tipo, it.nome));
    return `<button type="button" class="cp-item" data-idx="${idx}">
      <span class="cp-thumb">${icone}${it.imagem ? `<img src="${esc(it.imagem)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>
      <span style="flex:1;min-width:0">
        <span class="cp-item-nome">${esc(titulo(it.nome))}<span class="cp-tag" style="background:${cor}22;color:${cor};border:1px solid ${cor}66">${esc(it.raridade)}</span></span>
        <span class="cp-item-meta">${esc(it.tipo)}${it.sintonia ? ' · requer sintonização' : ''}</span>
      </span></button>`;
  }
  function monstroHTML(m, idx) {
    return `<button type="button" class="cp-item" data-idx="${idx}">
      <span class="cp-thumb">${ico('dragao')}${m.imagem ? `<img src="${esc(m.imagem)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>
      <span style="flex:1;min-width:0">
        <span class="cp-item-nome">${esc(titulo(m.nome))}</span>
        <span class="cp-item-meta">${esc(m.tipo || '')} · ${ico('escudo', { titulo: 'Classe de Armadura' })}${m.ca} ${ico('vida', { titulo: 'Pontos de vida' })}${m.hp_max} ${ico('ataque', { titulo: 'Nível de desafio' })}${esc(m.nd || '—')}</span>
      </span></button>`;
  }

  function abrirDetalhe(idx) {
    const corpo = _root.querySelector('.cp-corpo');
    const x = (cache[_tipo] || [])[idx];
    if (!x) return;
    corpo.innerHTML = `<button class="cp-voltar">← Voltar à lista</button>` + (_tipo === 'itens' ? fichaItem(x) : fichaMonstro(x));
    corpo.querySelector('.cp-voltar').addEventListener('click', () => renderLista(_root.querySelector('.cp-input').value));
    corpo.scrollTop = 0;
  }

  function fichaItem(it) {
    const cor = CORES_RAR[it.raridade] || '#a89878';
    return `<div class="cp-ficha">
      ${it.imagem ? `<img class="cp-img" src="${esc(it.imagem)}" alt="" onerror="this.style.display='none'">` : ''}
      <h3>${esc(titulo(it.nome))}</h3>
      <div class="cp-sub">${esc(it.tipo)}, <b style="color:${cor}">${esc(it.raridade)}</b>${it.sintonia ? ` · requer sintonização${it.sintonia_detalhe ? ' ' + esc(it.sintonia_detalhe) : ''}` : ''}</div>
      <div class="cp-desc">${esc(it.descricao)}</div></div>`;
  }
  function fichaMonstro(m) {
    const a = m.atributos || {};
    const mod = v => window.Regras.fmtMod(window.Regras.mod(v));
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
      ${(m.acoes_bonus && m.acoes_bonus.length) ? `<div class="cp-sec">Ações Bônus</div>${blocos(m.acoes_bonus)}` : ''}
      ${(m.reacoes && m.reacoes.length) ? `<div class="cp-sec">Reações</div>${blocos(m.reacoes)}` : ''}
      ${(m.acoes_lendarias && m.acoes_lendarias.length) ? `<div class="cp-sec">Ações Lendárias</div>${blocos(m.acoes_lendarias)}` : ''}
      ${(m.acoes_covil && m.acoes_covil.length) ? `<div class="cp-sec">Ações de Covil</div>${blocos(m.acoes_covil)}` : ''}
      ${m.notas ? `<div class="cp-linha" style="margin-top:12px;font-style:italic;color:#8c7d5e">${esc(m.notas)}</div>` : ''}
    </div>`;
  }

  window.Compendio = { abrir, fechar, inline, base: '../data/' };
})();

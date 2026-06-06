// assets/js/master_notes.js
// Modal de anotações do Mestre — timeline (data + categoria + texto) por personagem.
// Persistência: tabela master_notes (Supabase). Só Mestre acessa.
//
// Uso: chamar abrirNotasMestre() de qualquer botão.
//
// Dependências: window.sb, window.Auth.

(function () {
  // Data local em formato YYYY-MM-DD (evita bug do toISOString() em fusos atrasados)
  function hojeLocal() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  // Formata YYYY-MM-DD para DD/MM/AAAA sem cair em armadilha de timezone
  function fmtData(ymd) {
    if (!ymd) return '—';
    const [y, m, d] = ymd.split('-');
    return `${d}/${m}/${y}`;
  }

  const CATEGORIAS = [
    { id: 'historia',    label: 'História',    icon: '📜', cor: '#b88a2c' },
    { id: 'equipamento', label: 'Equipamento', icon: '⚔',  cor: '#8a8a4a' },
    { id: 'npc',         label: 'NPC',         icon: '👤', cor: '#6a6a90' },
    { id: 'segredo',     label: 'Segredo',     icon: '🔒', cor: '#8b1a1a' },
    { id: 'decisao',     label: 'Decisão',     icon: '⚖',  cor: '#4a8a8a' },
    { id: 'loot',        label: 'Loot',        icon: '💰', cor: '#c9a961' },
    { id: 'outro',       label: 'Outro',       icon: '✦',  cor: '#8c7d5e' },
  ];
  const POR_ID = Object.fromEntries(CATEGORIAS.map(c => [c.id, c]));

  let _injetado = false;
  let _pjs = [];          // {id, nome}
  let _pjSelId = null;
  let _filtroCat = null;  // categoria ativa ou null
  let _canalRealtime = null;
  let _editandoId = null;

  // ===== CSS =====
  const CSS = `
  .mn-overlay {
    position: fixed; inset: 0; z-index: 5000;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    display: none; align-items: center; justify-content: center; padding: 16px;
  }
  .mn-overlay.open { display: flex; animation: mnFade 0.18s ease-out; }
  @keyframes mnFade { from { opacity: 0; } to { opacity: 1; } }
  .mn-modal {
    background: linear-gradient(160deg, #1f1416 0%, #160c10 100%);
    border: 2px solid #8B6914;
    border-radius: 10px;
    max-width: 980px; width: 100%;
    max-height: 92vh; max-height: 92dvh;
    display: flex; flex-direction: column;
    box-shadow: 0 0 0 1px #8b1d1d inset, 0 28px 80px rgba(0,0,0,0.9), 0 0 60px rgba(139,29,29,0.12);
    overflow: hidden;
    animation: mnScale 0.22s ease-out;
    font-family: 'EB Garamond', Georgia, serif;
    color: #d4c5a0;
  }
  @keyframes mnScale { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }

  /* ===== HEADER ===== */
  .mn-header {
    padding: 16px 22px 14px;
    border-bottom: 1px solid #6b1010;
    display: flex; align-items: center; gap: 14px;
    background: linear-gradient(180deg, #251618 0%, #1a1014 100%);
    position: relative;
    flex-shrink: 0;
  }
  .mn-header::before {
    content: ''; position: absolute; left: 0; right: 0; top: 0; height: 3px;
    background: linear-gradient(to right, transparent, #b88a2c, transparent);
  }
  .mn-title {
    font-family: 'Cinzel Decorative', serif;
    font-size: 20px; font-weight: 700; color: #b88a2c;
    letter-spacing: 1.5px; flex: 1;
    text-shadow: 0 0 20px rgba(184,138,44,0.3);
    display: flex; align-items: center; gap: 10px;
  }
  .mn-close {
    background: transparent; border: 1px solid #6b1010; color: #d4c5a0;
    padding: 8px 14px; border-radius: 4px; cursor: pointer;
    font-family: 'Cinzel', serif; font-size: 11px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase;
    transition: all 0.15s; min-height: 36px;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .mn-close:hover { background: #6b1010; color: #fff; border-color: #8b1d1d; }

  /* ===== BODY ===== */
  .mn-body {
    flex: 1; min-height: 0; overflow: hidden;
    display: grid; grid-template-columns: 240px 1fr;
  }

  /* ===== SIDEBAR — lista de PJs ===== */
  .mn-sidebar {
    border-right: 1px solid rgba(139,105,20,0.25);
    background: rgba(0,0,0,0.18);
    display: flex; flex-direction: column;
    min-height: 0; overflow: hidden;
  }
  .mn-sidebar-label {
    font-family: 'Cinzel', serif; font-size: 10px;
    color: #b88a2c; letter-spacing: 1.8px; text-transform: uppercase;
    padding: 14px 16px 8px;
    border-bottom: 1px solid rgba(139,105,20,0.2);
    flex-shrink: 0; font-weight: 700;
  }
  .mn-pj-list-wrap {
    flex: 1; overflow-y: auto;
    padding: 8px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .mn-pj {
    text-align: left;
    background: linear-gradient(180deg, rgba(139,105,20,0.06), transparent);
    border: 1px solid rgba(139,105,20,0.25);
    color: #d4c5a0; padding: 9px 11px; border-radius: 5px;
    font-family: 'Cinzel', serif; cursor: pointer;
    transition: all 0.15s;
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    min-height: 46px;
  }
  .mn-pj:hover { border-color: #b88a2c; background: rgba(139,105,20,0.12); transform: translateX(2px); }
  .mn-pj.ativo {
    background: linear-gradient(180deg, #b88a2c, #8B6914);
    color: #1a1014; border-color: #d4a843; font-weight: 700;
    box-shadow: 0 4px 12px rgba(184,138,44,0.25);
  }
  .mn-pj .count {
    background: rgba(0,0,0,0.5); color: #d4c5a0;
    padding: 2px 9px; border-radius: 10px; font-size: 10px;
    font-weight: 700; flex-shrink: 0; min-width: 24px; text-align: center;
  }
  .mn-pj.ativo .count { background: rgba(0,0,0,0.35); color: #fff; }
  .mn-pj-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .mn-pj-nome { font-size: 13px; font-weight: 700; letter-spacing: 0.3px; }
  .mn-pj-sub {
    font-size: 9px; opacity: 0.75; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.8px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  /* ===== MAIN — formulário + timeline ===== */
  .mn-main {
    display: flex; flex-direction: column;
    min-width: 0; min-height: 0; overflow: hidden;
  }
  .mn-cats {
    display: flex; flex-wrap: wrap; gap: 5px;
    padding: 12px 18px 10px;
    border-bottom: 1px solid rgba(139,105,20,0.18);
    background: rgba(0,0,0,0.12);
    flex-shrink: 0;
  }
  .mn-cat-pill {
    background: rgba(0,0,0,0.3); border: 1px solid #5a4a30;
    color: #a89878; padding: 5px 10px; border-radius: 14px;
    font-family: 'Cinzel', serif; font-size: 10px; font-weight: 700;
    letter-spacing: 0.6px; cursor: pointer; transition: all 0.15s;
    text-transform: uppercase; min-height: 28px;
    display: inline-flex; align-items: center; gap: 4px;
  }
  .mn-cat-pill:hover { border-color: #b88a2c; color: #d4c5a0; }
  .mn-cat-pill.ativo {
    background: var(--cat-cor, #8B6914);
    border-color: var(--cat-cor, #b88a2c);
    color: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }

  /* ===== FORM ===== */
  .mn-form {
    background: linear-gradient(180deg, rgba(139,105,20,0.08), rgba(0,0,0,0.2));
    border-bottom: 1px solid rgba(139,105,20,0.2);
    padding: 14px 18px;
    display: grid; grid-template-columns: 1fr;
    gap: 8px;
    flex-shrink: 0;
  }
  .mn-form-row {
    display: grid; grid-template-columns: 1fr 160px auto auto;
    gap: 8px; align-items: stretch;
  }
  .mn-form textarea {
    width: 100%; min-height: 70px;
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(139,105,20,0.4);
    color: #d4c5a0;
    font-family: 'EB Garamond', serif; font-size: 14px; line-height: 1.5;
    padding: 10px 12px; border-radius: 5px; outline: none;
    resize: vertical; transition: border-color 0.15s, box-shadow 0.15s;
  }
  .mn-form textarea:focus {
    border-color: #b88a2c;
    box-shadow: 0 0 0 3px rgba(184,138,44,0.12);
  }
  .mn-form textarea::placeholder { color: #6a5a3a; font-style: italic; }
  .mn-form select, .mn-form input[type="date"] {
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(139,105,20,0.4);
    color: #d4c5a0;
    font-family: 'Cinzel', serif; font-size: 12px; font-weight: 600;
    padding: 8px 10px; border-radius: 5px; outline: none;
    min-height: 38px;
    transition: border-color 0.15s;
  }
  .mn-form select:focus, .mn-form input[type="date"]:focus { border-color: #b88a2c; }
  .mn-form input[type="date"]::-webkit-calendar-picker-indicator {
    filter: invert(0.7) sepia(1) hue-rotate(15deg);
    cursor: pointer;
  }
  .mn-form .mn-add-btn {
    background: linear-gradient(180deg, #b88a2c, #6a4f0e);
    border: 1px solid #d4a843; color: #1a1014;
    font-family: 'Cinzel', serif; font-size: 12px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase;
    padding: 8px 18px; border-radius: 5px; cursor: pointer;
    min-height: 38px; min-width: 120px;
    transition: all 0.2s;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  }
  .mn-form .mn-add-btn:hover {
    background: linear-gradient(180deg, #d4a843, #b88a2c);
    box-shadow: 0 4px 12px rgba(184,138,44,0.3);
  }
  .mn-form .mn-add-btn:disabled { opacity: 0.5; cursor: wait; }
  .mn-form .mn-cancel-btn {
    background: transparent; border: 1px solid #6b1010; color: #d4c5a0;
    font-family: 'Cinzel', serif; font-size: 11px; padding: 8px 14px;
    border-radius: 5px; cursor: pointer; min-height: 38px;
    transition: all 0.15s;
  }
  .mn-form .mn-cancel-btn:hover { background: #6b1010; color: #fff; }

  /* ===== TIMELINE ===== */
  .mn-timeline-wrap {
    flex: 1; overflow-y: auto; min-height: 0;
    padding: 14px 18px 22px;
  }
  .mn-timeline { display: flex; flex-direction: column; gap: 10px; }
  .mn-entry {
    border-left: 4px solid var(--cat-cor, #8B6914);
    background: linear-gradient(135deg, rgba(139,105,20,0.08), rgba(0,0,0,0.15) 70%);
    padding: 12px 14px; border-radius: 0 6px 6px 0;
    transition: transform 0.15s, box-shadow 0.15s;
    position: relative;
  }
  .mn-entry:hover {
    transform: translateX(2px);
    box-shadow: 0 4px 14px rgba(0,0,0,0.4);
  }
  .mn-entry-head {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .mn-entry-cat {
    background: var(--cat-cor, #8B6914); color: #fff;
    padding: 3px 9px; border-radius: 3px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.6px; font-size: 9px;
    font-family: 'Cinzel', serif;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  }
  .mn-entry-data {
    color: #8c7d5e; font-family: 'Cinzel', serif;
    font-size: 11px; letter-spacing: 0.5px; font-weight: 600;
    display: inline-flex; align-items: center; gap: 4px;
  }
  .mn-entry-actions { margin-left: auto; display: flex; gap: 4px; }
  .mn-entry-actions button {
    background: transparent; border: 1px solid transparent; color: #8c7d5e;
    cursor: pointer; padding: 6px 9px; border-radius: 4px;
    font-size: 13px; transition: all 0.15s; min-width: 32px; min-height: 32px;
  }
  .mn-entry-actions button:hover { background: rgba(139,29,29,0.3); color: #d4c5a0; border-color: rgba(139,29,29,0.4); }
  .mn-entry-text {
    color: #d4c5a0; font-size: 14px; line-height: 1.6;
    white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word;
  }
  .mn-empty {
    text-align: center; padding: 40px 20px;
    color: #8c7d5e; font-style: italic;
    border: 1px dashed rgba(139,105,20,0.25);
    border-radius: 8px;
    background: radial-gradient(ellipse at center, rgba(139,105,20,0.05), transparent 70%);
  }
  .mn-empty .ic { font-size: 38px; display: block; margin-bottom: 10px; opacity: 0.6; }
  .mn-empty .sub { font-size: 12px; opacity: 0.7; margin-top: 6px; font-style: normal; }

  /* ===== SCROLLBARS ===== */
  .mn-pj-list-wrap::-webkit-scrollbar,
  .mn-timeline-wrap::-webkit-scrollbar { width: 6px; }
  .mn-pj-list-wrap::-webkit-scrollbar-track,
  .mn-timeline-wrap::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
  .mn-pj-list-wrap::-webkit-scrollbar-thumb,
  .mn-timeline-wrap::-webkit-scrollbar-thumb { background: #8B6914; border-radius: 3px; }

  /* ===== RESPONSIVO ===== */
  @media (max-width: 820px) {
    .mn-body { grid-template-columns: 1fr; }
    .mn-sidebar {
      border-right: none;
      border-bottom: 1px solid rgba(139,105,20,0.25);
      max-height: 30vh;
    }
    .mn-form-row { grid-template-columns: 1fr 1fr; }
    .mn-form .mn-add-btn { grid-column: 1 / -1; }
  }
  @media (max-width: 600px) {
    .mn-overlay { padding: 0; }
    .mn-modal {
      max-width: 100%; max-height: 100vh; max-height: 100dvh;
      height: 100%; border-radius: 0; border-left: none; border-right: none;
    }
    .mn-header { padding: 12px 14px 10px; }
    .mn-title { font-size: 16px; letter-spacing: 0.8px; }
    .mn-close { padding: 8px 12px; font-size: 10px; }
    .mn-sidebar { max-height: 32vh; }
    .mn-sidebar-label { padding: 10px 12px 6px; font-size: 9px; }
    .mn-pj-list-wrap {
      flex-direction: row; gap: 6px;
      overflow-x: auto; overflow-y: hidden;
      padding: 8px 12px;
    }
    .mn-pj { flex: 0 0 auto; min-width: 160px; min-height: 52px; }
    .mn-cats { padding: 10px 12px 8px; gap: 4px; }
    .mn-cat-pill { padding: 6px 10px; font-size: 10px; min-height: 32px; }
    .mn-form { padding: 12px; }
    .mn-form-row { grid-template-columns: 1fr; }
    .mn-form .mn-add-btn,
    .mn-form .mn-cancel-btn { width: 100%; }
    .mn-form textarea { min-height: 80px; font-size: 15px; }
    .mn-timeline-wrap { padding: 12px 12px 20px; }
    .mn-entry { padding: 10px 12px; }
    .mn-entry-text { font-size: 13px; }
    .mn-entry-actions button { min-width: 38px; min-height: 38px; padding: 6px 10px; }
  }
  `;

  // ===== HTML =====
  function montar() {
    if (_injetado) return;
    _injetado = true;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'mn-overlay';
    overlay.id = 'mn-overlay';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) fechar();
    });
    overlay.innerHTML = `
      <div class="mn-modal" role="dialog" aria-modal="true" aria-labelledby="mn-title">
        <div class="mn-header">
          <div class="mn-title" id="mn-title"><span aria-hidden="true">📒</span> Anotações do Mestre</div>
          <button type="button" class="mn-close" id="mn-close-btn" aria-label="Fechar anotações">Fechar ✕</button>
        </div>
        <div class="mn-body">
          <aside class="mn-sidebar">
            <div class="mn-sidebar-label">Jogadores</div>
            <div class="mn-pj-list-wrap" id="mn-pj-list"></div>
          </aside>
          <section class="mn-main">
            <div class="mn-cats" id="mn-cats" role="toolbar" aria-label="Filtrar e definir categoria"></div>
            <form class="mn-form" id="mn-form" autocomplete="off" novalidate>
              <textarea id="mn-texto" placeholder="Escreva a anotação…  (Ctrl+Enter para salvar)" required></textarea>
              <div class="mn-form-row">
                <select id="mn-cat" aria-label="Categoria"></select>
                <input type="date" id="mn-data" aria-label="Data da anotação">
                <button type="button" class="mn-cancel-btn" id="mn-cancel" style="display:none">Cancelar</button>
                <button type="submit" class="mn-add-btn" id="mn-submit">+ Adicionar</button>
              </div>
            </form>
            <div class="mn-timeline-wrap">
              <div class="mn-timeline" id="mn-timeline"></div>
            </div>
          </section>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('mn-close-btn').addEventListener('click', fechar);
    document.getElementById('mn-form').addEventListener('submit', onSubmit);
    document.getElementById('mn-cancel').addEventListener('click', cancelarEdicao);
    document.getElementById('mn-texto').addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); onSubmit(e); }
    });

    // Categorias no select
    const sel = document.getElementById('mn-cat');
    CATEGORIAS.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.icon} ${c.label}`;
      sel.appendChild(opt);
    });
    // Categorias como pills de filtro
    const wrap = document.getElementById('mn-cats');
    const todasBtn = document.createElement('button');
    todasBtn.type = 'button';
    todasBtn.className = 'mn-cat-pill ativo';
    todasBtn.textContent = 'Todas';
    todasBtn.dataset.cat = '';
    todasBtn.style.setProperty('--cat-cor', '#8B6914');
    todasBtn.addEventListener('click', () => filtrarCat(null));
    wrap.appendChild(todasBtn);
    CATEGORIAS.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mn-cat-pill';
      b.textContent = `${c.icon} ${c.label}`;
      b.dataset.cat = c.id;
      b.style.setProperty('--cat-cor', c.cor);
      b.addEventListener('click', () => filtrarCat(c.id));
      wrap.appendChild(b);
    });

    document.addEventListener('keydown', escListener);
    document.getElementById('mn-data').value = hojeLocal();
  }

  function escListener(e) {
    if (e.key === 'Escape' && document.getElementById('mn-overlay')?.classList.contains('open')) {
      fechar();
    }
  }

  // ===== DADOS =====
  async function carregarPjs() {
    // Busca characters + profile do dono separadamente (sem FK auto-resolvido)
    const { data: chars, error } = await window.sb
      .from('characters')
      .select('id, nome, classe, nivel, user_id, is_active')
      .order('nome');
    if (error) { console.warn('[Notes] carregar chars:', error.message); _pjs = []; return; }

    const userIds = [...new Set((chars || []).map(c => c.user_id).filter(Boolean))];
    let nomesUser = {};
    if (userIds.length) {
      const { data: profs } = await window.sb
        .from('profiles')
        .select('id, nome')
        .in('id', userIds);
      (profs || []).forEach(p => { nomesUser[p.id] = p.nome; });
    }

    // Filtra "Personagem Padrão" — placeholder criado pelo grimório p/ ancorar favoritas
    _pjs = (chars || [])
      .filter(c => c.id && c.nome && c.nome.trim().toLowerCase() !== 'personagem padrão')
      .map(c => ({
        ...c,
        jogadorNome: nomesUser[c.user_id] || '?',
      }));
  }

  async function carregarNotas(pjId) {
    const { data, error } = await window.sb
      .from('master_notes')
      .select('id, categoria, texto, data_ref, created_at')
      .eq('character_id', pjId)
      .order('data_ref', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) { console.warn('[Notes] carregar:', error.message); return []; }
    return data || [];
  }

  async function inserirNota(pjId, categoria, texto, dataRef) {
    const { data: u } = await window.sb.auth.getUser();
    if (!u?.user) return null;
    const { data, error } = await window.sb
      .from('master_notes')
      .insert({
        user_id: u.user.id,
        character_id: pjId,
        categoria,
        texto,
        data_ref: dataRef || hojeLocal()
      })
      .select().single();
    if (error) { alert('Erro ao salvar: ' + error.message); return null; }
    return data;
  }

  async function atualizarNota(id, categoria, texto, dataRef) {
    const { error } = await window.sb
      .from('master_notes')
      .update({ categoria, texto, data_ref: dataRef })
      .eq('id', id);
    if (error) { alert('Erro ao atualizar: ' + error.message); return false; }
    return true;
  }

  async function deletarNota(id) {
    const { error } = await window.sb.from('master_notes').delete().eq('id', id);
    if (error) { alert('Erro ao deletar: ' + error.message); return false; }
    return true;
  }

  // ===== RENDER =====
  async function renderListaPj() {
    const wrap = document.getElementById('mn-pj-list');
    wrap.innerHTML = '';
    if (!_pjs.length) {
      wrap.innerHTML = '<div class="mn-empty" style="padding:16px"><span class="ic">📭</span><div>Nenhum personagem cadastrado.</div></div>';
      return;
    }
    // contagem de notas por PJ
    let contagens = {};
    try {
      const { data } = await window.sb.from('master_notes').select('character_id');
      (data || []).forEach(r => { contagens[r.character_id] = (contagens[r.character_id] || 0) + 1; });
    } catch {}

    _pjs.forEach(p => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mn-pj' + (p.id === _pjSelId ? ' ativo' : '');
      const n = contagens[p.id] || 0;
      const sub = [p.classe, p.nivel ? 'N'+p.nivel : '', p.jogadorNome && p.jogadorNome !== '?' ? '· ' + p.jogadorNome : '']
        .filter(Boolean).join(' ');
      b.innerHTML = `
        <span class="mn-pj-info">
          <span class="mn-pj-nome">${escapeHtml(p.nome)}${p.is_active ? ' ★' : ''}</span>
          ${sub ? `<span class="mn-pj-sub">${escapeHtml(sub)}</span>` : ''}
        </span>
        <span class="count">${n}</span>`;
      b.addEventListener('click', () => { selecionarPj(p.id); });
      wrap.appendChild(b);
    });
  }

  function selecionarPj(id) {
    _pjSelId = id;
    cancelarEdicao();
    renderListaPj();
    renderTimeline();
  }

  function filtrarCat(catId) {
    _filtroCat = catId;
    document.querySelectorAll('#mn-cats .mn-cat-pill').forEach(b => {
      b.classList.toggle('ativo', (b.dataset.cat || '') === (catId || ''));
    });
    // Sincroniza o select do formulário: se você está filtrando NPC,
    // a próxima anotação por padrão também é NPC. Só muda se não está editando.
    if (catId && !_editandoId) {
      const sel = document.getElementById('mn-cat');
      if (sel) sel.value = catId;
    }
    renderTimeline();
  }

  let _cacheNotas = [];
  async function renderTimeline() {
    const wrap = document.getElementById('mn-timeline');
    if (!_pjSelId) {
      wrap.innerHTML = '<div class="mn-empty"><span class="ic">👆</span><div>Selecione um jogador na lista ao lado para ver suas anotações.</div></div>';
      return;
    }
    wrap.innerHTML = '<div class="mn-empty"><span class="ic">⏳</span><div>Carregando…</div></div>';
    _cacheNotas = await carregarNotas(_pjSelId);
    let lista = _cacheNotas;
    if (_filtroCat) lista = lista.filter(n => n.categoria === _filtroCat);

    if (!lista.length) {
      wrap.innerHTML = `<div class="mn-empty"><span class="ic">📝</span><div>${_filtroCat ? 'Nenhuma anotação nesta categoria.' : 'Ainda não há anotações para este jogador.'}<br><span style="font-size:12px;opacity:0.7">Use o formulário acima para adicionar a primeira.</span></div></div>`;
      return;
    }
    wrap.innerHTML = '';
    lista.forEach(n => {
      const cat = POR_ID[n.categoria] || POR_ID['outro'];
      const div = document.createElement('div');
      div.className = 'mn-entry';
      div.style.setProperty('--cat-cor', cat.cor);
      const dataFmt = fmtData(n.data_ref);
      div.innerHTML = `
        <div class="mn-entry-head">
          <span class="mn-entry-cat" style="background:${cat.cor}">${cat.icon} ${cat.label}</span>
          <span class="mn-entry-data">📅 ${dataFmt}</span>
          <span class="mn-entry-actions">
            <button type="button" data-act="edit" title="Editar">✎</button>
            <button type="button" data-act="del" title="Apagar">🗑</button>
          </span>
        </div>
        <div class="mn-entry-text"></div>
      `;
      div.querySelector('.mn-entry-text').textContent = n.texto;
      div.querySelector('[data-act="edit"]').addEventListener('click', () => iniciarEdicao(n));
      div.querySelector('[data-act="del"]').addEventListener('click', async () => {
        if (!confirm('Apagar esta anotação?')) return;
        if (await deletarNota(n.id)) renderTimeline().then(renderListaPj);
      });
      wrap.appendChild(div);
    });
  }

  function iniciarEdicao(n) {
    _editandoId = n.id;
    document.getElementById('mn-texto').value = n.texto;
    document.getElementById('mn-cat').value = n.categoria;
    document.getElementById('mn-data').value = n.data_ref || hojeLocal();
    document.getElementById('mn-submit').textContent = 'Salvar edição';
    document.getElementById('mn-cancel').style.display = '';
    document.getElementById('mn-texto').focus();
  }

  function cancelarEdicao() {
    _editandoId = null;
    document.getElementById('mn-texto').value = '';
    document.getElementById('mn-submit').textContent = '+ Adicionar';
    document.getElementById('mn-cancel').style.display = 'none';
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!_pjSelId) { alert('Selecione um jogador.'); return; }
    const texto = document.getElementById('mn-texto').value.trim();
    if (!texto) return;
    const cat   = document.getElementById('mn-cat').value;
    const data  = document.getElementById('mn-data').value || null;

    document.getElementById('mn-submit').disabled = true;
    let ok;
    if (_editandoId) {
      ok = await atualizarNota(_editandoId, cat, texto, data);
    } else {
      ok = !!(await inserirNota(_pjSelId, cat, texto, data));
    }
    document.getElementById('mn-submit').disabled = false;
    if (ok) {
      cancelarEdicao();
      await renderTimeline();
      renderListaPj();
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ===== ABRIR/FECHAR =====
  async function abrir() {
    if (!window.Auth || !window.sb) { alert('Auth/Supabase não carregado.'); return; }
    const ehMestre = await window.Auth.ehMestre();
    if (!ehMestre) { alert('Apenas o Mestre pode acessar as anotações.'); return; }

    montar();
    document.getElementById('mn-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    await carregarPjs();
    if (!_pjSelId && _pjs.length) _pjSelId = _pjs[0].id;
    await renderListaPj();
    await renderTimeline();

    // realtime
    if (!_canalRealtime) {
      const { data: u } = await window.sb.auth.getUser();
      if (u?.user) {
        _canalRealtime = window.sb.channel('mn-' + u.user.id)
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'master_notes',
            filter: `user_id=eq.${u.user.id}`
          }, () => {
            if (document.getElementById('mn-overlay')?.classList.contains('open')) {
              renderTimeline();
              renderListaPj();
            }
          })
          .subscribe();
      }
    }
  }

  function fechar() {
    const ov = document.getElementById('mn-overlay');
    if (ov) ov.classList.remove('open');
    document.body.style.overflow = '';
    cancelarEdicao();
  }

  window.abrirNotasMestre = abrir;
  window.MasterNotes = { abrir, fechar };
})();

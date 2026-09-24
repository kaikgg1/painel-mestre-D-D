// assets/js/master_notes.js
// Modal de anotações do Mestre — timeline (data + categoria + texto) por personagem.
// Persistência: tabela master_notes (Supabase). Só Mestre acessa.
//
// Uso: chamar abrirNotasMestre() de qualquer botão.
//
// Dependências: window.sb, window.Auth.

(function () {
  // Ícones vetoriais (assets/js/icones.js). Degrada pra string vazia se a
  // página não carregou o módulo — nunca sobra emoji de sistema.
  const ico = (chave, opts) => (window.Icones ? window.Icones.html(chave, opts) : '');

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

  // TODAS as categorias possíveis — usadas pra renderização de notas antigas
  // (mesmo que filtradas no formulário do contexto atual).
  // `ico` = chave semântica do mapa de ícones (assets/js/icones.js)
  const CATEGORIAS = [
    { id: 'historia',    label: 'História',    ico: 'pergaminho', cor: '#b88a2c' },
    { id: 'equipamento', label: 'Equipamento', ico: 'ataque',     cor: '#8a8a4a' },
    { id: 'npc',         label: 'NPC',         ico: 'humanoide',  cor: '#6a6a90' },
    { id: 'segredo',     label: 'Segredo',     ico: 'cadeado',    cor: '#8b1a1a' },
    { id: 'decisao',     label: 'Decisão',     ico: 'balanca',    cor: '#4a8a8a' },
    { id: 'loot',        label: 'Loot',        ico: 'moedas',     cor: '#c9a961' },
    { id: 'outro',       label: 'Outro',       ico: 'brilho',     cor: '#8c7d5e' },
  ];
  const POR_ID = Object.fromEntries(CATEGORIAS.map(c => [c.id, c]));

  // Categorias DISPONÍVEIS por contexto (PJ vs Campanha)
  const CATEGORIAS_PJ       = ['historia', 'loot'];
  const CATEGORIAS_CAMPANHA = ['historia', 'npc', 'equipamento'];

  function categoriasAtuais() {
    const ids = _modoCampanha ? CATEGORIAS_CAMPANHA : CATEGORIAS_PJ;
    return ids.map(id => POR_ID[id]).filter(Boolean);
  }

  // Templates: estrutura sugerida ao escolher certas categorias.
  // Só preenche se o textarea estiver totalmente vazio (não atrapalha quem digita).
  // Em markdown: "### " vira cabeçalho de seção no render.
  const TEMPLATES = {
    npc: '### Características\n\n\n### História\n\n\n### Objetivos\n\n',
    equipamento: '### Descrição\n\n\n### Mecânica/efeito\n\n\n### Localização\n\n',
    historia: '',
    loot: '',
    decisao: '',
    segredo: '',
    outro: ''
  };
  function aplicarTemplateCategoria(catId) {
    if (_editandoId) return;  // não bagunça quando está editando
    const tpl = TEMPLATES[catId];
    if (!tpl) return;
    const ta = document.getElementById('mn-texto');
    if (!ta) return;
    if (ta.value.trim() === '') {
      ta.value = tpl;
      // cursor na linha em branco sob o primeiro cabeçalho, pronto pra digitar
      const fimLinha1 = tpl.indexOf('\n');
      const pos = fimLinha1 >= 0 ? fimLinha1 + 1 : tpl.length;
      try { ta.setSelectionRange(pos, pos); ta.focus(); } catch {}
    }
  }

  let _injetado = false;
  let _pjs = [];          // {id, nome}
  let _pjSelId = null;    // id do PJ ativo OU null se modo campanha
  let _modoCampanha = false;
  let _campanha = { chave: 'mestre', titulo: 'Campanha' };
  let _filtroCat = null;  // categoria ativa ou null
  let _canalRealtime = null;
  let _editandoId = null;

  // ===== CSS =====
  const CSS = `
  .mn-overlay {
    /* 8600: acima dos FABs (rolador/log_combate = 8500) e abaixo do
       Confirmar (9000). Mesma camada de iniciativa.js/loot_xp.js. */
    position: fixed; inset: 0; z-index: 8600;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    display: none; align-items: center; justify-content: center; padding: 16px;
  }
  .mn-overlay.open { display: flex; animation: mnFade 0.18s ease-out; }
  /* O modal não depende do reset global da página: com content-box, os campos
     de largura 100% somariam o padding e estourariam a lateral no celular. */
  .mn-overlay, .mn-overlay *, .mn-overlay *::before, .mn-overlay *::after {
    box-sizing: border-box;
  }
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
  /* ===== Card especial — Campanha ===== */
  .mn-pj.mn-campanha {
    background: linear-gradient(160deg, rgba(139,29,29,0.25), rgba(74,8,8,0.15));
    border: 1px solid #8b1d1d;
    border-left: 4px solid #c4302b;
    margin-bottom: 4px;
    position: relative;
  }
  .mn-pj.mn-campanha::before {
    content: '';
    position: absolute; left: 0; right: 0; top: 0; height: 1px;
    background: linear-gradient(to right, transparent, #c4302b, transparent);
    opacity: 0.7;
  }
  .mn-pj.mn-campanha:hover {
    background: linear-gradient(160deg, rgba(139,29,29,0.4), rgba(74,8,8,0.25));
    border-color: #c4302b; transform: translateX(2px);
  }
  .mn-pj.mn-campanha.ativo {
    background: linear-gradient(180deg, #8b1d1d, #5a0e0e);
    color: #d4c5a0; border-color: #c4302b;
    box-shadow: 0 4px 14px rgba(139,29,29,0.35);
  }
  .mn-pj.mn-campanha.ativo .mn-pj-nome { color: #f4b8a8; }
  .mn-pj.mn-campanha .mn-pj-sub { color: #a89878; opacity: 0.85; }
  .mn-pj.mn-campanha.ativo .mn-pj-sub { color: rgba(244,184,168,0.75); }
  .mn-pj.mn-campanha .count {
    background: rgba(139,29,29,0.5);
    color: #f4b8a8;
  }
  .mn-pj.mn-campanha.ativo .count { background: rgba(0,0,0,0.4); color: #f4b8a8; }

  /* Bloco da Campanha (no topo da sidebar, acima do label "Jogadores") */
  .mn-campanha-section {
    padding: 10px 8px 4px;
  }
  .mn-campanha-section:empty { display: none; }
  .mn-pj .count {
    background: rgba(0,0,0,0.5); color: #d4c5a0;
    padding: 2px 9px; border-radius: 10px; font-size: 10px;
    font-weight: 700; flex-shrink: 0; min-width: 24px; text-align: center;
  }
  .mn-pj.ativo .count { background: rgba(0,0,0,0.35); color: #fff; }
  .mn-pj-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .mn-pj-nome {
    font-size: 13px; font-weight: 700; letter-spacing: 0.3px;
    /* nome longo não quebra o card em duas linhas */
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  /* o card da campanha pode usar duas linhas: o título é mais longo */
  .mn-pj.mn-campanha .mn-pj-nome { white-space: normal; }
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

  /* ===== FORM (compositor) =====
     O form tem rolagem própria e a barra de ações fica presa no rodapé: é o
     que garante que o botão de salvar NUNCA seja empurrado fora da tela
     quando o texto cresce (era o bug do layout quebrado). */
  .mn-form {
    background: linear-gradient(180deg, rgba(139,105,20,0.08), rgba(0,0,0,0.22));
    border-bottom: 1px solid rgba(139,105,20,0.2);
    padding: 12px 18px 0;
    display: flex; flex-direction: column; gap: 8px;
    flex: 0 0 auto;
    max-height: 62%;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  /* Nada aqui encolhe: o form rola e a barra de ações fica presa embaixo.
     Sem isso o flex comprimia a área de escrita a duas linhas no celular. */
  .mn-form > * { flex-shrink: 0; }
  .mn-editor {
    position: relative;
    border: 1px solid rgba(139,105,20,0.4);
    border-radius: 6px;
    background: rgba(0,0,0,0.4);
    display: flex; flex-direction: column;
    min-height: 0;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .mn-editor:focus-within {
    border-color: #b88a2c;
    box-shadow: 0 0 0 3px rgba(184,138,44,0.12);
  }

  /* --- barra de ferramentas do markdown --- */
  .mn-toolbar {
    display: flex; align-items: center; gap: 2px; flex-wrap: wrap;
    padding: 5px 6px;
    border-bottom: 1px solid rgba(139,105,20,0.25);
    background: linear-gradient(180deg, rgba(139,105,20,0.12), transparent);
    border-radius: 5px 5px 0 0;
    flex-shrink: 0;
  }
  .mn-tb-btn {
    background: transparent; border: 1px solid transparent;
    color: #a89878; cursor: pointer;
    min-width: 30px; height: 28px; padding: 0 7px;
    border-radius: 4px;
    font-family: 'Cinzel', serif; font-size: 12px; font-weight: 700;
    display: inline-flex; align-items: center; justify-content: center;
    transition: all 0.12s;
  }
  .mn-tb-btn:hover { background: rgba(184,138,44,0.18); color: #f4d878; border-color: rgba(184,138,44,0.35); }
  .mn-tb-btn:active { transform: translateY(1px); }
  .mn-tb-btn.b { font-weight: 900; }
  .mn-tb-btn.i { font-style: italic; }
  .mn-tb-btn.s { text-decoration: line-through; }
  .mn-tb-sep { width: 1px; height: 18px; background: rgba(139,105,20,0.35); margin: 0 4px; flex-shrink: 0; }
  .mn-tb-dir { margin-left: auto; display: flex; align-items: center; gap: 2px; }
  .mn-tb-aba {
    background: transparent; border: 1px solid rgba(139,105,20,0.3);
    color: #a89878; cursor: pointer;
    height: 28px; padding: 0 11px; border-radius: 14px;
    font-family: 'Cinzel', serif; font-size: 10px; font-weight: 700;
    letter-spacing: 0.8px; text-transform: uppercase;
    transition: all 0.12s;
  }
  .mn-tb-aba:hover { border-color: #b88a2c; color: #d4c5a0; }
  .mn-tb-aba.ativo {
    background: linear-gradient(180deg, #b88a2c, #8B6914);
    color: #1a1014; border-color: #d4a843;
  }

  .mn-form textarea {
    width: 100%; min-height: 84px;
    background: transparent;
    border: 0;
    color: #d4c5a0;
    font-family: 'EB Garamond', serif; font-size: 14.5px; line-height: 1.62;
    padding: 11px 13px; border-radius: 0 0 5px 5px; outline: none;
    resize: none; /* auto-grow controla a altura */
    overflow-y: auto;
    max-height: min(34vh, 280px);
    transition: height 0.1s;
  }
  .mn-form textarea::placeholder { color: #6a5a3a; font-style: italic; }

  /* --- prévia renderizada --- */
  .mn-preview {
    padding: 11px 13px;
    min-height: 84px;
    max-height: min(34vh, 280px);
    overflow-y: auto;
    color: #d4c5a0; font-size: 14.5px; line-height: 1.62;
    font-family: 'EB Garamond', serif;
  }
  .mn-preview:empty::before {
    content: 'Nada para prever ainda.';
    color: #6a5a3a; font-style: italic;
  }
  .mn-titulo-input {
    width: 100%;
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(139,105,20,0.4);
    border-left: 3px solid #b88a2c;
    color: #d4a843;
    font-family: 'Cinzel', serif;
    font-size: 16px; font-weight: 700; letter-spacing: 0.5px;
    padding: 10px 14px; border-radius: 5px; outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .mn-titulo-input::placeholder {
    color: #6a5a3a; font-style: italic; font-weight: 400; letter-spacing: 0.3px;
  }
  .mn-titulo-input:focus {
    border-color: #b88a2c;
    border-left-color: #d4a843;
    box-shadow: 0 0 0 3px rgba(184,138,44,0.12);
  }
  /* ===== BARRA DE AÇÕES — sempre visível ===== */
  .mn-form-acoes {
    position: sticky; bottom: 0; z-index: 2;
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    padding: 11px 0 12px;
    /* fundo 100% opaco: o texto que rola por baixo não pode aparecer */
    background: #1e1517;
    border-top: 1px solid rgba(139,105,20,0.28);
    box-shadow: 0 -12px 18px -10px rgba(0,0,0,0.8);
  }
  .mn-form-acoes .mn-flex { flex: 1 1 auto; min-width: 0; }

  .mn-form select {
    background-color: rgba(0,0,0,0.4);
    border: 1px solid rgba(139,105,20,0.4);
    color: #d4c5a0;
    font-family: 'Cinzel', serif; font-size: 12px; font-weight: 600;
    letter-spacing: 0.5px;
    padding: 9px 12px; border-radius: 6px; outline: none;
    min-height: 42px; max-width: 190px;
    transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
  }
  /* O caret dourado e o padding-right vêm de assets/css/ui.css */
  .mn-form select:hover { border-color: #b88a2c; background-color: rgba(0,0,0,0.55); }
  .mn-form select:focus, .mn-form select:focus-visible {
    border-color: #d4a843;
    box-shadow: 0 0 0 3px rgba(184,138,44,0.18);
  }

  /* ===== SELETOR DE DATA (calendário próprio, no tema) =====
     O <input type="date"> abria o calendário claro do navegador, que destoava
     do painel. Aqui o valor fica num input escondido e a UI é nossa. */
  .mn-data-btn {
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(139,105,20,0.4);
    color: #d4c5a0; cursor: pointer;
    font-family: 'Cinzel', serif; font-size: 12px; font-weight: 600;
    letter-spacing: 0.5px;
    padding: 9px 13px; border-radius: 6px;
    min-height: 42px;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.15s;
  }
  .mn-data-btn:hover { border-color: #b88a2c; background: rgba(0,0,0,0.55); color: #f4d878; }
  .mn-data-btn[aria-expanded="true"] {
    border-color: #d4a843;
    box-shadow: 0 0 0 3px rgba(184,138,44,0.18);
  }
  .mn-data-btn iconify-icon { color: #b88a2c; font-size: 15px; }
  .mn-data-rel {
    font-size: 9px; letter-spacing: 1px; text-transform: uppercase;
    color: #b88a2c; font-weight: 700;
    border-left: 1px solid rgba(139,105,20,0.4); padding-left: 8px;
  }

  /* popover: position:fixed pra não ser cortado pela rolagem do form */
  .mn-cal {
    position: fixed; z-index: 8700;
    width: 264px; padding: 10px;
    background: linear-gradient(160deg, #241619 0%, #180d11 100%);
    border: 1px solid #8B6914; border-radius: 8px;
    box-shadow: 0 18px 44px rgba(0,0,0,0.85), 0 0 0 1px rgba(139,29,29,0.5) inset;
    font-family: 'Cinzel', serif;
    animation: mnFade 0.12s ease-out;
  }
  .mn-cal-head {
    display: flex; align-items: center; gap: 6px;
    margin-bottom: 8px;
  }
  .mn-cal-mes {
    flex: 1; text-align: center;
    font-size: 12px; font-weight: 700; color: #d4a843;
    letter-spacing: 0.8px; text-transform: capitalize;
  }
  .mn-cal-nav {
    background: transparent; border: 1px solid rgba(139,105,20,0.35);
    color: #b88a2c; cursor: pointer;
    width: 28px; height: 28px; border-radius: 4px;
    font-size: 13px; line-height: 1;
    display: inline-flex; align-items: center; justify-content: center;
    transition: all 0.12s;
  }
  .mn-cal-nav:hover { background: rgba(184,138,44,0.2); color: #f4d878; border-color: #b88a2c; }
  .mn-cal-grade { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
  .mn-cal-dow {
    text-align: center; font-size: 9px; font-weight: 700;
    color: #8c7d5e; letter-spacing: 0.5px; padding: 4px 0 6px;
  }
  .mn-cal-dia {
    background: transparent; border: 1px solid transparent;
    color: #d4c5a0; cursor: pointer;
    height: 30px; border-radius: 4px;
    font-family: 'EB Garamond', serif; font-size: 14px;
    transition: all 0.1s;
  }
  .mn-cal-dia:hover { background: rgba(184,138,44,0.22); border-color: rgba(184,138,44,0.5); }
  .mn-cal-dia.fora { color: #5a4a38; }
  .mn-cal-dia.hoje { border-color: #8b1d1d; color: #f4b8a8; font-weight: 700; }
  .mn-cal-dia.sel {
    background: linear-gradient(180deg, #b88a2c, #8B6914);
    border-color: #d4a843; color: #1a1014; font-weight: 700;
  }
  .mn-cal-pe {
    display: flex; gap: 6px; margin-top: 9px; padding-top: 9px;
    border-top: 1px solid rgba(139,105,20,0.25);
  }
  .mn-cal-atalho {
    flex: 1;
    background: rgba(139,105,20,0.1); border: 1px solid rgba(139,105,20,0.3);
    color: #d4c5a0; cursor: pointer;
    padding: 6px 4px; border-radius: 4px;
    font-family: 'Cinzel', serif; font-size: 9.5px; font-weight: 700;
    letter-spacing: 0.6px; text-transform: uppercase;
    transition: all 0.12s;
  }
  .mn-cal-atalho:hover { background: rgba(184,138,44,0.28); color: #f4d878; border-color: #b88a2c; }

  /* ===== Ícones vetoriais ===== */
  .mn-title iconify-icon { color: #d4a843; font-size: 22px; }
  .mn-cat-pill iconify-icon,
  .mn-entry-cat iconify-icon,
  .mn-entry-data iconify-icon,
  .mn-pj-nome iconify-icon { vertical-align: -2px; }
  .mn-entry-cat iconify-icon { font-size: 12px; }
  .mn-entry-actions iconify-icon { font-size: 15px; vertical-align: -2px; }
  .mn-empty .ic iconify-icon { font-size: 38px; }
  .mn-form .mn-add-btn {
    background: linear-gradient(180deg, #b88a2c, #6a4f0e);
    border: 1px solid #d4a843; color: #1a1014;
    font-family: 'Cinzel', serif; font-size: 12px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase;
    padding: 8px 18px; border-radius: 5px; cursor: pointer;
    min-height: 42px; min-width: 132px;
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
    border-radius: 5px; cursor: pointer; min-height: 42px;
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
  .mn-entry-titulo {
    font-family: 'Cinzel Decorative', serif;
    color: #d4a843;
    font-size: 17px; font-weight: 700; line-height: 1.25;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
    text-shadow: 0 0 14px rgba(212,168,67,0.18);
    word-wrap: break-word;
  }
  .mn-entry-text {
    color: #d4c5a0; font-size: 14.5px; line-height: 1.68;
    word-wrap: break-word; overflow-wrap: break-word;
    max-width: 74ch;  /* limite de largura pra leitura confortável */
  }

  /* ===== MARKDOWN RENDERIZADO (anotação e prévia) ===== */
  .mn-md > :first-child { margin-top: 0 !important; }
  .mn-md > :last-child { margin-bottom: 0 !important; }
  .mn-md .md-p { margin: 0 0 10px; }
  .mn-md .md-h {
    font-family: 'Cinzel', serif;
    color: #d4a843; font-weight: 700;
    line-height: 1.3; letter-spacing: 0.5px;
    margin: 18px 0 8px;
  }
  .mn-md .md-h1 {
    font-family: 'Cinzel Decorative', serif;
    font-size: 19px;
    padding-bottom: 5px;
    border-bottom: 1px solid rgba(212,168,67,0.32);
  }
  .mn-md .md-h2 {
    font-size: 16px;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(212,168,67,0.18);
  }
  .mn-md .md-h3 { font-size: 14.5px; }
  .mn-md .md-h4, .mn-md .md-h5, .mn-md .md-h6 {
    font-size: 12.5px; text-transform: uppercase; letter-spacing: 1px;
    color: #c09a4a;
  }
  /* Cabeçalho de seção legado (linhas que terminam em ":") */
  .mn-md .md-secao {
    font-family: 'Cinzel', serif;
    color: #d4a843;
    font-size: 12px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase;
    margin: 15px 0 6px;
    padding-bottom: 3px;
    border-bottom: 1px solid rgba(212,168,67,0.2);
  }
  .mn-md strong { color: #eddaa8; font-weight: 700; }
  .mn-md em { color: #cbbf9c; }
  .mn-md del { color: #8c7d5e; }
  .mn-md .md-link {
    color: #d4a843; text-decoration: none;
    border-bottom: 1px dotted rgba(212,168,67,0.6);
  }
  .mn-md .md-link:hover { color: #f4d878; border-bottom-style: solid; }
  .mn-md .md-ul, .mn-md .md-ol { margin: 0 0 10px; padding-left: 22px; }
  .mn-md .md-ul { list-style: none; }
  .mn-md .md-ul > li { position: relative; }
  .mn-md .md-ul > li::before {
    content: '';
    position: absolute; left: -14px; top: 0.62em;
    width: 5px; height: 5px; border-radius: 50%;
    background: #b88a2c;
  }
  .mn-md .md-ul .md-ul > li::before {
    background: transparent;
    border: 1px solid #8c7d5e;
    width: 4px; height: 4px;
  }
  .mn-md li { margin: 0 0 4px; }
  .mn-md .md-ul .md-ul, .mn-md .md-ol .md-ol,
  .mn-md .md-ul .md-ol, .mn-md .md-ol .md-ul { margin: 4px 0 2px; }
  .mn-md .md-ol { list-style: decimal; }
  .mn-md .md-ol > li::marker { color: #b88a2c; font-family: 'Cinzel', serif; font-size: 0.9em; }
  /* checklists */
  .mn-md li.md-tarefa { list-style: none; display: flex; gap: 8px; align-items: flex-start; }
  .mn-md li.md-tarefa::before { display: none; }
  .mn-md .md-caixa {
    flex-shrink: 0; margin-top: 0.22em;
    width: 15px; height: 15px; border-radius: 3px;
    border: 1px solid rgba(184,138,44,0.6);
    background: rgba(0,0,0,0.35);
    color: #d4a843; font-size: 11px; line-height: 13px; text-align: center;
  }
  .mn-md li.md-tarefa.feita { color: #8c7d5e; text-decoration: line-through; }
  .mn-md li.md-tarefa.feita .md-caixa { background: rgba(184,138,44,0.25); }
  /* citação */
  .mn-md .md-quote {
    margin: 0 0 10px; padding: 8px 14px;
    border-left: 3px solid #8b1d1d;
    background: linear-gradient(90deg, rgba(139,29,29,0.16), transparent 80%);
    color: #e2cfae; font-style: italic;
    border-radius: 0 4px 4px 0;
  }
  .mn-md .md-quote .md-p:last-child { margin-bottom: 0; }
  /* código */
  .mn-md .md-code {
    font-family: 'Consolas', 'SF Mono', monospace; font-size: 0.86em;
    background: rgba(0,0,0,0.45); color: #e8c97a;
    border: 1px solid rgba(139,105,20,0.3);
    padding: 1px 5px; border-radius: 3px;
    font-style: normal;
  }
  .mn-md .md-pre {
    margin: 0 0 10px; padding: 10px 12px;
    background: rgba(0,0,0,0.5);
    border: 1px solid rgba(139,105,20,0.3);
    border-left: 3px solid #8B6914;
    border-radius: 0 5px 5px 0;
    overflow-x: auto;
  }
  .mn-md .md-pre code {
    font-family: 'Consolas', 'SF Mono', monospace;
    font-size: 12.5px; line-height: 1.5; color: #cbbf9c;
    white-space: pre;
  }
  .mn-md .md-hr {
    border: 0; height: 1px; margin: 16px 0;
    background: linear-gradient(to right, transparent, rgba(184,138,44,0.55), transparent);
  }
  /* tabela */
  .mn-md .md-tabela-wrap { overflow-x: auto; margin: 0 0 12px; }
  .mn-md .md-tabela {
    border-collapse: collapse; width: 100%; font-size: 13px;
    border: 1px solid rgba(139,105,20,0.3);
  }
  .mn-md .md-tabela th {
    font-family: 'Cinzel', serif; font-size: 10.5px;
    text-transform: uppercase; letter-spacing: 0.8px;
    color: #d4a843; font-weight: 700;
    background: rgba(139,105,20,0.18);
    padding: 7px 10px; text-align: left;
    border-bottom: 1px solid rgba(184,138,44,0.4);
    white-space: nowrap;
  }
  .mn-md .md-tabela td {
    padding: 6px 10px;
    border-bottom: 1px solid rgba(139,105,20,0.14);
  }
  .mn-md .md-tabela tr:last-child td { border-bottom: 0; }
  .mn-md .md-tabela tbody tr:nth-child(even) { background: rgba(0,0,0,0.18); }
  .mn-md .md-img {
    max-width: 100%; height: auto; border-radius: 5px;
    border: 1px solid rgba(139,105,20,0.35);
    margin: 4px 0;
  }

  /* Colapso de entradas longas */
  .mn-entry.mn-colapsavel { position: relative; }
  .mn-entry.mn-colapsavel.colapsado .mn-entry-text {
    max-height: 200px;
    overflow: hidden;
    -webkit-mask-image: linear-gradient(to bottom, #000 70%, transparent 100%);
            mask-image: linear-gradient(to bottom, #000 70%, transparent 100%);
  }
  .mn-ver-mais {
    background: linear-gradient(180deg, rgba(139,105,20,0.25), rgba(0,0,0,0.4));
    border: 1px solid rgba(184,138,44,0.35);
    color: #d4a843;
    font-family: 'Cinzel', serif;
    font-size: 11px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase;
    padding: 6px 14px; margin-top: 10px;
    border-radius: 14px;
    cursor: pointer;
    width: 100%;
    transition: all 0.15s;
  }
  .mn-ver-mais:hover {
    background: linear-gradient(180deg, rgba(184,138,44,0.4), rgba(139,105,20,0.2));
    border-color: #d4a843; color: #f4d878;
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
  /* Tela baixa: o editor encolhe pra barra de ações e a timeline continuarem
     visíveis. Era aqui que o botão de salvar sumia. */
  @media (max-height: 780px) {
    .mn-form { max-height: 58%; }
    .mn-form textarea, .mn-preview { max-height: 26vh; }
  }
  @media (max-height: 620px) {
    .mn-form { max-height: 62%; }
    .mn-form textarea, .mn-preview { max-height: 22vh; min-height: 64px; }
    .mn-header { padding: 10px 18px 9px; }
    .mn-title { font-size: 16px; }
  }

  /* Sem espaço pra duas colunas: a lista vira uma faixa horizontal no topo,
     que gasta muito menos altura do que a sidebar empilhada. */
  @media (max-width: 880px) {
    .mn-body { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
    .mn-sidebar {
      border-right: none;
      border-bottom: 1px solid rgba(139,105,20,0.25);
      flex-direction: column;
    }
    .mn-sidebar-label { display: none; }
    .mn-campanha-section { padding: 8px 12px 0; }
    .mn-pj-list-wrap {
      flex-direction: row; gap: 6px;
      overflow-x: auto; overflow-y: hidden;
      padding: 8px 12px;
      scrollbar-width: thin;
    }
    .mn-pj { flex: 0 0 auto; min-width: 168px; min-height: 50px; }
    .mn-pj:hover, .mn-pj.mn-campanha:hover { transform: none; }
    .mn-campanha-section .mn-pj { width: 100%; }
    .mn-entry-text { max-width: none; }
  }

  @media (max-width: 600px) {
    .mn-overlay { padding: 0; }
    .mn-modal {
      max-width: 100%; max-height: 100vh; max-height: 100dvh;
      height: 100%; border-radius: 0; border-left: none; border-right: none;
    }
    .mn-header { padding: 11px 14px 10px; gap: 10px; }
    .mn-title { font-size: 15px; letter-spacing: 0.6px; }
    .mn-close { padding: 8px 11px; font-size: 10px; }
    .mn-cats { padding: 9px 12px 8px; gap: 4px; }
    .mn-cat-pill { padding: 6px 10px; font-size: 10px; min-height: 32px; }
    .mn-form { padding: 10px 12px 0; max-height: 64%; }
    /* No celular o rótulo dos botões de marcação some e fica só o símbolo */
    .mn-tb-btn { min-width: 34px; height: 32px; }
    .mn-tb-sep { margin: 0 2px; }
    /* Escrever/Prever em linha própria: no celular a barra quebraria de
       qualquer jeito, e assim a quebra fica intencional em vez de torta. */
    .mn-tb-dir {
      flex: 1 1 100%; margin-left: 0; justify-content: flex-end;
      padding-top: 4px; margin-top: 3px;
      border-top: 1px solid rgba(139,105,20,0.18);
    }
    .mn-tb-aba { padding: 0 12px; height: 30px; font-size: 9px; }
    .mn-form textarea, .mn-preview { font-size: 15.5px; max-height: 30vh; }
    .mn-titulo-input { font-size: 15px; padding: 10px 12px; }
    /* select/data/salvar em blocos de largura cheia — nada mais é cortado */
    .mn-form-acoes { gap: 6px; padding: 9px 0 11px; }
    .mn-form select { flex: 1 1 100%; max-width: none; min-height: 46px; font-size: 13px; }
    .mn-data-btn { flex: 1 1 100%; justify-content: center; min-height: 46px; }
    .mn-form-acoes .mn-flex { display: none; }
    .mn-form .mn-add-btn { flex: 1 1 100%; min-height: 48px; }
    .mn-form .mn-cancel-btn { flex: 1 1 100%; min-height: 44px; }
    .mn-cal { width: calc(100vw - 24px); max-width: 300px; }
    .mn-cal-dia { height: 36px; font-size: 15px; }
    .mn-entry-titulo { font-size: 15px; }
    .mn-timeline-wrap { padding: 12px 12px 20px; }
    .mn-entry { padding: 10px 12px; }
    .mn-entry:hover { transform: none; }
    .mn-entry-text { font-size: 14px; }
    .mn-md .md-h1 { font-size: 17px; }
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
          <div class="mn-title" id="mn-title">${ico('notas')} Anotações do Mestre</div>
          <button type="button" class="mn-close" id="mn-close-btn" aria-label="Fechar anotações">Fechar ✕</button>
        </div>
        <div class="mn-body">
          <aside class="mn-sidebar">
            <div class="mn-campanha-section" id="mn-campanha-section"></div>
            <div class="mn-sidebar-label">Jogadores</div>
            <div class="mn-pj-list-wrap" id="mn-pj-list"></div>
          </aside>
          <section class="mn-main">
            <div class="mn-cats" id="mn-cats" role="toolbar" aria-label="Filtrar e definir categoria"></div>
            <form class="mn-form" id="mn-form" autocomplete="off" novalidate>
              <input type="text" id="mn-titulo" class="mn-titulo-input" placeholder="Título  (ex.: Fiona Watcher, Bola de Fogo, Sessão 5…)" maxlength="120">
              <div class="mn-editor">
                <div class="mn-toolbar" id="mn-toolbar" role="toolbar" aria-label="Formatação (markdown)">
                  <button type="button" class="mn-tb-btn b" data-md="negrito"   title="Negrito (Ctrl+B)"        aria-label="Negrito">B</button>
                  <button type="button" class="mn-tb-btn i" data-md="italico"   title="Itálico (Ctrl+I)"        aria-label="Itálico">I</button>
                  <button type="button" class="mn-tb-btn s" data-md="riscado"   title="Riscado"                 aria-label="Riscado">S</button>
                  <span class="mn-tb-sep"></span>
                  <button type="button" class="mn-tb-btn" data-md="titulo"      title="Título de seção"         aria-label="Título">H</button>
                  <button type="button" class="mn-tb-btn" data-md="lista"       title="Lista"                   aria-label="Lista">•</button>
                  <button type="button" class="mn-tb-btn" data-md="numerada"    title="Lista numerada"          aria-label="Lista numerada">1.</button>
                  <button type="button" class="mn-tb-btn" data-md="tarefa"      title="Checklist"               aria-label="Checklist">✓</button>
                  <span class="mn-tb-sep"></span>
                  <button type="button" class="mn-tb-btn" data-md="citacao"     title="Citação (fala de NPC)"   aria-label="Citação">❝</button>
                  <button type="button" class="mn-tb-btn" data-md="link"        title="Link (Ctrl+K)"           aria-label="Link">URL</button>
                  <button type="button" class="mn-tb-btn" data-md="tabela"      title="Tabela"                  aria-label="Tabela">▦</button>
                  <button type="button" class="mn-tb-btn" data-md="divisor"     title="Divisor"                 aria-label="Divisor">—</button>
                  <span class="mn-tb-dir">
                    <button type="button" class="mn-tb-aba ativo" id="mn-aba-escrever">Escrever</button>
                    <button type="button" class="mn-tb-aba" id="mn-aba-prever">Prever</button>
                  </span>
                </div>
                <textarea id="mn-texto" placeholder="Escreva a anotação…  aceita markdown: **negrito**, # título, - lista, > citação  (Ctrl+Enter salva)" required></textarea>
                <div class="mn-preview mn-md" id="mn-preview" hidden aria-live="polite"></div>
              </div>
              <div class="mn-form-acoes">
                <select id="mn-cat" aria-label="Categoria"></select>
                <button type="button" class="mn-data-btn" id="mn-data-btn" aria-haspopup="dialog" aria-expanded="false">
                  ${ico('calendario')}<span id="mn-data-txt">—</span>
                </button>
                <input type="hidden" id="mn-data">
                <span class="mn-flex"></span>
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
    const taEl = document.getElementById('mn-texto');
    taEl.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); onSubmit(e); return; }
      // Atalhos de marcação
      if (e.ctrlKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'b') { e.preventDefault(); aplicarMarcacao('negrito'); return; }
        if (k === 'i') { e.preventDefault(); aplicarMarcacao('italico'); return; }
        if (k === 'k') { e.preventDefault(); aplicarMarcacao('link');   return; }
      }
      // Enter dentro de uma lista continua a lista (como num editor de verdade)
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) continuarLista(e, taEl);
    });
    // Auto-grow: cresce com o conteúdo (até o teto do CSS)
    taEl.addEventListener('input', () => autoGrowTextarea(taEl));

    // Barra de marcação
    document.getElementById('mn-toolbar').addEventListener('click', e => {
      const b = e.target.closest('[data-md]');
      if (b) aplicarMarcacao(b.dataset.md);
    });
    document.getElementById('mn-aba-escrever').addEventListener('click', () => verPrevia(false));
    document.getElementById('mn-aba-prever').addEventListener('click', () => verPrevia(true));

    // Templates por categoria — preenche o textarea quando o usuário muda
    // pra essa categoria E o campo está vazio (sem sobrescrever conteúdo).
    document.getElementById('mn-cat').addEventListener('change', e => {
      aplicarTemplateCategoria(e.target.value);
      autoGrowTextarea(taEl);
    });

    // Seletor de data próprio (o nativo abria o calendário claro do navegador)
    document.getElementById('mn-data-btn').addEventListener('click', alternarCalendario);

    rebuildCategorias();

    document.addEventListener('keydown', escListener);
    setData(hojeLocal());
  }

  // ===== MARCAÇÃO (markdown) =====
  // Envolve a seleção, ou insere um exemplo se nada estiver selecionado.
  function envolver(ta, antes, depois, exemplo) {
    const ini = ta.selectionStart;
    const fim = ta.selectionEnd;
    const sel = ta.value.slice(ini, fim) || exemplo || '';
    ta.value = ta.value.slice(0, ini) + antes + sel + depois + ta.value.slice(fim);
    ta.focus();
    ta.setSelectionRange(ini + antes.length, ini + antes.length + sel.length);
  }

  // Aplica um prefixo em cada linha selecionada (títulos, listas, citação).
  // Clicar de novo no mesmo botão remove o prefixo (alterna).
  function prefixarLinhas(ta, prefixo, numerada) {
    const v = ta.value;
    let ini = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    let fim = v.indexOf('\n', ta.selectionEnd);
    if (fim === -1) fim = v.length;
    const linhas = v.slice(ini, fim).split('\n');
    const re = numerada ? /^\d+[.)]\s+/ : new RegExp('^' + prefixo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const remover = linhas.every(l => !l.trim() || re.test(l));
    const novas = linhas.map((l, k) => {
      if (remover) return l.replace(re, '');
      if (!l.trim() && linhas.length > 1) return l;
      return (numerada ? (k + 1) + '. ' : prefixo) + l;
    });
    const texto = novas.join('\n');
    ta.value = v.slice(0, ini) + texto + v.slice(fim);
    ta.focus();
    ta.setSelectionRange(ini, ini + texto.length);
  }

  function aplicarMarcacao(tipo) {
    const ta = document.getElementById('mn-texto');
    if (!ta) return;
    if (_previewAberta) verPrevia(false);   // não dá pra marcar olhando a prévia
    switch (tipo) {
      case 'negrito':  envolver(ta, '**', '**', 'negrito'); break;
      case 'italico':  envolver(ta, '*', '*', 'itálico'); break;
      case 'riscado':  envolver(ta, '~~', '~~', 'riscado'); break;
      case 'titulo':   prefixarLinhas(ta, '## '); break;
      case 'lista':    prefixarLinhas(ta, '- '); break;
      case 'numerada': prefixarLinhas(ta, '1. ', true); break;
      case 'tarefa':   prefixarLinhas(ta, '- [ ] '); break;
      case 'citacao':  prefixarLinhas(ta, '> '); break;
      case 'link':     envolver(ta, '[', '](https://)', 'texto do link'); break;
      case 'divisor':  inserirBloco(ta, '\n---\n'); break;
      case 'tabela':
        inserirBloco(ta, '\n| Item | Valor |\n| --- | --- |\n|  |  |\n');
        break;
    }
    autoGrowTextarea(ta);
  }

  // Insere um bloco em linha própria, sem colar na frase anterior.
  function inserirBloco(ta, bloco) {
    const ini = ta.selectionStart;
    const antes = ta.value.slice(0, ini);
    const pad = antes && !antes.endsWith('\n') ? '\n' : '';
    ta.value = antes + pad + bloco + ta.value.slice(ta.selectionEnd);
    const pos = ini + pad.length + bloco.length;
    ta.focus();
    ta.setSelectionRange(pos, pos);
  }

  // Enter numa linha de lista já abre o próximo item. Enter num item vazio
  // encerra a lista (comportamento padrão de editor de markdown).
  function continuarLista(e, ta) {
    const ini = ta.selectionStart;
    if (ini !== ta.selectionEnd) return;
    const inicioLinha = ta.value.lastIndexOf('\n', ini - 1) + 1;
    const linha = ta.value.slice(inicioLinha, ini);
    const m = linha.match(/^(\s*)(?:([-*+])\s(\[[ xX]\]\s)?|(\d{1,9})([.)])\s)/);
    if (!m) return;
    const resto = linha.slice(m[0].length);
    e.preventDefault();
    if (!resto.trim()) {
      // item vazio: apaga a marcação e sai da lista
      ta.value = ta.value.slice(0, inicioLinha) + ta.value.slice(ini);
      ta.setSelectionRange(inicioLinha, inicioLinha);
      autoGrowTextarea(ta);
      return;
    }
    const proximo = m[2]
      ? m[1] + m[2] + ' ' + (m[3] ? '[ ] ' : '')
      : m[1] + (parseInt(m[4], 10) + 1) + m[5] + ' ';
    ta.value = ta.value.slice(0, ini) + '\n' + proximo + ta.value.slice(ini);
    const pos = ini + 1 + proximo.length;
    ta.setSelectionRange(pos, pos);
    autoGrowTextarea(ta);
  }

  let _previewAberta = false;
  function verPrevia(mostrar) {
    const ta   = document.getElementById('mn-texto');
    const prev = document.getElementById('mn-preview');
    if (!ta || !prev) return;
    _previewAberta = !!mostrar;
    ta.hidden = _previewAberta;
    prev.hidden = !_previewAberta;
    document.getElementById('mn-aba-escrever').classList.toggle('ativo', !_previewAberta);
    document.getElementById('mn-aba-prever').classList.toggle('ativo', _previewAberta);
    if (_previewAberta) prev.innerHTML = renderTexto(ta.value);
    else { ta.focus(); autoGrowTextarea(ta); }
  }

  // ===== SELETOR DE DATA =====
  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho',
                 'agosto','setembro','outubro','novembro','dezembro'];
  const DOW = ['D','S','T','Q','Q','S','S'];
  let _calEl = null;
  let _calMes = null;   // {ano, mes}

  function getData() {
    return document.getElementById('mn-data')?.value || '';
  }

  // Grava o valor e atualiza o rótulo do botão (com "hoje"/"ontem" quando cabe)
  function setData(ymd) {
    const hid = document.getElementById('mn-data');
    const txt = document.getElementById('mn-data-txt');
    if (!hid || !txt) return;
    hid.value = ymd || '';
    if (!ymd) { txt.textContent = 'Sem data'; return; }
    const hoje = hojeLocal();
    const rel = ymd === hoje ? 'hoje' : ymd === diasAtras(1) ? 'ontem' : '';
    txt.innerHTML = escapeHtml(fmtData(ymd)) +
      (rel ? `<span class="mn-data-rel">${rel}</span>` : '');
  }

  function diasAtras(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function alternarCalendario() {
    if (_calEl) { fecharCalendario(); return; }
    const atual = getData() || hojeLocal();
    const [a, m] = atual.split('-').map(Number);
    _calMes = { ano: a, mes: m - 1 };

    _calEl = document.createElement('div');
    _calEl.className = 'mn-cal';
    _calEl.setAttribute('role', 'dialog');
    _calEl.setAttribute('aria-label', 'Escolher data');
    document.getElementById('mn-overlay').appendChild(_calEl);
    _calEl.addEventListener('click', e => e.stopPropagation());
    document.getElementById('mn-data-btn').setAttribute('aria-expanded', 'true');
    renderCalendario();
    posicionarCalendario();
    setTimeout(() => document.addEventListener('click', cliqueForaCal), 0);
    window.addEventListener('resize', posicionarCalendario);
    document.querySelector('.mn-form')?.addEventListener('scroll', fecharCalendario);
  }

  function cliqueForaCal(e) {
    if (_calEl && !_calEl.contains(e.target) && !e.target.closest('#mn-data-btn')) fecharCalendario();
  }

  function fecharCalendario() {
    if (!_calEl) return;
    _calEl.remove();
    _calEl = null;
    document.getElementById('mn-data-btn')?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', cliqueForaCal);
    window.removeEventListener('resize', posicionarCalendario);
    document.querySelector('.mn-form')?.removeEventListener('scroll', fecharCalendario);
  }

  // Abre pra cima ou pra baixo, dependendo do espaço que sobra na tela.
  function posicionarCalendario() {
    const btn = document.getElementById('mn-data-btn');
    if (!btn || !_calEl) return;
    const r = btn.getBoundingClientRect();
    const alt = _calEl.offsetHeight;
    const larg = _calEl.offsetWidth;
    const top = r.top - alt - 6 >= 8 ? r.top - alt - 6 : Math.min(r.bottom + 6, window.innerHeight - alt - 8);
    _calEl.style.top = Math.max(8, top) + 'px';
    _calEl.style.left = Math.max(8, Math.min(r.left, window.innerWidth - larg - 8)) + 'px';
  }

  function renderCalendario() {
    if (!_calEl) return;
    const { ano, mes } = _calMes;
    const sel = getData();
    const hoje = hojeLocal();
    const primeiro = new Date(ano, mes, 1);
    const inicio = primeiro.getDay();                   // 0 = domingo
    const noMes = new Date(ano, mes + 1, 0).getDate();
    const noAnterior = new Date(ano, mes, 0).getDate();

    let dias = '';
    for (let k = 0; k < 42; k++) {
      const n = k - inicio + 1;
      let ymd, rotulo, fora = false;
      if (n < 1)            { ymd = ptData(ano, mes - 1, noAnterior + n); rotulo = noAnterior + n; fora = true; }
      else if (n > noMes)   { ymd = ptData(ano, mes + 1, n - noMes);      rotulo = n - noMes;      fora = true; }
      else                  { ymd = ptData(ano, mes, n);                  rotulo = n; }
      if (k >= 35 && fora) continue;   // não desenha uma 6ª linha só de sobras
      const cls = ['mn-cal-dia'];
      if (fora) cls.push('fora');
      if (ymd === hoje) cls.push('hoje');
      if (ymd === sel) cls.push('sel');
      dias += `<button type="button" class="${cls.join(' ')}" data-ymd="${ymd}"${ymd === sel ? ' aria-current="date"' : ''}>${rotulo}</button>`;
    }

    _calEl.innerHTML = `
      <div class="mn-cal-head">
        <button type="button" class="mn-cal-nav" data-nav="-1" aria-label="Mês anterior">‹</button>
        <div class="mn-cal-mes">${MESES[mes]} ${ano}</div>
        <button type="button" class="mn-cal-nav" data-nav="1" aria-label="Mês seguinte">›</button>
      </div>
      <div class="mn-cal-grade">
        ${DOW.map(d => `<div class="mn-cal-dow">${d}</div>`).join('')}
        ${dias}
      </div>
      <div class="mn-cal-pe">
        <button type="button" class="mn-cal-atalho" data-atalho="hoje">Hoje</button>
        <button type="button" class="mn-cal-atalho" data-atalho="ontem">Ontem</button>
        <button type="button" class="mn-cal-atalho" data-atalho="7">−7 dias</button>
      </div>`;

    _calEl.querySelectorAll('[data-nav]').forEach(b => {
      b.addEventListener('click', () => {
        const d = new Date(_calMes.ano, _calMes.mes + Number(b.dataset.nav), 1);
        _calMes = { ano: d.getFullYear(), mes: d.getMonth() };
        renderCalendario();
        posicionarCalendario();
      });
    });
    _calEl.querySelectorAll('[data-ymd]').forEach(b => {
      b.addEventListener('click', () => { setData(b.dataset.ymd); fecharCalendario(); });
    });
    _calEl.querySelectorAll('[data-atalho]').forEach(b => {
      b.addEventListener('click', () => {
        const a = b.dataset.atalho;
        setData(a === 'hoje' ? hojeLocal() : a === 'ontem' ? diasAtras(1) : diasAtras(7));
        fecharCalendario();
      });
    });
  }

  // Monta YYYY-MM-DD normalizando mês fora da faixa (-1 / 12)
  function ptData(ano, mes, dia) {
    const d = new Date(ano, mes, dia);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Reconstrói o select e as pills de categoria baseado no contexto atual
  // (PJ = História + Loot; Campanha = História + NPC + Equipamento).
  function rebuildCategorias() {
    const cats = categoriasAtuais();
    // Select
    const sel = document.getElementById('mn-cat');
    if (sel) {
      const valorAtual = sel.value;
      sel.innerHTML = '';
      cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.label;
        sel.appendChild(opt);
      });
      // Se o valor que tava selecionado ainda existe na nova lista, mantém
      if (cats.some(c => c.id === valorAtual)) sel.value = valorAtual;
      else if (cats.length) sel.value = cats[0].id;
    }
    // Pills
    const wrap = document.getElementById('mn-cats');
    if (wrap) {
      wrap.innerHTML = '';
      const todasBtn = document.createElement('button');
      todasBtn.type = 'button';
      todasBtn.className = 'mn-cat-pill' + (_filtroCat ? '' : ' ativo');
      todasBtn.textContent = 'Todas';
      todasBtn.dataset.cat = '';
      todasBtn.style.setProperty('--cat-cor', '#8B6914');
      todasBtn.addEventListener('click', () => filtrarCat(null));
      wrap.appendChild(todasBtn);
      cats.forEach(c => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mn-cat-pill' + (_filtroCat === c.id ? ' ativo' : '');
        b.innerHTML = ico(c.ico) + ' ' + escapeHtml(c.label);
        b.dataset.cat = c.id;
        b.style.setProperty('--cat-cor', c.cor);
        b.addEventListener('click', () => filtrarCat(c.id));
        wrap.appendChild(b);
      });
      // Se o filtro ativo não existe mais nesse contexto, limpa
      if (_filtroCat && !cats.some(c => c.id === _filtroCat)) {
        _filtroCat = null;
      }
    }
  }

  function escListener(e) {
    if (e.key !== 'Escape') return;
    if (!document.getElementById('mn-overlay')?.classList.contains('open')) return;
    // Esc fecha primeiro o calendário; só depois o modal.
    if (_calEl) { fecharCalendario(); return; }
    fechar();
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
      .select('id, categoria, texto, data_ref, created_at, titulo')
      .eq('character_id', pjId)
      .order('data_ref', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) { console.warn('[Notes] carregar:', error.message); return []; }
    return data || [];
  }

  // Anotações da CAMPANHA: character_id IS NULL + campanha = chave
  async function carregarNotasCampanha(chave) {
    const { data: u } = await window.sb.auth.getUser();
    if (!u?.user) return [];
    const { data, error } = await window.sb
      .from('master_notes')
      .select('id, categoria, texto, data_ref, created_at, titulo')
      .is('character_id', null)
      .eq('user_id', u.user.id)
      .eq('campanha', chave)
      .order('data_ref', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) { console.warn('[Notes] carregar campanha:', error.message); return []; }
    return data || [];
  }

  async function contarNotasCampanha(chave) {
    const { data: u } = await window.sb.auth.getUser();
    if (!u?.user) return 0;
    const { count } = await window.sb
      .from('master_notes')
      .select('id', { count: 'exact', head: true })
      .is('character_id', null)
      .eq('user_id', u.user.id)
      .eq('campanha', chave);
    return count || 0;
  }

  async function inserirNota(pjId, categoria, texto, dataRef, titulo) {
    const { data: u } = await window.sb.auth.getUser();
    if (!u?.user) return null;
    const payload = {
      user_id: u.user.id,
      categoria,
      texto,
      data_ref: dataRef || hojeLocal(),
      titulo: (titulo || '').trim() || null,
    };
    if (pjId) payload.character_id = pjId;
    else payload.campanha = _campanha.chave;
    const { data, error } = await window.sb
      .from('master_notes')
      .insert(payload)
      .select().single();
    if (error) { alert('Erro ao salvar: ' + error.message); return null; }
    return data;
  }

  async function atualizarNota(id, categoria, texto, dataRef, titulo) {
    const { error } = await window.sb
      .from('master_notes')
      .update({ categoria, texto, data_ref: dataRef, titulo: (titulo || '').trim() || null })
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
  // Token de render — anti-race: várias chamadas concorrentes (onSubmit + realtime)
  // tentavam pintar o mesmo wrap ao mesmo tempo, causando duplicação.
  // Só o token mais recente chega a tocar o DOM.
  let _tokListaPj = 0;

  async function renderListaPj() {
    const tok = ++_tokListaPj;
    const campWrap = document.getElementById('mn-campanha-section');
    const wrap = document.getElementById('mn-pj-list');
    if (!campWrap || !wrap) return;

    // ===== Busca dados (awaits) =====
    let nCamp = 0;
    try { nCamp = await contarNotasCampanha(_campanha.chave); } catch {}
    if (tok !== _tokListaPj) return;

    let contagens = {};
    try {
      const { data } = await window.sb.from('master_notes')
        .select('character_id')
        .not('character_id', 'is', null);
      (data || []).forEach(r => { contagens[r.character_id] = (contagens[r.character_id] || 0) + 1; });
    } catch {}
    if (tok !== _tokListaPj) return;

    // ===== Constrói HTML como string (atômico) =====
    const campHtml = `
      <button type="button" class="mn-pj mn-campanha${_modoCampanha ? ' ativo' : ''}">
        <span class="mn-pj-info">
          <span class="mn-pj-nome">${ico('campanha')} ${escapeHtml(_campanha.titulo)}</span>
          <span class="mn-pj-sub">Anotações da campanha</span>
        </span>
        <span class="count">${nCamp}</span>
      </button>`;

    let pjHtml;
    if (!_pjs.length) {
      pjHtml = '<div class="mn-empty" style="padding:16px"><span class="ic">'+ico('caixa')+'</span><div>Nenhum personagem cadastrado.</div></div>';
    } else {
      pjHtml = _pjs.map(p => {
        const n = contagens[p.id] || 0;
        const sub = [p.classe, p.nivel ? 'N'+p.nivel : '', p.jogadorNome && p.jogadorNome !== '?' ? '· ' + p.jogadorNome : '']
          .filter(Boolean).join(' ');
        return `
          <button type="button" class="mn-pj${!_modoCampanha && p.id === _pjSelId ? ' ativo' : ''}" data-pj-id="${escapeHtml(p.id)}">
            <span class="mn-pj-info">
              <span class="mn-pj-nome">${escapeHtml(p.nome)}${p.is_active ? ' ★' : ''}</span>
              ${sub ? `<span class="mn-pj-sub">${escapeHtml(sub)}</span>` : ''}
            </span>
            <span class="count">${n}</span>
          </button>`;
      }).join('');
    }

    if (tok !== _tokListaPj) return;
    campWrap.innerHTML = campHtml;
    wrap.innerHTML = pjHtml;

    // Wire-up dos cliques
    campWrap.querySelector('.mn-campanha')?.addEventListener('click', selecionarCampanha);
    wrap.querySelectorAll('[data-pj-id]').forEach(b => {
      b.addEventListener('click', () => selecionarPj(b.dataset.pjId));
    });
  }

  function selecionarCampanha() {
    _modoCampanha = true;
    _pjSelId = null;
    cancelarEdicao();
    rebuildCategorias();
    renderListaPj();
    renderTimeline();
  }

  function selecionarPj(id) {
    _modoCampanha = false;
    _pjSelId = id;
    cancelarEdicao();
    rebuildCategorias();
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
  let _tokTimeline = 0;
  async function renderTimeline() {
    const tok = ++_tokTimeline;
    const wrap = document.getElementById('mn-timeline');
    if (!wrap) return;
    if (!_modoCampanha && !_pjSelId) {
      wrap.innerHTML = '<div class="mn-empty"><span class="ic">'+ico('clique')+'</span><div>Selecione um jogador ou a campanha para ver as anotações.</div></div>';
      return;
    }
    wrap.innerHTML = '<div class="mn-empty"><span class="ic">'+ico('tempo')+'</span><div>Carregando…</div></div>';
    const notas = _modoCampanha
      ? await carregarNotasCampanha(_campanha.chave)
      : await carregarNotas(_pjSelId);
    if (tok !== _tokTimeline) return;  // chamada mais recente já está em andamento
    _cacheNotas = notas;
    let lista = _cacheNotas;
    if (_filtroCat) lista = lista.filter(n => n.categoria === _filtroCat);

    const escopo = _modoCampanha ? 'esta campanha' : 'este jogador';
    if (!lista.length) {
      wrap.innerHTML = `<div class="mn-empty"><span class="ic">${ico('notas')}</span><div>${_filtroCat ? 'Nenhuma anotação nesta categoria.' : `Ainda não há anotações para ${escopo}.`}<br><span style="font-size:12px;opacity:0.7">Use o formulário acima para adicionar a primeira.</span></div></div>`;
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
          <span class="mn-entry-cat" style="background:${cat.cor}">${ico(cat.ico)} ${cat.label}</span>
          <span class="mn-entry-data">${ico('calendario')} ${dataFmt}</span>
          <span class="mn-entry-actions">
            <button type="button" data-act="edit" title="Editar" aria-label="Editar anotação">${ico('editar')}</button>
            <button type="button" data-act="del" title="Apagar" aria-label="Apagar anotação">${ico('lixeira')}</button>
          </span>
        </div>
        ${n.titulo ? `<div class="mn-entry-titulo"></div>` : ''}
        <div class="mn-entry-text mn-md"></div>
      `;
      if (n.titulo) div.querySelector('.mn-entry-titulo').textContent = n.titulo;
      div.querySelector('.mn-entry-text').innerHTML = renderTexto(semTituloRepetido(n.texto, n.titulo));
      div.querySelector('[data-act="edit"]').addEventListener('click', () => iniciarEdicao(n));
      div.querySelector('[data-act="del"]').addEventListener('click', async () => {
        // Confirmar.perguntar() no lugar do confirm() nativo (assets/js/confirmar.js),
        // que já é carregado nesta mesma página — mesmo padrão de aba_habilidades.js.
        const ok = window.Confirmar
          ? await window.Confirmar.perguntar({
              titulo: 'Apagar anotação?',
              mensagem: 'Esta ação não pode ser desfeita.',
              confirmar: 'Apagar', danger: true,
            })
          : confirm('Apagar esta anotação?');
        if (!ok) return;
        if (await deletarNota(n.id)) {
          await renderTimeline();
          await renderListaPj();
        }
      });
      wrap.appendChild(div);
      aplicarColapso(div);
    });
  }

  function iniciarEdicao(n) {
    _editandoId = n.id;
    verPrevia(false);
    document.getElementById('mn-titulo').value = n.titulo || '';
    const ta = document.getElementById('mn-texto');
    ta.value = n.texto;
    // A categoria da nota pode não existir no contexto atual (nota antiga):
    // adiciona a opção no select pra não trocar a categoria sem o Mestre pedir.
    const sel = document.getElementById('mn-cat');
    if (sel && !Array.from(sel.options).some(o => o.value === n.categoria)) {
      const c = POR_ID[n.categoria] || POR_ID['outro'];
      const opt = document.createElement('option');
      opt.value = n.categoria;
      opt.textContent = c.label;
      sel.appendChild(opt);
    }
    if (sel) sel.value = n.categoria;
    setData(n.data_ref || hojeLocal());
    document.getElementById('mn-submit').textContent = 'Salvar edição';
    document.getElementById('mn-cancel').style.display = '';
    document.getElementById('mn-titulo').focus();
    autoGrowTextarea(ta);
    const form = document.querySelector('.mn-form');
    if (form) form.scrollTop = 0;   // o compositor volta pro começo
  }

  function cancelarEdicao() {
    _editandoId = null;
    fecharCalendario();
    verPrevia(false);
    const t = document.getElementById('mn-titulo'); if (t) t.value = '';
    const ta = document.getElementById('mn-texto'); if (ta) { ta.value = ''; autoGrowTextarea(ta); }
    const s = document.getElementById('mn-submit'); if (s) s.textContent = '+ Adicionar';
    const c = document.getElementById('mn-cancel'); if (c) c.style.display = 'none';
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!_modoCampanha && !_pjSelId) { alert('Selecione um jogador ou a campanha.'); return; }
    const texto = document.getElementById('mn-texto').value.trim();
    if (!texto) return;
    const cat    = document.getElementById('mn-cat').value;
    const data   = document.getElementById('mn-data').value || null;
    const titulo = document.getElementById('mn-titulo').value;

    document.getElementById('mn-submit').disabled = true;
    let ok;
    if (_editandoId) {
      ok = await atualizarNota(_editandoId, cat, texto, data, titulo);
    } else {
      // Em modo campanha, pjId=null força a inserção como nota de campanha
      ok = !!(await inserirNota(_modoCampanha ? null : _pjSelId, cat, texto, data, titulo));
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

  // Textarea cresce com o conteúdo até o teto definido no CSS (max-height, que
  // muda com a altura da tela). Respeitar esse teto é o que impede o formulário
  // de empurrar a barra de ações — e o botão de salvar — fora da tela.
  function autoGrowTextarea(el) {
    if (!el || el.hidden) return;
    el.style.height = 'auto';
    const teto = parseFloat(getComputedStyle(el).maxHeight);
    const max = isFinite(teto) && teto > 0 ? teto : 280;
    el.style.height = Math.min(el.scrollHeight + 2, max) + 'px';
  }

  // Se a anotação começa com um título markdown igual ao campo Título, ele
  // aparecia duas vezes na tela. Some só com essa primeira linha repetida —
  // o texto salvo no banco continua intacto (a edição mostra ele inteiro).
  function semTituloRepetido(texto, titulo) {
    if (!texto || !titulo) return texto;
    const m = String(texto).match(/^\s*#{1,6}\s+(.+?)\s*#*\s*(?:\n|$)/);
    if (!m) return texto;
    const norm = s => s.trim().toLowerCase().replace(/[*_`]/g, '').replace(/\s+/g, ' ');
    if (norm(m[1]) !== norm(titulo)) return texto;
    return texto.slice(m[0].length).replace(/^\n+/, '');
  }

  // Render do corpo da anotação em markdown (assets/js/markdown.js).
  // `secaoDoisPontos` mantém as anotações antigas funcionando: linhas curtas
  // terminadas em ":" continuam virando cabeçalho de seção.
  // Sem o módulo carregado, degrada pra texto escapado com quebras de linha.
  function renderTexto(texto) {
    if (!texto) return '';
    if (window.Markdown) return window.Markdown.render(texto, { secaoDoisPontos: true });
    return '<p class="md-p">' + escapeHtml(texto).replace(/\n/g, '<br>') + '</p>';
  }

  // Aplica colapso visual ao card: se for muito alto, esconde excesso com fade
  // e mostra botão "Ver mais"/"Ver menos".
  function aplicarColapso(div) {
    const textEl = div.querySelector('.mn-entry-text');
    if (!textEl) return;
    // Mede altura natural após o paint
    requestAnimationFrame(() => {
      const ALT_MAX = 240; // px — limite antes de colapsar
      if (textEl.scrollHeight <= ALT_MAX + 40) return;  // pequeno o suficiente
      div.classList.add('mn-colapsavel', 'colapsado');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mn-ver-mais';
      btn.textContent = '▾ Ver mais';
      btn.addEventListener('click', () => {
        const aberto = div.classList.toggle('colapsado') === false;
        btn.textContent = aberto ? '▴ Ver menos' : '▾ Ver mais';
      });
      div.appendChild(btn);
    });
  }

  // ===== ABRIR/FECHAR =====
  async function abrir(opts) {
    if (!window.Auth || !window.sb) { alert('Auth/Supabase não carregado.'); return; }
    const ehMestre = await window.Auth.ehMestre();
    if (!ehMestre) { alert('Apenas o Mestre pode acessar as anotações.'); return; }

    // Aceita string legada OU { chave, titulo }
    if (typeof opts === 'string') _campanha = { chave: opts, titulo: 'Campanha' };
    else if (opts && opts.chave) _campanha = { chave: opts.chave, titulo: opts.titulo || 'Campanha' };
    // Se não passou nada, mantém o último (default 'mestre' / 'Campanha')

    montar();
    // Atualiza título do modal pra refletir a campanha atual
    const t = document.getElementById('mn-title');
    if (t) t.innerHTML = ico('notas') + ` Anotações — ${escapeHtml(_campanha.titulo)}`;

    document.getElementById('mn-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    // Abre sempre no modo de escrita e na data de hoje (a menos que já esteja
    // editando alguma anotação, o que não acontece numa abertura nova).
    if (!_editandoId) { verPrevia(false); setData(hojeLocal()); }
    await carregarPjs();
    // Default: abre na visão de Campanha (pediu pra ser proeminente)
    if (!_modoCampanha && !_pjSelId) _modoCampanha = true;
    rebuildCategorias();
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

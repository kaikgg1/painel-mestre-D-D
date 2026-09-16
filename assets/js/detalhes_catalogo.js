// assets/js/detalhes_catalogo.js
// Descrição completa de habilidades e magias dentro do Painel do Mestre.
//
// Por que existe: o painel mostrava só o NOME das habilidades (e, pior, um
// nome reconstruído do slug — "Destruir Mortos Vivos Cr 1 2" em vez de
// "Destruir Mortos-Vivos (CR 1/2)"), e só o nome das magias preparadas.
// Na mesa, o Mestre precisa ler o efeito completo sem abrir a ficha do
// jogador nem o Grimório em outra aba.
//
// Fonte dos dados:
//   - habilidades → data/habilidades_classes.json (mesmo arquivo da aba
//     Habilidades da ficha), indexado pelo MESMO slug que a ficha usa em
//     recursos_usados, então dá pra casar chave salva → nome/descrição reais.
//   - magias → o painel já carrega o objeto completo de data/magias_data.json
//     pra montar as tags; aqui só se recebe esse objeto e se desenha.
//
// API:
//   await DetalhesCatalogo.habilidade(slug, classe)  → {nome, desc, ...} | null
//   DetalhesCatalogo.abrirHabilidade(slug, classe, nomeFallback)
//   DetalhesCatalogo.abrirMagia(objMagia)
//
// Depende de: assets/css/components.css (.modal-overlay/.modal).

window.DetalhesCatalogo = (function () {
  // paineis/*.html → ../data/ ; raiz → data/
  const BASE = location.pathname.includes('/paineis/') ? '../data/' : 'data/';

  const CSS = `
  .dc-modal { padding: 22px 24px; max-width: 560px; }
  .dc-titulo {
    font-family: 'Cinzel', var(--font-heading, serif); font-size: 19px; font-weight: 700;
    color: var(--gold-light, #dfc57a); letter-spacing: .5px; margin: 0 0 4px;
  }
  .dc-sub {
    font-family: var(--font-body, Georgia, serif); font-style: italic;
    font-size: 13.5px; color: var(--text-muted, #9e947c); margin: 0 0 14px;
  }
  .dc-props {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px 16px; margin: 0 0 14px; padding: 12px 0;
    border-top: 1px solid var(--border-soft, #3d3420);
    border-bottom: 1px solid var(--border-soft, #3d3420);
  }
  .dc-prop-nome {
    font-family: 'Cinzel', serif; font-size: 10px; font-weight: 700; letter-spacing: 1px;
    text-transform: uppercase; color: var(--gold, #c49a3a); margin-bottom: 2px;
  }
  .dc-prop-valor { font-size: 14px; color: var(--text, #e5d8b9); }
  .dc-desc {
    font-family: var(--font-body, Georgia, serif); font-size: 15px; line-height: 1.6;
    color: var(--text, #e5d8b9); max-height: 46vh; overflow-y: auto;
  }
  .dc-desc p { margin: 0 0 10px; }
  .dc-extra {
    margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-soft, #3d3420);
    font-size: 14px; line-height: 1.55; color: var(--text-muted, #9e947c);
  }
  .dc-extra strong { color: var(--gold-light, #dfc57a); }
  .dc-acoes { display: flex; justify-content: flex-end; margin-top: 18px; }
  .dc-fechar {
    padding: 9px 20px; cursor: pointer; border-radius: 4px;
    background: transparent; border: 1px solid var(--border, #6f5a2a);
    color: var(--text-muted, #9e947c);
    font-family: 'Cinzel', serif; font-size: 11px; font-weight: 700;
    letter-spacing: 1.2px; text-transform: uppercase; min-height: 40px;
  }
  .dc-fechar:hover { background: var(--gold, #c49a3a); color: var(--bg, #0d0e0c); border-color: var(--gold, #c49a3a); }
  /* Deixa claro que dá pra clicar pra ler o texto completo */
  .recurso-nome.dc-link, .magia-prep-tag.dc-link { cursor: pointer; }
  .recurso-nome.dc-link:hover, .magia-prep-tag.dc-link:hover {
    color: var(--gold-light, #dfc57a); text-decoration: underline; text-underline-offset: 3px;
  }
  .dc-link:focus-visible { outline: 2px solid var(--gold, #c49a3a); outline-offset: 2px; }
  @media (max-width: 767px) { .dc-modal { padding: 18px 16px; } }
  `;

  let _css = false;
  function injetarCSS() {
    if (_css) return;
    _css = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // MESMO slug de assets/js/ficha/aba_habilidades.js — é o que está salvo
  // em characters.recursos_usados, então precisa bater caractere a caractere.
  function slugFeature(nome) {
    return (nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80);
  }

  function chaveDeClasse(classe) {
    return (classe || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  // Índice: Map<classe, Map<slug, feature>> — carregado uma vez só.
  let _indice = null;
  function carregarIndice() {
    if (_indice) return _indice;
    _indice = fetch(BASE + 'habilidades_classes.json')
      .then(r => r.json())
      .then(db => {
        const porClasse = new Map();
        for (const [classe, lista] of Object.entries(db)) {
          if (!Array.isArray(lista)) continue;   // pula a chave "_descricao"
          const m = new Map();
          lista.forEach(h => {
            const s = slugFeature(h.nome);
            // Features que repetem em vários níveis com o MESMO nome
            // ("Característica do Arquétipo" em 7/10/15/18, Aumento de
            // Atributo em 4/8...) colidem no slug. Guarda a primeira (nível
            // mais baixo) e acumula os níveis, em vez de a última sobrescrever
            // e o modal dizer "Nível 18" pra uma feature pega no 7.
            if (m.has(s)) { m.get(s)._niveis.push(h.nivel); return; }
            m.set(s, { ...h, _niveis: [h.nivel] });
          });
          porClasse.set(classe, m);
        }
        return porClasse;
      })
      .catch(e => { console.warn('[detalhes] habilidades:', e); return new Map(); });
    return _indice;
  }

  // Procura primeiro na classe do personagem; se não achar (multiclasse,
  // feature de outra origem), varre as demais classes antes de desistir.
  async function habilidade(slug, classe) {
    if (!slug) return null;
    const idx = await carregarIndice();
    const daClasse = idx.get(chaveDeClasse(classe));
    if (daClasse?.has(slug)) return daClasse.get(slug);
    for (const m of idx.values()) if (m.has(slug)) return m.get(slug);
    return null;
  }

  // Nome de exibição: o real do catálogo quando existir, senão o slug
  // "humanizado" (que é o que o painel mostrava pra tudo antes).
  async function nomeBonito(slug, classe) {
    const h = await habilidade(slug, classe);
    return h ? h.nome : String(slug || '').replace(/_/g, ' ');
  }

  function abrirModal(corpoHtml) {
    injetarCSS();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal dc-modal" role="dialog" aria-modal="true">
      ${corpoHtml}
      <div class="dc-acoes"><button type="button" class="dc-fechar">Fechar</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const fechar = () => { overlay.remove(); document.removeEventListener('keydown', onEsc); };
    function onEsc(e) { if (e.key === 'Escape') fechar(); }
    overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });
    document.addEventListener('keydown', onEsc);
    const btn = overlay.querySelector('.dc-fechar');
    btn.addEventListener('click', fechar);
    btn.focus();
    return fechar;
  }

  function paragrafos(texto) {
    return String(texto || '—').split(/\n\n+/).map(p => `<p>${esc(p.trim())}</p>`).join('');
  }

  async function abrirHabilidade(slug, classe, nomeFallback) {
    const h = await habilidade(slug, classe);
    const nome = h?.nome || nomeFallback || String(slug || '').replace(/_/g, ' ');
    const niveis = h?._niveis?.length > 1
      ? `Níveis ${h._niveis.join(', ')}`
      : (h?.nivel ? `Nível ${h.nivel}` : '');
    const sub = h
      ? [niveis, h.subclasse || '', classe || ''].filter(Boolean).join(' · ')
      : 'Característica personalizada (a descrição fica na ficha do jogador)';
    abrirModal(`
      <h3 class="dc-titulo">${esc(nome)}</h3>
      <p class="dc-sub">${esc(sub)}</p>
      <div class="dc-desc">${h ? paragrafos(h.desc) : '<p>Sem descrição no catálogo — foi criada pelo jogador na aba Habilidades.</p>'}</div>
    `);
  }

  function abrirMagia(m) {
    if (!m) return;
    const nivel = m.nivel === 0 ? 'Truque' : `${m.nivel}° nível`;
    const sub = [nivel, m.escola, m.ritual ? 'Ritual' : '', m.concentracao ? 'Concentração' : '']
      .filter(Boolean).join(' · ');
    const comps = (m.componentes || '') + (m.material ? ` (${m.material})` : '');
    const props = [
      ['Tempo', m.tempoCast], ['Alcance', m.alcance],
      ['Componentes', comps], ['Duração', m.duracao],
    ].filter(([, v]) => v).map(([k, v]) =>
      `<div><div class="dc-prop-nome">${esc(k)}</div><div class="dc-prop-valor">${esc(v)}</div></div>`).join('');
    abrirModal(`
      <h3 class="dc-titulo">${esc(m.nome)}</h3>
      <p class="dc-sub">${esc(sub)}</p>
      ${props ? `<div class="dc-props">${props}</div>` : ''}
      <div class="dc-desc">${paragrafos(m.descricao)}</div>
      ${m.maiorNivel ? `<div class="dc-extra"><strong>Em Níveis Superiores.</strong> ${esc(m.maiorNivel)}</div>` : ''}
    `);
  }

  // Liga um <span> de nome de recurso ao catálogo: troca o texto pelo nome
  // real (se houver) e deixa o elemento clicável pra abrir a descrição.
  // Se o slug não existir no catálogo (característica personalizada), o
  // elemento fica só com o texto — sem virar link que abriria um modal vazio.
  function ligarNomeHabilidade(el, slug, classe, nomeFallback) {
    if (!el) return;
    injetarCSS();
    habilidade(slug, classe).then(h => {
      if (h) el.textContent = h.nome;
      else if (nomeFallback) el.textContent = nomeFallback;
      if (!h) return;
      el.classList.add('dc-link');
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.title = 'Ver descrição completa';
      const abrir = () => abrirHabilidade(slug, classe, nomeFallback);
      el.addEventListener('click', abrir);
      el.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        abrir();
      });
    });
  }

  return { habilidade, nomeBonito, abrirHabilidade, abrirMagia, ligarNomeHabilidade, slugFeature };
})();

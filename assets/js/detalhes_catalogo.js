// assets/js/detalhes_catalogo.js
// Descrição completa de habilidades, magias e equipamento dentro do Painel
// do Mestre — clicando no nome, sem abrir a ficha do jogador nem o Grimório.
//
// Fonte dos dados:
//   habilidades → data/habilidades_classes.json (mesmo arquivo da aba
//     Habilidades da ficha), indexado pelo MESMO slug usado em
//     recursos_usados, pra casar chave salva → nome/descrição reais.
//   magias      → o painel já carrega o objeto completo de data/magias_data.json
//     pra montar as tags; aqui só se recebe esse objeto e se desenha.
//   equipamento → o próprio item salvo no inventário (dano, peso, custo…)
//     + data/itens_data.json quando for item mágico do DMG
//     + window.PHB (assets/js/phb_catalogo.js) pra itens mundanos.
//
// API:
//   await DetalhesCatalogo.habilidade(slug, classe) → {nome, desc, ...} | null
//   DetalhesCatalogo.abrirHabilidade(slug, classe, nomeFallback)
//   DetalhesCatalogo.abrirMagia(objMagia)
//   DetalhesCatalogo.abrirEquipamento(item, grupo)
//   DetalhesCatalogo.ligarNomeHabilidade(el, slug, classe, nomeFallback)
//
// Depende de: assets/css/components.css (.modal-overlay/.modal).

window.DetalhesCatalogo = (function () {
  // paineis/*.html → ../data/ ; raiz → data/
  const BASE = location.pathname.includes('/paineis/') ? '../data/' : 'data/';

  const CSS = `
  .dc-modal { padding: 22px 24px; max-width: 580px; }
  .dc-titulo {
    font-family: 'Cinzel', var(--font-heading, serif); font-size: 19px; font-weight: 700;
    color: var(--gold-light, #dfc57a); letter-spacing: .5px; margin: 0 0 6px;
  }
  .dc-sub {
    font-family: var(--font-body, Georgia, serif); font-style: italic;
    font-size: 13.5px; color: var(--text-muted, #9e947c); margin: 0 0 12px;
  }
  .dc-badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 14px; }
  .dc-badge {
    font-family: 'Cinzel', serif; font-size: 10px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase;
    padding: 4px 10px; border-radius: 999px;
    border: 1px solid var(--border-soft, #3d3420);
    background: rgba(0,0,0,0.25); color: var(--text-muted, #9e947c);
  }
  /* Tipo de ação é a informação que o Mestre procura primeiro numa mesa */
  .dc-badge.acao { border-color: var(--gold, #c49a3a); color: var(--gold-light, #dfc57a); background: rgba(196,154,58,0.14); }
  .dc-badge.recarga { border-color: #4a7a8a; color: #9ad4e0; background: rgba(74,122,138,0.16); }
  .dc-badge.alerta { border-color: #8a4a4a; color: #e0a09a; background: rgba(138,74,74,0.18); }
  .dc-props {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px 16px; margin: 0 0 14px; padding: 12px 0;
    border-top: 1px solid var(--border-soft, #3d3420);
    border-bottom: 1px solid var(--border-soft, #3d3420);
  }
  .dc-prop-nome {
    font-family: 'Cinzel', serif; font-size: 10px; font-weight: 700; letter-spacing: 1px;
    text-transform: uppercase; color: var(--gold, #c49a3a); margin-bottom: 3px;
  }
  .dc-prop-valor { font-size: 15px; color: var(--text, #e5d8b9); font-weight: 600; }
  .dc-desc {
    font-family: var(--font-body, Georgia, serif); font-size: 15px; line-height: 1.6;
    color: var(--text, #e5d8b9); max-height: 44vh; overflow-y: auto;
  }
  .dc-desc p { margin: 0 0 10px; }
  .dc-desc p:last-child { margin-bottom: 0; }
  /* Números que decidem a jogada: dados, CD, alcance */
  .dc-hl { color: var(--gold-light, #dfc57a); font-weight: 700; }
  .dc-extra {
    margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-soft, #3d3420);
    font-size: 14px; line-height: 1.55; color: var(--text-muted, #9e947c);
  }
  .dc-extra strong { color: var(--gold-light, #dfc57a); }
  .dc-vazio { font-style: italic; color: var(--text-muted, #9e947c); }
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
  .recurso-nome.dc-link, .magia-prep-tag.dc-link, .equip-tag.dc-link { cursor: pointer; }
  .recurso-nome.dc-link:hover, .magia-prep-tag.dc-link:hover, .equip-tag.dc-link:hover {
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

  function semAcento(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  // MESMO slug de assets/js/ficha/aba_habilidades.js — é o que está salvo
  // em characters.recursos_usados, então precisa bater caractere a caractere.
  function slugFeature(nome) {
    return semAcento(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80);
  }

  // ── Destaque do que importa numa mesa ───────────────────────────────
  // Roda SEMPRE sobre texto já escapado, então as únicas tags no resultado
  // são as que esta função insere — não abre brecha de injeção.
  function destacar(txt) {
    return txt
      // "Ação:", "Ação Bônus:", "Reação:" no começo da frase
      .replace(/(^|\.\s+|\n)(A[çc][ãa]o B[ôo]nus|A[çc][ãa]o|Rea[çc][ãa]o)(\s*:)/g,
        (m, pre, lbl, fim) => `${pre}<strong class="dc-hl">${lbl}${fim}</strong>`)
      // dados: 2d6, 1d8+3, 10d6 - 5
      .replace(/\b(\d+d\d+(?:\s*[+-]\s*\d+)?)/g, '<strong class="dc-hl">$1</strong>')
      // CD de resistência
      .replace(/\bCD\s*(\d+)/g, '<strong class="dc-hl">CD $1</strong>')
      // alcance/área
      .replace(/\b(\d+(?:[.,]\d+)?)\s(metros|metro|pés|pes)\b/g, '<strong class="dc-hl">$1 $2</strong>')
      // recuperação
      .replace(/\b(descansos?\s+(?:curtos?|longos?))\b/gi, '<strong class="dc-hl">$1</strong>');
  }

  function paragrafos(texto) {
    const t = String(texto || '').trim();
    if (!t) return '<p class="dc-vazio">Sem descrição no catálogo.</p>';
    return t.split(/\n\n+/).map(p => `<p>${destacar(esc(p.trim()))}</p>`).join('');
  }

  function badge(txt, classe) {
    return `<span class="dc-badge${classe ? ' ' + classe : ''}">${esc(txt)}</span>`;
  }

  // Tipo de ação + limite de usos, lidos do texto (o catálogo não tem esses
  // campos estruturados) — mesma heurística da aba Habilidades da ficha.
  function badgesHabilidade(h) {
    const txt = (h?.nome || '') + ' ' + (h?.desc || '');
    const b = [];
    if (/a[çc][ãa]o\s+b[ôo]nus/i.test(txt)) b.push(badge('Ação Bônus', 'acao'));
    else if (/rea[çc][ãa]o\s*:/i.test(txt)) b.push(badge('Reação', 'acao'));
    else if (/(^|\.\s*)a[çc][ãa]o\s*:/i.test(txt)) b.push(badge('Ação', 'acao'));
    else b.push(badge('Passiva'));

    const usos = txt.match(/(\d+)\s*(?:\/|x\s*\/|\s+vezes?\s+por\s+)\s*(descanso(?:\s+(?:curto|longo))?|dia)/i);
    if (usos) b.push(badge(`${usos[1]}× por ${usos[2].toLowerCase()}`, 'recarga'));
    else if (/recupera\s+em\s+descanso\s+(curto|longo)/i.test(txt)) {
      b.push(badge('Recupera em descanso ' + RegExp.$1.toLowerCase(), 'recarga'));
    }
    if (/concentra[çc][ãa]o/i.test(txt)) b.push(badge('Concentração', 'alerta'));
    return b.join('');
  }

  // ── Índice de habilidades ───────────────────────────────────────────
  // Map<classe, Map<slug, feature>> — carregado uma vez só.
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
            // ("Característica do Arquétipo" em 7/10/15/18) colidem no slug.
            // Guarda a primeira (nível mais baixo) e acumula os níveis.
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

  // Busca em camadas, porque a chave salva nem sempre bate exatamente com o
  // nome do catálogo: o painel tem "Surto de Ação" e o catálogo tem "Surto de
  // Ação (1 uso)"; o painel tem "Pontos de Feitiçaria" e o catálogo tem
  // "Fonte de Magia (Pontos de Feitiçaria)". Sem isso, essas linhas ficavam
  // sem descrição nenhuma.
  function acharNoMapa(m, slug) {
    if (!m || !slug) return null;
    if (m.has(slug)) return m.get(slug);
    const candidatos = [];
    for (const [s, h] of m) {
      if (s.startsWith(slug + '_') || s.includes('_' + slug) || s.includes(slug)) candidatos.push(h);
    }
    if (!candidatos.length) return null;
    // menor nível primeiro: é a ocorrência "original" da característica
    candidatos.sort((a, b) => (a.nivel || 0) - (b.nivel || 0));
    return candidatos[0];
  }

  // Procura primeiro na classe do personagem; se não achar (multiclasse,
  // feature de outra origem), varre as demais classes antes de desistir.
  async function habilidade(slug, classe) {
    if (!slug) return null;
    const idx = await carregarIndice();
    const direto = acharNoMapa(idx.get(semAcento(classe)), slug);
    if (direto) return direto;
    for (const m of idx.values()) {
      const achado = acharNoMapa(m, slug);
      if (achado) return achado;
    }
    return null;
  }

  async function nomeBonito(slug, classe) {
    const h = await habilidade(slug, classe);
    return h ? h.nome : String(slug || '').replace(/_/g, ' ');
  }

  // ── Itens mágicos (DMG) ─────────────────────────────────────────────
  let _itens = null;
  function carregarItens() {
    if (_itens) return _itens;
    _itens = fetch(BASE + 'itens_data.json')
      .then(r => r.json())
      .then(lista => {
        const m = new Map();
        (lista || []).forEach(it => m.set(semAcento(it.nome), it));
        return m;
      })
      .catch(e => { console.warn('[detalhes] itens:', e); return new Map(); });
    return _itens;
  }

  // Item mundano do PHB (assets/js/phb_catalogo.js), se a página carregou
  function acharNoPHB(nome) {
    if (!window.PHB) return null;
    const alvo = semAcento(nome);
    for (const grupo of ['ARMAS', 'ARMADURAS', 'FERRAMENTAS', 'ITENS']) {
      const achado = (window.PHB[grupo] || []).find(x => semAcento(x.nome) === alvo);
      if (achado) return achado;
    }
    return null;
  }

  // ── Modal ───────────────────────────────────────────────────────────
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

  function gridProps(pares) {
    const itens = pares.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
      .map(([k, v]) => `<div><div class="dc-prop-nome">${esc(k)}</div><div class="dc-prop-valor">${esc(v)}</div></div>`);
    return itens.length ? `<div class="dc-props">${itens.join('')}</div>` : '';
  }

  async function abrirHabilidade(slug, classe, nomeFallback) {
    const h = await habilidade(slug, classe);
    const nome = h?.nome || nomeFallback || String(slug || '').replace(/_/g, ' ');
    const niveis = h?._niveis?.length > 1
      ? `Níveis ${h._niveis.join(', ')}`
      : (h?.nivel ? `Nível ${h.nivel}` : '');
    const sub = h
      ? [niveis, h.subclasse || '', classe || ''].filter(Boolean).join(' · ')
      : 'Característica personalizada';
    abrirModal(`
      <h3 class="dc-titulo">${esc(nome)}</h3>
      <p class="dc-sub">${esc(sub)}</p>
      ${h ? `<div class="dc-badges">${badgesHabilidade(h)}</div>` : ''}
      <div class="dc-desc">${h ? paragrafos(h.desc)
        : '<p class="dc-vazio">Criada pelo jogador na aba Habilidades da ficha — a descrição fica lá.</p>'}</div>
    `);
  }

  function abrirMagia(m) {
    if (!m) return;
    const nivel = m.nivel === 0 ? 'Truque' : `${m.nivel}° nível`;
    const badges = [
      badge(nivel), m.escola ? badge(m.escola) : '',
      m.concentracao ? badge('Concentração', 'alerta') : '',
      m.ritual ? badge('Ritual', 'recarga') : '',
      m.tempoCast ? badge(m.tempoCast, 'acao') : '',
    ].filter(Boolean).join('');
    const comps = (m.componentes || '') + (m.material ? ` (${m.material})` : '');
    abrirModal(`
      <h3 class="dc-titulo">${esc(m.nome)}</h3>
      <div class="dc-badges">${badges}</div>
      ${gridProps([['Tempo', m.tempoCast], ['Alcance', m.alcance], ['Componentes', comps], ['Duração', m.duracao]])}
      <div class="dc-desc">${paragrafos(m.descricao)}</div>
      ${m.maiorNivel ? `<div class="dc-extra"><strong>Em Níveis Superiores.</strong> ${destacar(esc(m.maiorNivel))}</div>` : ''}
    `);
  }

  // item: objeto salvo no inventário ({nome, dano, tipo_dano, propriedades,
  // peso, custo, ca, qtd…}); grupo: 'armas' | 'armaduras' | 'itens'
  async function abrirEquipamento(item, grupo) {
    if (!item) return;
    const nome = item.nome || '?';
    const mapaItens = await carregarItens();
    const magico = mapaItens.get(semAcento(nome));
    const phb = acharNoPHB(nome);
    const d = { ...(phb || {}), ...item };   // o que está salvo na ficha manda

    const badges = [
      grupo === 'armas' ? badge('Arma', 'acao') : grupo === 'armaduras' ? badge('Armadura') : badge('Item'),
      d.categoria ? badge(d.categoria) : '',
      magico ? badge(magico.raridade || 'mágico', 'recarga') : '',
      magico?.sintonia ? badge('Requer sintonia', 'alerta') : '',
    ].filter(Boolean).join('');

    const props = gridProps([
      ['Dano', d.dano && d.tipo_dano ? `${d.dano} ${d.tipo_dano}` : d.dano],
      ['CA', d.ca],
      ['Propriedades', d.propriedades],
      ['Quantidade', d.qtd],
      ['Peso', d.peso !== undefined && d.peso !== '' ? `${d.peso} kg` : ''],
      ['Custo', d.custo],
      ['Tipo', magico?.tipo],
    ]);

    const desc = magico?.descricao
      ? paragrafos(magico.descricao)
      : `<p class="dc-vazio">${phb
          ? 'Equipamento comum do Livro do Jogador — sem descrição de regra além das propriedades acima.'
          : 'Item fora do catálogo (adicionado à mão), sem descrição cadastrada.'}</p>`;

    abrirModal(`
      <h3 class="dc-titulo">${esc(nome)}</h3>
      <div class="dc-badges">${badges}</div>
      ${props}
      <div class="dc-desc">${desc}</div>
      ${magico?.sintonia_detalhe ? `<div class="dc-extra"><strong>Sintonia.</strong> ${esc(magico.sintonia_detalhe)}</div>` : ''}
    `);
  }

  // Liga um <span> de nome de recurso ao catálogo: troca o texto pelo nome
  // real (se houver) e deixa o elemento clicável pra abrir a descrição.
  //
  // manterTexto = true preserva o texto que já está no elemento. Serve pros
  // recursos que a gente mesmo nomeia em recursos_classe.js: o nome do
  // catálogo é o da habilidade INTEIRA e não cabe na linha do tracker —
  // "Pontos de Feitiçaria" virava "Fonte de Magia (Pontos de Feitiçaria)" e
  // aparecia cortado na ficha do Feiticeiro. O clique pra ler a regra
  // continua valendo; só o rótulo é que fica o nosso.
  function ligarNomeHabilidade(el, slug, classe, nomeFallback, manterTexto) {
    if (!el) return;
    injetarCSS();
    habilidade(slug, classe).then(h => {
      if (manterTexto) { /* rótulo curado: não mexe */ }
      else if (h) el.textContent = h.nome;
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

  return {
    habilidade, nomeBonito, abrirHabilidade, abrirMagia, abrirEquipamento,
    ligarNomeHabilidade, slugFeature,
  };
})();

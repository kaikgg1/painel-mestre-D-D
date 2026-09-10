// assets/js/ficha/aba_habilidades.js
// Aba Habilidades (Fase 5 do redesign): features fixas por classe×nível
// (data/habilidades_classes.json) + características personalizadas
// (characters.features_personalizadas), agora com busca, filtro por tipo
// de ação, favoritar (characters.habilidades_favoritas — migration 022,
// degrada pra "só nesta sessão" se a coluna ainda não existir) e um
// tracker de usos redesenhado (pips + "N/M disponíveis" + período de
// recuperação visível, no lugar de "Usos 0/1 [1]").

function renderHabilidades(c) {
  return `
    <div id="recursos-classe-wrap"></div>

    <h3>Habilidades</h3>
    <p style="color:var(--text-dim);font-style:italic;font-size:12px;margin-bottom:14px">
      Preenchido automaticamente com base na classe e nível.
      ${c.subclasse ? `Subclasse: <strong>${escape(c.subclasse)}</strong>` : 'Defina sua subclasse na aba <em>Identidade</em>.'}
    </p>

    <div class="hab-busca-wrap">
      <input type="search" id="hab-busca" class="hab-busca-input" placeholder="Buscar habilidade…" aria-label="Buscar habilidade">
    </div>
    <div class="hab-filtros" role="group" aria-label="Filtrar por tipo de ação">
      <button type="button" class="pill ativo" data-hab-filtro="todas" aria-pressed="true">Todas</button>
      <button type="button" class="pill" data-hab-filtro="acao" aria-pressed="false">Ações</button>
      <button type="button" class="pill" data-hab-filtro="bonus" aria-pressed="false">Ações Bônus</button>
      <button type="button" class="pill" data-hab-filtro="reacao" aria-pressed="false">Reações</button>
      <button type="button" class="pill" data-hab-filtro="passiva" aria-pressed="false">Passivas</button>
    </div>

    <div id="hab-wrap">Carregando…</div>
    <div id="hab-sem-resultados" class="item-vazio" hidden>Nenhuma habilidade encontrada com esse filtro/busca.</div>

    <div class="hab-add-bar">
      <h3 style="margin:0">Características Personalizadas</h3>
      <button type="button" class="btn" id="btn-add-feature">+ Adicionar característica</button>
    </div>
    <p style="color:var(--text-dim);font-style:italic;font-size:12px;margin-bottom:10px">
      Talentos (feats), habilidades raciais especiais, dons de campanha, ou qualquer característica fora do catálogo.
    </p>
    <div id="hab-custom-wrap"></div>

    <h3 style="margin-top:18px">Notas Livres</h3>
    <p style="color:var(--text-dim);font-style:italic;font-size:12px;margin-bottom:8px">
      Para anotações que não cabem como uma característica estruturada.
    </p>
    <div class="campo">
      <textarea name="caracteristicas_adicionais" style="min-height:120px">${escape(c.caracteristicas_adicionais || '')}</textarea>
    </div>
  `;
}

function slugFeature(nome) {
  return (nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80);
}

// Detecta se uma feature tem usos limitados por descanso/dia analisando
// nome + descrição. Retorna {max, periodo, tipo} ou null para passivas.
// max=0 quando a fórmula é variável (ex.: "1 + mod CAR") — usuário ajusta.
function detectarUsosLimitados(h) {
  const txt = (h.nome || '') + ' ' + (h.desc || '');

  // 1) (N/descanso|dia|longo|curto) — padrão explícito no nome
  let m = txt.match(/\(\s*(\d+)\s*\/\s*(descanso(?:\s+(?:curto|longo))?|dia|longo|curto|long\.?|curt\.?)\s*\)/i);
  if (m) return { max: +m[1], periodo: m[2].toLowerCase() };

  // 2) (N uso/usos) no nome
  m = txt.match(/\(\s*(\d+)\s+usos?\s*\)/i);
  if (m) return { max: +m[1], periodo: 'descanso' };

  // 3) "Nx/descanso" ou "Nx/dia" (sem parênteses)
  m = txt.match(/(\d+)\s*x\s*\/\s*(descanso(?:\s+(?:curto|longo))?|dia|longo|curto)/i);
  if (m) return { max: +m[1], periodo: m[2].toLowerCase() };

  // 4) "N vezes por (descanso|dia)" ou "N vezes entre descansos"
  m = txt.match(/(\d+)\s+vezes?\s+(?:por|a\s+cada|entre)\s+(descanso[s]?(?:\s+(?:curto|longo))?|dia)/i);
  if (m) return { max: +m[1], periodo: m[2].toLowerCase() };

  // 5) "uma vez por (descanso|dia|turno)"
  if (/uma\s+vez\s+(?:por|a\s+cada|entre)\s+(descanso|dia|turno)/i.test(txt)) {
    return { max: 1, periodo: RegExp.$1.toLowerCase() };
  }

  // 6) "1x cada/descanso" / "1x/dia"
  m = txt.match(/(\d+)\s*x\s+cada\s+(descanso|dia)/i);
  if (m) return { max: +m[1], periodo: m[2].toLowerCase() };

  // 7) Fórmula "Usos = X" ou "X usos = ..." (ex.: Sentido Divino do Paladino)
  if (/usos?\s*=/i.test(txt) || /usos?\s*por\s+descanso/i.test(txt)) {
    return { max: 0, periodo: 'descanso' };  // editável manualmente
  }

  // 8) "/descanso longo" ou "/descanso curto" no fim de uma cláusula com número
  m = txt.match(/(\d+)\s*\/\s*(descanso\s+(?:curto|longo)|dia|longo|curto)/i);
  if (m) return { max: +m[1], periodo: m[2].toLowerCase() };

  // 9) "recupera em descanso" + número de cargas/pontos no início (ex.: pontos de feitiçaria)
  if (/recupera\s+em\s+descanso\s+(curto|longo)/i.test(txt) &&
      /(\d+)\s+(?:pontos?|cargas?|usos?)/i.test(txt)) {
    return { max: 0, periodo: 'descanso ' + RegExp.$1.toLowerCase() };  // editável
  }

  return null;  // passiva — sem tracker
}

// Detecta o TIPO DE AÇÃO (Fase 5, §11) por texto — a fonte de dados não tem
// esse campo estruturado, então é um palpite best-effort igual ao de
// detectarUsosLimitados: procura o marcador explícito "Ação bônus:"/
// "Reação:"/"Ação:" (com dois-pontos, pra não disparar em qualquer menção
// incidental da palavra). Sem marcador → passiva, que é o caso comum
// (ASI, proficiências, escolha de subclasse etc. não custam ação).
function detectarTipoAcao(h) {
  const txt = (h.nome || '') + ' ' + (h.desc || '');
  if (/a[çc][ãa]o\s+b[ôo]nus\s*:/i.test(txt)) return 'bonus';
  if (/rea[çc][ãa]o\s*:/i.test(txt)) return 'reacao';
  if (/(^|\.\s*)a[çc][ãa]o\s*:/i.test(txt)) return 'acao';
  return 'passiva';
}
function rotuloTipoAcao(tipo) {
  return { acao: 'Ação', bonus: 'Ação Bônus', reacao: 'Reação', passiva: 'Passiva' }[tipo] || 'Passiva';
}

// Lista achatada de TODAS as habilidades do PJ (catálogo de classe já
// filtrado por nível/subclasse + características personalizadas), num
// formato único {slug,nome,desc,tipoAcao,custom}. Usada pelo Resumo pra
// resolver os favoritos sem duplicar a lógica de filtragem do catálogo.
async function todasHabilidadesPJ(c) {
  const lista = [];
  if (c.classe) {
    const db = await carregarHabilidadesClasses();
    if (db) {
      const todas = db[chaveDeClasse(c.classe)] || [];
      const habs = todas.filter(h => h.nivel <= (c.nivel || 1) && (!h.subclasse || h.subclasse === c.subclasse));
      for (const h of habs) {
        lista.push({ slug: slugFeature(h.nome), nome: h.nome, desc: h.desc, tipoAcao: detectarTipoAcao(h), custom: false });
      }
    }
  }
  const custom = Array.isArray(c.features_personalizadas) ? c.features_personalizadas : [];
  custom.forEach((f, idx) => {
    lista.push({ slug: 'custom_' + (f.id || idx), nome: f.nome || '(sem nome)', desc: f.desc || '', tipoAcao: detectarTipoAcao(f), custom: true });
  });
  return lista;
}

// ── Busca + filtro por tipo de ação ──
// Estado em módulo (não em charAtivo): preferência da sessão, não é dado
// do personagem. Preservado entre re-renders da própria aba (pip clicado
// não deve resetar o filtro), mas reseta ao recarregar a página.
let _habFiltro = 'todas';
let _habBusca = '';

function semAcentoHab(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function aplicarFiltroHabilidades() {
  const termo = semAcentoHab(_habBusca.trim());
  let visiveis = 0;

  document.querySelectorAll('#hab-wrap .hab-feature, #hab-custom-wrap .hab-feature').forEach(card => {
    const tipoOk = _habFiltro === 'todas' || card.dataset.habTipo === _habFiltro;
    const textoOk = !termo || semAcentoHab(card.textContent).includes(termo);
    const mostrar = tipoOk && textoOk;
    card.hidden = !mostrar;
    if (mostrar) visiveis++;
  });

  // Esconde grupos "Nível N" que ficaram sem nenhuma feature visível
  document.querySelectorAll('#hab-wrap .habilidade-card').forEach(grupo => {
    const temVisivel = !!grupo.querySelector('.hab-feature:not([hidden])');
    grupo.hidden = !temVisivel;
  });

  const semResultados = document.getElementById('hab-sem-resultados');
  if (semResultados) semResultados.hidden = visiveis > 0;
}

function conectarListenersFiltroHabilidades() {
  const busca = document.getElementById('hab-busca');
  if (busca) {
    busca.value = _habBusca;
    busca.addEventListener('input', () => { _habBusca = busca.value; aplicarFiltroHabilidades(); });
  }
  document.querySelectorAll('[data-hab-filtro]').forEach(btn => {
    btn.classList.toggle('ativo', btn.dataset.habFiltro === _habFiltro);
    btn.setAttribute('aria-pressed', String(btn.dataset.habFiltro === _habFiltro));
    btn.addEventListener('click', () => {
      _habFiltro = btn.dataset.habFiltro;
      document.querySelectorAll('[data-hab-filtro]').forEach(b => {
        b.classList.toggle('ativo', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      aplicarFiltroHabilidades();
    });
  });
}

// ── Tracker de usos (§11): pips + "N/M disponíveis" + período visível —
// substitui o antigo "Usos: [pips] N/M [input]" sem rótulo de recuperação. ──
function renderTrackerUsos(max, usos, disp, periodo, dataAttrs) {
  if (max <= 0) return '';
  const pips = Array.from({ length: max }).map((_, i) =>
    `<span class="hab-pip ${i < usos ? 'gasto' : ''}" ${dataAttrs(i)} role="button" tabindex="0" aria-label="Uso ${i+1} de ${max}, ${i < usos ? 'gasto' : 'disponível'}"></span>`
  ).join('');
  return `
    <span class="hab-pips">${pips}</span>
    <span class="hab-disp"><strong>${disp}</strong>/${max} disponíveis</span>
    ${periodo ? `<span class="hab-periodo-badge" title="Recupera em ${escape(periodo)}">↻ ${escape(periodo)}</span>` : ''}
  `;
}

async function popularHabilidades(classe, nivel, subclasse) {
  const wrap = document.getElementById('hab-wrap');
  if (!wrap) return;
  if (!classe) {
    wrap.innerHTML = `<div class="item-vazio">Sem classe definida.</div>`;
    return;
  }
  const db = await carregarHabilidadesClasses();
  if (!db) {
    wrap.innerHTML = `
      <div class="item-vazio" style="text-align:center;padding:20px">
        ${ico('aviso')} Não foi possível carregar as habilidades.
        <button type="button" class="btn no-lock" style="display:block;margin:12px auto 0" onclick="popularHabilidades('${escape(classe)}', ${+nivel||1}, '${escape(subclasse||'')}')">Tentar de novo</button>
      </div>`;
    return;
  }
  const todas = db[chaveDeClasse(classe)] || [];
  // Filtra: nivel <= atual AND (sem subclasse OR subclasse === subclasse do PJ)
  const habs = todas.filter(h => h.nivel <= (nivel || 1) && (!h.subclasse || h.subclasse === subclasse));
  if (!habs.length) {
    wrap.innerHTML = `<div class="item-vazio">Nenhuma habilidade encontrada para ${escape(classe)}.</div>`;
    return;
  }
  // Agrupa por nível
  const porNivel = {};
  for (const h of habs) (porNivel[h.nivel] = porNivel[h.nivel] || []).push(h);
  const recursos = charAtivo.recursos_usados || {};
  const favoritas = new Set(Array.isArray(charAtivo.habilidades_favoritas) ? charAtivo.habilidades_favoritas : []);

  wrap.innerHTML = Object.entries(porNivel).sort(([a],[b]) => +a - +b).map(([nv, lista]) => `
    <div class="habilidade-card">
      <h4>Nível ${nv}</h4>
      ${lista.map(h => {
        const slug = slugFeature(h.nome);
        const detectado = detectarUsosLimitados(h);
        const tipoAcao = detectarTipoAcao(h);
        const r = recursos[slug] || {};
        // max efetivo: o que está salvo > o detectado pelo regex
        const maxSalvo = +r.max || 0;
        const maxDetectado = detectado ? +detectado.max : 0;
        const max = maxSalvo > 0 ? maxSalvo : maxDetectado;
        const usos = Math.min(+r.atual || 0, max);
        const disp = Math.max(0, max - usos);
        const favorita = favoritas.has(slug);
        const ehTracker = !!detectado || maxSalvo > 0;

        const botaoFav = `<button type="button" class="hab-fav-btn ${favorita ? 'ativa' : ''} no-lock" data-hab-fav="${slug}" aria-pressed="${favorita}" aria-label="${favorita ? 'Remover dos favoritos' : 'Favoritar'}" title="${favorita ? 'Remover dos favoritos' : 'Favoritar — aparece no Resumo'}">${favorita ? '★' : '☆'}</button>`;
        const badgeTipo = tipoAcao !== 'passiva' ? `<span class="hab-tipo-badge hab-tipo-${tipoAcao}">${rotuloTipoAcao(tipoAcao)}</span>` : '';

        // SEM tracker: feature passiva (nenhum padrão de uso detectado)
        if (!ehTracker) {
          return `<div class="hab-feature passiva" data-hab-slug="${slug}" data-hab-tipo="${tipoAcao}">
            ${botaoFav}
            ${h.subclasse ? `<span class="hab-sub-tag">${escape(h.subclasse)}</span>` : ''}
            <div class="hab-feature-titulo">
              <strong>${escape(h.nome)}.</strong> ${badgeTipo}
              <span class="hab-desc">${escape(h.desc || '—')}</span>
            </div>
          </div>`;
        }

        // COM tracker: feature usável (limite detectado ou já configurado)
        const periodo = detectado?.periodo || 'descanso';
        return `<div class="hab-feature ativa" data-hab-slug="${slug}" data-hab-tipo="${tipoAcao}">
          ${botaoFav}
          ${h.subclasse ? `<span class="hab-sub-tag">${escape(h.subclasse)}</span>` : ''}
          <div class="hab-feature-head">
            <div class="hab-feature-titulo">
              <strong>${escape(h.nome)}.</strong> ${badgeTipo}
              <span class="hab-desc">${escape(h.desc || '—')}</span>
            </div>
            <div class="hab-tracker">
              ${renderTrackerUsos(max, usos, disp, periodo, i => `data-hab-slug="${slug}" data-hab-idx="${i}"`)}
              <input type="text" inputmode="numeric" class="hab-tracker-max" value="${max}" data-hab-max="${slug}" aria-label="Máximo de usos" title="Ajuste o máximo (a regra padrão é ${detectado?.max || '?'})">
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  `).join('');

  // Favoritar
  wrap.querySelectorAll('[data-hab-fav]').forEach(btn => {
    btn.addEventListener('click', () => {
      alternarHabilidadeFavorita(btn.dataset.habFav);
      popularHabilidades(classe, nivel, subclasse);
    });
  });

  // Listeners dos pips (toggle gasto/disponível) e do max
  const alternarPip = pip => {
    const slug = pip.dataset.habSlug;
    const idx  = +pip.dataset.habIdx;
    const rec  = charAtivo.recursos_usados || {};
    const cur  = rec[slug] || { atual: 0, max: 0 };
    // Click no pip "gasto" → recupera 1; click no pip "disponível" → gasta 1
    cur.atual = pip.classList.contains('gasto') ? idx : idx + 1;
    cur.atual = Math.max(0, Math.min(cur.max, cur.atual));
    rec[slug] = cur;
    charAtivo.recursos_usados = rec;
    salvarRecursosSeguro();
    popularHabilidades(classe, nivel, subclasse);  // re-render
  };
  wrap.querySelectorAll('.hab-pip').forEach(pip => {
    pip.addEventListener('click', () => alternarPip(pip));
    pip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternarPip(pip); } });
  });

  wrap.querySelectorAll('.hab-tracker-max').forEach(inp => {
    inp.addEventListener('change', () => {
      const slug = inp.dataset.habMax;
      const val  = Math.max(0, Math.min(20, parseInt(inp.value, 10) || 0));
      const rec  = charAtivo.recursos_usados || {};
      const cur  = rec[slug] || { atual: 0, max: 0 };
      cur.max = val;
      cur.atual = Math.min(cur.atual, val);
      rec[slug] = cur;
      charAtivo.recursos_usados = rec;
      salvarRecursosSeguro();
      popularHabilidades(classe, nivel, subclasse);
    });
  });

  aplicarFiltroHabilidades();
}

// Salva recursos_usados via UPDATE direto.
// Lança em caso de erro — use salvarRecursosSeguro() pra fire-and-forget.
async function salvarRecursos() {
  if (!charAtivo?.id) return;
  _ultimoSaveLocal = Date.now();
  const { error } = await window.sb.from('characters')
    .update({ recursos_usados: charAtivo.recursos_usados || {} })
    .eq('id', charAtivo.id);
  if (error) {
    console.warn('[recursos] erro ao salvar:', error);
    throw error;
  }
}
// Wrapper pra chamadores fire-and-forget que não querem propagação de erro.
function salvarRecursosSeguro() {
  salvarRecursos().catch(() => {/* já loga no warn acima */});
}

// Salva features_personalizadas via UPDATE direto
async function salvarFeaturesPersonalizadas() {
  if (!charAtivo?.id) return;
  try {
    _ultimoSaveLocal = Date.now();
    await window.sb.from('characters')
      .update({ features_personalizadas: charAtivo.features_personalizadas || [] })
      .eq('id', charAtivo.id);
  } catch (e) { console.warn('[features] erro ao salvar:', e); }
}

// Renderiza a lista de features personalizadas (cards estruturados)
function popularFeaturesPersonalizadas() {
  const wrap = document.getElementById('hab-custom-wrap');
  if (!wrap) return;
  const lista = Array.isArray(charAtivo.features_personalizadas) ? charAtivo.features_personalizadas : [];
  if (!lista.length) {
    wrap.innerHTML = `<div class="item-vazio" style="padding:14px">Nenhuma característica personalizada ainda. Clique <strong>+ Adicionar característica</strong> acima.</div>`;
    aplicarFiltroHabilidades();
    return;
  }
  const recursos = charAtivo.recursos_usados || {};
  const favoritas = new Set(Array.isArray(charAtivo.habilidades_favoritas) ? charAtivo.habilidades_favoritas : []);
  wrap.innerHTML = `<div class="habilidade-card">
    ${lista.map((f, idx) => {
      const slug = 'custom_' + (f.id || idx);
      const max = +f.max || 0;
      const r = recursos[slug] || { atual: 0, max: 0 };
      const maxEfetivo = max > 0 ? max : (+r.max || 0);
      const usos = Math.min(+r.atual || 0, maxEfetivo);
      const disp = Math.max(0, maxEfetivo - usos);
      const tipoAcao = detectarTipoAcao(f);
      const favorita = favoritas.has(slug);
      return `<div class="hab-feature ${maxEfetivo > 0 ? 'ativa' : 'passiva'}" data-cfeat-idx="${idx}" data-hab-tipo="${tipoAcao}">
        <button type="button" class="hab-fav-btn ${favorita ? 'ativa' : ''} no-lock" data-hab-fav="${slug}" aria-pressed="${favorita}" aria-label="${favorita ? 'Remover dos favoritos' : 'Favoritar'}" title="${favorita ? 'Remover dos favoritos' : 'Favoritar — aparece no Resumo'}">${favorita ? '★' : '☆'}</button>
        <button type="button" class="cfeat-remove" data-cfeat-rm="${idx}" title="Remover" aria-label="Remover característica">✕</button>
        <div class="hab-feature-head">
          <div class="hab-feature-titulo">
            <input type="text" class="cfeat-nome" data-cfeat-field="nome" data-cfeat-idx="${idx}" value="${escape(f.nome || '')}" placeholder="Nome da característica" aria-label="Nome">
            <textarea class="cfeat-desc" data-cfeat-field="desc" data-cfeat-idx="${idx}" placeholder="Descrição (opcional)" aria-label="Descrição">${escape(f.desc || '')}</textarea>
          </div>
          <div class="hab-tracker">
            ${renderTrackerUsos(maxEfetivo, usos, disp, null, i => `data-cfeat-slug="${slug}" data-cfeat-idx-pip="${i}"`)}
            <input type="text" inputmode="numeric" class="hab-tracker-max" value="${max}" data-cfeat-max="${idx}" title="Máximo de usos (0 = passiva, sem tracker)" aria-label="Máximo de usos">
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  // Favoritar
  wrap.querySelectorAll('[data-hab-fav]').forEach(btn => {
    btn.addEventListener('click', () => {
      alternarHabilidadeFavorita(btn.dataset.habFav);
      popularFeaturesPersonalizadas();
    });
  });

  // Pip click → toggle gasto
  const alternarPipCustom = pip => {
    const slug = pip.dataset.cfeatSlug;
    const idx  = +pip.dataset.cfeatIdxPip;
    const rec  = charAtivo.recursos_usados || {};
    const featList = charAtivo.features_personalizadas || [];
    const featIdx = featList.findIndex((f, i) => 'custom_' + (f.id || i) === slug);
    const max = featIdx >= 0 ? (+featList[featIdx].max || 0) : 0;
    const cur = rec[slug] || { atual: 0, max };
    cur.max = max;
    cur.atual = pip.classList.contains('gasto') ? idx : (idx + 1);
    cur.atual = Math.max(0, Math.min(max, cur.atual));
    rec[slug] = cur;
    charAtivo.recursos_usados = rec;
    salvarRecursosSeguro();
    popularFeaturesPersonalizadas();
  };
  wrap.querySelectorAll('.hab-pip[data-cfeat-slug]').forEach(pip => {
    pip.addEventListener('click', () => alternarPipCustom(pip));
    pip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternarPipCustom(pip); } });
  });

  // Nome / desc / max — salva no estado
  wrap.querySelectorAll('[data-cfeat-field]').forEach(el => {
    el.addEventListener('input', () => {
      const idx = +el.dataset.cfeatIdx;
      const field = el.dataset.cfeatField;
      if (!charAtivo.features_personalizadas[idx]) return;
      charAtivo.features_personalizadas[idx][field] = el.value;
      salvarFeaturesPersonalizadas();
    });
  });

  wrap.querySelectorAll('.hab-tracker-max[data-cfeat-max]').forEach(inp => {
    inp.addEventListener('change', () => {
      const idx = +inp.dataset.cfeatMax;
      const val = Math.max(0, Math.min(20, parseInt(inp.value, 10) || 0));
      if (!charAtivo.features_personalizadas[idx]) return;
      charAtivo.features_personalizadas[idx].max = val;
      // Ajusta recursos_usados também
      const f = charAtivo.features_personalizadas[idx];
      const slug = 'custom_' + (f.id || idx);
      const rec = charAtivo.recursos_usados || {};
      const cur = rec[slug] || { atual: 0, max: 0 };
      cur.max = val;
      cur.atual = Math.min(cur.atual, val);
      rec[slug] = cur;
      charAtivo.recursos_usados = rec;
      salvarFeaturesPersonalizadas();
      salvarRecursosSeguro();
      popularFeaturesPersonalizadas();
    });
  });

  // Remover
  wrap.querySelectorAll('[data-cfeat-rm]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = +btn.dataset.cfeatRm;
      const cf = window.Confirmar
        ? await Confirmar.perguntar({ titulo: 'Remover característica?', mensagem: 'Esta ação não pode ser desfeita.', confirmar: 'Remover', danger: true })
        : confirm('Remover esta característica?');
      if (!cf) return;
      const f = charAtivo.features_personalizadas[idx];
      if (f) {
        const slug = 'custom_' + (f.id || idx);
        const rec = charAtivo.recursos_usados || {};
        delete rec[slug];
        charAtivo.recursos_usados = rec;
        if (Array.isArray(charAtivo.habilidades_favoritas)) {
          charAtivo.habilidades_favoritas = charAtivo.habilidades_favoritas.filter(s => s !== slug);
          salvarHabilidadesFavoritas();
        }
      }
      charAtivo.features_personalizadas.splice(idx, 1);
      salvarFeaturesPersonalizadas();
      salvarRecursosSeguro();
      popularFeaturesPersonalizadas();
    });
  });

  aplicarFiltroHabilidades();
}

function adicionarFeaturePersonalizada() {
  if (!Array.isArray(charAtivo.features_personalizadas)) charAtivo.features_personalizadas = [];
  const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  charAtivo.features_personalizadas.push({ id, nome: '', desc: '', max: 0 });
  salvarFeaturesPersonalizadas();
  popularFeaturesPersonalizadas();
  // Foca o input do nome novo
  setTimeout(() => {
    const wrap = document.getElementById('hab-custom-wrap');
    const inputs = wrap?.querySelectorAll('.cfeat-nome');
    if (inputs?.length) inputs[inputs.length - 1].focus();
  }, 50);
}

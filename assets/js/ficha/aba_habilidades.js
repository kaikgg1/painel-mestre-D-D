// assets/js/ficha/aba_habilidades.js
// Aba Habilidades: features fixas por classe×nível (data/habilidades_classes.json),
// detecção de usos limitados por regex sobre o texto da feature, e as
// características personalizadas (characters.features_personalizadas).

function renderHabilidades(c) {
  return `
    <div id="recursos-classe-wrap"></div>

    <h3>Habilidades de Classe</h3>
    <p style="color:var(--text-dim);font-style:italic;font-size:12px;margin-bottom:14px">
      Preenchido automaticamente com base na classe e nível.
      ${c.subclasse ? `Subclasse: <strong>${escape(c.subclasse)}</strong>` : 'Defina sua subclasse na aba <em>Identidade</em>.'}
    </p>
    <div id="hab-wrap">Carregando…</div>

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

  wrap.innerHTML = Object.entries(porNivel).sort(([a],[b]) => +a - +b).map(([nv, lista]) => `
    <div class="habilidade-card">
      <h4>Nível ${nv}</h4>
      ${lista.map(h => {
        const slug = slugFeature(h.nome);
        const detectado = detectarUsosLimitados(h);
        const r = recursos[slug] || {};
        // max efetivo: o que está salvo > o detectado pelo regex
        const maxSalvo = +r.max || 0;
        const maxDetectado = detectado ? +detectado.max : 0;
        const max = maxSalvo > 0 ? maxSalvo : maxDetectado;
        const usos = Math.min(+r.atual || 0, max);
        const disp = Math.max(0, max - usos);

        // SEM tracker: feature passiva (nenhum padrão de uso detectado)
        if (!detectado && maxSalvo === 0) {
          return `<div class="hab-feature passiva" data-hab-slug="${slug}">
            ${h.subclasse ? `<span class="hab-sub-tag">${escape(h.subclasse)}</span>` : ''}
            <div class="hab-feature-titulo">
              <strong>${escape(h.nome)}.</strong>
              <span class="hab-desc">${escape(h.desc || '—')}</span>
            </div>
          </div>`;
        }

        // COM tracker: feature usável (limite detectado ou já configurado)
        const periodo = detectado?.periodo || 'descanso';
        const pips = max > 0 ? Array.from({length: max}).map((_, i) =>
          `<button type="button" class="hab-pip ${i < usos ? 'gasto' : ''}" data-hab-slug="${slug}" data-hab-idx="${i}" aria-label="Uso ${i+1} ${i < usos ? 'gasto' : 'disponível'}"></button>`
        ).join('') : '';
        return `<div class="hab-feature ativa" data-hab-slug="${slug}">
          ${h.subclasse ? `<span class="hab-sub-tag">${escape(h.subclasse)}</span>` : ''}
          <div class="hab-feature-head">
            <div class="hab-feature-titulo">
              <strong>${escape(h.nome)}.</strong>
              <span class="hab-desc">${escape(h.desc || '—')}</span>
            </div>
            <div class="hab-tracker" title="Recupera em ${escape(periodo)}">
              <label class="hab-tracker-lbl">Usos:</label>
              ${max > 0 ? `
                <span class="hab-pips">${pips}</span>
                <span class="hab-disp"><strong>${disp}</strong>/${max}</span>
              ` : ''}
              <input type="text" inputmode="numeric" class="hab-tracker-max" value="${max}" data-hab-max="${slug}" aria-label="Máximo de usos" title="Ajuste o máximo (a regra padrão é ${detectado?.max || '?'})">
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  `).join('');

  // Listeners dos pips (toggle gasto/disponível) e do max
  wrap.querySelectorAll('.hab-pip').forEach(pip => {
    pip.addEventListener('click', () => {
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
    });
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
    return;
  }
  const recursos = charAtivo.recursos_usados || {};
  wrap.innerHTML = `<div class="habilidade-card">
    ${lista.map((f, idx) => {
      const slug = 'custom_' + (f.id || idx);
      const max = +f.max || 0;
      const r = recursos[slug] || { atual: 0, max: 0 };
      const maxEfetivo = max > 0 ? max : (+r.max || 0);
      const usos = Math.min(+r.atual || 0, maxEfetivo);
      const disp = Math.max(0, maxEfetivo - usos);
      const pips = maxEfetivo > 0 ? Array.from({length: maxEfetivo}).map((_, i) =>
        `<button type="button" class="hab-pip ${i < usos ? 'gasto' : ''}" data-cfeat-slug="${slug}" data-cfeat-idx="${i}" aria-label="Uso ${i+1}"></button>`
      ).join('') : '';
      return `<div class="hab-feature ${maxEfetivo > 0 ? 'ativa' : 'passiva'}" data-cfeat-idx="${idx}">
        <button type="button" class="cfeat-remove" data-cfeat-rm="${idx}" title="Remover" aria-label="Remover característica">✕</button>
        <div class="hab-feature-head">
          <div class="hab-feature-titulo">
            <input type="text" class="cfeat-nome" data-cfeat-field="nome" data-cfeat-idx="${idx}" value="${escape(f.nome || '')}" placeholder="Nome da característica" aria-label="Nome">
            <textarea class="cfeat-desc" data-cfeat-field="desc" data-cfeat-idx="${idx}" placeholder="Descrição (opcional)" aria-label="Descrição">${escape(f.desc || '')}</textarea>
          </div>
          <div class="hab-tracker">
            <label class="hab-tracker-lbl">Usos:</label>
            ${maxEfetivo > 0 ? `
              <span class="hab-pips">${pips}</span>
              <span class="hab-disp"><strong>${disp}</strong>/${maxEfetivo}</span>
            ` : ''}
            <input type="text" inputmode="numeric" class="hab-tracker-max" value="${max}" data-cfeat-max="${idx}" title="Máximo de usos (0 = passiva, sem tracker)" aria-label="Máximo de usos">
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  // Pip click → toggle gasto
  wrap.querySelectorAll('.hab-pip[data-cfeat-slug]').forEach(pip => {
    pip.addEventListener('click', () => {
      const slug = pip.dataset.cfeatSlug;
      const idx  = +pip.dataset.cfeatIdx;
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
    });
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
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.cfeatRm;
      if (!confirm('Remover esta característica?')) return;
      const f = charAtivo.features_personalizadas[idx];
      if (f) {
        const slug = 'custom_' + (f.id || idx);
        const rec = charAtivo.recursos_usados || {};
        delete rec[slug];
        charAtivo.recursos_usados = rec;
      }
      charAtivo.features_personalizadas.splice(idx, 1);
      salvarFeaturesPersonalizadas();
      salvarRecursosSeguro();
      popularFeaturesPersonalizadas();
    });
  });
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


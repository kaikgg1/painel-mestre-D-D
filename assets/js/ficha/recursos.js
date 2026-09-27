// assets/js/ficha/recursos.js
// Recursos de classe (trackers de pips/pool) e o conversor Pontos ⇄ Slots do
// Feiticeiro. O catálogo em si vive em assets/js/recursos_classe.js, que é
// compartilhado com o painel do Mestre. Persiste em characters.recursos_usados.

/* ============================================================
   RECURSOS DE CLASSE — trackers por classe × nível
   Catálogo vive em assets/js/recursos_classe.js (compartilhado com o
   painel do Mestre, pra mostrarem exatamente os mesmos recursos).
   Pips clicáveis salvam em charAtivo.recursos_usados (mesma tabela
   usada pelas features auto-detectadas).
   ============================================================ */
function recursosPara(c, atrs) {
  return window.RecursosClasse ? window.RecursosClasse.recursosPara(c, atrs) : [];
}

function renderRecursosClasse(c) {
  const wrap = document.getElementById('recursos-classe-wrap');
  if (!wrap) return;
  const recursos = recursosPara(c, atributosEfetivos(c));
  if (!recursos.length) { wrap.innerHTML = ''; return; }

  const usados = c.recursos_usados || {};
  const ehFeit = chaveDeClasse(c.classe) === 'feiticeiro';

  const cards = recursos.map(r => {
    const usado = Math.min(r.max, usados[r.id] || 0);
    const livre = r.max - usado;
    const passo = r.step || 1;
    // Pool grande (>10) usa input numérico; senão pips visuais
    const usaPool = r.max > 12;
    const corpoTracker = usaPool
      ? `<div class="rc-pool">
           <button type="button" class="rc-pool-btn no-lock" data-act="menos" data-rc="${escape(r.id)}" data-rc-step="${passo}" aria-label="Usar 1">−</button>
           <button type="button" class="rc-pool-btn rc-pool-btn-big no-lock" data-act="menos" data-rc="${escape(r.id)}" data-rc-step="5" aria-label="Usar 5">−5</button>
           <div class="rc-pool-display"><strong class="rc-pool-livre">${livre}</strong><span class="rc-pool-sep">/</span><span class="rc-pool-max">${r.max}</span></div>
           <button type="button" class="rc-pool-btn rc-pool-btn-big no-lock" data-act="mais" data-rc="${escape(r.id)}" data-rc-step="5" aria-label="Recuperar 5">+5</button>
           <button type="button" class="rc-pool-btn no-lock" data-act="mais" data-rc="${escape(r.id)}" data-rc-step="${passo}" aria-label="Recuperar 1">+</button>
         </div>`
      : `<div class="rc-pips" data-rc="${escape(r.id)}" data-rc-max="${r.max}">
           ${Array.from({length: r.max}, (_, i) =>
             `<span class="rc-pip ${i < usado ? 'gasto' : ''}" data-rc-idx="${i}" role="button" tabindex="0" aria-label="Uso ${i+1} de ${r.max}"></span>`
           ).join('')}
           <span class="rc-frac"><strong>${livre}</strong>/${r.max}</span>
         </div>`;

    return `
      <div class="rc-card" data-rc-card="${escape(r.id)}">
        <div class="rc-head">
          <span class="rc-icone" aria-hidden="true">${r.icone || '●'}</span>
          <div class="rc-titulo-wrap">
            <div class="rc-nome">${escape(r.nome)}</div>
            <div class="rc-periodo">↻ ${escape(r.periodo || '')}</div>
          </div>
          <button type="button" class="rc-reset no-lock" data-rc-reset="${escape(r.id)}" title="Recuperar tudo" aria-label="Recuperar todos os usos">⟲</button>
        </div>
        ${corpoTracker}
        ${r.dica ? `<div class="rc-dica">${escape(r.dica)}</div>` : ''}
      </div>`;
  }).join('');

  const cabec = `
    <div class="rc-cabecalho">
      <h3 style="margin:0">Recursos de ${escape(c.classe || 'Classe')} <span class="rc-nv">N${+c.nivel || 1}</span></h3>
    </div>`;

  wrap.innerHTML = `
    <div class="rc-painel">
      ${cabec}
      <div class="rc-grid">${cards}</div>
    </div>`;

  ligarListenersRecursos();
  if (ehFeit && window.FeiticeiroUI) wrap.querySelector('.rc-painel').appendChild(blocoFeiticeiroFicha(c));
}

// Fonte de Magia + Metamágica (assets/js/feiticeiro_ui.js — o mesmo bloco dos
// painéis do Mestre). Cada campo tem save próprio, fora do autosave do form.
function blocoFeiticeiroFicha(c) {
  if (!c.recursos_usados || typeof c.recursos_usados !== 'object') c.recursos_usados = {};
  if (!c.slots_magia) c.slots_magia = {};
  return window.FeiticeiroUI.bloco({
    nivel: c.nivel,
    getRec: () => charAtivo.recursos_usados,
    getSlots: () => charAtivo.slots_magia,
    getMetamagias: () => charAtivo.metamagias || [],
    salvarRecursos: patch => {
      _ultimoSaveLocal = Date.now();
      window.RecursosClasse.gravarRecursosUsados(charAtivo.id, patch)
        .catch(e => { console.warn('[feiticeiro] recursos:', e); toast('Falha ao salvar — tente novamente', 'aviso'); });
    },
    salvarSlots: async () => {
      _ultimoSaveLocal = Date.now();
      const { error } = await window.sb.from('characters').update({ slots_magia: charAtivo.slots_magia }).eq('id', charAtivo.id);
      if (error) { console.warn('[feiticeiro] slots:', error); toast('Falha ao salvar espaços — tente novamente', 'aviso'); }
    },
    salvarMetamagias: async arr => {
      charAtivo.metamagias = arr;
      _ultimoSaveLocal = Date.now();
      const { error } = await window.sb.from('characters').update({ metamagias: arr }).eq('id', charAtivo.id);
      if (error) { console.warn('[feiticeiro] metamágica:', error); toast('Falha ao salvar Metamágica', 'aviso'); }
    },
    atualizar: () => {
      const aba = document.querySelector('.tab.ativa')?.dataset.tab;
      if (aba === 'combate' || aba === 'magias') render();
      else renderRecursosClasse(charAtivo);
    },
    avisar: msg => toast(msg),
  });
}

// Event delegation: 1 listener no painel inteiro, em vez de N listeners individuais.
// Evita memory leak quando renderRecursosClasse é chamada muitas vezes (realtime updates).
function ligarListenersRecursos() {
  const painel = document.querySelector('.rc-painel');
  if (!painel) return;
  if (painel.dataset.rcWired === '1') return;  // idempotente
  painel.dataset.rcWired = '1';

  painel.addEventListener('click', e => {
    const pip = e.target.closest('.rc-pip');
    if (pip) { alternarPipRecurso(pip); return; }

    const poolBtn = e.target.closest('.rc-pool-btn');
    if (poolBtn) {
      const id = poolBtn.dataset.rc;
      const passo = +poolBtn.dataset.rcStep || 1;
      const delta = poolBtn.dataset.act === 'menos' ? +passo : -passo;
      ajustarRecurso(id, delta);
      return;
    }

    const reset = e.target.closest('.rc-reset');
    if (reset) {
      const id = reset.dataset.rcReset;
      if (!charAtivo) return;
      const rec = charAtivo.recursos_usados || {};
      gravarUsadoRecurso(rec, id, 0);
      charAtivo.recursos_usados = rec;
      renderRecursosClasse(charAtivo);
      salvarRecursosSeguro();
      return;
    }
  });

  // Acessibilidade: Enter/Espaço nos pips
  painel.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const pip = e.target.closest('.rc-pip');
    if (!pip) return;
    e.preventDefault();
    alternarPipRecurso(pip);
  });
}

// Lock por recurso — bloqueia cliques múltiplos durante o salvamento
// (evita race entre alternarPipRecurso → realtime → ajustarRecurso)
const _lockRecurso = new Set();

// Lê/grava o valor "usado" de um recurso, lidando com os 2 formatos
// (number bruto OU objeto {atual, max} pras features personalizadas) —
// lógica compartilhada com o painel do Mestre via recursos_classe.js.
function lerUsadoRecurso(rec, id) {
  return window.RecursosClasse ? window.RecursosClasse.lerUsado(rec, id) : 0;
}
function gravarUsadoRecurso(rec, id, novoUsado) {
  if (window.RecursosClasse) window.RecursosClasse.gravarUsado(rec, id, novoUsado);
}

async function alternarPipRecurso(pip) {
  const grupo = pip.closest('.rc-pips');
  const id = grupo.dataset.rc;
  if (_lockRecurso.has(id)) return;  // já tem um save em voo
  const max = +grupo.dataset.rcMax;
  const idx = +pip.dataset.rcIdx;
  const pips = [...grupo.querySelectorAll('.rc-pip')];
  const eraGasto = pip.classList.contains('gasto');
  const novoGastos = Math.max(0, Math.min(max, eraGasto ? idx : idx + 1));
  if (!charAtivo) return;

  // Snapshot pra rollback se o save falhar
  const rec = charAtivo.recursos_usados || {};
  const antes = lerUsadoRecurso(rec, id);

  // Otimismo: atualiza UI imediato
  gravarUsadoRecurso(rec, id, novoGastos);
  charAtivo.recursos_usados = rec;
  pips.forEach((p, i) => p.classList.toggle('gasto', i < novoGastos));
  if (window.FX) FX.slot(pip);
  const frac = grupo.querySelector('.rc-frac');
  if (frac) frac.innerHTML = `<strong>${max - novoGastos}</strong>/${max}`;

  _lockRecurso.add(id);
  try {
    await salvarRecursos();
  } catch (e) {
    // Rollback
    gravarUsadoRecurso(rec, id, antes);
    charAtivo.recursos_usados = rec;
    pips.forEach((p, i) => p.classList.toggle('gasto', i < antes));
    if (frac) frac.innerHTML = `<strong>${max - antes}</strong>/${max}`;
    if (typeof toast === 'function') toast('Falha ao salvar — tente novamente', 'aviso');
    console.warn('[recursos] rollback:', e);
  } finally {
    _lockRecurso.delete(id);
  }
}

async function ajustarRecurso(id, delta) {
  if (!charAtivo) return;
  if (_lockRecurso.has(id)) return;
  const recs = recursosPara(charAtivo, atributosEfetivos(charAtivo));
  const def = recs.find(r => r.id === id);
  if (!def) return;

  const rec = charAtivo.recursos_usados || {};
  const antes = lerUsadoRecurso(rec, id);
  const novo = Math.max(0, Math.min(def.max, antes + delta));
  if (novo === antes) return;  // sem mudança

  gravarUsadoRecurso(rec, id, novo);
  charAtivo.recursos_usados = rec;

  // Atualiza display do card desse recurso (sem re-render geral pra evitar flicker)
  const card = document.querySelector(`[data-rc-card="${CSS.escape(id)}"]`);
  if (card) {
    const livre = def.max - novo;
    const lEl = card.querySelector('.rc-pool-livre');
    if (lEl) lEl.textContent = livre;
    const frac = card.querySelector('.rc-frac');
    if (frac) frac.innerHTML = `<strong>${livre}</strong>/${def.max}`;
    const grupo = card.querySelector('.rc-pips');
    if (grupo) {
      grupo.querySelectorAll('.rc-pip').forEach((p, i) => p.classList.toggle('gasto', i < novo));
    }
  }

  _lockRecurso.add(id);
  try {
    await salvarRecursos();
  } catch (e) {
    gravarUsadoRecurso(rec, id, antes);
    charAtivo.recursos_usados = rec;
    if (card) {
      const livre = def.max - antes;
      const lEl = card.querySelector('.rc-pool-livre');
      if (lEl) lEl.textContent = livre;
      const frac = card.querySelector('.rc-frac');
      if (frac) frac.innerHTML = `<strong>${livre}</strong>/${def.max}`;
      const grupo = card.querySelector('.rc-pips');
      if (grupo) {
        grupo.querySelectorAll('.rc-pip').forEach((p, i) => p.classList.toggle('gasto', i < antes));
      }
    }
    if (typeof toast === 'function') toast('Falha ao salvar — tente novamente', 'aviso');
    console.warn('[recursos] rollback:', e);
  } finally {
    _lockRecurso.delete(id);
  }
}

/* ============================================================
   DESCANSO CURTO / LONGO — aplica a regra do PHB em lote, em vez de
   o jogador ter que clicar em cada pip de cada slot/recurso um por um.

   Curto: reseta slots de Magia do Pacto (Bruxo) + recursos/habilidades
   cujo período detectado contém "curto".
   Longo: reseta TODOS os slots de magia + todos os recursos/habilidades
   marcados por descanso (curto OU longo — descanso longo recupera tudo
   que um curto recupera, e mais), restaura PV ao máximo e recupera
   metade dos Dados de Vida (mínimo 1), arredondado pra baixo — regra
   do PHB 2014. NÃO mexe em exaustão: no PHB 2014 (a base usada nesta
   ficha, ver assets/js/exaustao_regras.js) um descanso longo comum não
   reduz exaustão — isso exige magia ou repouso prolongado específico,
   não é automático.
   ============================================================ */
async function aplicarDescanso(tipo) {
  if (!charAtivo?.id) return;
  const longo = tipo === 'longo';
  const rec = Object.assign({}, charAtivo.recursos_usados || {});

  // 1) Recursos de classe (RecursosClasse) — período já estruturado.
  for (const r of recursosPara(charAtivo, atributosEfetivos(charAtivo))) {
    const curto = /curto/i.test(r.periodo || '');
    if (longo || curto) gravarUsadoRecurso(rec, r.id, 0);
  }

  // 2) Habilidades de classe com tracker de uso auto-detectado (mesma
  // detecção usada em popularHabilidades, aba_habilidades.js).
  if (charAtivo.classe && typeof carregarHabilidadesClasses === 'function') {
    const db = await carregarHabilidadesClasses();
    const todas = (db && db[chaveDeClasse(charAtivo.classe)]) || [];
    const habs = todas.filter(h => h.nivel <= (charAtivo.nivel || 1) && (!h.subclasse || h.subclasse === charAtivo.subclasse));
    for (const h of habs) {
      const detectado = typeof detectarUsosLimitados === 'function' ? detectarUsosLimitados(h) : null;
      if (!detectado) continue;
      const periodoTxt = detectado.periodo || '';
      if (/turno/i.test(periodoTxt)) continue;  // não recupera com descanso
      const curto = /curto/i.test(periodoTxt);
      if (!longo && !curto) continue;
      const slug = slugFeature(h.nome);
      const cur = rec[slug] || { atual: 0, max: detectado.max };
      rec[slug] = Object.assign({}, cur, { atual: 0 });
    }
  }

  // 3) Slots de magia — descanso curto só recupera Magia do Pacto (Bruxo);
  // descanso longo recupera todos os níveis.
  const sm = Object.assign({}, charAtivo.slots_magia || {});
  const tipoSlot = (window.SlotsPHB && charAtivo.classe)
    ? window.SlotsPHB.tipoDaClasse(charAtivo.classe, charAtivo.subclasse) : null;
  for (const lvl of Object.keys(sm)) {
    if (longo || tipoSlot === 'pact') sm[lvl] = Object.assign({}, sm[lvl], { atual: 0 });
  }
  // Espaços criados com pontos de feitiçaria somem no descanso longo (PHB).
  if (longo) window.RecursosClasse?.limparSlotsExtras(sm, rec);

  const payload = { slots_magia: sm };
  let msg = longo ? 'Descanso longo aplicado' : 'Descanso curto aplicado';

  if (longo) {
    const hpMax = charAtivo.hp_max ?? charAtivo.hp_atual ?? 0;
    payload.hp_atual = hpMax;
    const totalDados = Math.max(1, nivelTotalPersonagem(charAtivo));
    const recuperar = Math.max(1, Math.floor(totalDados / 2));
    payload.dado_vida_atual = Math.min(totalDados, (+charAtivo.dado_vida_atual || 0) + recuperar);
    msg += ` — PV restaurado, +${recuperar} dado${recuperar > 1 ? 's' : ''} de vida recuperado${recuperar > 1 ? 's' : ''}`;
  }

  Object.assign(charAtivo, payload);
  charAtivo.recursos_usados = rec;
  _ultimoSaveLocal = Date.now();
  // recursos_usados vai pela RPC de merge (sql/031) — atômica, sem apagar
  // chaves que só existam no banco; os outros campos (slots, PV, dado de
  // vida) vão juntos no update comum, já que descanso É pra zerá-los de
  // vez, não tem outro cliente concorrendo por ESSES campos aqui.
  const [rMesclar, rUpdate] = await Promise.all([
    window.RecursosClasse.gravarRecursosUsados(charAtivo.id, rec).then(() => null).catch(e => e),
    window.sb.from('characters').update(payload).eq('id', charAtivo.id).then(({ error }) => error || null),
  ]);
  if (rMesclar || rUpdate) {
    console.warn('[descanso] erro ao salvar:', rMesclar || rUpdate);
    toast('⚠ Erro ao aplicar descanso — tente de novo');
    return;
  }
  render();
  toast(msg);
}


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
  const recursos = recursosPara(c, c.atributos);
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
      ${ehFeit ? `<button type="button" class="btn no-lock" id="btn-fei-converter" title="Converter pontos ⇄ slots">⇄ Converter</button>` : ''}
    </div>`;

  wrap.innerHTML = `
    <div class="rc-painel">
      ${cabec}
      <div class="rc-grid">${cards}</div>
    </div>`;

  ligarListenersRecursos();
  if (ehFeit) ligarConversorFeiticaria();
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
  const recs = recursosPara(charAtivo, charAtivo.atributos);
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

/* ===== FEITICEIRO: Conversor Pontos ⇄ Slots ===== */
function ligarConversorFeiticaria() {
  const btn = document.getElementById('btn-fei-converter');
  if (!btn) return;
  btn.addEventListener('click', abrirModalConversorFeit);
}

// Custos PHB para criar slot via pontos de feitiçaria
const CUSTO_SLOT_DE_PONTOS = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 };

function abrirModalConversorFeit() {
  if (!charAtivo) return;
  const nv = +charAtivo.nivel || 1;
  const recs = recursosPara(charAtivo, charAtivo.atributos);
  const ptDef = recs.find(r => r.id === 'pontos_feiticaria');
  if (!ptDef) return;
  const ptUsados = (charAtivo.recursos_usados || {}).pontos_feiticaria || 0;
  const ptLivres = ptDef.max - ptUsados;

  // Quais slots o feiticeiro pode criar? (PHB: até 5° nível)
  const slotsMagia = charAtivo.slots_magia || {};
  let opcoes = '';
  for (let lvl = 1; lvl <= 5; lvl++) {
    const custo = CUSTO_SLOT_DE_PONTOS[lvl];
    const podePagar = ptLivres >= custo;
    opcoes += `
      <button type="button" class="fei-opt ${podePagar ? '' : 'desabilitada'}"
              data-fei-criar="${lvl}" ${podePagar ? '' : 'disabled'}>
        <span class="fei-opt-lvl">Slot ${lvl}°</span>
        <span class="fei-opt-custo">${custo} pt</span>
      </button>`;
  }

  // Quais slots pode converter EM pontos? (PHB: 1 slot de nível X = X pontos)
  let conversaoVolta = '';
  for (let lvl = 1; lvl <= 9; lvl++) {
    const s = slotsMagia[lvl];
    if (!s) continue;
    const livres = (s.max || 0) - (s.atual || 0);
    if (livres <= 0) continue;
    conversaoVolta += `
      <button type="button" class="fei-opt" data-fei-quebrar="${lvl}">
        <span class="fei-opt-lvl">Slot ${lvl}°</span>
        <span class="fei-opt-custo">→ ${lvl} pt</span>
      </button>`;
  }
  if (!conversaoVolta) conversaoVolta = '<div class="fei-vazio">Nenhum slot disponível para converter.</div>';

  const overlay = document.createElement('div');
  overlay.className = 'fei-overlay';
  overlay.innerHTML = `
    <div class="fei-modal" role="dialog" aria-modal="true" aria-labelledby="fei-titulo">
      <button class="fei-close" type="button" aria-label="Fechar">✕</button>
      <div class="fei-titulo" id="fei-titulo">⇄ Fonte de Magia</div>
      <div class="fei-status">Pontos de Feitiçaria: <strong>${ptLivres}</strong> / ${ptDef.max}</div>
      <div class="fei-sec">
        <div class="fei-sec-titulo">Criar slot (gasta pontos)</div>
        <div class="fei-grid">${opcoes}</div>
      </div>
      <div class="fei-sec">
        <div class="fei-sec-titulo">Quebrar slot em pontos</div>
        <div class="fei-grid">${conversaoVolta}</div>
      </div>
      <div class="fei-rodape">PHB: 1 slot 1°=2 · 2°=3 · 3°=5 · 4°=6 · 5°=7. Sem conversão acima do 5° nível.</div>
    </div>`;
  document.body.appendChild(overlay);

  const fechar = () => overlay.remove();
  overlay.querySelector('.fei-close').onclick = fechar;
  overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });

  // Criar slot
  overlay.querySelectorAll('[data-fei-criar]').forEach(b => {
    b.onclick = () => {
      const lvl = +b.dataset.feiCriar;
      const custo = CUSTO_SLOT_DE_PONTOS[lvl];
      const rec = charAtivo.recursos_usados || {};
      const usados = rec.pontos_feiticaria || 0;
      if (ptDef.max - usados < custo) return;
      // Garante que existe entry de slot desse nível
      const sm = charAtivo.slots_magia || {};
      if (!sm[lvl]) sm[lvl] = { max: 0, atual: 0 };
      sm[lvl].max = Math.max(sm[lvl].max, 1);
      sm[lvl].atual = Math.max(0, (sm[lvl].atual || 0) - 1);
      // "atual" é o nº de slots GASTOS (mesmo campo lido em aba_combate.js/aba_magias.js).
      // Criar um slot novo disponível: se atual > 0, decrementa (havia slot gasto pra "reaproveitar");
      // senão aumenta max (slot extra de verdade).
      charAtivo.slots_magia = sm;
      rec.pontos_feiticaria = usados + custo;
      charAtivo.recursos_usados = rec;
      toast(`✓ Slot de nível ${lvl} criado (-${custo} pt)`);
      salvarRecursosSeguro();
      // Salva slots_magia direto
      window.sb.from('characters').update({ slots_magia: charAtivo.slots_magia }).eq('id', charAtivo.id);
      fechar();
      renderRecursosClasse(charAtivo);
      // Re-render aba Combate se aberta (slots aparecem lá)
      const tabAtual = document.querySelector('.tab.ativa')?.dataset.tab;
      if (tabAtual === 'combate') render();
    };
  });

  // Quebrar slot
  overlay.querySelectorAll('[data-fei-quebrar]').forEach(b => {
    b.onclick = () => {
      const lvl = +b.dataset.feiQuebrar;
      const sm = charAtivo.slots_magia || {};
      if (!sm[lvl] || (sm[lvl].max - (sm[lvl].atual || 0)) <= 0) return;
      sm[lvl].atual = (sm[lvl].atual || 0) + 1;
      const rec = charAtivo.recursos_usados || {};
      const usados = rec.pontos_feiticaria || 0;
      rec.pontos_feiticaria = Math.max(0, usados - lvl);
      charAtivo.slots_magia = sm;
      charAtivo.recursos_usados = rec;
      toast(`✓ Slot ${lvl}° → +${lvl} pt`);
      salvarRecursosSeguro();
      window.sb.from('characters').update({ slots_magia: charAtivo.slots_magia }).eq('id', charAtivo.id);
      fechar();
      renderRecursosClasse(charAtivo);
      const tabAtual = document.querySelector('.tab.ativa')?.dataset.tab;
      if (tabAtual === 'combate') render();
    };
  });
}


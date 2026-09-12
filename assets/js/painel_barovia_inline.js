const PERSONAGENS_INICIAIS = [
  { jogador: 'Jogador 1', nome: 'Aragorn', raca: 'Humano', classe: 'Guerreiro', nivel: 5, hpAtual: 42, hpMax: 47, ca: 18 },
  { jogador: 'Jogador 2', nome: 'Lúthien', raca: 'Elfo', classe: 'Mago', nivel: 5, hpAtual: 25, hpMax: 28, ca: 13 },
  { jogador: 'Jogador 3', nome: 'Thorin', raca: 'Anão', classe: 'Clérigo', nivel: 5, hpAtual: 38, hpMax: 40, ca: 18 },
  { jogador: 'Jogador 4', nome: 'Pippin', raca: 'Halfling', classe: 'Ladino', nivel: 5, hpAtual: 30, hpMax: 33, ca: 15 }
];

// Ícone vetorial inline (assets/js/icones.js); vazio se o módulo não carregou.
const ico = (k, o) => (window.Icones ? window.Icones.html(k, o) : '');

const CAMPANHA = 'barovia';
let estado = { personagens: [] };
let ehMestre = false;

function salvar(p) {
  if (!window.DBSync) return;
  if (p && p.id) {
    marcarEcoLocal(p.id);
    window.DBSync.salvarCampo(p.id, p);
    renderPartyBar();
    return;
  }
  for (const x of estado.personagens) {
    if (x.id) {
      marcarEcoLocal(x.id);
      window.DBSync.salvarCampo(x.id, x);
    }
  }
  renderPartyBar();
}

function carregar() { return estado; }

function criarPersonagem(base = {}) {
  return {
    id: Date.now() + Math.random(),
    jogador: base.jogador || 'Nome do Jogador',
    nome: base.nome || 'Personagem',
    raca: base.raca || 'Raça',
    classe: base.classe || 'Classe',
    nivel: base.nivel || 1,
    hpAtual: base.hpAtual ?? 10,
    hpMax: base.hpMax ?? 10,
    hpTemp: base.hpTemp ?? 0,
    ca: base.ca || 10,
    iniciativa_bonus: base.iniciativa_bonus ?? 0,
    deslocamento: base.deslocamento ?? 9,
    percepcaoPassiva: base.percepcaoPassiva ?? 10,
    atributos: base.atributos || { for:10, dex:10, con:10, int:10, sab:10, car:10 },
    inspiracao: 0,
    exaustao: 0,
    sucessos: 0,
    falhas: 0,
    concentracao: base.concentracao || { ativa: false, magia: '' },
    // cd_resistencia/bonus_atq_magia: mesma coluna que a ficha do jogador
    // usa (assets/js/ficha/aba_combate.js) — antes lia spell_dc/spell_atk,
    // uma coluna paralela nunca preenchida pelo jogador, por isso aparecia
    // "—" pra quase todo mundo mesmo quem já tinha CD/Ataque na ficha.
    cdResistencia: base.cdResistencia ?? null,
    bonusAtqMagia: base.bonusAtqMagia ?? null,
    slots: {1:{atual:0,max:0},2:{atual:0,max:0},3:{atual:0,max:0},4:{atual:0,max:0},5:{atual:0,max:0},6:{atual:0,max:0},7:{atual:0,max:0},8:{atual:0,max:0},9:{atual:0,max:0}},
    magias: '',
    condicoes: [],
    inventario: { moedas:{po:0,pp:0,pe:0,pc:0,pl:0}, armas:[], armaduras:[], itens:[] }
  };
}


// Magias preparadas (favoritas) de um personagem específico
let _magiasCacheMestre = null;
async function carregarCatalogoMagias() {
  if (_magiasCacheMestre) return _magiasCacheMestre;
  try {
    const r = await fetch('../data/magias_data.json');
    _magiasCacheMestre = await r.json();
    return _magiasCacheMestre;
  } catch { return []; }
}
async function carregarMagiasPreparadasMestre(characterId) {
  if (!window.sb || !characterId) return [];
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000));
  try {
    const fetch = (async () => {
      const { data } = await window.sb.from('spell_lists')
        .select('spell_names')
        .eq('character_id', characterId)
        .eq('nome', 'Favoritas')
        .maybeSingle();
      const nomes = new Set(data?.spell_names || []);
      if (!nomes.size) return [];
      const todas = await carregarCatalogoMagias();
      return todas.filter(m => nomes.has(m.nome))
        .sort((a,b) => a.nivel - b.nivel || a.nome.localeCompare(b.nome, 'pt'));
    })();
    return await Promise.race([fetch, timeout]);
  } catch (e) {
    console.warn('[barovia] preparadas:', e);
    return null;
  }
}

function render() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  if (!estado.personagens.length) {
    grid.innerHTML = `<div class="grid-vazio" style="padding:50px 20px;text-align:center;color:var(--text-dim);font-style:italic;grid-column:1/-1;background:var(--bg-card);border:1px dashed var(--divider);border-radius:6px">
      ${ehMestre
        ? ico('vampiro') + 'Nenhum personagem ativo em Barovia ainda.<br><br>Os jogadores precisam abrir <strong>Minha Ficha</strong>, vincular à campanha "Maldição de Strahd" e marcar como ★ Ativo.<br><br>Você também pode criar NPCs com o botão <strong>⚜ Adicionar</strong>.'
        : 'Nenhum personagem na campanha. Clique em <strong>⚜ Adicionar</strong>.'}
    </div>`;
  } else {
    estado.personagens.forEach(p => grid.appendChild(criarCard(p)));
  }
  renderPartyBar();
  window.VilaoWidget?.montar('vilao-widget-bar');
}

// Iniciativa (mst-3): abre com os PJs/NPCs ativos já preenchidos (bônus de
// characters.iniciativa_bonus) — vilões abertos em outra aba não são
// sincronizados automaticamente (cada ficha vive numa página separada, sem
// canal em comum pra isso), então entram como combatente avulso dentro do
// próprio modal (nome + bônus digitados na hora).
function abrirIniciativa() {
  if (!window.Iniciativa) return;
  window.Iniciativa.abrir(estado.personagens.map(p => ({ nome: p.nome, bonus: +p.iniciativa_bonus || 0 })));
}

// ===== BARRA DA PARTY: resumo rápido acima dos cards =====
function renderPartyBar() {
  const bar = document.getElementById('party-bar');
  if (!bar) return;
  if (!estado.personagens.length) { bar.innerHTML = ''; return; }
  bar.innerHTML = estado.personagens.map(p => {
    const hpMax = +p.hpMax || 1;
    const hpAtual = +p.hpAtual || 0;
    const pct = Math.max(0, Math.min(100, (hpAtual / hpMax) * 100));
    const inconsciente = hpAtual <= 0;
    const critico = !inconsciente && pct <= 25;
    const tema = window.ClasseTema ? window.ClasseTema.obter(p.classe) : null;
    const flags = [];
    if (inconsciente) flags.push('💀');
    else if (p.condicoes?.length) flags.push('⚠');
    if (p.concentracao?.ativa) flags.push('🔮');
    return `<div class="party-chip${critico ? ' critico' : ''}${inconsciente ? ' inconsciente' : ''}" data-goto="${p.id}" title="${escapeHtml(p.nome)} — ${hpAtual}/${hpMax} PV">
      <span class="pc-dot" style="--tema-cor:${tema ? tema.cor : 'var(--gold-muted)'}"></span>
      <span class="pc-nome">${escapeHtml(p.nome)}</span>
      ${flags.map(f => `<span class="pc-flag">${f}</span>`).join('')}
      <span class="pc-hp">${hpAtual}/${hpMax}</span>
    </div>`;
  }).join('');
  bar.querySelectorAll('.party-chip').forEach(chip => {
    chip.onclick = () => {
      const alvo = document.querySelector(`[data-card-id="${chip.dataset.goto}"]`);
      if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  });
}

// Patch cirúrgico: re-renderiza apenas o card de um personagem específico
const _rerenderTimers = new Map();
const _rerenderPending = new Map();

function rerenderCard(p) {
  if (!p?.id) return;
  _rerenderPending.set(p.id, p);
  if (_rerenderTimers.has(p.id)) clearTimeout(_rerenderTimers.get(p.id));
  _rerenderTimers.set(p.id, setTimeout(() => {
    _rerenderTimers.delete(p.id);
    _aplicarRerender(p.id);
  }, 280));
}

function _aplicarRerender(id) {
  const grid = document.getElementById('grid');
  if (!grid) return;
  const antigo = grid.querySelector(`[data-card-id="${id}"]`);
  if (!antigo) { _rerenderPending.delete(id); render(); return; }
  if (antigo.contains(document.activeElement)) {
    const handler = () => {
      antigo.removeEventListener('focusout', handler);
      setTimeout(() => {
        if (!antigo.contains(document.activeElement)) _aplicarRerender(id);
      }, 250);
    };
    antigo.addEventListener('focusout', handler, { once: true });
    return;
  }
  const dados = _rerenderPending.get(id);
  _rerenderPending.delete(id);
  if (!dados) return;
  const h = antigo.offsetHeight;
  const novo = criarCard(dados);
  novo.style.minHeight = h + 'px';
  antigo.replaceWith(novo);
  requestAnimationFrame(() => requestAnimationFrame(() => { novo.style.minHeight = ''; }));
  renderPartyBar();
}

// Aplica cor temática da classe: uma linha fina no topo do card + ícone discreto,
// nunca uma borda forte no card inteiro.
function aplicarTemaClasse(card, p) {
  const tema = window.ClasseTema ? window.ClasseTema.obter(p.classe) : null;

  card.querySelector('.class-watermark')?.remove();
  const badgeAntigo = card.querySelector('.class-badge');
  if (badgeAntigo) badgeAntigo.remove();

  if (!tema) {
    card.style.removeProperty('--tema-cor');
    return;
  }
  card.style.setProperty('--tema-cor', tema.cor);

  const wm = document.createElement('div');
  wm.className = 'class-watermark';
  wm.setAttribute('aria-hidden', 'true');
  wm.innerHTML = ico(tema.icone, { cor: tema.cor });
  card.appendChild(wm);

  const meta = card.querySelector('.char-meta');
  if (meta) {
    const badge = document.createElement('span');
    badge.className = 'class-badge';
    badge.innerHTML = ico(tema.icone, { titulo: tema.chave });
    meta.prepend(badge);
  }
}

// Equipamento: mesmo formato de dados que a ficha do jogador (c.inventario),
// então o que o mestre edita aqui aparece direto na ficha (e vice-versa).
const GRUPOS_EQUIP = [
  { tipo: 'armas', titulo: 'Armas', vazio: 'Nenhuma arma.',
    campos: [{ chave: 'nome', placeholder: 'Nome' }, { chave: 'dano', placeholder: 'Dano', extra: true }] },
  { tipo: 'armaduras', titulo: 'Armaduras', vazio: 'Nenhuma armadura.',
    campos: [{ chave: 'nome', placeholder: 'Nome' }, { chave: 'ca', placeholder: 'CA', extra: true }] },
  { tipo: 'itens', titulo: 'Itens', vazio: 'Nenhum item.',
    campos: [{ chave: 'nome', placeholder: 'Nome' }, { chave: 'qtd', placeholder: 'Qtd', extra: true }] },
];

function contarEquipamento(p) {
  const inv = p.inventario || {};
  return (inv.armas?.length || 0) + (inv.armaduras?.length || 0) + (inv.itens?.length || 0);
}

function criarSecaoEquipamento(p) {
  if (!p.inventario) p.inventario = { moedas: {}, armas: [], armaduras: [], itens: [] };
  ['armas', 'armaduras', 'itens'].forEach(t => { if (!Array.isArray(p.inventario[t])) p.inventario[t] = []; });

  const wrap = document.createElement('div');

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'edit-toggle';
  editBtn.textContent = 'Editar';
  editBtn.onclick = () => {
    const editando = wrap.classList.toggle('modo-edicao');
    editBtn.classList.toggle('ativo', editando);
    editBtn.textContent = editando ? 'Concluir edição' : 'Editar';
  };
  wrap.appendChild(editBtn);

  GRUPOS_EQUIP.forEach(g => {
    const grupo = document.createElement('div');
    grupo.className = 'equip-grupo';
    grupo.innerHTML = `<div class="equip-grupo-titulo">${g.titulo}</div><div class="equip-tags"></div>`;
    const tagsBox = grupo.querySelector('.equip-tags');
    const extraCampo = g.campos.find(c => c.extra);

    const repintar = () => {
      const lista = p.inventario[g.tipo];
      tagsBox.innerHTML = '';
      if (!lista.length) {
        tagsBox.innerHTML = `<span class="equip-vazio">${g.vazio}</span>`;
        return;
      }
      lista.forEach((item, idx) => {
        const extraVal = extraCampo ? item[extraCampo.chave] : null;
        const tag = document.createElement('span');
        tag.className = 'equip-tag';
        tag.innerHTML = `${escapeHtml(item.nome || '?')}${extraVal ? ` <span class="equip-tag-extra">(${escapeHtml(String(extraVal))})</span>` : ''}`;
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'equip-rm';
        rm.setAttribute('aria-label', `Remover ${item.nome || 'item'}`);
        rm.textContent = '✕';
        rm.onclick = () => {
          p.inventario[g.tipo].splice(idx, 1);
          salvar(p);
          repintar();
        };
        tag.appendChild(rm);
        tagsBox.appendChild(tag);
      });
    };
    repintar();

    const addRow = document.createElement('div');
    addRow.className = 'equip-add';
    const inputs = g.campos.map(c => {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = c.placeholder;
      if (c.extra) inp.className = 'equip-add-extra';
      return inp;
    });
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '+';
    btn.setAttribute('aria-label', `Adicionar em ${g.titulo}`);
    const adicionar = () => {
      const nome = inputs[0].value.trim();
      if (!nome) { inputs[0].focus(); return; }
      const novo = { nome };
      g.campos.slice(1).forEach((c, i) => { novo[c.chave] = inputs[i + 1].value.trim(); });
      p.inventario[g.tipo].push(novo);
      salvar(p);
      inputs.forEach(i => i.value = '');
      inputs[0].focus();
      repintar();
    };
    btn.onclick = adicionar;
    inputs.forEach(inp => {
      inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } };
      addRow.appendChild(inp);
    });
    addRow.appendChild(btn);
    grupo.appendChild(addRow);
    wrap.appendChild(grupo);
  });

  return wrap;
}

function criarCard(p) {
  const card = document.createElement('article');
  card.className = 'card';
  if (p.id) card.dataset.cardId = p.id;

  const hpAtualNum = +p.hpAtual || 0;
  const hpMaxNum = Math.max(1, +p.hpMax || 1);
  const inconsciente = hpAtualNum <= 0;
  const pctHp = Math.max(0, Math.min(100, (hpAtualNum / hpMaxNum) * 100));
  const hpCritico = !inconsciente && pctHp <= 25;
  if (hpCritico || inconsciente) card.classList.add('critico');

  // Efeitos de Exaustão (PHB 2014) — cumulativos, calculados a partir de p.exaustao.
  // Mesmas regras usadas em ficha.html (assets/js/exaustao_regras.js), então o
  // que o Mestre vê aqui bate com o que o jogador vê na própria ficha.
  const exhEfeitos = window.ExaustaoRegras ? window.ExaustaoRegras.efeitos(p.exaustao) : null;
  if (exhEfeitos?.morto) card.classList.add('critico');

  const body = document.createElement('div');
  body.className = 'card-body';
  card.appendChild(body);

  // ===== CABEÇALHO =====
  const header = document.createElement('div');
  header.className = 'char-header';

  const insp = document.createElement('div');
  const inspNum0 = +p.inspiracao || 0;
  insp.className = 'inspiration' + (inspNum0 > 0 ? ' active' : '');
  insp.title = 'Inspiração';
  insp.innerHTML = `<button type="button" class="insp-btn insp-menos" aria-label="Remover inspiração">−</button><span class="insp-qty"><span class="ic">★</span><span class="qty">${inspNum0}</span></span><button type="button" class="insp-btn insp-mais" aria-label="Adicionar inspiração">+</button>`;
  const inspMenos = insp.querySelector('.insp-menos');
  const inspMais = insp.querySelector('.insp-mais');
  const atualizarInsp = () => {
    const n = +p.inspiracao || 0;
    insp.classList.toggle('active', n > 0);
    insp.querySelector('.qty').textContent = n;
    inspMenos.disabled = n <= 0;
  };
  atualizarInsp();
  inspMenos.onclick = () => { p.inspiracao = Math.max(0, (+p.inspiracao || 0) - 1); salvar(p); atualizarInsp(); };
  inspMais.onclick = () => { p.inspiracao = (+p.inspiracao || 0) + 1; salvar(p); atualizarInsp(); };

  const nome = document.createElement('div');
  nome.className = 'char-name';
  nome.contentEditable = true;
  nome.textContent = p.nome;
  nome.oninput = () => { p.nome = nome.textContent.trim() || 'Personagem'; salvar(p); };
  nome.onblur = () => { p.nome = nome.textContent.trim() || 'Personagem'; salvar(p); };

  const meta = document.createElement('div');
  meta.className = 'char-meta';
  meta.innerHTML = `<span class="jogador-nome" contenteditable="true" data-field="jogador">${escapeHtml(p.jogador)}</span><span class="sep">·</span><span contenteditable="true" data-field="classe">${escapeHtml(p.classe)}</span> <strong contenteditable="true" data-field="nivel">${p.nivel}</strong><span class="sep">•</span><span contenteditable="true" data-field="raca">${escapeHtml(p.raca)}</span>`;
  meta.querySelectorAll('[contenteditable]').forEach(el => {
    const aplicarCampo = () => {
      const field = el.dataset.field;
      p[field] = field === 'nivel' ? (parseInt(el.textContent) || 1) : (el.textContent.trim() || '?');
      salvar(p);
      if (field === 'classe' || field === 'nivel') rerenderCard(p);
    };
    el.oninput = aplicarCampo;
    el.onblur = aplicarCampo;
  });

  header.appendChild(insp);
  header.appendChild(nome);
  header.appendChild(meta);
  body.appendChild(header);

  // ===== TEMA VISUAL POR CLASSE =====
  aplicarTemaClasse(card, p);

  // ===== HP =====
  const hpBlock = document.createElement('div');
  hpBlock.className = 'hp-block';
  const hpRow = document.createElement('div');
  hpRow.className = 'hp-row';
  const hpLabel = document.createElement('span');
  hpLabel.className = 'hp-label';
  hpLabel.textContent = 'PV';
  const hpNums = document.createElement('div');
  hpNums.className = 'hp-nums';
  const hpCur = inputNumerico(p.hpAtual, v => {
    const antes = p.hpAtual ?? v;
    const delta = v - antes;
    p.hpAtual = v; salvar(p); toast(`PV atualizado: ${v}`);
    if (window.FX && delta !== 0) {
      const alvo = hpCur.closest('.card') || hpCur;
      if (delta < 0) FX.dano(alvo, delta); else FX.cura(alvo, delta);
    }
    if (delta !== 0) window.LogCombate?.registrar(`${escapeHtml(p.nome)}: <strong>${delta > 0 ? '+' : ''}${delta} PV</strong> (${antes}→${v})`);
    rerenderCard(p);
  }, 'hp-current-input' + (hpCritico || inconsciente ? ' critico' : ''), null);
  const hpSep = document.createElement('span');
  hpSep.className = 'hp-sep';
  hpSep.textContent = '/';
  const hpMax = inputNumerico(p.hpMax, v => { p.hpMax = v; salvar(p); rerenderCard(p); }, 'hp-max-input', 1);
  hpNums.appendChild(hpCur);
  hpNums.appendChild(hpSep);
  hpNums.appendChild(hpMax);
  const hpTempWrap = document.createElement('div');
  hpTempWrap.className = 'hp-temp-wrap';
  const hpTempPlus = document.createElement('span');
  hpTempPlus.className = 'hp-temp-plus';
  hpTempPlus.textContent = '+';
  const hpTemp = inputNumerico(p.hpTemp || 0, v => { p.hpTemp = v; salvar(p); }, 'hp-temp-input', 0);
  hpTemp.title = 'PV temporários';
  hpTempWrap.appendChild(hpTempPlus);
  hpTempWrap.appendChild(hpTemp);
  hpRow.appendChild(hpLabel);
  hpRow.appendChild(hpNums);
  hpRow.appendChild(hpTempWrap);
  hpBlock.appendChild(hpRow);

  const hpBarTrack = document.createElement('div');
  hpBarTrack.className = 'hp-bar-track' + (inconsciente ? ' zero' : '');
  const hpBarFill = document.createElement('div');
  hpBarFill.className = 'hp-bar-fill' + (hpCritico ? ' baixo' : (pctHp <= 60 ? ' medio' : ''));
  hpBarFill.style.width = inconsciente ? '0%' : pctHp + '%';
  hpBarTrack.appendChild(hpBarFill);
  hpBlock.appendChild(hpBarTrack);

  if (inconsciente) {
    const badge = document.createElement('div');
    badge.className = 'unconscious-badge';
    badge.innerHTML = `${ico('atordoado')} Inconsciente`;
    hpBlock.appendChild(badge);
  }
  if (exhEfeitos?.morto) {
    const badgeMorte = document.createElement('div');
    badgeMorte.className = 'unconscious-badge';
    badgeMorte.innerHTML = `${ico('caveira')} Exaustão nível 6 — morto`;
    hpBlock.appendChild(badgeMorte);
  } else if (exhEfeitos && exhEfeitos.hpMaxMult < 1) {
    const notaHpMax = document.createElement('div');
    notaHpMax.className = 'unconscious-badge';
    notaHpMax.innerHTML = `${ico('aviso')} PV máx. efetivo (exaustão): ${window.ExaustaoRegras.hpMaxEfetivo(p.hpMax, p.exaustao)}`;
    hpBlock.appendChild(notaHpMax);
  }
  body.appendChild(hpBlock);

  // ===== CHIPS: CA / Iniciativa / Movimento / Percepção Passiva =====
  const chips = document.createElement('div');
  chips.className = 'stat-chips';
  const fazChip = (label, valor, callback, min) => {
    const box = document.createElement('div');
    box.className = 'stat-chip';
    const lb = document.createElement('div');
    lb.className = 'stat-chip-label';
    lb.textContent = label;
    const val = document.createElement('div');
    val.className = 'stat-chip-value';
    val.appendChild(inputNumerico(valor, callback, '', min));
    box.appendChild(lb);
    box.appendChild(val);
    return box;
  };
  chips.appendChild(fazChip('CA', p.ca, v => { p.ca = v; salvar(p); }, 0));
  chips.appendChild(fazChip('Iniciativa', p.iniciativa_bonus ?? 0, v => { p.iniciativa_bonus = v; salvar(p); }, null));
  const movChip = fazChip('Mov. (m)', p.deslocamento ?? 9, v => { p.deslocamento = v; salvar(p); rerenderCard(p); }, 0);
  if (exhEfeitos && (exhEfeitos.velocidadeMult < 1 || exhEfeitos.velocidadeZero)) {
    const efetivo = window.ExaustaoRegras.velocidadeEfetiva(p.deslocamento ?? 9, p.exaustao);
    const nota = document.createElement('div');
    nota.style.cssText = 'font-size:9px;color:var(--danger);margin-top:1px;';
    nota.textContent = `efetivo: ${efetivo}`;
    movChip.appendChild(nota);
  }
  chips.appendChild(movChip);
  chips.appendChild(fazChip('Perc. Pass.', p.percepcaoPassiva ?? 10, v => { p.percepcaoPassiva = v; salvar(p); }, 0));
  body.appendChild(chips);

  // ===== LINHA DE ALERTA: condições ativas + concentração + death saves =====
  const alertRow = document.createElement('div');
  alertRow.className = 'alert-row';

  // condições
  const condWrap = document.createElement('div');
  const condTagsRow = document.createElement('div');
  condTagsRow.className = 'tags-row';
  const condPicker = document.createElement('div');
  condPicker.className = 'condition-picker';

  const repintarCondicoes = () => {
    condTagsRow.innerHTML = '';
    (p.condicoes || []).forEach(cond => {
      const tag = document.createElement('span');
      tag.className = 'condition-tag';
      tag.innerHTML = `${escapeHtml(cond)} <span class="rm">✕</span>`;
      tag.onclick = () => {
        p.condicoes = p.condicoes.filter(c => c !== cond);
        salvar(p);
        repintarCondicoes();
        repintarPicker();
      };
      condTagsRow.appendChild(tag);
    });
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'add-condition-btn';
    addBtn.textContent = '+ Condição';
    addBtn.onclick = () => condPicker.classList.toggle('aberto');
    condTagsRow.appendChild(addBtn);
  };
  const repintarPicker = () => {
    condPicker.innerHTML = '';
    CONDICOES.forEach(cond => {
      const ativa = (p.condicoes || []).includes(cond);
      const tag = document.createElement('button');
      tag.type = 'button';
      tag.className = 'cp-tag' + (ativa ? ' ativa' : '');
      tag.textContent = cond;
      tag.onclick = () => {
        if (!p.condicoes) p.condicoes = [];
        if (p.condicoes.includes(cond)) p.condicoes = p.condicoes.filter(c => c !== cond);
        else p.condicoes.push(cond);
        salvar(p);
        window.LogCombate?.registrar(`${escapeHtml(p.nome)}: <strong>${escapeHtml(cond)}</strong> ${p.condicoes.includes(cond) ? 'ativada' : 'removida'}`);
        repintarCondicoes();
        repintarPicker();
      };
      condPicker.appendChild(tag);
    });
  };
  repintarCondicoes();
  repintarPicker();
  condWrap.appendChild(condTagsRow);
  condWrap.appendChild(condPicker);
  alertRow.appendChild(condWrap);

  // concentração (só exibida se o personagem tiver slots de magia — decidido abaixo)
  const slotsClasse = (window.SlotsPHB && p.classe)
    ? window.SlotsPHB.porClasse(p.classe, p.nivel, p._subclasse)
    : null;
  const ehConjurador = !!(slotsClasse && NIVEIS_SLOTS.some(nv => (slotsClasse[nv] || 0) > 0));

  let concBadge = null;
  if (ehConjurador) {
    if (!p.concentracao) p.concentracao = { ativa: false, magia: '' };
    concBadge = document.createElement('span');
    const atualizarConcBadge = () => {
      concBadge.className = 'concentration-badge' + (p.concentracao.ativa ? '' : ' inativa');
      concBadge.innerHTML = p.concentracao.ativa
        ? `${ico('encantamento')} Concentrando${p.concentracao.magia ? ': ' + escapeHtml(p.concentracao.magia) : ''}`
        : `${ico('encantamento')} Sem concentração`;
    };
    atualizarConcBadge();
    concBadge.onclick = () => {
      p.concentracao.ativa = !p.concentracao.ativa;
      salvar(p);
      atualizarConcBadge();
    };
    concBadge.oncontextmenu = (e) => {
      e.preventDefault();
      const nome = prompt('Magia em concentração:', p.concentracao.magia || '');
      if (nome === null) return;
      p.concentracao.magia = nome.trim();
      p.concentracao.ativa = !!p.concentracao.magia || p.concentracao.ativa;
      salvar(p);
      atualizarConcBadge();
    };
    concBadge.title = 'Clique para ativar/desativar · botão direito pra nomear a magia';
    const concRow = document.createElement('div');
    concRow.className = 'tags-row';
    concRow.appendChild(concBadge);
    alertRow.appendChild(concRow);
  }

  // death saves — sempre presentes, discretos; destacados quando inconsciente
  const deathWrap = document.createElement('div');
  deathWrap.className = 'death-saves-inline';
  if (!inconsciente) deathWrap.style.display = 'none';
  deathWrap.innerHTML = `<span class="dsi-label">Morte</span>`;
  ['sucessos','falhas'].forEach(tipo => {
    const grupo = document.createElement('div');
    grupo.className = 'death-group ' + (tipo === 'sucessos' ? 'success' : 'failure');
    const pips = document.createElement('div');
    pips.className = 'death-pips';
    for (let i = 1; i <= 3; i++) {
      const pip = document.createElement('div');
      pip.className = 'death-pip' + (i <= (p[tipo] || 0) ? ' filled' : '');
      pip.onclick = () => {
        p[tipo] = (p[tipo] === i) ? i - 1 : i;
        salvar(p);
        pips.querySelectorAll('.death-pip').forEach((el, idx) => {
          el.classList.toggle('filled', (idx + 1) <= p[tipo]);
        });
      };
      pips.appendChild(pip);
    }
    grupo.appendChild(pips);
    deathWrap.appendChild(grupo);
  });
  alertRow.appendChild(deathWrap);

  // exaustão compacta
  const exhWrap = document.createElement('div');
  const exhCompact = document.createElement('div');
  const nivelExa = p.exaustao || 0;
  exhCompact.className = 'exhaustion-compact' + (nivelExa === 0 ? ' zero' : '');
  exhCompact.innerHTML = `<span>Exaustão ${nivelExa}</span><span class="exh-dots">${
    Array.from({length:6}).map((_,i) => `<span class="exh-dot${i < nivelExa ? ' on' : ''}"></span>`).join('')
  }</span>`;
  const exhPicker = document.createElement('div');
  exhPicker.className = 'exhaustion-picker';
  for (let i = 1; i <= 6; i++) {
    const pip = document.createElement('div');
    pip.className = 'exh-pip' + (i <= (p.exaustao || 0) ? ' filled' : '');
    pip.textContent = i;
    pip.onclick = (e) => {
      e.stopPropagation();
      p.exaustao = (p.exaustao === i) ? i - 1 : i;
      salvar(p);
      // Efeitos (PV máx./deslocamento/badges) dependem do nível — re-renderiza o card inteiro.
      rerenderCard(p);
    };
    exhPicker.appendChild(pip);
  }
  exhCompact.onclick = () => exhPicker.classList.toggle('aberto');
  exhWrap.appendChild(exhCompact);
  if (nivelExa > 0 && exhEfeitos) {
    const efeitosTexto = document.createElement('div');
    efeitosTexto.style.cssText = 'font-size:10px;color:var(--danger);margin-top:2px;line-height:1.5;';
    efeitosTexto.textContent = exhEfeitos.resumo.join(' · ');
    exhWrap.appendChild(efeitosTexto);
  }
  exhWrap.appendChild(exhPicker);
  alertRow.appendChild(exhWrap);

  body.appendChild(alertRow);

  // ===== RESUMO DE MAGIA (se conjurador) =====
  let magiasTabContent = null;
  if (ehConjurador) {
    const dcRow = document.createElement('div');
    dcRow.className = 'summary-line sl-magic';
    const preparadasSpan = document.createElement('span');
    preparadasSpan.textContent = 'carregando…';
    dcRow.innerHTML = `<span>CD <strong data-dc>${p.cdResistencia ?? '—'}</strong></span><span>Ataque <strong data-atk>${p.bonusAtqMagia != null ? (p.bonusAtqMagia >= 0 ? '+' + p.bonusAtqMagia : p.bonusAtqMagia) : '—'}</strong></span>`;
    dcRow.appendChild(preparadasSpan);
    const btnMagias = document.createElement('button');
    btnMagias.type = 'button';
    btnMagias.className = 'summary-btn';
    btnMagias.textContent = 'Ver Magias';
    dcRow.appendChild(btnMagias);
    body.appendChild(dcRow);

    const magiasPanel = document.createElement('div');
    magiasPanel.style.display = 'none';
    magiasPanel.style.marginTop = '8px';
    btnMagias.onclick = () => {
      const abrir = magiasPanel.style.display === 'none';
      magiasPanel.style.display = abrir ? 'block' : 'none';
      btnMagias.classList.toggle('aberto', abrir);
      btnMagias.textContent = abrir ? 'Ocultar Magias' : 'Ver Magias';
    };
    body.appendChild(magiasPanel);
    magiasTabContent = magiasPanel;

    carregarMagiasPreparadasMestre(p.id).then(magias => {
      if (magias === null) { preparadasSpan.textContent = ''; return; }
      preparadasSpan.textContent = `${magias.length} preparada${magias.length === 1 ? '' : 's'}`;
    });
  }

  // ===== TABS =====
  const tabbar = document.createElement('div');
  tabbar.className = 'tabbar';
  const abas = [
    { chave: 'combate', label: 'Combate' },
    ...(ehConjurador ? [{ chave: 'magias', label: 'Magias' }] : []),
    { chave: 'ficha', label: 'Ficha' },
    { chave: 'mais', label: 'Mais' },
  ];
  const painelPorAba = {};
  abas.forEach((aba, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab-btn' + (idx === 0 ? ' ativa' : '');
    btn.textContent = aba.label;
    btn.dataset.aba = aba.chave;
    btn.onclick = () => {
      tabbar.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('ativa', b === btn));
      Object.entries(painelPorAba).forEach(([k, painel]) => painel.classList.toggle('ativa', k === aba.chave));
    };
    tabbar.appendChild(btn);
  });
  body.appendChild(tabbar);

  // --- Painel Combate ---
  const painelCombate = document.createElement('div');
  painelCombate.className = 'tab-panel ativa';
  painelPorAba.combate = painelCombate;

  // recursos de classe (recursosUsados) — junta o catálogo por classe/nível
  // (Fúria, Surto de Ação, Pontos de Feitiçaria, Cura pelas Mãos etc., sempre
  // disponível a partir de classe+nível+atributos) com quaisquer trackers
  // livres que o jogador tenha criado na aba Habilidades da própria ficha.
  const recSection = document.createElement('div');
  recSection.className = 'section';
  recSection.innerHTML = `<div class="section-title">Recursos de Classe</div>`;
  const recBody = document.createElement('div');
  if (!p.recursosUsados || typeof p.recursosUsados !== 'object') p.recursosUsados = {};
  const recursos = p.recursosUsados;

  const fazPips = (id, max, atual, onMudar) => {
    const pips = document.createElement('div');
    pips.className = 'recurso-pips';
    for (let i = 0; i < max; i++) {
      const pip = document.createElement('button');
      pip.type = 'button';
      pip.className = 'recurso-pip' + (i < atual ? ' gasto' : '');
      pip.onclick = () => {
        const novo = pip.classList.contains('gasto') ? i : i + 1;
        const val = Math.max(0, Math.min(max, novo));
        onMudar(val);
        pips.querySelectorAll('.recurso-pip').forEach((el, idx) => el.classList.toggle('gasto', idx < val));
      };
      pips.appendChild(pip);
    }
    return pips;
  };
  // Pools grandes (ex.: Cura pelas Mãos) viram +/- em vez de uma fileira de pips
  const fazPool = (max, atual, onMudar) => {
    const wrap = document.createElement('div');
    wrap.className = 'recurso-pool';
    const val = document.createElement('span');
    val.className = 'recurso-pool-val';
    const livre = () => Math.max(0, max - atual);
    const render = () => { val.innerHTML = `<strong>${livre()}</strong>/${max}`; };
    render();
    const botao = (texto, passo, label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'recurso-pool-btn';
      b.textContent = texto;
      b.setAttribute('aria-label', label);
      b.onclick = () => {
        atual = Math.max(0, Math.min(max, atual + passo));
        onMudar(atual);
        render();
      };
      return b;
    };
    wrap.appendChild(botao('−5', 5, 'Usar 5'));
    wrap.appendChild(botao('−1', 1, 'Usar 1'));
    wrap.appendChild(val);
    wrap.appendChild(botao('+1', -1, 'Recuperar 1'));
    wrap.appendChild(botao('+5', -5, 'Recuperar 5'));
    return wrap;
  };
  const fazTracker = (id, max, atual, onMudar) => max > 12 ? fazPool(max, atual, onMudar) : fazPips(id, max, atual, onMudar);

  const catalogo = window.RecursosClasse ? window.RecursosClasse.recursosPara(p, p.atributos) : [];
  const idsCatalogo = new Set(catalogo.map(r => r.id));

  catalogo.forEach(def => {
    if (!(def.max > 0)) return;
    const row = document.createElement('div');
    row.className = 'recurso-row';
    const nomeSpan = document.createElement('span');
    nomeSpan.className = 'recurso-nome';
    nomeSpan.title = def.dica || '';
    nomeSpan.textContent = def.nome;
    const atual = window.RecursosClasse.lerUsado(recursos, def.id);
    row.appendChild(nomeSpan);
    row.appendChild(fazTracker(def.id, def.max, atual, (val) => {
      window.RecursosClasse.gravarUsado(recursos, def.id, val);
      salvar(p);
    }));
    recBody.appendChild(row);
  });

  const chavesLivres = Object.keys(recursos).filter(k =>
    !idsCatalogo.has(k) && recursos[k] && typeof recursos[k].max === 'number' && recursos[k].max > 0);
  chavesLivres.forEach(k => {
    const r = recursos[k];
    const row = document.createElement('div');
    row.className = 'recurso-row';
    const nomeSpan = document.createElement('span');
    nomeSpan.className = 'recurso-nome';
    nomeSpan.textContent = k.replace(/_/g, ' ');
    row.appendChild(nomeSpan);
    row.appendChild(fazTracker(k, r.max, r.atual || 0, (val) => {
      r.atual = val;
      salvar(p);
    }));
    recBody.appendChild(row);
  });

  if (!catalogo.length && !chavesLivres.length) {
    recBody.innerHTML = `<span class="recurso-vazio">Sem recursos rastreáveis pra essa classe (ou ainda não sincronizado com a ficha do jogador).</span>`;
  }
  recSection.appendChild(recBody);
  painelCombate.appendChild(recSection);

  // === XP (mst-10) — editável direto, e é onde "Distribuir XP/Loot"
  // (toolbar) soma quando aplicado em lote pro grupo todo. ===
  const xpSection = document.createElement('div');
  xpSection.className = 'section xp-section';
  xpSection.innerHTML = `<div class="section-title">XP</div>`;
  const xpInput = inputNumerico(p.xp ?? 0, v => { p.xp = v; salvar(p); }, 'xp-input', 0);
  xpSection.appendChild(xpInput);
  painelCombate.appendChild(xpSection);

  body.appendChild(painelCombate);

  // --- Painel Magias ---
  if (ehConjurador) {
    const painelMagias = document.createElement('div');
    painelMagias.className = 'tab-panel';
    painelPorAba.magias = painelMagias;

    const metaSection = document.createElement('div');
    metaSection.className = 'section';
    const metaRow = document.createElement('div');
    metaRow.className = 'spell-meta-row';
    const fazMeta = (label, valor, callback) => {
      const item = document.createElement('div');
      item.className = 'spell-meta-item';
      const lb = document.createElement('div');
      lb.className = 'spell-meta-label';
      lb.textContent = label;
      const val = document.createElement('div');
      val.className = 'spell-meta-value';
      val.appendChild(inputNumerico(valor ?? '', callback, '', null));
      item.appendChild(lb);
      item.appendChild(val);
      return item;
    };
    metaRow.appendChild(fazMeta('CD', p.cdResistencia ?? '', v => { p.cdResistencia = v; salvar(p); rerenderCard(p); }));
    metaRow.appendChild(fazMeta('Ataque', p.bonusAtqMagia ?? '', v => { p.bonusAtqMagia = v; salvar(p); rerenderCard(p); }));
    metaSection.appendChild(metaRow);
    painelMagias.appendChild(metaSection);

    const slotsSection = document.createElement('div');
    slotsSection.className = 'section';
    slotsSection.innerHTML = `<div class="section-title">Slots de Magia</div>`;
    const slotsCompact = document.createElement('div');
    slotsCompact.className = 'spell-slots-compact';

    if (!p.slots) p.slots = {};
    for (let n = 1; n <= 9; n++) if (!p.slots[n]) p.slots[n] = { atual: 0, max: 0 };

    NIVEIS_SLOTS.forEach(nv => {
      const maxClasse = slotsClasse[nv] || 0;
      p.slots[nv].max = maxClasse;
      if (maxClasse === 0) return; // não mostra níveis que o personagem não possui
      const usados = Math.min(p.slots[nv].atual || 0, maxClasse);

      const row = document.createElement('div');
      row.className = 'slot-row';
      const lbl = document.createElement('span');
      lbl.className = 'slot-nv';
      lbl.textContent = `Nv ${nv}`;
      const dots = document.createElement('div');
      dots.className = 'slot-dots';
      const frac = document.createElement('span');
      frac.className = 'slot-frac';

      const atualizar = () => {
        const u = Math.min(p.slots[nv].atual || 0, maxClasse);
        frac.textContent = `${maxClasse - u}/${maxClasse}`;
        dots.querySelectorAll('.slot-dot').forEach((el, idx) => el.classList.toggle('gasto', idx < u));
      };

      for (let i = 0; i < maxClasse; i++) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'slot-dot' + (i < usados ? ' gasto' : '');
        dot.setAttribute('aria-label', `Slot ${nv}° ${i+1}`);
        dot.onclick = () => {
          const novo = dot.classList.contains('gasto') ? i : (i + 1);
          p.slots[nv].atual = Math.max(0, Math.min(maxClasse, novo));
          salvar(p);
          atualizar();
        };
        dots.appendChild(dot);
      }
      row.appendChild(lbl);
      row.appendChild(dots);
      row.appendChild(frac);
      atualizar();
      slotsCompact.appendChild(row);
    });
    slotsSection.appendChild(slotsCompact);
    painelMagias.appendChild(slotsSection);

    const prepSection = document.createElement('div');
    prepSection.className = 'section';
    prepSection.innerHTML = `<div class="section-title">Magias Preparadas</div>`;
    const prepWrap = document.createElement('div');
    prepWrap.className = 'magias-prep-mestre';
    prepWrap.innerHTML = `<span class="magia-prep-vazio">Carregando…</span>`;
    prepSection.appendChild(prepWrap);
    painelMagias.appendChild(prepSection);

    function pintarMagias(magias) {
      if (magias === null) {
        prepWrap.innerHTML = `<span class="magia-prep-vazio" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${ico('aviso')} Erro ao carregar magias.<button type="button" class="save-card" style="padding:4px 10px;font-size:10px" data-retry-magias="${p.id}">Tentar de novo</button></span>`;
        prepWrap.querySelector('[data-retry-magias]')?.addEventListener('click', () => {
          prepWrap.innerHTML = `<span class="magia-prep-vazio">Carregando…</span>`;
          carregarMagiasPreparadasMestre(p.id).then(pintarMagias);
        });
        return;
      }
      if (!magias.length) {
        prepWrap.innerHTML = `<span class="magia-prep-vazio">Nenhuma magia favoritada pelo jogador.</span>`;
        return;
      }
      const grupos = new Map();
      magias.forEach(m => {
        const nv = m.nivel || 0;
        if (!grupos.has(nv)) grupos.set(nv, []);
        grupos.get(nv).push(m);
      });
      prepWrap.innerHTML = [...grupos.entries()].map(([nv, lista]) => {
        const rotulo = nv === 0 ? 'Truques' : `${nv}° Nível`;
        const tags = lista.map(m => `<span class="magia-prep-tag" title="${escapeHtml(m.escola || '')}">${escapeHtml(m.nome)}</span>`).join('');
        return `<div class="magia-prep-grupo">
          <div class="magia-prep-grupo-titulo">${rotulo}</div>
          <div class="magia-prep-grupo-tags">${tags}</div>
        </div>`;
      }).join('');
      if (magiasTabContent) magiasTabContent.innerHTML = prepWrap.innerHTML;
    }
    carregarMagiasPreparadasMestre(p.id).then(pintarMagias);

    body.appendChild(painelMagias);
  }

  // --- Painel Ficha (equipamento + bolsa) ---
  const painelFicha = document.createElement('div');
  painelFicha.className = 'tab-panel';
  painelPorAba.ficha = painelFicha;

  const equipCount = contarEquipamento(p);
  const equipResumo = document.createElement('div');
  equipResumo.className = 'summary-line';
  const inv = p.inventario || {};
  equipResumo.innerHTML = `<span><strong>${inv.armas?.length || 0}</strong> armas</span><span><strong>${inv.armaduras?.length || 0}</strong> armaduras</span><span><strong>${inv.itens?.length || 0}</strong> itens</span>`;
  const btnEquip = document.createElement('button');
  btnEquip.type = 'button';
  btnEquip.className = 'summary-btn';
  btnEquip.textContent = 'Ver Equipamento';
  equipResumo.appendChild(btnEquip);
  painelFicha.appendChild(equipResumo);

  const equipPanel = document.createElement('div');
  equipPanel.style.display = 'none';
  equipPanel.style.marginTop = '8px';
  equipPanel.appendChild(criarSecaoEquipamento(p));
  painelFicha.appendChild(equipPanel);
  btnEquip.onclick = () => {
    const abrir = equipPanel.style.display === 'none';
    equipPanel.style.display = abrir ? 'block' : 'none';
    btnEquip.classList.toggle('aberto', abrir);
    btnEquip.textContent = abrir ? 'Ocultar Equipamento' : 'Ver Equipamento';
  };

  if (p.moedas && Object.values(p.moedas).some(v => +v > 0)) {
    const moedasSection = document.createElement('div');
    moedasSection.className = 'section';
    moedasSection.style.marginTop = '10px';
    moedasSection.innerHTML = `<div class="section-title">Bolsa</div>`;
    const moedasGrid = document.createElement('div');
    moedasGrid.className = 'moedas-grid';
    const NOMES = { pl:'Platina', po:'Ouro', pe:'Eletro', pp:'Prata', pc:'Cobre' };
    ['pl','po','pe','pp','pc'].forEach(k => {
      const v = +p.moedas[k] || 0;
      const box = document.createElement('div');
      box.className = 'moeda-box-mestre' + (v === 0 ? ' zero' : '');
      box.title = `${NOMES[k]}: ${v}`;
      box.innerHTML = `<span class="m-ic moeda-dot moeda-dot--${k}" aria-hidden="true"></span><span class="m-val">${v}</span><span class="m-tag">${k.toUpperCase()}</span>`;
      moedasGrid.appendChild(box);
    });
    moedasSection.appendChild(moedasGrid);
    painelFicha.appendChild(moedasSection);
  }

  body.appendChild(painelFicha);

  // --- Painel Mais ---
  const painelMais = document.createElement('div');
  painelMais.className = 'tab-panel';
  painelPorAba.mais = painelMais;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const salvarBtn = document.createElement('button');
  salvarBtn.className = 'save-card';
  salvarBtn.innerHTML = ico('salvar') + 'Salvar';
  salvarBtn.onclick = () => {
    salvar(p);
    salvarBtn.textContent = '✓ Salvo';
    salvarBtn.classList.add('saved');
    setTimeout(() => {
      salvarBtn.innerHTML = ico('salvar') + 'Salvar';
      salvarBtn.classList.remove('saved');
    }, 1800);
    toast(`${p.nome} salvo!`);
  };

  let descBtn = null;
  if (ehMestre) {
    descBtn = document.createElement('button');
    descBtn.className = 'save-card';
    descBtn.innerHTML = ico('noite') + 'Desc. Longo';
    descBtn.onclick = async () => {
      const ok = await window.Confirmar.perguntar({
        titulo: 'Descanso Longo',
        mensagem: `Aplicar descanso longo em ${p.nome}?`,
        confirmar: 'Descansar'
      });
      if (!ok) return;
      aplicarDescansoLongo(p);
      rerenderCard(p);
      toast(`${p.nome} descansou`);
    };
  }

  let periciasBtn = null;
  if (ehMestre) {
    periciasBtn = document.createElement('button');
    periciasBtn.className = 'save-card';
    periciasBtn.innerHTML = ico('alvo') + 'Perícias';
    periciasBtn.title = 'Dar/tirar bônus de perícia';
    periciasBtn.onclick = () => {
      if (window.AjustePericias) window.AjustePericias.abrir(p.id, p.nome);
    };
  }

  const remover = document.createElement('button');
  remover.className = 'remove-card';
  remover.textContent = '✕ remover';
  remover.onclick = async () => {
    const ok = await window.Confirmar.perguntar({
      titulo: 'Remover do painel?',
      mensagem: `"${p.nome}" será removido do banco. Esta ação não pode ser desfeita.`,
      confirmar: 'Remover',
      danger: true
    });
    if (ok) {
      try {
        await window.DBSync.deletar(p.id);
        estado.personagens = estado.personagens.filter(x => x.id !== p.id);
        render();
      } catch(e) { alert('Erro ao remover: ' + e.message); }
    }
  };

  actions.appendChild(salvarBtn);
  if (descBtn) actions.appendChild(descBtn);
  if (periciasBtn) actions.appendChild(periciasBtn);
  actions.appendChild(remover);
  painelMais.appendChild(actions);
  body.appendChild(painelMais);

  return card;
}

async function adicionarCard() {
  try {
    const base = criarPersonagem();
    delete base.id;
    const novo = await window.DBSync.criar(base);
    if (!estado.personagens.find(x => x.id === novo.id)) estado.personagens.push(novo);
    render();
    toast('Personagem adicionado');
  } catch(e) { alert('Erro ao criar: ' + e.message); }
}

// Aplica regras de descanso longo do PHB num personagem:
// HP → max; slots → max; exaustão −1; saves de morte → 0;
// recursos por dia → atual=0; dado de vida → recupera metade do nível (mín 1).
function aplicarDescansoLongo(p) {
  p.hpAtual = p.hpMax;
  p.hpTemp = 0;
  p.exaustao = Math.max(0, (p.exaustao || 0) - 1);
  p.sucessos = 0;
  p.falhas = 0;
  if (p.slots) Object.keys(p.slots).forEach(nv => { p.slots[nv].atual = 0; });
  if (p.recursosUsados && typeof p.recursosUsados === 'object') {
    // Dois formatos coexistem em recursos_usados: {atual,max} (trackers da
    // aba Habilidades) e número puro (RecursosClasse.gravarUsado, catálogo
    // por classe — Fúria, Surto de Ação etc.). Faltava resetar o segundo
    // formato, então esses recursos nunca voltavam ao normal no descanso longo.
    Object.keys(p.recursosUsados).forEach(k => {
      const v = p.recursosUsados[k];
      if (v && typeof v === 'object' && typeof v.atual === 'number') v.atual = 0;
      else if (typeof v === 'number') p.recursosUsados[k] = 0;
    });
  }
  const recupera = Math.max(1, Math.floor((p.nivel || 1) / 2));
  p.dadoVidaAtual = Math.min((p.nivel || 1), (p.dadoVidaAtual || 0) + recupera);
  salvar(p);
}

async function descansoLongo() {
  if (!ehMestre) { toast('Apenas o Mestre pode aplicar descanso longo'); return; }
  const ok = await window.Confirmar.perguntar({
    titulo: 'Descanso Longo — Todos',
    mensagem: 'Aplicar a TODOS os personagens:\n\n• PV ao máximo\n• Slots cheios\n• Recursos resetados\n• Exaustão −1\n• Dado de vida recupera metade do nível',
    confirmar: 'Descansar'
  });
  if (!ok) return;
  for (const p of estado.personagens) aplicarDescansoLongo(p);
  render();
  toast('Descanso longo concluído pra todos');
}


// ─── INIT: requer login + carrega via DBSync + escuta realtime ───
(async () => {
  const u = await window.Auth.requerLogin('login.html');
  if (!u) return;
  await window.Auth.renderHeader('#auth-slot');

  const _ehMestreInit = await window.Auth.ehMestre();

  try {
    const r = await window.DBSync.init({
      campanha: CAMPANHA,
      apenasAtivos: _ehMestreInit,
      onChange: (ev) => {
        if (ev.tipo === 'load') {
          estado.personagens = window.DBSync.listar();
          render();
        } else if (ev.tipo === 'insert') {
          if (!estado.personagens.find(x => x.id === ev.char.id)) {
            estado.personagens.push(ev.char);
            render();
          }
        } else if (ev.tipo === 'update') {
          const idx = estado.personagens.findIndex(x => x.id === ev.char.id);
          if (idx >= 0) estado.personagens[idx] = ev.char;
          else { estado.personagens.push(ev.char); render(); return; }
          if (ehEcoLocal(ev.char.id)) return;
          rerenderCard(ev.char);
        } else if (ev.tipo === 'delete') {
          estado.personagens = estado.personagens.filter(x => x.id !== ev.id);
          render();
        }
      }
    });
    ehMestre = r.ehMestre;
    if (ehMestre) {
      ['btn-adicionar','btn-descanso-global','btn-iniciativa','btn-loot-xp','btn-notas-mestre','link-vilao','link-reloaded'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
      });
    }
  } catch (e) {
    console.error(e);
    document.getElementById('grid').innerHTML = `<div style="padding:30px;text-align:center;color:var(--parchment-dim,#888)">Erro ao conectar: ${e.message}</div>`;
    return;
  }

  render();
})();

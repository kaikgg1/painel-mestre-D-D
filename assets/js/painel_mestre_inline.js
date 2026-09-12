const PERSONAGENS_INICIAIS = [
  { jogador: 'Jogador 1', nome: 'Aragorn', raca: 'Humano', classe: 'Guerreiro', nivel: 5, hpAtual: 42, hpMax: 47, ca: 18 },
  { jogador: 'Jogador 2', nome: 'Lúthien', raca: 'Elfo', classe: 'Mago', nivel: 5, hpAtual: 25, hpMax: 28, ca: 13 },
  { jogador: 'Jogador 3', nome: 'Thorin', raca: 'Anão', classe: 'Clérigo', nivel: 5, hpAtual: 38, hpMax: 40, ca: 18 },
  { jogador: 'Jogador 4', nome: 'Pippin', raca: 'Halfling', classe: 'Ladino', nivel: 5, hpAtual: 30, hpMax: 33, ca: 15 }
];

// Ícone vetorial inline (assets/js/icones.js); vazio se o módulo não carregou.
const ico = (k, o) => (window.Icones ? window.Icones.html(k, o) : '');

const CAMPANHA = 'mestre';
let estado = { personagens: [] };
let ehMestre = false;

// salvar(p?) — envia campos do personagem p para o banco (debounced).
// Se sem p, sincroniza todos (legacy, usado em descansoLongo etc.)
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

// ===== BARRA DA PARTY (mst-6): resumo rápido acima dos cards, clicável pra
// rolar até o card do personagem — igual ao que já existia só em
// painel_barovia_dnd5e.html. =====
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
      <span class="pc-dot" style="--tema-cor:${tema ? tema.cor : 'var(--gold)'}"></span>
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

// Compatibilidade — função carregar() agora é no-op (init real é via DBSync)
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
    ca: base.ca || 10,
    inspiracao: 0,
    exaustao: 0,
    sucessos: 0,
    falhas: 0,
    slots: {1:{atual:0,max:0},2:{atual:0,max:0},3:{atual:0,max:0},4:{atual:0,max:0},5:{atual:0,max:0},6:{atual:0,max:0},7:{atual:0,max:0},8:{atual:0,max:0},9:{atual:0,max:0}},
    magias: '',
    condicoes: [],
    inventario: { moedas:{po:0,pp:0,pe:0,pc:0,pl:0}, armas:[], armaduras:[], itens:[] }
  };
}

// Carrega magias preparadas (favoritas) de um personagem específico
// Junta spell_lists com o catálogo de magias pra ter nível/escola.
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
  // Timeout de 8s pra não deixar "Carregando…" pra sempre se a rede travar
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
    console.warn('[mestre] preparadas:', e);
    return null;  // sinal pro caller mostrar erro
  }
}

function render() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  if (!estado.personagens.length) {
    grid.innerHTML = `<div class="grid-vazio" style="padding:50px 20px;text-align:center;color:var(--text-dim);font-style:italic;grid-column:1/-1;background:rgba(0,0,0,0.2);border:1px dashed rgba(139,105,20,0.4);border-radius:6px">
      ${ehMestre
        ? ico('mestre') + 'Nenhum personagem ativo nesta campanha ainda.<br><br>Os jogadores precisam abrir <strong>Minha Ficha</strong>, vincular à campanha "Crônica dos Aventureiros" e marcar como ★ Ativo.<br><br>Você também pode criar NPCs com o botão <strong>+ Adicionar Personagem</strong>.'
        : 'Nenhum personagem na campanha. Clique em <strong>+ Adicionar Personagem</strong>.'}
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

// Anti-flicker: debounce por card + skip se o usuário está editando dentro dele.
const _rerenderTimers = new Map();
const _rerenderPending = new Map();

function rerenderCard(p) {
  if (!p?.id) return;
  // Sempre guarda o estado mais recente (sobrescreve pending anterior)
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
  // Se há foco dentro deste card, adia até perder foco — não interrompe digitação.
  if (antigo.contains(document.activeElement)) {
    const handler = () => {
      antigo.removeEventListener('focusout', handler);
      // espera 1 tick + 200ms pra não interromper auto-save subsequente
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
  // preserva altura para evitar "pulo" visual
  const h = antigo.offsetHeight;
  const novo = criarCard(dados);
  novo.style.minHeight = h + 'px';
  antigo.replaceWith(novo);
  // remove o min-height na próxima frame (já assumiu nova altura natural)
  requestAnimationFrame(() => requestAnimationFrame(() => { novo.style.minHeight = ''; }));
  renderPartyBar();
}

// Aplica cor + ícone de fundo temáticos da classe do personagem no card.
// Some silenciosamente se a classe não for reconhecida (mantém o tema padrão dourado/vermelho).
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

  const raceClass = card.querySelector('.race-class');
  if (raceClass) {
    const badge = document.createElement('span');
    badge.className = 'class-badge';
    badge.innerHTML = ico(tema.icone, { titulo: tema.chave });
    raceClass.prepend(badge);
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

function criarSecaoEquipamento(p) {
  if (!p.inventario) p.inventario = { moedas: {}, armas: [], armaduras: [], itens: [] };
  ['armas', 'armaduras', 'itens'].forEach(t => { if (!Array.isArray(p.inventario[t])) p.inventario[t] = []; });

  const section = document.createElement('div');
  section.className = 'section';
  section.innerHTML = `<div class="section-title">Equipamento</div>`;

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
    section.appendChild(grupo);
  });

  return section;
}

function criarCard(p) {
  const card = document.createElement('article');
  card.className = 'card';
  if (p.id) card.dataset.cardId = p.id;

  // === CABEÇALHO ===
  const header = document.createElement('div');
  header.className = 'char-header';

  const insp = document.createElement('div');
  const inspNum = +p.inspiracao || 0;
  insp.className = 'inspiration' + (inspNum > 0 ? ' active' : '');
  insp.title = `Inspiração: ${inspNum} (clique para +1 · Shift+clique para −1)`;
  insp.innerHTML = `<span class="ic">★</span><span class="qty">${inspNum}</span>`;
  insp.onclick = (e) => {
    if (e.shiftKey) p.inspiracao = Math.max(0, (+p.inspiracao || 0) - 1);
    else p.inspiracao = (+p.inspiracao || 0) + 1;
    salvar(p);
    const n = +p.inspiracao || 0;
    insp.classList.toggle('active', n > 0);
    insp.querySelector('.qty').textContent = n;
  };

  const nome = document.createElement('div');
  nome.className = 'char-name';
  nome.contentEditable = true;
  nome.textContent = p.nome;
  nome.oninput = () => { p.nome = nome.textContent.trim() || 'Personagem'; salvar(p); };
  nome.onblur = () => { p.nome = nome.textContent.trim() || 'Personagem'; salvar(p); };

  const jogador = document.createElement('div');
  jogador.className = 'player-name';
  jogador.contentEditable = true;
  jogador.textContent = p.jogador;
  jogador.oninput = () => { p.jogador = jogador.textContent.trim() || 'Jogador'; salvar(p); };
  jogador.onblur = () => { p.jogador = jogador.textContent.trim() || 'Jogador'; salvar(p); };

  const raceClass = document.createElement('div');
  raceClass.className = 'race-class';
  raceClass.innerHTML = `<span contenteditable="true" data-field="raca">${escapeHtml(p.raca)}</span> · <span contenteditable="true" data-field="classe">${escapeHtml(p.classe)}</span> · <strong>Nv <span contenteditable="true" data-field="nivel">${escapeHtml(String(p.nivel))}</span></strong>`;
  raceClass.querySelectorAll('[contenteditable]').forEach(el => {
    const aplicar = () => {
      const field = el.dataset.field;
      p[field] = field === 'nivel' ? (parseInt(el.textContent) || 1) : (el.textContent.trim() || '?');
      salvar(p);
      if (field === 'classe') aplicarTemaClasse(card, p);
    };
    el.oninput = aplicar;
    el.onblur = aplicar;
  });

  header.appendChild(insp);
  header.appendChild(nome);
  header.appendChild(jogador);
  header.appendChild(raceClass);
  card.appendChild(header);

  // === TEMA VISUAL POR CLASSE (cor + ícone de fundo) ===
  aplicarTemaClasse(card, p);

  // === STATS PRINCIPAIS ===
  const stats = document.createElement('div');
  stats.className = 'stats-row';

  // HP
  const hpBox = document.createElement('div');
  hpBox.className = 'stat-box';
  const hpLabel = document.createElement('div');
  hpLabel.className = 'stat-label';
  hpLabel.textContent = 'Pontos de Vida';
  const hpVal = document.createElement('div');
  hpVal.className = 'stat-value hp-grouped';
  const hpCur = inputNumerico(p.hpAtual, v => {
    const antes = p.hpAtual ?? v;
    const delta = v - antes;
    p.hpAtual = v; salvar(p); toast(`PV atualizado: ${v}`);
    if (window.FX && delta !== 0) {
      const alvo = hpCur.closest('.card') || hpCur;
      if (delta < 0) FX.dano(alvo, delta); else FX.cura(alvo, delta);
    }
    if (delta !== 0) window.LogCombate?.registrar(`${escapeHtml(p.nome)}: <strong>${delta > 0 ? '+' : ''}${delta} PV</strong> (${antes}→${v})`);
  }, 'hp-current-input', 0);
  const hpSep = document.createElement('span');
  hpSep.className = 'hp-sep';
  hpSep.textContent = '/';
  const hpMax = inputNumerico(p.hpMax, v => { p.hpMax = v; salvar(p); }, 'hp-max-input', 1);
  hpVal.appendChild(hpCur);
  hpVal.appendChild(hpSep);
  hpVal.appendChild(hpMax);
  hpBox.appendChild(hpLabel);
  hpBox.appendChild(hpVal);

  // CA
  const caBox = document.createElement('div');
  caBox.className = 'stat-box';
  caBox.innerHTML = `<div class="stat-label">CA</div>`;
  const caVal = document.createElement('div');
  caVal.className = 'stat-value';
  const caInput = inputNumerico(p.ca, v => { p.ca = v; salvar(p); }, '', 0);
  caVal.appendChild(caInput);
  caBox.appendChild(caVal);

  // Nível
  const nvBox = document.createElement('div');
  nvBox.className = 'stat-box';
  nvBox.innerHTML = `<div class="stat-label">Nível</div>`;
  const nvVal = document.createElement('div');
  nvVal.className = 'stat-value';
  const nvInput = inputNumerico(p.nivel, v => {
    p.nivel = Math.max(1, Math.min(20, v));
    nvInput.value = p.nivel;
    salvar(p);
    rerenderCard(p);  // slots dependem do nível
  }, '', 1);
  nvVal.appendChild(nvInput);
  nvBox.appendChild(nvVal);

  stats.appendChild(hpBox);
  stats.appendChild(caBox);
  stats.appendChild(nvBox);
  card.appendChild(stats);

  // === EXAUSTÃO ===
  const exhSection = document.createElement('div');
  exhSection.className = 'section';
  exhSection.innerHTML = `<div class="section-title">Exaustão</div><div class="exhaustion"></div>`;
  const exhContainer = exhSection.querySelector('.exhaustion');
  for (let i = 1; i <= 6; i++) {
    const pip = document.createElement('div');
    pip.className = 'exh-pip' + (i <= p.exaustao ? ' filled' : '');
    pip.textContent = i;
    pip.title = `Nível ${i} de exaustão`;
    pip.onclick = () => {
      p.exaustao = (p.exaustao === i) ? i - 1 : i;
      salvar(p);
      exhContainer.querySelectorAll('.exh-pip').forEach((el, idx) => {
        el.classList.toggle('filled', (idx + 1) <= p.exaustao);
      });
    };
    exhContainer.appendChild(pip);
  }
  // Efeitos cumulativos do PHB (assets/js/exaustao_regras.js) — mesma regra
  // já usada na ficha do jogador e no painel_barovia_dnd5e.html, então o que
  // o Mestre vê aqui bate com o que o jogador vê na própria ficha.
  const exhEfeitos = window.ExaustaoRegras ? window.ExaustaoRegras.efeitos(p.exaustao) : null;
  if (exhEfeitos?.resumo?.length) {
    const exhNota = document.createElement('div');
    exhNota.className = 'exh-efeitos';
    exhNota.textContent = exhEfeitos.resumo.join(' · ');
    exhSection.appendChild(exhNota);
  }
  card.appendChild(exhSection);

  // === XP (mst-10) — editável direto, e é onde "Distribuir XP/Loot" (toolbar)
  // soma quando aplicado em lote pro grupo todo. ===
  const xpSection = document.createElement('div');
  xpSection.className = 'section xp-section';
  xpSection.innerHTML = `<div class="section-title">XP</div>`;
  const xpInput = inputNumerico(p.xp ?? 0, v => { p.xp = v; salvar(p); }, 'xp-input', 0);
  xpSection.appendChild(xpInput);
  card.appendChild(xpSection);

  // === RECURSOS DE CLASSE (mst-2) === — catálogo por classe/nível/atributos
  // (assets/js/recursos_classe.js), mesma fonte usada na ficha do jogador,
  // então o Mestre acompanha Fúria/Surto de Ação/Pontos de Feitiçaria/etc.
  // sem precisar perguntar ou abrir a ficha do jogador à parte.
  if (window.RecursosClasse) {
    const recSection = document.createElement('div');
    recSection.className = 'section';
    recSection.innerHTML = `<div class="section-title">Recursos de Classe</div>`;
    const recBody = document.createElement('div');
    if (!p.recursosUsados || typeof p.recursosUsados !== 'object') p.recursosUsados = {};
    const recursos = p.recursosUsados;

    const fazPips = (max, atual, onMudar) => {
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
      const renderVal = () => { val.innerHTML = `<strong>${livre()}</strong>/${max}`; };
      renderVal();
      const botao = (texto, passo, label) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'recurso-pool-btn';
        b.textContent = texto;
        b.setAttribute('aria-label', label);
        b.onclick = () => {
          atual = Math.max(0, Math.min(max, atual + passo));
          onMudar(atual);
          renderVal();
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
    const fazTracker = (max, atual, onMudar) => max > 12 ? fazPool(max, atual, onMudar) : fazPips(max, atual, onMudar);

    const catalogo = window.RecursosClasse.recursosPara({ classe: p.classe, nivel: p.nivel }, p.atributos);
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
      row.appendChild(fazTracker(def.max, atual, (val) => {
        window.RecursosClasse.gravarUsado(recursos, def.id, val);
        salvar(p);
      }));
      recBody.appendChild(row);
    });

    // Trackers livres que o jogador criou na aba Habilidades da própria
    // ficha (características personalizadas) — mesmo formato {atual,max}.
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
      row.appendChild(fazTracker(r.max, r.atual || 0, (val) => {
        r.atual = val;
        salvar(p);
      }));
      recBody.appendChild(row);
    });

    if (!catalogo.length && !chavesLivres.length) {
      recBody.innerHTML = `<span class="recurso-vazio">Sem recursos rastreáveis pra essa classe (ou ainda não sincronizado com a ficha do jogador).</span>`;
    }
    recSection.appendChild(recBody);
    card.appendChild(recSection);
  }

  // === SALVAGUARDAS DE MORTE ===
  const deathSection = document.createElement('div');
  deathSection.className = 'section';
  deathSection.innerHTML = `
    <div class="section-title">Salvaguardas de Morte</div>
    <div class="death-saves">
      <div class="death-group success">
        <div class="death-group-label">Sucessos</div>
        <div class="death-pips" data-type="sucessos"></div>
      </div>
      <div class="death-group failure">
        <div class="death-group-label">Falhas</div>
        <div class="death-pips" data-type="falhas"></div>
      </div>
    </div>`;
  ['sucessos','falhas'].forEach(tipo => {
    const cont = deathSection.querySelector(`[data-type="${tipo}"]`);
    for (let i = 1; i <= 3; i++) {
      const pip = document.createElement('div');
      pip.className = 'death-pip' + (i <= p[tipo] ? ' filled' : '');
      pip.onclick = () => {
        p[tipo] = (p[tipo] === i) ? i - 1 : i;
        salvar(p);
        cont.querySelectorAll('.death-pip').forEach((el, idx) => {
          el.classList.toggle('filled', (idx + 1) <= p[tipo]);
        });
      };
      cont.appendChild(pip);
    }
  });
  card.appendChild(deathSection);

  // === SLOTS DE MAGIA ===
  // Semântica: p.slots[nv].atual = USADOS (gastos), p.slots[nv].max = total.
  // Max calculado pela classe/nível via SlotsPHB; fallback pro valor salvo.
  const slotsClasse = (window.SlotsPHB && p.classe)
    ? window.SlotsPHB.porClasse(p.classe, p.nivel, p._subclasse)
    : null;

  if (slotsClasse) {
    const slotsSection = document.createElement('div');
    slotsSection.className = 'section';
    slotsSection.innerHTML = `<div class="section-title">Slots de Magia</div>`;
    const slotsGrid = document.createElement('div');
    slotsGrid.className = 'spell-slots';

    if (!p.slots) p.slots = {};
    for (let n = 1; n <= 9; n++) if (!p.slots[n]) p.slots[n] = { atual: 0, max: 0 };

    NIVEIS_SLOTS.forEach(nv => {
      const maxClasse = slotsClasse[nv] || 0;
      // Sincroniza max do banco com a tabela da classe
      p.slots[nv].max = maxClasse;
      const usados = Math.min(p.slots[nv].atual || 0, maxClasse);
      const disp = maxClasse - usados;

      const slot = document.createElement('div');
      slot.className = 'slot-level' + (maxClasse === 0 ? ' indisponivel' : '');

      const numDiv = document.createElement('div');
      numDiv.className = 'slot-level-num';
      numDiv.textContent = `Nv ${nv}`;
      slot.appendChild(numDiv);

      if (maxClasse === 0) {
        const stat = document.createElement('div');
        stat.className = 'slot-status-m';
        stat.textContent = '—';
        slot.appendChild(stat);
      } else {
        const pipsBox = document.createElement('div');
        pipsBox.className = 'slot-pips-mestre';
        const stat = document.createElement('div');
        stat.className = 'slot-status-m';

        const atualizarStatus = () => {
          const u = Math.min(p.slots[nv].atual || 0, maxClasse);
          const d = maxClasse - u;
          stat.innerHTML = `<strong>${d}</strong>/${maxClasse}`;
          pipsBox.querySelectorAll('.slot-pip-m').forEach((el, idx) => {
            el.classList.toggle('gasto', idx < u);
          });
        };

        for (let i = 0; i < maxClasse; i++) {
          const pip = document.createElement('button');
          pip.type = 'button';
          pip.className = 'slot-pip-m' + (i < usados ? ' gasto' : '');
          pip.setAttribute('aria-label', `Slot ${nv}° espaço ${i+1} — ${i < usados ? 'gasto' : 'disponível'}`);
          pip.onclick = () => {
            const novoUsados = pip.classList.contains('gasto') ? i : (i + 1);
            p.slots[nv].atual = Math.max(0, Math.min(maxClasse, novoUsados));
            salvar(p);
            atualizarStatus();
          };
          pipsBox.appendChild(pip);
        }
        atualizarStatus();
        slot.appendChild(pipsBox);
        slot.appendChild(stat);
      }
      slotsGrid.appendChild(slot);
    });
    slotsSection.appendChild(slotsGrid);
    card.appendChild(slotsSection);

    // === MOEDAS (somente leitura — vem do inventario do jogador) ===
    if (p.moedas && Object.values(p.moedas).some(v => +v > 0)) {
      const moedasSection = document.createElement('div');
      moedasSection.className = 'section';
      moedasSection.innerHTML = `<div class="section-title">Bolsa</div>`;
      const moedasGrid = document.createElement('div');
      moedasGrid.className = 'moedas-grid';
      // A cor identifica a moeda -> ponto colorido em CSS (ícone perderia a cor)
      const NOMES  = { pl:'Platina', po:'Ouro', pe:'Eletro', pp:'Prata', pc:'Cobre' };
      // Ordem: maior valor primeiro
      ['pl','po','pe','pp','pc'].forEach(k => {
        const v = +p.moedas[k] || 0;
        const box = document.createElement('div');
        box.className = 'moeda-box-mestre' + (v === 0 ? ' zero' : '');
        box.title = `${NOMES[k]}: ${v}`;
        box.innerHTML = `<span class="m-ic moeda-dot moeda-dot--${k}" aria-hidden="true"></span><span class="m-val">${v}</span><span class="m-tag">${k.toUpperCase()}</span>`;
        moedasGrid.appendChild(box);
      });
      moedasSection.appendChild(moedasGrid);
      card.appendChild(moedasSection);
    }

    // === MAGIAS PREPARADAS (do spell_lists do jogador) ===
    const magiasSection = document.createElement('div');
    magiasSection.className = 'section';
    magiasSection.innerHTML = `<div class="section-title">Magias Preparadas</div>`;
    const wrap = document.createElement('div');
    wrap.className = 'magias-prep-mestre';
    wrap.innerHTML = `<span class="magia-prep-vazio">Carregando…</span>`;
    magiasSection.appendChild(wrap);
    card.appendChild(magiasSection);
    // Fetch async (com timeout interno de 8s)
    function pintarMagias(magias) {
      if (magias === null) {
        wrap.innerHTML = `<span class="magia-prep-vazio" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${ico('aviso')} Erro ao carregar magias.<button type="button" class="back-link" style="padding:4px 10px;font-size:10px" data-retry-magias="${p.id}">Tentar de novo</button></span>`;
        wrap.querySelector('[data-retry-magias]')?.addEventListener('click', () => {
          wrap.innerHTML = `<span class="magia-prep-vazio">Carregando…</span>`;
          carregarMagiasPreparadasMestre(p.id).then(pintarMagias);
        });
        return;
      }
      if (!magias.length) {
        wrap.innerHTML = `<span class="magia-prep-vazio">Nenhuma magia favoritada pelo jogador.</span>`;
        return;
      }
      // Agrupa por nível (0 = Truques) — já vem ordenado por carregarMagiasPreparadasMestre
      const grupos = new Map();
      magias.forEach(m => {
        const nv = m.nivel || 0;
        if (!grupos.has(nv)) grupos.set(nv, []);
        grupos.get(nv).push(m);
      });
      wrap.innerHTML = [...grupos.entries()].map(([nv, lista]) => {
        const rotulo = nv === 0 ? 'Truques' : `${nv}° Nível`;
        const tags = lista.map(m => `<span class="magia-prep-tag" title="${escapeHtml(m.escola || '')}">${escapeHtml(m.nome)}</span>`).join('');
        return `<div class="magia-prep-grupo">
          <div class="magia-prep-grupo-titulo">${rotulo}</div>
          <div class="magia-prep-grupo-tags">${tags}</div>
        </div>`;
      }).join('');
    }
    carregarMagiasPreparadasMestre(p.id).then(pintarMagias);
  }

  // === EQUIPAMENTO (editável — some com o mesmo campo p.inventario da ficha) ===
  card.appendChild(criarSecaoEquipamento(p));

  // === CONDIÇÕES ===
  const condSection = document.createElement('div');
  condSection.className = 'section';
  condSection.innerHTML = `<div class="section-title">Condições</div><div class="conditions"></div>`;
  const condContainer = condSection.querySelector('.conditions');
  CONDICOES.forEach(cond => {
    const tag = document.createElement('span');
    tag.className = 'condition-tag' + (p.condicoes.includes(cond) ? ' active' : '');
    tag.textContent = cond;
    tag.onclick = () => {
      if (p.condicoes.includes(cond)) p.condicoes = p.condicoes.filter(c => c !== cond);
      else p.condicoes.push(cond);
      salvar(p);
      const ativo = p.condicoes.includes(cond);
      tag.classList.toggle('active', ativo);
      window.LogCombate?.registrar(`${escapeHtml(p.nome)}: <strong>${escapeHtml(cond)}</strong> ${ativo ? 'ativada' : 'removida'}`);
    };
    condContainer.appendChild(tag);
  });
  card.appendChild(condSection);

  // === AÇÕES DO CARD ===
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

  const descBtn = document.createElement('button');
  descBtn.className = 'save-card';
  descBtn.style.borderColor = 'var(--red)';
  descBtn.style.color = 'var(--red-dark)';
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

  const periciasBtn = document.createElement('button');
  periciasBtn.className = 'save-card';
  periciasBtn.innerHTML = ico('alvo') + 'Perícias';
  periciasBtn.title = 'Dar/tirar bônus de perícia';
  periciasBtn.onclick = () => {
    if (window.AjustePericias) window.AjustePericias.abrir(p.id, p.nome);
  };

  const remover = document.createElement('button');
  remover.className = 'remove-card';
  remover.textContent = '✕ remover';
  remover.onclick = async () => {
    const ok = await window.Confirmar.perguntar({
      titulo: 'Remover do painel?',
      mensagem: `"${p.nome}" será removido do banco de dados. Esta ação não pode ser desfeita.`,
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
  actions.appendChild(descBtn);
  actions.appendChild(periciasBtn);
  actions.appendChild(remover);
  card.appendChild(actions);

  return card;
}

async function adicionarCard() {
  try {
    const base = criarPersonagem();
    delete base.id;
    const novo = await window.DBSync.criar(base);
    // O realtime vai re-renderizar; tb adiciono já pra resposta imediata
    if (!estado.personagens.find(x => x.id === novo.id)) estado.personagens.push(novo);
    render();
    toast('Personagem adicionado');
  } catch(e) { alert('Erro ao criar: ' + e.message); }
}

function aplicarDescansoLongo(p) {
  p.hpAtual = p.hpMax;
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
  const ok = await window.Confirmar.perguntar({
    titulo: 'Descanso Longo — Todos',
    mensagem: 'Aplicar a TODOS os personagens:\n\n• PV ao máximo\n• Slots cheios\n• Recursos resetados\n• Exaustão −1\n• Dado de vida recupera metade do nível',
    confirmar: 'Descansar',
    cancelar: 'Cancelar'
  });
  if (!ok) return;
  for (const p of estado.personagens) {
    if (!podeEditar(p)) continue;
    aplicarDescansoLongo(p);
  }
  render();
  toast('Descanso longo concluído');
}

function podeEditar() {
  // A UI não restringe edição — o RLS do Supabase é a barreira real de permissão.
  return true;
}


// ─── INIT: requer login + carrega via DBSync + escuta realtime ───
(async () => {
  const u = await window.Auth.requerLogin('login.html');
  if (!u) return;
  const mestre = await window.Auth.ehMestre();
  if (!mestre) {
    location.replace('../index.html');
    return;
  }
  await window.Auth.renderHeader('#auth-slot');

  // Pré-checa se é mestre antes do init (pra decidir se filtra ativos)
  const _ehMestreInit = await window.Auth.ehMestre();

  try {
    const r = await window.DBSync.init({
      campanha: CAMPANHA,
      apenasAtivos: _ehMestreInit,  // mestre vê só ativos; jogador vê todos os seus
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
          // Anti-eco: nossa própria edição já foi aplicada no DOM
          if (ehEcoLocal(ev.char.id)) return;
          rerenderCard(ev.char);
        } else if (ev.tipo === 'delete') {
          estado.personagens = estado.personagens.filter(x => x.id !== ev.id);
          render();
        }
      }
    });
    ehMestre = r.ehMestre;
  } catch (e) {
    console.error(e);
    document.getElementById('grid').innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-dim,#888)">Erro ao conectar ao banco: ${e.message}</div>`;
    return;
  }


  render();
})();

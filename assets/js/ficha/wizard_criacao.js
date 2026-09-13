// assets/js/ficha/wizard_criacao.js
// Assistente de Criação de Personagem (jog-9 da auditoria) — um modal de 4
// passos (Identidade → Atributos por array padrão → Perícias → Equipamento)
// que cria um personagem NOVO já com os campos essenciais preenchidos
// corretamente, em vez do jogador ter que descobrir sozinho as regras do
// PHB (array padrão, perícias por classe/raça/antecedente, equipamento
// inicial).
//
// Todo campo é obrigatório: não dá pra avançar de passo (nem criar o
// personagem) com qualquer campo em branco — inclui origem (antecedente),
// alinhamento, os 6 atributos, todas as perícias exigidas e toda escolha
// de equipamento (armas/armadura/pacote/foco/idiomas). Dados de regras
// (antecedentes, perícias por raça, equipamento por classe, array padrão)
// vêm de wizard_dados.js.

function abrirWizardCriacao() {
  const state = {
    passo: 0,
    nome: '',
    raca: '',
    classe: '',
    origem: '',
    alinhamento: '',
    atributos: { for: null, dex: null, con: null, int: null, sab: null, car: null },
    pericias: new Set(),        // escolhas do jogador (classe + escolha livre de raça)
    idiomasEscolhidos: [],      // array paralelo às escolhas de idioma do antecedente
    equipBgSlot: {},            // `${tipo}:${idx}` -> nome escolhido (antecedente: ferramentas/equipamento)
    equipClasseGrupo: {},       // idx do grupo de escolha -> idx da opção escolhida
    equipClasseSlot: {},        // chave do slot -> nome escolhido (dentro da opção escolhida, ou fixo)
  };

  const { overlay, card, fechar } = UI.abrirModal({
    tituloHtml: `${ico('brilho')} Assistente de Criação de Personagem`,
    className: 'wizard-overlay',
    corpoHtml: `
      <p class="ajuda-mini" id="wizard-passo-lbl"></p>
      <div id="wizard-corpo"></div>
      <div class="modal-acoes wizard-acoes">
        <button type="button" class="btn" id="wizard-cancelar">Cancelar</button>
        <span style="flex:1"></span>
        <button type="button" class="btn" id="wizard-anterior">← Anterior</button>
        <button type="button" class="btn" id="wizard-proximo">Próximo →</button>
        <button type="button" class="btn" id="wizard-criar" hidden>✓ Criar Personagem</button>
      </div>
    `,
  });

  const corpo = card.querySelector('#wizard-corpo');
  const passoLbl = card.querySelector('#wizard-passo-lbl');
  const btnAnterior = card.querySelector('#wizard-anterior');
  const btnProximo = card.querySelector('#wizard-proximo');
  const btnCriar = card.querySelector('#wizard-criar');
  const ULTIMO_PASSO = 3;
  card.querySelector('#wizard-cancelar').addEventListener('click', fechar);

  // ── Helpers de regras (perícias, equipamento) ──────────────────────
  const opcoesClasseAtual = () => opcoesPericiasDaClasse(state.classe) || { escolhas: 0, opcoes: [] };
  const origemAtual = () => origemPorNome(state.origem);
  const equipClasseAtual = () => equipamentoDaClasse(state.classe);

  // Combina perícias fixas (raça + antecedente) com o total de escolhas
  // (classe + escolha livre de raça, ex. Meio-Elfo). O pool de escolha
  // exclui as fixas — evita marcar 2x a mesma perícia (PHB: se uma perícia
  // já vem por outra fonte, escolha outra da lista).
  function infoPericias() {
    const bg = origemAtual();
    const fixasBg = bg ? bg.pericias : [];
    const racaInfo = PERICIAS_POR_RACA[state.raca];
    const fixasRaca = racaInfo?.fixas || [];
    const fixas = new Set([...fixasBg, ...fixasRaca]);
    const def = opcoesClasseAtual();
    const racaEscolheQualquer = !!(racaInfo?.escolhas);
    const poolNomes = racaEscolheQualquer
      ? PERICIAS.map(p => p[0])
      : def.opcoes;
    const pool = Array.from(new Set(poolNomes)).filter(s => !fixas.has(s));
    const totalEscolhas = (def.escolhas || 0) + (racaInfo?.escolhas || 0);
    return { fixas, pool, totalEscolhas };
  }

  function podeAvancar() {
    if (state.passo === 0) return !!(state.nome.trim() && state.raca && state.classe && state.origem && state.alinhamento);
    if (state.passo === 1) return ATRIBUTOS.every(([k]) => state.atributos[k] != null);
    if (state.passo === 2) { const info = infoPericias(); return info.totalEscolhas === 0 || state.pericias.size === info.totalEscolhas; }
    return true;
  }

  // Todo slot/escolha de equipamento (antecedente + classe) preenchido?
  function equipamentoCompleto() {
    const bg = origemAtual();
    const eq = equipClasseAtual();
    if (!bg || !eq) return false;

    const nIdiomas = bg.idiomas?.escolhas || 0;
    if (state.idiomasEscolhidos.length !== nIdiomas || state.idiomasEscolhidos.some(v => !v)) return false;
    if (new Set(state.idiomasEscolhidos).size !== nIdiomas) return false;

    for (let i = 0; i < bg.ferramentas.length; i++) {
      if (slotPrecisaEscolha(bg.ferramentas[i]) && !state.equipBgSlot[`ferr:${i}`]) return false;
    }
    for (let i = 0; i < bg.equipamento.length; i++) {
      if (slotPrecisaEscolha(bg.equipamento[i]) && !state.equipBgSlot[`item:${i}`]) return false;
    }

    for (let gi = 0; gi < eq.escolhas.length; gi++) {
      const oi = state.equipClasseGrupo[gi];
      if (oi === undefined) return false;
      const slots = eq.escolhas[gi].opcoes[oi].slots;
      for (let si = 0; si < slots.length; si++) {
        if (slotPrecisaEscolha(slots[si]) && !state.equipClasseSlot[`${gi}:${oi}:${si}`]) return false;
      }
    }
    for (let fi = 0; fi < eq.fixos.length; fi++) {
      if (slotPrecisaEscolha(eq.fixos[fi]) && !state.equipClasseSlot[`fixo:${fi}`]) return false;
    }
    return true;
  }

  function renderPasso() {
    const TITULOS = ['Identidade', 'Atributos (Array Padrão)', 'Perícias', 'Equipamento Inicial'];
    passoLbl.textContent = `Passo ${state.passo + 1} de 4 — ${TITULOS[state.passo]}`;

    if (state.passo === 0) renderPasso0();
    if (state.passo === 1) renderPasso1();
    if (state.passo === 2) renderPasso2();
    if (state.passo === 3) renderPasso3();

    btnAnterior.hidden = state.passo === 0;
    btnProximo.hidden = state.passo === ULTIMO_PASSO;
    btnCriar.hidden = state.passo !== ULTIMO_PASSO;
    atualizarBotoes();
  }

  // ── Passo 0: Identidade ─────────────────────────────────────────────
  function renderPasso0() {
    corpo.innerHTML = `
      <div class="campo"><label>Nome do Personagem *</label>
        <input type="text" id="wz-nome" autocomplete="off" value="${escapeHtmlWizard(state.nome)}" placeholder="Ex.: Elara Ventoluz"></div>
      <div class="grid-2">
        <div class="campo"><label>Raça *</label>
          <select id="wz-raca">${RACAS.map(r => `<option value="${escapeHtmlWizard(r)}" ${r===state.raca?'selected':''}>${r || '— selecione —'}</option>`).join('')}</select></div>
        <div class="campo"><label>Classe *</label>
          <select id="wz-classe">${CLASSES.map(c => `<option value="${escapeHtmlWizard(c)}" ${c===state.classe?'selected':''}>${c || '— selecione —'}</option>`).join('')}</select></div>
        <div class="campo"><label>Origem (Antecedente) *</label>
          <select id="wz-origem">
            <option value="">— selecione —</option>
            ${BACKGROUNDS_PHB.map(b => `<option value="${escapeHtmlWizard(b.nome)}" ${b.nome===state.origem?'selected':''}>${b.nome}</option>`).join('')}
          </select></div>
        <div class="campo"><label>Alinhamento *</label>
          <select id="wz-alinhamento">${ALINHAMENTOS.map(a => `<option value="${escapeHtmlWizard(a)}" ${a===state.alinhamento?'selected':''}>${a || '— selecione —'}</option>`).join('')}</select></div>
      </div>
      <p class="ajuda-mini">* obrigatório — todos os campos precisam ser preenchidos para avançar.</p>
    `;
    corpo.querySelector('#wz-nome').addEventListener('input', e => { state.nome = e.target.value; atualizarBotoes(); });
    corpo.querySelector('#wz-raca').addEventListener('change', e => {
      state.raca = e.target.value;
      resetarPericiasEEquipamento();
      atualizarBotoes();
    });
    corpo.querySelector('#wz-classe').addEventListener('change', e => {
      state.classe = e.target.value;
      resetarPericiasEEquipamento();
      atualizarBotoes();
    });
    corpo.querySelector('#wz-origem').addEventListener('change', e => {
      state.origem = e.target.value;
      resetarPericiasEEquipamento();
      atualizarBotoes();
    });
    corpo.querySelector('#wz-alinhamento').addEventListener('change', e => { state.alinhamento = e.target.value; atualizarBotoes(); });
  }
  function resetarPericiasEEquipamento() {
    // Raça/classe/antecedente determinam quais perícias e itens estão
    // disponíveis — mudar qualquer um invalida escolhas já feitas nos
    // passos seguintes (evita guardar uma escolha que não existe mais).
    state.pericias.clear();
    state.idiomasEscolhidos = [];
    state.equipBgSlot = {};
    state.equipClasseGrupo = {};
    state.equipClasseSlot = {};
  }

  // ── Passo 1: Atributos (Array Padrão) ───────────────────────────────
  function renderPasso1() {
    corpo.innerHTML = `
      <p class="ajuda-mini">PHB, Variante: Array Padrão — distribua ${ARRAY_PADRAO.join(', ')} entre os 6 atributos (bônus racial é somado depois, na ficha).</p>
      <div class="wizard-atributos">
        ${ATRIBUTOS.map(([k, nome]) => {
          const v = state.atributos[k];
          const usados = new Set(Object.entries(state.atributos).filter(([k2]) => k2 !== k).map(([, vv]) => vv).filter(vv => vv != null));
          const opcoes = ARRAY_PADRAO.filter(n => n === v || !usados.has(n));
          return `
            <div class="wizard-attr-row">
              <span class="wizard-attr-nome">${nome}</span>
              <select data-wz-attr="${k}">
                <option value="">—</option>
                ${opcoes.map(n => `<option value="${n}" ${n===v?'selected':''}>${n}</option>`).join('')}
              </select>
              <span class="wizard-attr-mod">${v != null ? fmtMod(mod(v)) : '—'}</span>
            </div>`;
        }).join('')}
      </div>
    `;
    corpo.querySelectorAll('[data-wz-attr]').forEach(sel => {
      sel.addEventListener('change', () => {
        const k = sel.dataset.wzAttr;
        state.atributos[k] = sel.value ? +sel.value : null;
        renderPasso();
      });
    });
  }

  // ── Passo 2: Perícias (classe + raça + antecedente) ─────────────────
  function renderPasso2() {
    const bg = origemAtual();
    const info = infoPericias();
    const nomePericia = slug => (PERICIAS.find(p => p[0] === slug) || [slug, slug])[1];
    corpo.innerHTML = `
      ${bg ? `<p class="ajuda-mini">Perícias garantidas por ${state.raca ? state.raca + ' + ' : ''}${bg.nome}: <strong>${Array.from(info.fixas).map(nomePericia).join(', ') || '—'}</strong></p>` : ''}
      ${info.totalEscolhas > 0 ? `
        <p class="ajuda-mini">Escolha <strong>${info.totalEscolhas}</strong> perícia${info.totalEscolhas>1?'s':''} (perícias já garantidas acima não aparecem na lista).</p>
        <div class="wizard-pericias-lista">
          ${info.pool.map(slug => {
            const marcada = state.pericias.has(slug);
            const travarDesmarcada = !marcada && state.pericias.size >= info.totalEscolhas;
            return `<label class="editor-check wizard-pericia-item">
              <input type="checkbox" data-wz-pericia="${slug}" ${marcada?'checked':''} ${travarDesmarcada?'disabled':''}>
              ${nomePericia(slug)}
            </label>`;
          }).join('')}
        </div>
        <p class="ajuda-mini">${state.pericias.size} / ${info.totalEscolhas} escolhidas</p>
      ` : `<p class="ajuda-mini">Essa combinação de raça/classe não tem mais nenhuma perícia à escolha.</p>`}
    `;
    corpo.querySelectorAll('[data-wz-pericia]').forEach(cb => {
      cb.addEventListener('change', () => {
        const slug = cb.dataset.wzPericia;
        if (cb.checked) state.pericias.add(slug); else state.pericias.delete(slug);
        renderPasso();
      });
    });
  }

  // ── Passo 3: Equipamento Inicial (antecedente + classe) ─────────────
  function renderSlotHtml(slot, chave, valorAtual) {
    if (!slotPrecisaEscolha(slot)) {
      const qtdTxt = slot.qtd && slot.qtd > 1 ? ` ×${slot.qtd}` : '';
      return `<div class="equip-slot-fixo">• ${escapeHtmlWizard(slot.nome || slot.custom)}${qtdTxt}</div>`;
    }
    const opcoes = opcoesDoSlot(slot);
    return `<div class="equip-slot-escolha">
      <select data-slot-key="${chave}">
        <option value="">— escolha —</option>
        ${opcoes.map(o => `<option value="${escapeHtmlWizard(o)}" ${o===valorAtual?'selected':''}>${escapeHtmlWizard(o)}</option>`).join('')}
      </select>
    </div>`;
  }

  function renderPasso3() {
    const bg = origemAtual();
    const eq = equipClasseAtual();
    if (!bg || !eq) { corpo.innerHTML = `<p class="ajuda-mini">Volte ao Passo 1 e escolha raça, classe e antecedente válidos.</p>`; return; }

    const nIdiomas = bg.idiomas?.escolhas || 0;
    const idiomasHtml = nIdiomas ? `
      <div class="wizard-equip-bloco">
        <h4>Idiomas (${nIdiomas} à escolha)</h4>
        <div class="wizard-equip-idiomas">
          ${Array.from({ length: nIdiomas }).map((_, i) => {
            const usadosPorOutros = new Set(state.idiomasEscolhidos.filter((v, idx) => idx !== i && v));
            const opcoes = IDIOMAS_PHB.filter(id => !usadosPorOutros.has(id));
            const atual = state.idiomasEscolhidos[i] || '';
            return `<select data-idioma-idx="${i}">
              <option value="">— escolha —</option>
              ${opcoes.map(id => `<option value="${id}" ${id===atual?'selected':''}>${id}</option>`).join('')}
            </select>`;
          }).join('')}
        </div>
      </div>` : '';

    const bgFerramentasHtml = bg.ferramentas.length ? `
      <div class="wizard-equip-bloco">
        <h4>Proficiências em Ferramentas (${bg.nome})</h4>
        ${bg.ferramentas.map((slot, i) => renderSlotHtml(slot, `ferr:${i}`, state.equipBgSlot[`ferr:${i}`])).join('')}
      </div>` : '';

    const bgItensHtml = `
      <div class="wizard-equip-bloco">
        <h4>Itens de ${escapeHtmlWizard(bg.nome)}</h4>
        ${bg.equipamento.map((slot, i) => renderSlotHtml(slot, `item:${i}`, state.equipBgSlot[`item:${i}`])).join('')}
        <p class="ajuda-mini">+ ${bg.ouro} po</p>
      </div>`;

    const classeHtml = `
      <div class="wizard-equip-bloco">
        <h4>Equipamento de ${escapeHtmlWizard(state.classe)}</h4>
        ${eq.escolhas.map((grupo, gi) => `
          <fieldset class="wizard-equip-grupo">
            <legend>${escapeHtmlWizard(grupo.label)}</legend>
            ${grupo.opcoes.map((opcao, oi) => {
              const selecionada = state.equipClasseGrupo[gi] === oi;
              return `
                <label class="editor-check wizard-equip-opcao">
                  <input type="radio" name="wz-grupo-${gi}" data-grupo="${gi}" data-opcao="${oi}" ${selecionada?'checked':''}>
                  ${escapeHtmlWizard(opcao.label)}
                </label>
                ${selecionada ? `<div class="wizard-equip-sub">
                  ${opcao.slots.map((slot, si) => renderSlotHtml(slot, `${gi}:${oi}:${si}`, state.equipClasseSlot[`${gi}:${oi}:${si}`])).join('')}
                </div>` : ''}
              `;
            }).join('')}
          </fieldset>
        `).join('')}
        ${eq.fixos.length ? `<div class="wizard-equip-fixos">
          <h5>Itens fixos</h5>
          ${eq.fixos.map((slot, fi) => renderSlotHtml(slot, `fixo:${fi}`, state.equipClasseSlot[`fixo:${fi}`])).join('')}
        </div>` : ''}
      </div>`;

    corpo.innerHTML = idiomasHtml + bgFerramentasHtml + bgItensHtml + classeHtml;

    corpo.querySelectorAll('[data-idioma-idx]').forEach(sel => {
      sel.addEventListener('change', () => {
        const i = +sel.dataset.idiomaIdx;
        state.idiomasEscolhidos[i] = sel.value || null;
        renderPasso();
      });
    });
    corpo.querySelectorAll('[data-slot-key]').forEach(sel => {
      sel.addEventListener('change', () => {
        const chave = sel.dataset.slotKey;
        if (chave.startsWith('ferr:') || chave.startsWith('item:')) {
          state.equipBgSlot[chave] = sel.value || null;
        } else {
          state.equipClasseSlot[chave] = sel.value || null;
        }
        renderPasso();
      });
    });
    corpo.querySelectorAll('[data-grupo]').forEach(radio => {
      radio.addEventListener('change', () => {
        const gi = +radio.dataset.grupo;
        const oi = +radio.dataset.opcao;
        state.equipClasseGrupo[gi] = oi;
        // Opção trocada: limpa escolhas de sub-slot desse grupo (podiam
        // pertencer a uma opção diferente da agora selecionada).
        Object.keys(state.equipClasseSlot).forEach(k => { if (k.startsWith(`${gi}:`)) delete state.equipClasseSlot[k]; });
        renderPasso();
      });
    });
  }

  function atualizarBotoes() {
    btnProximo.disabled = !podeAvancar();
    btnCriar.disabled = !(podeAvancar() && equipamentoCompleto());
  }

  btnAnterior.addEventListener('click', () => { state.passo = Math.max(0, state.passo - 1); renderPasso(); });
  btnProximo.addEventListener('click', () => { if (podeAvancar()) { state.passo = Math.min(ULTIMO_PASSO, state.passo + 1); renderPasso(); } });
  btnCriar.addEventListener('click', () => criarPersonagemComWizard(state, fechar));

  renderPasso();
  return { overlay, card, fechar };
}

function escapeHtmlWizard(s) { return window.Regras.escapeHtml(s || ''); }

// Resolve um slot de equipamento (com a escolha já feita, se houver) num
// item concreto pra guardar em characters.inventario, ou uma proficiência
// de ferramenta pra characters.ferramentas.
function construirItemDeSlot(slot, valorEscolhido) {
  const qtd = slot.qtd || 1;
  if (slot.custom) return { alvo: 'itens', item: { nome: slot.custom, qtd, peso: 0 } };
  const nome = slot.nome || valorEscolhido;
  if (!nome) return null;
  if (slot.tabela === 'ARMAS') {
    const c = resolverItemCatalogo('ARMAS', nome);
    return { alvo: 'armas', item: { nome: c.nome, dano: c.dano, tipo_dano: c.tipo_dano, categoria: c.categoria, propriedades: c.propriedades, peso: c.peso, custo: c.custo }, qtd };
  }
  if (slot.tabela === 'ARMADURAS') {
    const c = resolverItemCatalogo('ARMADURAS', nome);
    return { alvo: 'armaduras', item: { nome: c.nome, ca: c.ca, tipo: c.tipo, furtividade: c.furtividade, forca: c.forca, peso: c.peso, custo: c.custo } };
  }
  if (slot.tabela === 'FERRAMENTAS') {
    const c = resolverItemCatalogo('FERRAMENTAS', nome);
    return { alvo: 'itens', item: { nome: c.nome, qtd, peso: c.peso } };
  }
  const c = resolverItemCatalogo('ITENS', nome);
  return { alvo: 'itens', item: { nome: c.nome, qtd, peso: c.peso } };
}

// Monta characters.inventario/ferramentas a partir do antecedente escolhido
// (jog-9): itens fixos, itens de escolha já resolvidos e ferramentas —
// estas últimas viram TANTO um item físico quanto uma proficiência (o
// jogador ganha o kit e sabe usá-lo).
function montarEquipamentoOrigem(state) {
  const bg = origemPorNome(state.origem);
  const armas = [], armaduras = [], itens = [];
  const ferramentasProf = [];
  const empilhar = (resultado) => {
    if (!resultado) return;
    for (let i = 0; i < (resultado.qtd || 1); i++) {
      if (resultado.alvo === 'armas') armas.push({ ...resultado.item });
      else if (resultado.alvo === 'armaduras') armaduras.push({ ...resultado.item });
      else itens.push({ ...resultado.item });
    }
  };
  bg.ferramentas.forEach((slot, i) => {
    const valor = state.equipBgSlot[`ferr:${i}`];
    const nomeFinal = slot.nome || valor;
    if (nomeFinal) ferramentasProf.push(nomeFinal);
    empilhar(construirItemDeSlot(slot, valor));
  });
  bg.equipamento.forEach((slot, i) => {
    empilhar(construirItemDeSlot(slot, state.equipBgSlot[`item:${i}`]));
  });
  return { armas, armaduras, itens, ferramentasProf, ouro: bg.ouro };
}

// Idem, a partir do equipamento inicial da classe.
function montarEquipamentoClasse(state) {
  const eq = equipamentoDaClasse(state.classe);
  const armas = [], armaduras = [], itens = [];
  const empilhar = (resultado) => {
    if (!resultado) return;
    for (let i = 0; i < (resultado.qtd || 1); i++) {
      if (resultado.alvo === 'armas') armas.push({ ...resultado.item });
      else if (resultado.alvo === 'armaduras') armaduras.push({ ...resultado.item });
      else itens.push({ ...resultado.item });
    }
  };
  eq.escolhas.forEach((grupo, gi) => {
    const oi = state.equipClasseGrupo[gi];
    const slots = grupo.opcoes[oi]?.slots || [];
    slots.forEach((slot, si) => empilhar(construirItemDeSlot(slot, state.equipClasseSlot[`${gi}:${oi}:${si}`])));
  });
  eq.fixos.forEach((slot, fi) => empilhar(construirItemDeSlot(slot, state.equipClasseSlot[`fixo:${fi}`])));
  return { armas, armaduras, itens };
}

// Monta o payload de um personagem de 1° nível já com PV, dado de vida,
// salvaguardas de classe, perícias (classe+raça+antecedente) e equipamento
// inicial (antecedente+classe) — em vez do jogador ter que preencher tudo
// isso manualmente depois de criar um personagem em branco.
async function criarPersonagemComWizard(state, fechar) {
  const dadoVida = dadoVidaDaClasse(state.classe) || 8;
  const conMod = mod(state.atributos.con);
  const hpMax = Math.max(1, dadoVida + conMod);
  const salvasClasse = SALVAGUARDAS_POR_CLASSE[chaveDeClasse(state.classe)] || [];
  const bg = origemPorNome(state.origem);
  const racaInfo = PERICIAS_POR_RACA[state.raca];
  const periciasFixas = new Set([...(bg?.pericias || []), ...(racaInfo?.fixas || [])]);
  const todasPericias = new Set([...periciasFixas, ...state.pericias]);

  const origemEquip = montarEquipamentoOrigem(state);
  const classeEquip = montarEquipamentoClasse(state);

  const payload = {
    user_id: usuario.id,
    nome: state.nome.trim() || 'Novo Personagem',
    raca: state.raca,
    classe: state.classe,
    origem: state.origem,
    alinhamento: state.alinhamento,
    nivel: 1,
    atributos: { ...state.atributos },
    salvaguardas: Object.fromEntries(salvasClasse.map(k => [k, true])),
    pericias: Object.fromEntries(Array.from(todasPericias).map(k => [k, { prof: true }])),
    idiomas: ['Comum', ...state.idiomasEscolhidos.filter(Boolean)],
    ferramentas: origemEquip.ferramentasProf,
    dado_vida_tipo: dadoVida,
    dado_vida_atual: 1,
    hp_max: hpMax,
    hp_atual: hpMax,
    inventario: {
      moedas: { po: origemEquip.ouro, pp: 0, pe: 0, pc: 0, pl: 0 },
      armas: [...origemEquip.armas, ...classeEquip.armas],
      armaduras: [...origemEquip.armaduras, ...classeEquip.armaduras],
      itens: [...origemEquip.itens, ...classeEquip.itens],
    },
  };

  const { data, error } = await window.sb.from('characters').insert(payload).select('*').single();
  if (error) { toast('Erro ao criar personagem: ' + error.message); return; }
  chars.push(data);
  charAtivo = data;
  fechar();
  render();
  toast(`✓ ${data.nome} criado — confira Atributos/Perícias/Equipamento na ficha`);
}

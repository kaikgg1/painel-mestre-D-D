// assets/js/ficha/wizard_criacao.js
// Assistente de Criação de Personagem (jog-9 da auditoria) — um modal de 3
// passos (Identidade → Atributos por point-buy → Perícias) que cria um
// personagem NOVO já com os campos essenciais preenchidos corretamente,
// em vez do jogador ter que descobrir sozinho o orçamento de pontos e
// quantas/quais perícias sua classe permite escolher.
//
// PHB 5e, "Variante: Compra de Pontos" (cap. 1): orçamento de 27 pontos,
// custo por valor de atributo (8 a 15) abaixo. Perícias por classe e
// salvaguardas de classe vêm de PERICIAS_POR_CLASSE/SALVAGUARDAS_POR_CLASSE
// (nucleo.js, extraídas do capítulo de cada classe do PHB).
//
// Escopo deliberadamente "leve": não cobre raças com bônus de atributo
// variável, talentos, nem equipamento inicial — isso continua editável na
// ficha normal depois de criado, igual a qualquer outro personagem.

const CUSTO_POINT_BUY = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const ORCAMENTO_POINT_BUY = 27;

function abrirWizardCriacao() {
  const state = {
    passo: 0,
    nome: '',
    raca: RACAS[1] || '',
    classe: CLASSES[1] || '',
    origem: '',
    alinhamento: '',
    atributos: { for: 8, dex: 8, con: 8, int: 8, sab: 8, car: 8 },
    pericias: new Set(),
  };

  const custoGasto = () => ATRIBUTOS.reduce((soma, [k]) => soma + (CUSTO_POINT_BUY[state.atributos[k]] ?? 0), 0);
  const opcoesClasseAtual = () => opcoesPericiasDaClasse(state.classe) || { escolhas: 0, opcoes: [] };

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
  card.querySelector('#wizard-cancelar').addEventListener('click', fechar);

  function podeAvancar() {
    if (state.passo === 0) return !!(state.nome.trim() && state.raca && state.classe);
    if (state.passo === 1) return custoGasto() <= ORCAMENTO_POINT_BUY;
    return true;
  }

  function renderPasso() {
    const TITULOS = ['Identidade', 'Atributos (Compra de Pontos)', 'Perícias'];
    passoLbl.textContent = `Passo ${state.passo + 1} de 3 — ${TITULOS[state.passo]}`;

    if (state.passo === 0) {
      corpo.innerHTML = `
        <div class="campo"><label>Nome do Personagem</label>
          <input type="text" id="wz-nome" value="${escapeHtmlWizard(state.nome)}" placeholder="Ex.: Elara Ventoluz"></div>
        <div class="grid-2">
          <div class="campo"><label>Raça</label>
            <select id="wz-raca">${RACAS.filter(Boolean).map(r => `<option ${r===state.raca?'selected':''}>${r}</option>`).join('')}</select></div>
          <div class="campo"><label>Classe</label>
            <select id="wz-classe">${CLASSES.filter(Boolean).map(c => `<option ${c===state.classe?'selected':''}>${c}</option>`).join('')}</select></div>
          <div class="campo"><label>Origem (Background)</label>
            <input type="text" id="wz-origem" value="${escapeHtmlWizard(state.origem)}" placeholder="Ex.: Acólito"></div>
          <div class="campo"><label>Alinhamento</label>
            <select id="wz-alinhamento">${ALINHAMENTOS.map(a => `<option value="${escapeHtmlWizard(a)}" ${a===state.alinhamento?'selected':''}>${a || '—'}</option>`).join('')}</select></div>
        </div>
      `;
      corpo.querySelector('#wz-nome').addEventListener('input', e => { state.nome = e.target.value; atualizarBotoes(); });
      corpo.querySelector('#wz-raca').addEventListener('change', e => { state.raca = e.target.value; atualizarBotoes(); });
      corpo.querySelector('#wz-classe').addEventListener('change', e => {
        state.classe = e.target.value;
        state.pericias.clear(); // lista de perícias válidas muda com a classe
        atualizarBotoes();
      });
      corpo.querySelector('#wz-origem').addEventListener('input', e => { state.origem = e.target.value; });
      corpo.querySelector('#wz-alinhamento').addEventListener('change', e => { state.alinhamento = e.target.value; });
    }

    if (state.passo === 1) {
      const gasto = custoGasto();
      const restante = ORCAMENTO_POINT_BUY - gasto;
      corpo.innerHTML = `
        <p class="ajuda-mini">PHB, Variante: Compra de Pontos — ${ORCAMENTO_POINT_BUY} pontos, valores de 8 a 15 (bônus racial é somado depois, na ficha).</p>
        <div class="wizard-pontos-restantes ${restante < 0 ? 'negativo' : ''}">Pontos restantes: <strong>${restante}</strong> / ${ORCAMENTO_POINT_BUY}</div>
        <div class="wizard-atributos">
          ${ATRIBUTOS.map(([k, nome]) => {
            const v = state.atributos[k];
            return `
              <div class="wizard-attr-row">
                <span class="wizard-attr-nome">${nome}</span>
                <button type="button" class="wizard-attr-btn" data-wz-attr="${k}" data-wz-delta="-1" ${v<=8?'disabled':''} aria-label="Diminuir ${nome}">−</button>
                <span class="wizard-attr-valor">${v}</span>
                <button type="button" class="wizard-attr-btn" data-wz-attr="${k}" data-wz-delta="1" ${v>=15?'disabled':''} aria-label="Aumentar ${nome}">+</button>
                <span class="wizard-attr-mod">${fmtMod(mod(v))}</span>
                <span class="ajuda-mini">custo ${CUSTO_POINT_BUY[v]}</span>
              </div>`;
          }).join('')}
        </div>
      `;
      corpo.querySelectorAll('[data-wz-attr]').forEach(btn => {
        btn.addEventListener('click', () => {
          const k = btn.dataset.wzAttr;
          const delta = +btn.dataset.wzDelta;
          const novo = Math.max(8, Math.min(15, state.atributos[k] + delta));
          if (novo === state.atributos[k]) return;
          const custoAntes = CUSTO_POINT_BUY[state.atributos[k]];
          const custoDepois = CUSTO_POINT_BUY[novo];
          if (delta > 0 && (custoGasto() - custoAntes + custoDepois) > ORCAMENTO_POINT_BUY) {
            toast('Sem pontos suficientes pra esse aumento.');
            return;
          }
          state.atributos[k] = novo;
          renderPasso();
          atualizarBotoes();
        });
      });
    }

    if (state.passo === 2) {
      const def = opcoesClasseAtual();
      corpo.innerHTML = !def.opcoes.length ? `<p class="ajuda-mini">Escolha uma classe válida no Passo 1 pra ver as perícias disponíveis.</p>` : `
        <p class="ajuda-mini">${CLASSES.includes(state.classe) ? state.classe : 'Sua classe'}: escolha <strong>${def.escolhas}</strong> perícia${def.escolhas>1?'s':''}.</p>
        <div class="wizard-pericias-lista">
          ${def.opcoes.map(slug => {
            const p = PERICIAS.find(x => x[0] === slug);
            const marcada = state.pericias.has(slug);
            const travarDesmarcada = !marcada && state.pericias.size >= def.escolhas;
            return `<label class="editor-check wizard-pericia-item">
              <input type="checkbox" data-wz-pericia="${slug}" ${marcada?'checked':''} ${travarDesmarcada?'disabled':''}>
              ${p ? p[1] : slug}
            </label>`;
          }).join('')}
        </div>
        <p class="ajuda-mini">${state.pericias.size} / ${def.escolhas} escolhidas</p>
      `;
      corpo.querySelectorAll('[data-wz-pericia]').forEach(cb => {
        cb.addEventListener('change', () => {
          const slug = cb.dataset.wzPericia;
          if (cb.checked) state.pericias.add(slug); else state.pericias.delete(slug);
          renderPasso();
        });
      });
    }

    btnAnterior.hidden = state.passo === 0;
    btnProximo.hidden = state.passo === 2;
    btnCriar.hidden = state.passo !== 2;
    atualizarBotoes();
  }

  function atualizarBotoes() {
    btnProximo.disabled = !podeAvancar();
    const def = opcoesClasseAtual();
    btnCriar.disabled = def.escolhas > 0 && state.pericias.size !== def.escolhas;
  }

  btnAnterior.addEventListener('click', () => { state.passo = Math.max(0, state.passo - 1); renderPasso(); });
  btnProximo.addEventListener('click', () => { if (podeAvancar()) { state.passo = Math.min(2, state.passo + 1); renderPasso(); } });
  btnCriar.addEventListener('click', () => criarPersonagemComWizard(state, fechar));

  renderPasso();
  return { overlay, card, fechar };
}

function escapeHtmlWizard(s) { return window.Regras.escapeHtml(s || ''); }

// Monta o payload de um personagem de 1° nível já com PV, dado de vida,
// salvaguardas de classe e perícias escolhidas — em vez do jogador ter que
// preencher tudo isso manualmente depois de criar um personagem em branco.
async function criarPersonagemComWizard(state, fechar) {
  const dadoVida = dadoVidaDaClasse(state.classe) || 8;
  const conMod = mod(state.atributos.con);
  const hpMax = Math.max(1, dadoVida + conMod);
  const salvasClasse = SALVAGUARDAS_POR_CLASSE[chaveDeClasse(state.classe)] || [];

  const payload = {
    user_id: usuario.id,
    nome: state.nome.trim() || 'Novo Personagem',
    raca: state.raca,
    classe: state.classe,
    origem: state.origem.trim(),
    alinhamento: state.alinhamento,
    nivel: 1,
    atributos: { ...state.atributos },
    salvaguardas: Object.fromEntries(salvasClasse.map(k => [k, true])),
    pericias: Object.fromEntries(Array.from(state.pericias).map(k => [k, { prof: true }])),
    dado_vida_tipo: dadoVida,
    dado_vida_atual: 1,
    hp_max: hpMax,
    hp_atual: hpMax,
  };

  const { data, error } = await window.sb.from('characters').insert(payload).select('*').single();
  if (error) { toast('Erro ao criar personagem: ' + error.message); return; }
  chars.push(data);
  charAtivo = data;
  fechar();
  render();
  toast(`✓ ${data.nome} criado — confira Atributos/Perícias na aba Personagem`);
}

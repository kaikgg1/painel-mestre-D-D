// assets/js/ficha/aba_combate.js
// Aba Combate (Fase 4 do redesign): HP (barra, dano/cura, atalhos), CA/
// Iniciativa/Deslocamento/Inspiração num stat-row compacto, dado de vida,
// exaustão, condições, salvaguardas e perícias (consulta compacta com
// editor em acordeão) e um resumo de conjuração com os detalhes completos
// recolhidos — a lista completa de magias mora na aba Magias.
//
// Os campos continuam os MESMOS <input name="..."> de sempre, só reorganizados
// visualmente: o autosave guardado por aba (salvar.js, fd.has('_aba_combate'))
// não mudou uma linha. Editores recolhidos usam [hidden], que NÃO tira o
// campo do FormData — só escondido, ele ainda é lido e salvo normalmente.

function iconeVida(pct) {
  if (pct <= 0)  return ico('caveira', { cor: '#8a8a8a' });
  if (pct <= 25) return ico('vida',    { cor: '#a5433a' });
  if (pct <= 50) return ico('vida',    { cor: '#c49a3a' });
  if (pct <= 75) return ico('coracao', { cor: '#dfc57a' });
  return ico('coracao', { cor: '#7a8a5e' });
}

function renderCombate(c) {
  const slots = c.slots_magia || {};
  const salv = c.salvaguardas || {};
  const per = c.pericias || {};
  const hpAtual = c.hp_atual ?? 10;
  const hpMax = c.hp_max ?? 10;
  const pct = hpMax > 0 ? Math.max(0, Math.min(100, Math.round((hpAtual / hpMax) * 100))) : 0;
  const icone = iconeVida(pct);
  const classeBar = pct <= 15 ? 'critico' : pct <= 35 ? 'baixo' : pct <= 65 ? 'medio' : '';
  const insp = +c.inspiracao || 0;
  const ativas = Array.isArray(c.condicoes) ? c.condicoes : [];

  return `
    <input type="hidden" name="_aba_combate" value="1">

    <div class="stat-row combate-topo">
      <div class="stat-card stat-hp">
        <div class="stat-card-label"><span id="hp-icone-atual">${icone}</span> Pontos de Vida</div>
        <div class="hp-numero">
          <input name="hp_atual" type="text" inputmode="numeric" value="${hpAtual}" data-validar="int" id="hp-atual-input" aria-label="PV atual">
          <span class="sep">/</span>
          <input name="hp_max" type="text" inputmode="numeric" value="${hpMax}" data-validar="int" data-min="0" id="hp-max-input" aria-label="PV máximo">
        </div>
        <div class="hp-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <div class="hp-fill ${classeBar}" id="hp-fill" style="width:${pct}%"></div>
          <div class="hp-percent" id="hp-percent">${pct}%</div>
        </div>
        <div class="hp-temp-label">
          PV Temp.: <input name="hp_temp" type="text" inputmode="numeric" value="${c.hp_temp ?? 0}" data-validar="int" data-min="0">
        </div>
        <div id="exaustao-hp-aviso"></div>

        <div class="hp-aplicar">
          <div class="hp-aplicar-linha">
            <button type="button" class="hp-btn dano" data-aplicar="dano" aria-label="Aplicar dano">${ico('dano')} Dano</button>
            <input type="text" inputmode="numeric" id="hp-aplicar-input" value="" placeholder="0" aria-label="Quantidade">
            <button type="button" class="hp-btn cura" data-aplicar="cura" aria-label="Aplicar cura">${ico('cura')} Cura</button>
          </div>
          <div class="hp-quick" aria-label="Atalhos rápidos">
            <button type="button" class="q-dano" data-quick="-20">-20</button>
            <button type="button" class="q-dano" data-quick="-10">-10</button>
            <button type="button" class="q-dano" data-quick="-5">-5</button>
            <button type="button" class="q-dano" data-quick="-1">-1</button>
            <button type="button" class="q-cura" data-quick="1">+1</button>
            <button type="button" class="q-cura" data-quick="5">+5</button>
            <button type="button" class="q-cura" data-quick="10">+10</button>
            <button type="button" class="q-cura" data-quick="20">+20</button>
          </div>
        </div>
      </div>

      <div class="stat-card"><div class="stat-card-label">${ico('escudo')} CA</div>
        <div class="stat-card-valor"><input name="ca" type="text" inputmode="numeric" value="${c.ca ?? 10}" data-validar="int" aria-label="Classe de Armadura"></div></div>
      <div class="stat-card"><div class="stat-card-label">${ico('iniciativa')} Iniciativa</div>
        <div class="stat-card-valor"><input name="iniciativa_bonus" type="text" inputmode="numeric" value="${c.iniciativa_bonus ?? 0}" data-validar="int" aria-label="Iniciativa (bônus)"></div></div>
      <div class="stat-card"><div class="stat-card-label">${ico('pegadas')} Deslocamento</div>
        <div class="stat-card-valor"><input name="deslocamento" type="text" inputmode="decimal" value="${c.deslocamento ?? 9}" data-validar="num" data-min="0" aria-label="Deslocamento em metros"></div>
        <div class="ajuda-mini" id="desloc-efetivo"></div></div>
      <div class="stat-card stat-insp">
        <div class="stat-card-label">${ico('inspiracao')} Inspiração</div>
        <div class="resumo-insp-linha">
          <button type="button" class="insp-btn" id="insp-menos" aria-label="Diminuir inspiração">−</button>
          <input type="text" inputmode="numeric" name="inspiracao" id="insp-input" value="${insp}" data-validar="int" data-min="0" class="stat-card-valor resumo-insp-input" aria-label="Inspiração">
          <button type="button" class="insp-btn" id="insp-mais" aria-label="Aumentar inspiração">+</button>
        </div>
      </div>
    </div>

    <div class="stats-mini">
      <div class="stat-mini">
        <span class="ic">${ico('dado')}</span>
        <label>Dado de Vida</label>
        ${(() => {
          const dv = dadoVidaDaClasse(c.classe) || c.dado_vida_tipo || 8;
          return `<div class="readonly-stat" id="dv-display" title="Definido pela classe (D&D 5e)">d${dv}</div>
            <input type="hidden" name="dado_vida_tipo" id="dv-hidden" value="${dv}">
            <span class="ajuda-mini">${c.classe ? 'classe: ' + c.classe : 'escolha uma classe'}</span>`;
        })()}
      </div>
      <div class="stat-mini">
        <span class="ic">${ico('tempo')}</span>
        <label>DV Restantes</label>
        <input name="dado_vida_atual" type="text" inputmode="numeric" value="${c.dado_vida_atual ?? 1}" data-validar="int" data-min="0" id="dv-atual-input">
        <button type="button" class="btn no-lock" id="btn-gastar-dado-vida" title="Gastar 1 Dado de Vida no fim de um descanso curto (PHB): rola o dado + mod. de Constituição, mínimo 0">${ico('dado')} Gastar</button>
      </div>
      <div class="stat-mini">
        <span class="ic">${ico('atordoado')}</span>
        <label>Exaustão</label>
        <input name="exaustao" type="text" inputmode="numeric" value="${c.exaustao ?? 0}" data-validar="int" data-min="0" data-max="6">
        <span class="ajuda-mini">0 a 6</span>
      </div>
    </div>
    <div id="exaustao-resumo"></div>

    <div class="descanso-bar" role="group" aria-label="Aplicar descanso">
      <button type="button" class="btn no-lock" data-descanso="curto">${ico('folego')} Descanso Curto</button>
      <button type="button" class="btn no-lock" data-descanso="longo">${ico('descanso')} Descanso Longo</button>
    </div>

    ${renderConcentracaoBloco(c)}

    <h3>Condições</h3>
    ${renderCondicoesBloco('combate-condicoes-wrap', ativas)}

    <div class="modo-rolagem-bar">
      <span class="ajuda-mini">Rolar perícia/salvaguarda/ataque com:</span>
      <button type="button" class="pill modo-rolagem-${_modoRolagem} no-lock" id="btn-modo-rolagem" aria-live="polite">${ROTULO_MODO_ROLAGEM[_modoRolagem]}</button>
    </div>

    <h3>Salvaguardas <span class="legenda-simbolos">○ sem proficiência · ● proficiência</span></h3>
    <div class="lista-compacta">
      ${ATRIBUTOS.map(([k, nome]) => {
        const prof = salvProf(salv, k);
        const bonus = salvBonus(salv, k);
        const valor = valorSalvaguarda(c, k);
        return `
          <div class="linha-compacta">
            <button type="button" class="linha-gatilho" data-toggle-editor="salv-${k}" aria-expanded="false" aria-controls="editor-salv-${k}">
              <span class="linha-simbolo ${prof ? 'prof' : ''}" data-salv-simbolo="${k}">${prof ? '●' : '○'}</span>
              <span class="linha-nome">${nome}</span>
              <span class="linha-attr">${k.toUpperCase()}</span>
              <span class="linha-valor" data-salv-valor="${k}">${fmtMod(valor)}</span>
            </button>
            <button type="button" class="linha-rolar no-lock" data-rolar-salv="${k}" data-rolar-nome="Salvaguarda de ${nome}" aria-label="Rolar salvaguarda de ${nome}">${ico('dado')}</button>
            <div class="linha-editor" id="editor-salv-${k}" hidden>
              <label class="editor-check"><input type="checkbox" name="salv_${k}" ${prof ? 'checked' : ''} data-salv="${k}"> Proficiente</label>
              <label class="editor-bonus">Bônus extra
                <input class="bonus-input" type="text" inputmode="numeric" name="salv_${k}_bonus" value="${bonus||0}" data-salv-bonus="${k}" aria-label="Bônus extra de ${nome}">
              </label>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <h3>Perícias <span class="legenda-simbolos">○ sem proficiência · ● proficiência · ◆ expertise</span></h3>
    <div class="lista-compacta">
      ${PERICIAS.map(([k, nome, atr]) => {
        const p = per[k] || {};
        const bonus = +p.bonus || 0;
        const valor = valorPericia(c, k, atr);
        const simbolo = p.exp ? '◆' : p.prof ? '●' : '○';
        return `
          <div class="linha-compacta">
            <button type="button" class="linha-gatilho" data-toggle-editor="per-${k}" aria-expanded="false" aria-controls="editor-per-${k}">
              <span class="linha-simbolo ${p.exp ? 'exp' : p.prof ? 'prof' : ''}" data-per-simbolo="${k}">${simbolo}</span>
              <span class="linha-nome">${nome}</span>
              <span class="linha-attr">${atr.toUpperCase()}</span>
              <span class="linha-valor" data-per-valor="${k}">${fmtMod(valor)}</span>
            </button>
            <button type="button" class="linha-rolar no-lock" data-rolar-per="${k}" data-rolar-nome="${nome}" aria-label="Rolar ${nome}">${ico('dado')}</button>
            <div class="linha-editor" id="editor-per-${k}" hidden>
              <label class="editor-check"><input type="checkbox" name="per_${k}_prof" ${p.prof?'checked':''} data-per="${k}" data-atr="${atr}"> Proficiente</label>
              <label class="editor-check"><input type="checkbox" name="per_${k}_exp" ${p.exp?'checked':''} ${p.prof?'':'disabled'} data-per-exp="${k}"> Expertise</label>
              <label class="editor-bonus">Bônus extra
                <input class="bonus-input" type="text" inputmode="numeric" name="per_${k}_bonus" value="${bonus||0}" data-per-bonus="${k}" aria-label="Bônus extra de ${nome}">
              </label>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    ${classeUsaMagia(c) ? `
    <h3>Conjuração</h3>
    <div class="stat-row">
      <div class="stat-card"><div class="stat-card-label">CD de Resistência</div><div class="stat-card-valor">${c.cd_resistencia ?? 8}</div></div>
      <div class="stat-card"><div class="stat-card-label">Ataque Mágico</div><div class="stat-card-valor">${fmtMod(c.bonus_atq_magia ?? 0)}</div></div>
    </div>
    ${renderSlotsResumo(c)}
    <button type="button" class="btn no-lock" data-resumo-ir="magias">${ico('conjurar')} Ver Magias</button>

    <details class="detalhes-conjuracao">
      <summary>Editar CD, bônus e espaços de magia</summary>
      <div class="grid-3" style="margin-top:14px">
        <div class="campo"><label>Truques Conhecidos</label>
          <input type="text" inputmode="numeric" name="truques_conhecidos" value="${c.truques_conhecidos ?? 0}" data-validar="int" data-min="0"></div>
        <div class="campo"><label>Magias Conhecidas</label>
          <input type="text" inputmode="numeric" name="magias_conhecidas" value="${c.magias_conhecidas ?? 0}" data-validar="int" data-min="0"></div>
        <div class="campo"><label>CD de Resistência</label>
          <input type="text" inputmode="numeric" name="cd_resistencia" value="${c.cd_resistencia ?? 8}" data-validar="int" data-min="0">
          <span class="ajuda">8 + prof + mod do atributo de conjuração</span></div>
        <div class="campo"><label>Bônus de Ataque de Magia</label>
          <input type="text" inputmode="numeric" name="bonus_atq_magia" value="${c.bonus_atq_magia ?? 0}" data-validar="int"></div>
      </div>
      <h4 style="margin:16px 0 8px">Espaços de Magia (clique pra gastar/recuperar)</h4>
      ${renderSlotsMagia(c, slots)}
    </details>
    ` : ''}
  `;
}

// Estado de concentração (characters.concentracao) — a magia em si já é
// escolhida ao conjurar (aba_magias.js); aqui só mostra o estado atual e
// permite encerrar manualmente (ex.: falhou no teste de Constituição).
function renderConcentracaoBloco(c) {
  const conc = c.concentracao || {};
  if (!conc.ativa) {
    return `<div class="concentracao-bar concentracao-inativa">${ico('encantamento')} Sem concentração ativa</div>`;
  }
  return `<div class="concentracao-bar concentracao-ativa">
    <span>${ico('encantamento')} Concentrando em <strong>${escape(conc.magia || '?')}</strong></span>
    <button type="button" class="btn no-lock" data-concentracao-encerrar>Encerrar</button>
  </div>`;
}

function conectarListenersCombate() {
  // Editores em acordeão de salvaguardas/perícias — um clique no gatilho
  // mostra/esconde o [hidden]. Os campos continuam no form o tempo todo
  // (escondidos não saem do FormData), então isso não muda nada em salvar().
  document.querySelectorAll('[data-toggle-editor]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ed = document.getElementById('editor-' + btn.dataset.toggleEditor);
      if (!ed) return;
      ed.hidden = !ed.hidden;
      btn.setAttribute('aria-expanded', String(!ed.hidden));
    });
  });

  conectarListenersCondicoes('combate-condicoes-wrap');

  document.querySelectorAll('[data-descanso]').forEach(btn => {
    btn.addEventListener('click', () => aplicarDescanso(btn.dataset.descanso));
  });

  // Gastar 1 Dado de Vida (PHB, Descanso Curto): rola o dado da classe,
  // soma o mod. de Constituição (mínimo 0 recuperado), aplica no PV e
  // desconta o DV — via os próprios inputs do form, então o autosave normal
  // da aba Combate persiste (mesmo caminho de aplicarHP em listeners.js).
  const btnGastarDV = document.getElementById('btn-gastar-dado-vida');
  if (btnGastarDV) btnGastarDV.addEventListener('click', () => {
    const inpDv = document.getElementById('dv-atual-input');
    const inpHpAtual = document.querySelector('[name="hp_atual"]');
    const inpHpMax = document.querySelector('[name="hp_max"]');
    if (!inpDv || !inpHpAtual) return;
    const dvRestantes = parseNum(inpDv.value, { inteiro: true, min: 0 }) ?? 0;
    if (dvRestantes < 1) { toast('Sem Dados de Vida disponíveis'); return; }
    const faces = dadoVidaDaClasse(charAtivo.classe) || charAtivo.dado_vida_tipo || 8;
    const rolagem = 1 + Math.floor(Math.random() * faces);
    const conMod = mod(charAtivo.atributos?.con ?? 10);
    const recuperado = Math.max(0, rolagem + conMod);
    const hpMax = parseNum(inpHpMax?.value, { inteiro: true }) ?? charAtivo.hp_max ?? 0;
    const hpAtual = parseNum(inpHpAtual.value, { inteiro: true }) ?? 0;
    const novoHp = hpMax > 0 ? Math.min(hpMax, hpAtual + recuperado) : hpAtual + recuperado;
    inpHpAtual.value = novoHp;
    inpDv.value = dvRestantes - 1;
    inpHpAtual.dispatchEvent(new Event('input', { bubbles: true }));
    inpDv.dispatchEvent(new Event('input', { bubbles: true }));
    toast(`Dado de Vida: d${faces}(${rolagem}) ${fmtMod(conMod)} = +${recuperado} PV`, 'dado');
  });

  const btnEncerrarConc = document.querySelector('[data-concentracao-encerrar]');
  if (btnEncerrarConc) btnEncerrarConc.addEventListener('click', () => {
    encerrarConcentracao();
    toast('Concentração encerrada');
    render();
  });

  // Modo de rolagem (Normal/Vantagem/Desvantagem) — atualização direta do
  // botão em vez de re-render completo da aba (é só um rótulo mudando).
  const btnModo = document.getElementById('btn-modo-rolagem');
  if (btnModo) btnModo.addEventListener('click', () => {
    cicloModoRolagem();
    btnModo.textContent = ROTULO_MODO_ROLAGEM[_modoRolagem];
    btnModo.className = 'pill modo-rolagem-' + _modoRolagem + ' no-lock';
  });

  // Rolar salvaguarda/perícia (🎲), respeitando o modo de rolagem atual.
  document.querySelectorAll('[data-rolar-salv]').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.rolarSalv;
      const valor = valorSalvaguarda(charAtivo, k);
      const r = window.Regras.rolarD20(valor, _modoRolagem);
      toast(`${btn.dataset.rolarNome}: ${r.texto}${r.critico ? ' — CRÍTICO!' : r.falhaCritica ? ' — falha crítica' : ''}`, 'dado');
    });
  });
  document.querySelectorAll('[data-rolar-per]').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.rolarPer;
      const atr = PERICIAS.find(p => p[0] === k)?.[2];
      const valor = valorPericia(charAtivo, k, atr);
      const r = window.Regras.rolarD20(valor, _modoRolagem);
      toast(`${btn.dataset.rolarNome}: ${r.texto}${r.critico ? ' — CRÍTICO!' : r.falhaCritica ? ' — falha crítica' : ''}`, 'dado');
    });
  });
}

// Aplica os efeitos de exaustão do PHB (2014) nos avisos da aba Combate —
// mesmo módulo/mesmo campo `exaustao` usado pelo painel do Mestre, então
// os efeitos batem nos dois lados automaticamente via sync do Supabase.
function atualizarExaustaoUI() {
  if (!window.ExaustaoRegras) return;
  const avisoEl = document.getElementById('exaustao-hp-aviso');
  const deslocEl = document.getElementById('desloc-efetivo');
  const resumoEl = document.getElementById('exaustao-resumo');
  if (!avisoEl && !deslocEl && !resumoEl) return; // não está na aba Combate

  const inpExaustao = document.querySelector('[name="exaustao"]');
  const inpDeslocamento = document.querySelector('[name="deslocamento"]');
  const inpHpMax = document.querySelector('[name="hp_max"]');
  const nivel = inpExaustao ? parseNum(inpExaustao.value, { inteiro: true, min: 0, max: 6 }) ?? 0 : (charAtivo.exaustao ?? 0);
  const deslocBase = inpDeslocamento ? (parseNum(inpDeslocamento.value, { min: 0 }) ?? 0) : (charAtivo.deslocamento ?? 9);
  const hpMaxBase = inpHpMax ? (parseNum(inpHpMax.value, { inteiro: true, min: 0 }) ?? 0) : (charAtivo.hp_max ?? 0);
  const ef = window.ExaustaoRegras.efeitos(nivel);

  if (avisoEl) {
    if (ef.morto) {
      avisoEl.innerHTML = `<div class="exaustao-aviso">${ico('caveira') || '☠'} Exaustão nível 6 — morto</div>`;
    } else if (ef.hpMaxMult < 1) {
      const efetivo = window.ExaustaoRegras.hpMaxEfetivo(hpMaxBase, nivel);
      avisoEl.innerHTML = `<div class="exaustao-aviso">${ico('aviso') || '⚠'} PV máx. efetivo (exaustão): ${efetivo}</div>`;
    } else {
      avisoEl.innerHTML = '';
    }
  }

  if (deslocEl) {
    if (ef.velocidadeMult < 1 || ef.velocidadeZero) {
      const efetivo = window.ExaustaoRegras.velocidadeEfetiva(deslocBase, nivel);
      deslocEl.textContent = `efetivo (exaustão): ${efetivo}m`;
    } else {
      deslocEl.textContent = '';
    }
  }

  if (resumoEl) {
    if (nivel > 0) {
      resumoEl.innerHTML = `<div class="exaustao-resumo-txt">${ico('atordoado') || '⚠'} Exaustão ${nivel}/6 — ${ef.resumo.join(' · ')}</div>`;
    } else {
      resumoEl.innerHTML = '';
    }
  }
}

function renderSlotsMagia(c, slots) {
  const tipo = (window.SlotsPHB && c.classe) ? window.SlotsPHB.tipoDaClasse(c.classe, c.subclasse) : null;
  const slotsClasse = (window.SlotsPHB && c.classe) ? window.SlotsPHB.porClasse(c.classe, c.nivel || 1, c.subclasse) : null;

  // Classe sem slots (Bárbaro, Guerreiro, Ladino, Monge sem subclasse mágica)
  if (!slotsClasse) {
    return `<div class="slots-vazio">${ico('ataque')} ${c.classe || 'Classe'} não recebe espaços de magia pelas regras padrão.<br><span style="font-size:11px">(Subclasses Cavaleiro Místico e Trapaceiro Arcano podem ter — registre em "Características Adicionais".)</span></div>`;
  }

  const cabecalho = tipo === 'pact'
    ? `<div class="slots-info"><span class="ic">${ico('adivinhacao')}</span><div>Bruxo usa <strong>Magia do Pacto</strong>: todos os slots são do mesmo nível e recuperam em <strong>descanso curto</strong>.</div></div>`
    : tipo === 'third'
    ? `<div class="slots-info"><span class="ic">${ico('pergaminho')}</span><div>1/3 conjurador (<strong>${escape(c.subclasse)}</strong>) · Nível <strong>${c.nivel||1}</strong>. Slots calculados pela subclasse, recuperam em <strong>descanso longo</strong>.</div></div>`
    : `<div class="slots-info"><span class="ic">${ico('pergaminho')}</span><div>Espaços calculados automaticamente: <strong>${c.classe}</strong> · Nível <strong>${c.nivel||1}</strong>. Recuperam em <strong>descanso longo</strong>.</div></div>`;

  const niveisComSlots = Object.entries(slotsClasse).filter(([nv, max]) => max > 0);
  if (!niveisComSlots.length) {
    return cabecalho + `<div class="slots-vazio">No nível atual, esta classe ainda não tem espaços de magia.</div>`;
  }

  return cabecalho + `<div class="slots-grid">
    ${[1,2,3,4,5,6,7,8,9].map(nv => {
      const max = slotsClasse[nv] || 0;
      const s = slots[nv] || { atual: 0, max: 0 };
      const usados = Math.min(s.atual || 0, max);
      const disponivel = max - usados;
      if (max === 0) {
        return `<div class="slot-card indisponivel">
          <div class="slot-titulo">Nível ${nv}</div>
          <div class="slot-max">—</div>
          <div class="slot-status">indisponível</div>
        </div>`;
      }
      const pips = Array.from({length: max}).map((_, i) =>
        `<button type="button" class="slot-pip ${i < usados ? 'gasto' : ''}" data-slot-nv="${nv}" data-slot-idx="${i}" aria-label="Slot ${nv}° nível, espaço ${i+1}, ${i < usados ? 'gasto' : 'disponível'}"></button>`
      ).join('');
      return `<div class="slot-card">
        <div class="slot-titulo">Nível ${nv}</div>
        <div class="slot-max" title="Máximo da classe">${max}</div>
        <div class="slot-pips" data-slot-nv="${nv}">${pips}</div>
        <div class="slot-status"><strong>${disponivel}</strong> / ${max} disponíveis</div>
        <input type="hidden" name="slot_${nv}_max" value="${max}">
        <input type="hidden" name="slot_${nv}_atual" value="${usados}">
      </div>`;
    }).join('')}
  </div>`;
}

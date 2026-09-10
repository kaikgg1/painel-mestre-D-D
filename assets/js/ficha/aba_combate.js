// assets/js/ficha/aba_combate.js
// Aba Combate: HP (barra, dano/cura), CA, iniciativa, deslocamento, dado de
// vida, exaustão, salvaguardas, perícias, bloco de magia e espaços de magia.
// Cálculos vêm de nucleo.js (mod/bonusProf), ExaustaoRegras e SlotsPHB.

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
  return `
    <div class="combate-hero">
      <div class="hp-wrap">
        <div class="hp-titulo"><span class="hp-icone" id="hp-icone-atual">${icone}</span> Pontos de Vida</div>
        <div class="hp-numero">
          <input name="hp_atual" type="text" inputmode="numeric" value="${hpAtual}" data-validar="int" id="hp-atual-input" aria-label="PV atual">
          <span class="sep">/</span>
          <input name="hp_max" type="text" inputmode="numeric" value="${hpMax}" data-validar="int" data-min="0" id="hp-max-input" aria-label="PV máximo">
        </div>
        <div class="hp-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <div class="hp-fill ${classeBar}" id="hp-fill" style="width:${pct}%"></div>
          <div class="hp-percent" id="hp-percent">${pct}%</div>
        </div>
        <div class="hp-temp-label" style="margin-top:8px;text-align:center">
          PV Temporários: <input name="hp_temp" type="text" inputmode="numeric" value="${c.hp_temp ?? 0}" data-validar="int" data-min="0">
        </div>
        <div id="exaustao-hp-aviso"></div>

        <!-- Painel aplicar dano/cura -->
        <div class="hp-aplicar">
          <div class="hp-aplicar-titulo">Aplicar Dano ou Cura</div>
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

      <div class="stat-hero">
        <div class="stat-icone">${ico('escudo')}</div>
        <div class="stat-titulo">Classe de Armadura</div>
        <input name="ca" type="text" inputmode="numeric" value="${c.ca ?? 10}" data-validar="int" aria-label="CA">
      </div>

      <div class="stat-hero">
        <div class="stat-icone">${ico('iniciativa')}</div>
        <div class="stat-titulo">Iniciativa</div>
        <input name="iniciativa_bonus" type="text" inputmode="numeric" value="${c.iniciativa_bonus ?? 0}" data-validar="int" aria-label="Iniciativa (bônus)">
      </div>
    </div>

    <div class="stats-mini">
      <div class="stat-mini">
        <span class="ic">${ico('pegadas')}</span>
        <label>Deslocamento</label>
        <input name="deslocamento" type="text" inputmode="decimal" value="${c.deslocamento ?? 9}" data-validar="num" data-min="0">
        <span class="ajuda-mini">metros · aceita decimal</span>
        <span class="ajuda-mini" id="desloc-efetivo"></span>
      </div>
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
        <input name="dado_vida_atual" type="text" inputmode="numeric" value="${c.dado_vida_atual ?? 1}" data-validar="int" data-min="0">
      </div>
      <div class="stat-mini">
        <span class="ic">${ico('atordoado')}</span>
        <label>Exaustão</label>
        <input name="exaustao" type="text" inputmode="numeric" value="${c.exaustao ?? 0}" data-validar="int" data-min="0" data-max="6">
        <span class="ajuda-mini">0 a 6</span>
      </div>
    </div>
    <div id="exaustao-resumo"></div>

    <input type="hidden" name="_aba_combate" value="1">
    <h3>Salvaguardas <span style="font-size:11px;color:var(--text-dim);font-weight:normal;font-style:italic">(auto: modificador + ${bonusProf(c.nivel)} se proficiente · campo ± = bônus extra)</span></h3>
    <div class="check-grid">
      ${ATRIBUTOS.map(([k, nome]) => {
        const prof = salvProf(salv, k);
        const bonus = salvBonus(salv, k);
        const valor = valorSalvaguarda(c, k);
        return `
          <div class="check-row">
            <label><input type="checkbox" name="salv_${k}" ${prof ? 'checked' : ''} data-salv="${k}"> ${nome}</label>
            <span class="bonus-wrap" title="Bônus extra (item, dádiva, situacional)">
              <span class="bonus-pm">±</span>
              <input class="bonus-input" type="text" inputmode="numeric" name="salv_${k}_bonus" value="${bonus||0}" data-salv-bonus="${k}" aria-label="Bônus extra de ${nome}">
            </span>
            <span class="valor-calc" data-salv-valor="${k}">${fmtMod(valor)}</span>
          </div>
        `;
      }).join('')}
    </div>

    <h3>Perícias <span style="font-size:11px;color:var(--text-dim);font-weight:normal;font-style:italic">(P = Proficiente · E = Expertise · campo ± = bônus extra)</span></h3>
    <div class="check-grid">
      ${PERICIAS.map(([k, nome, atr]) => {
        const p = per[k] || {};
        const bonus = +p.bonus || 0;
        const valor = valorPericia(c, k, atr);
        return `
          <div class="check-row">
            <label><input type="checkbox" name="per_${k}_prof" ${p.prof?'checked':''} data-per="${k}" data-atr="${atr}"> ${nome}<span class="atr-tag">${atr.toUpperCase()}</span></label>
            <span class="exp-marker"><input type="checkbox" name="per_${k}_exp" ${p.exp?'checked':''} ${p.prof?'':'disabled'} data-per-exp="${k}"> E</span>
            <span class="bonus-wrap" title="Bônus extra (item, dádiva, situacional)">
              <span class="bonus-pm">±</span>
              <input class="bonus-input" type="text" inputmode="numeric" name="per_${k}_bonus" value="${bonus||0}" data-per-bonus="${k}" aria-label="Bônus extra de ${nome}">
            </span>
            <span class="valor-calc" data-per-valor="${k}">${fmtMod(valor)}</span>
          </div>
        `;
      }).join('')}
    </div>

    ${classeUsaMagia(c) ? `
    <h3>Magia</h3>
    <div class="grid-3">
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

    <h3>Espaços de Magia</h3>
    ${renderSlotsMagia(c, slots)}
    ` : ''}
  `;
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


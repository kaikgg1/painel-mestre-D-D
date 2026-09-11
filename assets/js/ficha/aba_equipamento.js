// assets/js/ficha/aba_equipamento.js
// Aba Equipamento (Fase 7 do redesign): moedas, armas, armaduras e itens. O
// catálogo do PHB vem de assets/js/phb_catalogo.js. Persiste em
// characters.inventario (jsonb) — formato de cada item NÃO mudou (mesmos
// campos de sempre), só a forma de escolher do catálogo e de exibir armas.
//
// Os 3 <select> nativos gigantes (armas/armaduras/itens) viraram botões que
// abrem UI.abrirSeletor() (seletor.js) — busca + categorias + "recentes",
// bottom sheet no mobile / popover no desktop. Armaduras e itens continuam
// em tabela (convertida a cards em telas pequenas, já existia); armas agora
// são cards reaproveitando .ataque-card e Ataques.calcular()/rolar() — os
// MESMOS do Resumo (Fase 3), então o bônus mostrado aqui é sempre igual ao
// de lá.

// Peso total do inventário (kg) e comparação com a capacidade de carga —
// PHB, cap. Equipamento: "sua capacidade de carga máxima é igual a 7,5
// vezes o seu valor de Força" (regra padrão, sempre vale — acima disso
// você simplesmente não consegue carregar). Os dois níveis intermediários
// (2,5x e 5x, com penalidade de deslocamento/desvantagem) são a "Variação:
// Sobrecarga" do PHB — uma regra OPCIONAL, não o padrão — por isso aparecem
// como aviso rotulado como variação, não como penalidade automática.
// Moedas pesam ~10g cada (100 moedas = 1kg), não importa o tipo.
function calcularCarga(c) {
  const inv = c.inventario || {};
  const m = inv.moedas || {};
  const pesoArmas = (inv.armas || []).reduce((s, a) => s + (+a.peso || 0), 0);
  const pesoArmaduras = (inv.armaduras || []).reduce((s, a) => s + (+a.peso || 0), 0);
  const pesoItens = (inv.itens || []).reduce((s, it) => s + (+it.peso || 0) * (+it.qtd || 1), 0);
  const totalMoedas = ['po','pp','pe','pc','pl'].reduce((s, cod) => s + (+m[cod] || 0), 0);
  const pesoMoedas = totalMoedas / 100;
  const total = pesoArmas + pesoArmaduras + pesoItens + pesoMoedas;
  const forca = Math.max(0, +c.atributos?.for || 10);
  const capacidade = forca * 7.5;
  let nivel = 'normal';
  if (total > capacidade) nivel = 'excede';
  else if (total > forca * 5) nivel = 'pesada';
  else if (total > forca * 2.5) nivel = 'leve';
  return { total, capacidade, nivel };
}

function renderEquipamento(c) {
  const inv = c.inventario || { moedas:{po:0,pp:0,pe:0,pc:0,pl:0}, armas:[], armaduras:[], itens:[] };
  const m = inv.moedas || {};
  // Ícones por moeda
  // Bolinha colorida por moeda: a COR é a informação, então vira CSS (.dot),
  // não ícone vetorial (que seria monocromático).
  const moedaDot = cod => `<span class="dot dot--${cod}"></span>`;
  const carga = calcularCarga(c);
  const AVISOS_CARGA = {
    excede: `${ico('aviso')} Acima da capacidade máxima — não é possível carregar tudo isso (PHB)`,
    pesada: `${ico('aviso')} Sobrecarga pesada (Variação opcional do PHB) — desloc. −6m e desvantagem em testes de FOR/DES/CON, ataques e resistência`,
    leve: `${ico('aviso')} Sobrecarga (Variação opcional do PHB) — desloc. −3m`,
  };

  return `
    <div class="carga-bar carga-${carga.nivel}" id="carga-bar">
      <span>${ico('mochila')} Carga: <strong id="carga-total">${carga.total.toFixed(1)}</strong> / ${carga.capacidade.toFixed(1)} kg</span>
      ${AVISOS_CARGA[carga.nivel] ? `<span class="carga-aviso">${AVISOS_CARGA[carga.nivel]}</span>` : ''}
    </div>

    <div class="bloco-equip">
      <div class="bloco-equip-head">
        <span class="bloco-icone">${ico('moedas')}</span>
        <h3 class="bloco-titulo">Moedas</h3>
      </div>
      <div class="moedas">
        ${window.PHB.MOEDAS.map(md => `<div class="moeda-box">
          <div class="moeda-ic" aria-hidden="true">${moedaDot(md.codigo)}</div>
          <label>${md.abrev}</label>
          <input type="text" inputmode="numeric" name="moeda_${md.codigo}" value="${m[md.codigo] ?? 0}" data-validar="int" data-min="0" aria-label="${md.nome}">
        </div>`).join('')}
      </div>
      <p class="conv-hint">Conversão: 10 PC = 1 PP · 5 PP = 1 PE · 2 PE = 1 PO · 10 PO = 1 PL</p>
    </div>

    <div class="bloco-equip">
      <div class="bloco-equip-head">
        <span class="bloco-icone">${ico('ataque')}</span>
        <h3 class="bloco-titulo">Armas</h3>
        <span class="contador-bloco">${inv.armas?.length || 0}</span>
      </div>
      ${renderCardsArmas(inv.armas || [], c.atributos, c.nivel)}
      <div class="adicionar-bloco">
        <button class="btn no-lock" type="button" id="btn-abrir-seletor-arma">${ico('buscar')} Adicionar arma do catálogo (${window.PHB.ARMAS.length})</button>
      </div>
    </div>

    <div class="bloco-equip">
      <div class="bloco-equip-head">
        <span class="bloco-icone">${ico('escudo')}</span>
        <h3 class="bloco-titulo">Armaduras</h3>
        <span class="contador-bloco">${inv.armaduras?.length || 0}</span>
      </div>
      ${renderTabelaItens('armaduras', inv.armaduras || [], ['Nome', 'CA', 'Tipo', 'Força mín.'], ['nome','ca','tipo','forca'])}
      <div class="adicionar-bloco">
        <button class="btn no-lock" type="button" id="btn-abrir-seletor-armadura">${ico('buscar')} Adicionar armadura do catálogo (${window.PHB.ARMADURAS.length})</button>
      </div>
    </div>

    <div class="bloco-equip">
      <div class="bloco-equip-head">
        <span class="bloco-icone">${ico('mochila')}</span>
        <h3 class="bloco-titulo">Itens e Equipamento</h3>
        <span class="contador-bloco">${inv.itens?.length || 0}</span>
      </div>
      ${renderTabelaItens('itens', inv.itens || [], ['Nome', 'Qtd', 'Peso (kg)'], ['nome','qtd','peso'])}
      <div class="adicionar-bloco">
        <button class="btn no-lock" type="button" id="btn-abrir-seletor-item">${ico('buscar')} Adicionar item do catálogo (${window.PHB.ITENS.length + window.PHB.FERRAMENTAS.length})</button>
        <div class="campo" style="max-width:80px"><label>Qtd</label><input type="text" inputmode="numeric" id="add-item-qtd" value="1"></div>
      </div>
      <div class="adicionar-bloco" style="margin-top:6px">
        <div class="campo"><label>Ou item personalizado</label><input type="text" id="add-item-nome" placeholder="Nome do item"></div>
        <div class="campo" style="max-width:80px"><label>Qtd</label><input type="text" inputmode="numeric" id="add-item-qtd-custom" value="1"></div>
        <button class="btn" type="button" id="btn-add-item-custom">+ Adicionar</button>
      </div>
    </div>
  `;
}

// Cards de arma (em vez de linha de tabela) — mostram bônus de ataque e
// dano já calculados (Ataques.calcular(), Fase 3) e um botão de rolar
// rápido, igual ao card de Ataques do Resumo (mesma classe .ataque-card).
function renderCardsArmas(armas, atributos, nivel) {
  if (!armas.length) return `<div class="item-vazio">Nenhuma arma. Adicione abaixo.</div>`;
  return `<div class="resumo-ataques equip-armas-lista">
    ${armas.map((arma, idx) => {
      const calc = window.Ataques ? Ataques.calcular(arma, atributos, nivel) : null;
      const props = [arma.tipo_dano, arma.propriedades].filter(Boolean).join(' · ');
      return `<div class="ataque-card">
        <button type="button" class="lixo equip-arma-rm no-lock" data-rm="armas" data-idx="${idx}" aria-label="Remover ${escape(arma.nome||'')}">✕</button>
        <div class="ataque-nome">${escape(arma.nome || 'Arma')}</div>
        ${calc ? `<div class="ataque-info">
          <span title="Bônus de ataque (assume proficiência)">${ico('ataque')} ${fmtMod(calc.bonusAtaque)}</span>
          <span title="Dano">${ico('dano')} ${escape(calc.danoTexto)}</span>
          ${calc.distancia ? '<span title="À distância">🏹</span>' : ''}
        </div>` : ''}
        <div class="equip-arma-props">${escape(props || '—')}</div>
        <button type="button" class="btn no-lock" data-equip-rolar="${idx}">🎲 Atacar</button>
      </div>`;
    }).join('')}
  </div>`;
}

function renderTabelaItens(tipo, itens, colunas, campos) {
  if (!itens.length) return `<div class="item-vazio">Nenhum ${tipo === 'armas' ? 'arma' : (tipo === 'armaduras' ? 'armadura' : 'item')}. Adicione abaixo.</div>`;
  return `<table class="item-tabela">
    <thead><tr>${colunas.map(c => `<th>${c}</th>`).join('')}<th></th></tr></thead>
    <tbody>${itens.map((it, idx) => `
      <tr>${campos.map((f, ci) => `<td data-label="${escape(colunas[ci])}">${escape(it[f] ?? '—')}</td>`).join('')}
      <td style="text-align:right"><button type="button" class="lixo" data-rm="${tipo}" data-idx="${idx}" aria-label="Remover">✕</button></td></tr>
    `).join('')}</tbody>
  </table>`;
}

// assets/js/ficha/aba_equipamento.js
// Aba Equipamento: moedas, armas, armaduras e itens. O catálogo do PHB vem de
// assets/js/phb_catalogo.js. Persiste em characters.inventario (jsonb).

function renderEquipamento(c) {
  const inv = c.inventario || { moedas:{po:0,pp:0,pe:0,pc:0,pl:0}, armas:[], armaduras:[], itens:[] };
  const m = inv.moedas || {};
  // Ícones por moeda
  // Bolinha colorida por moeda: a COR é a informação, então vira CSS (.dot),
  // não ícone vetorial (que seria monocromático).
  const moedaDot = cod => `<span class="dot dot--${cod}"></span>`;

  return `
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
      ${renderTabelaItens('armas', inv.armas || [], ['Nome', 'Dano', 'Tipo', 'Propriedades'], ['nome','dano','tipo_dano','propriedades'])}
      <div class="adicionar-bloco">
        <div class="campo"><label>Adicionar arma do catálogo (${window.PHB.ARMAS.length} do PHB)</label>
          <select id="add-arma">
            <option value="">— escolher —</option>
            ${optgroupsPorCategoria(window.PHB.ARMAS, a => `${escape(a.nome)} (${a.dano} ${escape(a.tipo_dano)})`)}
          </select></div>
        <button class="btn" type="button" id="btn-add-arma">+ Adicionar</button>
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
        <div class="campo"><label>Adicionar armadura do catálogo (${window.PHB.ARMADURAS.length} do PHB)</label>
          <select id="add-armadura">
            <option value="">— escolher —</option>
            ${optgroupsPorTipo(window.PHB.ARMADURAS, a => `${escape(a.nome)} (CA ${escape(a.ca)})`)}
          </select></div>
        <button class="btn" type="button" id="btn-add-armadura">+ Adicionar</button>
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
        <div class="campo"><label>Item do catálogo (${window.PHB.ITENS.length + window.PHB.FERRAMENTAS.length} do PHB)</label>
          <select id="add-item-catalogo">
            <option value="">— escolher do PHB —</option>
            ${optgroupsPorCategoria(window.PHB.ITENS, it => escape(it.nome))}
            ${optgroupsPorCategoria(window.PHB.FERRAMENTAS, it => escape(it.nome))}
          </select></div>
        <div class="campo" style="max-width:80px"><label>Qtd</label><input type="text" inputmode="numeric" id="add-item-qtd" value="1"></div>
        <button class="btn" type="button" id="btn-add-item-cat">+ Adicionar</button>
      </div>
      <div class="adicionar-bloco" style="margin-top:6px">
        <div class="campo"><label>Ou item personalizado</label><input type="text" id="add-item-nome" placeholder="Nome do item"></div>
        <div class="campo" style="max-width:80px"><label>Qtd</label><input type="text" inputmode="numeric" id="add-item-qtd-custom" value="1"></div>
        <button class="btn" type="button" id="btn-add-item-custom">+ Adicionar</button>
      </div>
    </div>
  `;
}

// Gera <optgroup> agrupando pela propriedade `categoria` (alfabético dentro do grupo).
function optgroupsPorCategoria(lista, formatarRotulo) {
  const grupos = {};
  for (const it of lista) {
    const cat = it.categoria || 'Outros';
    (grupos[cat] = grupos[cat] || []).push(it);
  }
  // Lista já vem ordenada alfabeticamente; só agrupa
  return Object.keys(grupos).sort((a,b) => a.localeCompare(b, 'pt'))
    .map(cat => `<optgroup label="${escape(cat)}">
      ${grupos[cat].map(it => `<option value='${escape(JSON.stringify(it))}'>${formatarRotulo(it)}</option>`).join('')}
    </optgroup>`).join('');
}

// Para armaduras: agrupa pelo campo `tipo` (Leve / Média / Pesada / Escudo)
function optgroupsPorTipo(lista, formatarRotulo) {
  const grupos = {};
  for (const it of lista) {
    const cat = it.tipo || 'Outros';
    (grupos[cat] = grupos[cat] || []).push(it);
  }
  const ordem = ['Leve', 'Média', 'Pesada', 'Escudo'];
  return Object.keys(grupos).sort((a,b) => {
    const ia = ordem.indexOf(a), ib = ordem.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  }).map(cat => `<optgroup label="${escape(cat)}">
    ${grupos[cat].map(it => `<option value='${escape(JSON.stringify(it))}'>${formatarRotulo(it)}</option>`).join('')}
  </optgroup>`).join('');
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


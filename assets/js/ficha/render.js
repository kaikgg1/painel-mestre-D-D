// assets/js/ficha/render.js
// render(): reconstrói #conteudo inteiro (abas e <form>) e re-liga os
// listeners. Inclui o dispatcher renderTab(), os helpers de select de
// subclasse / lista de tags, e o bloco de Identidade da aba Personagem
// (Fase 9 — o resto de Personagem, roleplay/retrato/história, mora em
// assets/js/ficha/aba_roleplay.js).

function render() {
  const c = charAtivo;
  const atrs = c.atributos || {for:10,dex:10,con:10,int:10,sab:10,car:10};

  // Header (avatar, nome, trocador, campanha, autosave, editar/travar, menu ⋯)
  // vive em assets/js/ficha/header.js — os slots #hdr-id/#hdr-meta são
  // estáticos em paineis/ficha.html, fora de #conteudo.
  renderHeader(c);

  $('#conteudo').innerHTML = `
    <div class="lock-banner" aria-live="polite">${ico('cadeado')} Ficha bloqueada para evitar edições acidentais — clique em <strong>Editar</strong> para desbloquear.</div>

    <div class="tabs-wrap" id="tabs-wrap">
      <div class="tabs" role="tablist" id="tabs">
        <!-- Ordem final da arquitetura-alvo do redesign (§1): Resumo, Combate,
             Magias, Habilidades, Equipamento, Aliados, Personagem — a
             navegação inferior mobile (nav_mobile.js) pega "as 4 primeiras
             abas + Mais" automaticamente, sem precisar tocar nela. Identidade
             e Roleplay se fundiram em "Personagem" na Fase 9. -->
        <button class="tab ${tabAtiva==='resumo'?'ativa':''}" data-tab="resumo" role="tab">Resumo</button>
        <button class="tab ${tabAtiva==='combate'?'ativa':''}" data-tab="combate" role="tab">Combate</button>
        ${classeUsaMagia(c) ? `<button class="tab ${tabAtiva==='magias'?'ativa':''}" data-tab="magias" role="tab">Magias</button>` : ''}
        <button class="tab ${tabAtiva==='habilidades'?'ativa':''}" data-tab="habilidades" role="tab">Habilidades</button>
        <button class="tab ${tabAtiva==='equipamento'?'ativa':''}" data-tab="equipamento" role="tab">Equipamento</button>
        <button class="tab ${tabAtiva==='aliados'?'ativa':''}" data-tab="aliados" role="tab">Aliados</button>
        <button class="tab ${tabAtiva==='personagem'?'ativa':''}" data-tab="personagem" role="tab">Personagem</button>
      </div>
    </div>

    <form class="tab-content" id="ficha-form" novalidate>
      ${renderTab(c, atrs)}
    </form>
  `;

  conectarListeners();
  renderBottomNav();
}

function renderSubclasseSelect(classe, atual) {
  const chave = chaveDeClasse(classe);
  const opcoes = SUBCLASSES_POR_CLASSE[chave] || [];
  if (!opcoes.length) {
    return `<select name="subclasse" disabled style="opacity:.5"><option>${classe ? 'Sem subclasses cadastradas' : 'Escolha uma classe'}</option></select>`;
  }
  return `<select name="subclasse" id="sel-subclasse">
    <option value="">— escolher —</option>
    ${opcoes.map(o => `<option ${o===atual?'selected':''}>${escape(o)}</option>`).join('')}
  </select>`;
}

function renderListaTags(field, label, valores) {
  const tags = (valores || []).map((v, i) =>
    `<span class="tag">${escape(v)}<span class="x" data-rmtag="${field}" data-idx="${i}" role="button" tabindex="0">✕</span></span>`).join('');
  return `<div class="campo"><label>${label}</label>
    <div class="lista-tags" id="tags-${field}">${tags || '<span style="color:var(--text-dim);font-style:italic;font-size:12px;padding:4px">Nenhum</span>'}</div>
    <div class="lista-tags-add">
      <input type="text" id="add-${field}-input" placeholder="Adicionar...">
      <button type="button" class="btn" data-addtag="${field}">+</button>
    </div></div>`;
}

// Mesma lista, sem os controles de adicionar/remover — usada em modo
// leitura (Fase 9). As tags em si continuam com a MESMA classe .tag, só
// sem o "✕" e a barra de adicionar embaixo.
function renderListaTagsLeitura(label, valores) {
  const tags = (valores || []).map(v => `<span class="tag tag-leitura">${escape(v)}</span>`).join('');
  return `<div class="campo">
    <label>${label}</label>
    <div class="lista-tags">${tags || '<span class="leitura-vazio" style="padding:4px">Nenhum</span>'}</div>
  </div>`;
}

function renderTab(c, atrs) {
  // Se PJ não usa magia e a tab "magias" estava ativa, joga pro Resumo
  if (tabAtiva === 'magias' && !classeUsaMagia(c)) tabAtiva = 'resumo';
  switch (tabAtiva) {
    case 'resumo':      return renderResumo(c, atrs);
    case 'combate':     return renderCombate(c);
    case 'magias':      return renderMagias(c);
    case 'habilidades': return renderHabilidades(c);
    case 'equipamento': return renderEquipamento(c);
    case 'aliados':     return renderAliados(c);
    case 'personagem':  return renderPersonagem(c, atrs);
  }
}

// Aba Personagem (Fase 9, §1/§4/§16) — fusão de Identidade + Roleplay.
// Nome/raça/classe/subclasse/origem/alinhamento/campanha/idiomas/ferramentas
// alternam entre CARD DE LEITURA e formulário conforme o modo global
// Editar/Travar (estaDesbloqueado(), nucleo.js — mesmo botão do header,
// Fase 2). Características Raciais e Atributos NÃO entram nesse
// vai-e-volta — o briefing não os lista em §4, então continuam como
// sempre (form fields sujeitos ao lock genérico de sistema.css, igual a
// qualquer outra aba). Retrato/História/Notas/Inspiração (aba_roleplay.js)
// também ficam de fora — o §16 pede que continuem como estão.
// Sub-navegação (jog-15): a aba Personagem reúne 4 seções bem distintas
// (Identidade, Raciais, Atributos, Roleplay) numa rolagem só — os pills
// abaixo só pulam pra âncora de cada uma, sem duplicar dado nenhum nem virar
// sub-abas de verdade (tudo continua no mesmo <form>, autosave intacto).
const SUBNAV_PERSONAGEM = [
  ['pj-sec-identidade', 'Identidade'],
  ['pj-sec-racial', 'Raciais'],
  ['pj-sec-atributos', 'Atributos'],
  ['pj-sec-roleplay', 'Roleplay'],
];

function renderPersonagem(c, atrs) {
  return `
    <nav class="subnav-pj" aria-label="Seções do Personagem">
      ${SUBNAV_PERSONAGEM.map(([id, rotulo], i) => `<button type="button" class="pill ${i===0?'ativo':''}" data-subnav="${id}">${rotulo}</button>`).join('')}
    </nav>

    <div id="pj-sec-identidade">
      ${estaDesbloqueado() ? renderIdentidadeEdicao(c) : renderIdentidadeLeitura(c)}
    </div>

    <div id="pj-sec-racial">
      <h3>Características Raciais</h3>
      <div class="campo">
        <textarea name="tracos_raciais" placeholder="Ex.: Visão no Escuro 18m, Resistência Anã, Proficiência em Machados">${escape(c.tracos_raciais||'')}</textarea>
      </div>
    </div>

    <div id="pj-sec-atributos">
      <h3>Atributos</h3>
      <div class="grid-6">
        ${ATRIBUTOS.map(([k, nome]) => `
          <div class="atributo">
            <span class="nome-atr">${nome.slice(0,3).toUpperCase()}</span>
            <input type="text" inputmode="numeric" class="valor-base" name="attr_${k}" value="${atrs[k] ?? 10}" data-attr="${k}" data-validar="int" data-min="1" data-max="30" aria-label="${nome} (valor base 1-30)">
            <span class="modificador" data-mod="${k}">${fmtMod(mod(atrs[k]))}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div id="pj-sec-roleplay">
      ${renderRoleplayBloco(c)}
    </div>
  `;
}

// Campo de leitura genérico: rótulo pequeno + valor — o "EditableField" do
// briefing (§22), sem esconder nada por trás de um nome de classe exato.
function campoLeitura(label, valorTexto) {
  const v = (valorTexto ?? '').toString().trim();
  return `<div class="leitura-campo"><span class="leitura-label">${escape(label)}</span><span class="leitura-valor">${v ? escape(v) : '<span class="leitura-vazio">—</span>'}</span></div>`;
}

function renderIdentidadeLeitura(c) {
  const campanhaLbl = c.campanha ? (CAMPANHAS.find(([k]) => k === c.campanha)?.[1] || c.campanha) : '';
  const secundarias = Array.isArray(c.classes_secundarias) ? c.classes_secundarias : [];
  return `
    <h3>Personagem</h3>
    <div class="leitura-grid">
      ${campoLeitura('Nome', c.nome)}
      ${campoLeitura('Nível', c.nivel || 1)}
      ${campoLeitura('Raça', c.raca)}
      ${campoLeitura('Classe', c.classe)}
      ${campoLeitura('Subclasse', c.subclasse)}
      ${campoLeitura('Origem', c.origem)}
      ${campoLeitura('Alinhamento', c.alinhamento)}
      ${campoLeitura('Campanha', campanhaLbl)}
    </div>

    ${secundarias.length ? `
      <h3>Multiclasse</h3>
      <div class="leitura-grid">
        ${secundarias.map(cl => campoLeitura(cl.classe, `Nível ${cl.nivel}`)).join('')}
        ${campoLeitura('Nível total', nivelTotalPersonagem(c))}
      </div>
    ` : ''}

    <h3>Idiomas e Ferramentas</h3>
    <div class="grid-2">
      ${renderListaTagsLeitura('Idiomas', c.idiomas || ['Comum'])}
      ${renderListaTagsLeitura('Proficiências em Ferramentas', c.ferramentas || [])}
    </div>
  `;
}

function renderIdentidadeEdicao(c) {
  return `
    <h3>Personagem</h3>
    <div class="grid-2">
      <div class="campo"><label>Nome do Personagem</label>
        <input name="nome" value="${escape(c.nome)}" required></div>
      <div class="campo"><label>Nível (1–20)</label>
        <input name="nivel" type="text" inputmode="numeric" value="${c.nivel||1}" data-validar="int" data-min="1" data-max="20">
        <span class="erro-msg">Nível inválido (1–20)</span></div>
      <div class="campo"><label>Raça</label>
        <select name="raca">${RACAS.map(r => `<option ${r===c.raca?'selected':''}>${r}</option>`).join('')}</select></div>
      <div class="campo"><label>Classe</label>
        <select name="classe" id="sel-classe">${CLASSES.map(cl => `<option ${cl===c.classe?'selected':''}>${cl}</option>`).join('')}</select></div>
      <div class="campo"><label>Subclasse</label>
        ${renderSubclasseSelect(c.classe, c.subclasse)}
        <span class="ajuda">Opções automáticas conforme classe (PHB 5e).</span></div>
      <div class="campo"><label>Origem (Background)</label>
        <input name="origem" value="${escape(c.origem||'')}"></div>
      <div class="campo"><label>Alinhamento</label>
        <select name="alinhamento">${ALINHAMENTOS.map(a => `<option ${a===c.alinhamento?'selected':''}>${a}</option>`).join('')}</select></div>
      <div class="campo"><label>Campanha (visível pro Mestre)</label>
        <select name="campanha">${CAMPANHAS.map(([k, lbl]) => `<option value="${k}" ${k===(c.campanha||'')?'selected':''}>${lbl}</option>`).join('')}</select>
        <span class="ajuda">Salve a ficha para vincular à campanha escolhida.</span></div>
    </div>

    <h3>Multiclasse <span class="ajuda-mini">(opcional)</span></h3>
    ${renderMulticlasseEdicao(c)}

    <h3>Idiomas e Ferramentas</h3>
    <div class="grid-2">
      ${renderListaTags('idiomas', 'Idiomas', c.idiomas || ['Comum'])}
      ${renderListaTags('ferramentas', 'Proficiências em Ferramentas', c.ferramentas || [])}
    </div>
  `;
}

// Multiclasse (jog-4): characters.classes_secundarias, array [{classe,nivel}]
// além da classe/nível principal de sempre — soma no nível total (bônus de
// proficiência e Dados de Vida recuperados no Descanso Longo, ver
// nivelTotalPersonagem() em nucleo.js). Tem save dedicado (não é um <input
// name=...> do form) — mesmo padrão de companions/features_personalizadas.
function renderMulticlasseEdicao(c) {
  const secundarias = Array.isArray(c.classes_secundarias) ? c.classes_secundarias : [];
  return `
    <div id="multiclasse-lista">
      ${secundarias.length ? secundarias.map((cl, idx) => `
        <div class="multiclasse-item">
          <span>${escape(cl.classe)} — nível ${cl.nivel}</span>
          <button type="button" class="lixo" data-mc-rm="${idx}" aria-label="Remover ${escape(cl.classe)}">✕</button>
        </div>
      `).join('') : '<div class="item-vazio">Nenhuma classe secundária.</div>'}
    </div>
    <div class="adicionar-bloco">
      <div class="campo"><label>Classe</label>
        <select id="mc-add-classe">${CLASSES.filter(Boolean).map(cl => `<option>${cl}</option>`).join('')}</select></div>
      <div class="campo" style="max-width:100px"><label>Nível</label>
        <input type="text" inputmode="numeric" id="mc-add-nivel" value="1" data-validar="int" data-min="1" data-max="19"></div>
      <button type="button" class="btn" id="btn-mc-add">+ Adicionar</button>
    </div>
    ${secundarias.length ? `<p class="ajuda-mini">Nível total (multiclasse): <strong>${nivelTotalPersonagem(c)}</strong> — usado no bônus de proficiência e na recuperação de Dados de Vida no Descanso Longo.</p>` : ''}
  `;
}

// Ícone de PV por faixa de porcentagem. A COR carrega o mesmo aviso que os
// emoji antigos de PV davam, agora em vetor e igual em todo SO.

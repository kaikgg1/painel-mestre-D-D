// assets/js/ficha/render.js
// render(): reconstrói #conteudo inteiro (aviso de visibilidade, barra de
// personagem, abas e <form>) e re-liga os listeners. Inclui o dispatcher
// renderTab(), os helpers de select de subclasse / lista de tags, e a aba
// Identidade.

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
        <button class="tab ${tabAtiva==='identidade'?'ativa':''}" data-tab="identidade" role="tab">Identidade</button>
        <button class="tab ${tabAtiva==='combate'?'ativa':''}" data-tab="combate" role="tab">Combate</button>
        <button class="tab ${tabAtiva==='habilidades'?'ativa':''}" data-tab="habilidades" role="tab">Habilidades</button>
        ${classeUsaMagia(c) ? `<button class="tab ${tabAtiva==='magias'?'ativa':''}" data-tab="magias" role="tab">Magias</button>` : ''}
        <button class="tab ${tabAtiva==='equipamento'?'ativa':''}" data-tab="equipamento" role="tab">Equipamento</button>
        <button class="tab ${tabAtiva==='aliados'?'ativa':''}" data-tab="aliados" role="tab">Aliados</button>
        <button class="tab ${tabAtiva==='roleplay'?'ativa':''}" data-tab="roleplay" role="tab">Roleplay</button>
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

function renderTab(c, atrs) {
  // Se PJ não usa magia e a tab "magias" estava ativa, joga pra identidade
  if (tabAtiva === 'magias' && !classeUsaMagia(c)) tabAtiva = 'identidade';
  switch (tabAtiva) {
    case 'identidade':  return renderIdentidade(c, atrs);
    case 'combate':     return renderCombate(c);
    case 'habilidades': return renderHabilidades(c);
    case 'magias':      return renderMagias(c);
    case 'equipamento': return renderEquipamento(c);
    case 'aliados':     return renderAliados(c);
    case 'roleplay':    return renderRoleplay(c);
  }
}

function renderIdentidade(c, atrs) {
  return `
    <h3>Identidade</h3>
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

    <h3>Idiomas e Ferramentas</h3>
    <div class="grid-2">
      ${renderListaTags('idiomas', 'Idiomas', c.idiomas || ['Comum'])}
      ${renderListaTags('ferramentas', 'Proficiências em Ferramentas', c.ferramentas || [])}
    </div>
    <h4 style="margin:14px 0 8px;font-family:'Cinzel',serif;font-size:13px;color:var(--gold);letter-spacing:1.5px;text-transform:uppercase">Características Raciais</h4>
    <div class="campo">
      <textarea name="tracos_raciais" placeholder="Ex.: Visão no Escuro 18m, Resistência Anã, Proficiência em Machados">${escape(c.tracos_raciais||'')}</textarea>
    </div>

    <h3>Atributos</h3>
    <div class="grid-6">
      ${ATRIBUTOS.map(([k, nome]) => `
        <div class="atributo">
          <span class="nome-atr">${nome.slice(0,3).toUpperCase()}</span>
          <span class="modificador" data-mod="${k}">${fmtMod(mod(atrs[k]))}</span>
          <input type="text" inputmode="numeric" class="valor-base" name="attr_${k}" value="${atrs[k] ?? 10}" data-attr="${k}" data-validar="int" data-min="1" data-max="30" aria-label="${nome} (valor base 1-30)">
        </div>
      `).join('')}
    </div>
  `;
}

// Ícone de PV por faixa de porcentagem. A COR carrega o mesmo aviso que os
// emoji antigos de PV davam, agora em vetor e igual em todo SO.

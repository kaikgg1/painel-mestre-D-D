// assets/js/ficha/header.js
// Header global (§3 do redesign): avatar + nome + trocador de personagem +
// subtítulo, pill compacta de campanha, badge de autosave, botão Editar/Travar
// e o menu "⋯" com as ações raras (Novo, Duplicar, Tornar ativo, Excluir).
//
// renderHeader(c) preenche os slots estáticos de paineis/ficha.html (#hdr-id,
// #hdr-meta) e é chamado por render() em nucleo.js/render.js a cada
// re-renderização — mesmo padrão de "reconstrói tudo, religa os listeners"
// usado no resto da ficha. conectarListenersHeader() faz a religação.

// Iniciais + cor determinística pro avatar quando não há retrato (imagem_url).
// Mesmo nome sempre gera a mesma cor — não é aleatório, é hash do nome.
function avatarIniciais(nome) {
  const partes = String(nome || '?').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const letras = partes.length > 1 ? (partes[0][0] + partes[partes.length - 1][0]) : partes[0].slice(0, 2);
  return letras.toUpperCase();
}
function corAvatar(nome) {
  let h = 0;
  for (const ch of String(nome || '')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 32% 28%)`;
}

function renderHeader(c) {
  const idEl = document.getElementById('hdr-id');
  const metaEl = document.getElementById('hdr-meta');
  if (!idEl || !metaEl) return;

  // ── Bloco de identidade (avatar + nome + trocador + subtítulo) ──
  const subtitulo = [c.classe, c.nivel ? 'Nv ' + c.nivel : '', c.subclasse]
    .filter(Boolean).join(' · ') || 'Sem classe definida';

  const avatarConteudo = c.imagem_url
    ? ''
    : escape(avatarIniciais(c.nome));
  const avatarEstilo = c.imagem_url
    ? `background-image:url('${String(c.imagem_url).replace(/'/g, '%27')}')`
    : `background-color:${corAvatar(c.nome)}`;

  const trocador = chars.length > 1 ? `
      <span class="hdr-nome-chevron" aria-hidden="true">▾</span>
      <select class="hdr-trocar-select" id="sel-char" aria-label="Trocar de personagem" title="Trocar de personagem">
        ${chars.map(x => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${escape(x.nome)}${x.classe ? ' — ' + escape(x.classe) : ''}${x.nivel ? ' N' + x.nivel : ''}${x.is_active ? ' ★' : ''}</option>`).join('')}
      </select>` : '';

  idEl.innerHTML = `
    <div class="hdr-avatar" style="${avatarEstilo}" aria-hidden="true">${avatarConteudo}</div>
    <div class="hdr-nome-bloco">
      <div class="hdr-nome-wrap">
        <span class="hdr-nome">${escape(c.nome || 'Sem nome')}</span>
        ${trocador}
      </div>
      <div class="hdr-subtitulo">${escape(subtitulo)}</div>
    </div>`;

  // ── Linha meta (campanha · autosave · editar/travar · menu ⋯) ──
  const temCampanha = !!c.campanha;
  const ehAtivo = !!c.is_active;
  let campanhaHtml;
  if (temCampanha && ehAtivo) {
    const nomeCampanha = escape(CAMPANHAS.find(([k]) => k === c.campanha)?.[1] || c.campanha);
    campanhaHtml = `<span class="hdr-campanha" title="Esta ficha aparece no painel do Mestre — campanha: ${nomeCampanha}">
      <span class="dot" aria-hidden="true"></span><span class="lbl">Vinculado a ${nomeCampanha}</span>
    </span>`;
  } else {
    const problemas = [];
    if (!temCampanha) problemas.push('vincule uma Campanha');
    if (!ehAtivo) problemas.push('marque como Ativo');
    campanhaHtml = `<span class="hdr-campanha aviso" id="hdr-campanha-aviso" role="button" tabindex="0"
        title="Esta ficha não aparece pro Mestre: ${escape(problemas.join(' e '))} (aba Identidade)">
      ${ico('aviso')}<span class="lbl">Não visível ao Mestre</span>
    </span>`;
  }

  metaEl.innerHTML = `
    ${campanhaHtml}
    <div class="autosave-status">
      <span class="status-msg" id="status" aria-live="polite">${ico('salvar')} <span class="txt">Auto-save ativo</span></span>
      <button type="button" id="status-retry" class="status-retry no-lock" hidden>Tentar novamente</button>
    </div>
    <button class="btn-lock-toggle no-lock" type="button" id="btn-lock-toggle" aria-pressed="false" aria-label="Alternar modo edição">
      <span id="lock-toggle-label">${ico('cadeado')} Editar</span>
    </button>
    <div class="menu-acoes no-lock">
      <button type="button" class="btn-icon" id="btn-menu-toggle" aria-haspopup="true" aria-expanded="false" aria-label="Menu de ações" title="Menu de ações">⋯</button>
      <div class="menu-popover" id="menu-popover" role="menu" hidden>
        <button type="button" class="menu-item" id="btn-novo" role="menuitem">+ Novo personagem</button>
        <button type="button" class="menu-item" id="btn-duplicar" role="menuitem">⧉ Duplicar personagem</button>
        <button type="button" class="menu-item" id="btn-ativo" role="menuitem" aria-pressed="${ehAtivo}">
          ${ehAtivo ? '★ Remover de ativo' : '☆ Tornar ativo'}
        </button>
        <div class="menu-sep" role="separator"></div>
        <button type="button" class="menu-item danger" id="btn-deletar" role="menuitem">🗑 Excluir personagem</button>
      </div>
    </div>`;

  conectarListenersHeader();
  aplicarEstadoLock(); // garante o rótulo/estado visual corretos após reconstruir o header
}

function fecharMenuAcoes() {
  const pop = document.getElementById('menu-popover');
  const btn = document.getElementById('btn-menu-toggle');
  if (pop) pop.hidden = true;
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function conectarListenersHeader() {
  // Trocar personagem (select real, invisível, sobre o nome)
  const sel = document.getElementById('sel-char');
  if (sel) sel.addEventListener('change', e => {
    // Salva edições pendentes do PJ atual antes de trocar
    const form = document.getElementById('ficha-form');
    if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
    charAtivo = chars.find(x => x.id === e.target.value) || chars[0];
    render();
  });

  // Pill de campanha (estado de aviso): atalho pra aba onde dá pra corrigir
  // (campo Campanha + estrela Ativo). data-tab="identidade" — quando a Fase 9
  // fundir Identidade+Roleplay em "Personagem", ajustar aqui também.
  const pill = document.getElementById('hdr-campanha-aviso');
  if (pill) {
    const irPraIdentidade = () => {
      const alvo = document.querySelector('.tab[data-tab="identidade"]');
      if (alvo) alvo.click();
    };
    pill.addEventListener('click', irPraIdentidade);
    pill.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); irPraIdentidade(); } });
  }

  // Editar / Travar (modo edição global — mesma lógica de sempre, só mudou de lugar)
  const lockBtn = document.getElementById('btn-lock-toggle');
  if (lockBtn) lockBtn.addEventListener('click', () => {
    const ativo = !document.body.classList.contains('modo-unlock');
    document.body.classList.toggle('modo-unlock', ativo);
    try { localStorage.setItem('ficha_unlock', ativo ? '1' : '0'); } catch {}
    atualizarLockLabel();
    aplicarTabIndexLock();
  });

  // Retry de autosave (aparece só quando salvar() marca erro)
  const retryBtn = document.getElementById('status-retry');
  if (retryBtn) retryBtn.addEventListener('click', () => {
    const form = document.getElementById('ficha-form');
    if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
  });

  // Menu "⋯": abre/fecha, fecha ao clicar fora ou Escape, fecha após qualquer ação
  const menuBtn = document.getElementById('btn-menu-toggle');
  const menuPop = document.getElementById('menu-popover');
  if (menuBtn && menuPop) {
    menuBtn.addEventListener('click', e => {
      e.stopPropagation();
      const abrir = menuPop.hidden;
      menuPop.hidden = !abrir;
      menuBtn.setAttribute('aria-expanded', String(abrir));
    });
    document.addEventListener('click', e => {
      if (!menuPop.hidden && !menuPop.contains(e.target) && e.target !== menuBtn) fecharMenuAcoes();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharMenuAcoes(); });
  }

  const novoBtn = document.getElementById('btn-novo');
  if (novoBtn) novoBtn.addEventListener('click', async () => {
    fecharMenuAcoes();
    const nome = prompt('Nome do novo personagem:');
    if (nome) await criarPersonagem(nome);
  });
  const duplicarBtn = document.getElementById('btn-duplicar');
  if (duplicarBtn) duplicarBtn.addEventListener('click', async () => {
    fecharMenuAcoes();
    await duplicarPersonagem();
  });
  const ativoBtn = document.getElementById('btn-ativo');
  if (ativoBtn) ativoBtn.addEventListener('click', () => { fecharMenuAcoes(); alternarAtivo(); });
  const delBtn = document.getElementById('btn-deletar');
  if (delBtn) delBtn.addEventListener('click', () => { fecharMenuAcoes(); deletarPersonagem(charAtivo.id); });
}

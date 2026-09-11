// assets/js/ficha/aba_resumo.js
// Aba Resumo (Fase 3 do redesign) — a tela principal de uso durante a sessão:
// "Quanto HP eu tenho? Qual minha CA? Quais ataques posso usar? Quantos
// slots restam? Quais condições estão ativas?" tudo numa consulta rápida.
//
// Identidade (nome/avatar/classe/nível/raça/subclasse) NÃO se repete aqui —
// já fica visível o tempo todo no header (assets/js/ficha/header.js), em
// qualquer aba. Este arquivo só cobre o que é específico do Resumo:
//
//   Status   — HP/temp (interativo, reaproveita os MESMOS ids/data-attrs
//              que a aba Combate usa: os listeners já existem em
//              listeners.js e funcionam sem mudar nada lá, porque só uma
//              aba fica montada no DOM por vez) · CA/Iniciativa/Deslocamento
//              (consulta, edição continua em Combate) · Inspiração (interativo).
//   Ataques  — bônus/dano calculados por assets/js/ataques.js a partir do
//              inventário (sempre um palpite editável, nunca gravado).
//   Recursos — reaproveita renderRecursosClasse() (recursos.js) via o MESMO
//              #recursos-classe-wrap que a aba Habilidades usa.
//   Magias   — CD, ataque mágico e um resumo compacto (só leitura) dos
//              espaços restantes; "Ver Magias" leva pra aba completa.
//   Outros   — percepção passiva, condições (characters.condicoes — CRUD em
//              nucleo.js, compartilhado com a Fase 4), salvaguardas.

function renderResumo(c, atrs) {
  return `
    <div class="resumo-grid">
      <section class="resumo-secao resumo-status">
        <h3>Status</h3>
        ${renderResumoStatus(c)}
      </section>

      <section class="resumo-secao">
        <h3>Ataques</h3>
        ${renderResumoAtaques(c, atrs)}
      </section>

      <section class="resumo-secao">
        <div id="recursos-classe-wrap"></div>
      </section>

      ${renderResumoFavoritas(c)}

      ${classeUsaMagia(c) ? `
      <section class="resumo-secao">
        <h3>Magias</h3>
        ${renderResumoMagias(c)}
      </section>` : ''}

      <section class="resumo-secao">
        <h3>Outros</h3>
        ${renderResumoOutros(c)}
      </section>
    </div>
  `;
}

function renderResumoStatus(c) {
  const hpAtual = c.hp_atual ?? 10;
  const hpMax = c.hp_max ?? 10;
  const hpTemp = c.hp_temp ?? 0;
  const pct = hpMax > 0 ? Math.max(0, Math.min(100, Math.round((hpAtual / hpMax) * 100))) : 0;
  const classeBar = pct <= 15 ? 'critico' : pct <= 35 ? 'baixo' : pct <= 65 ? 'medio' : '';
  const insp = +c.inspiracao || 0;

  return `
    <div class="stat-row">
      <div class="stat-card stat-hp">
        <div class="stat-card-label"><span id="hp-icone-atual">${iconeVida(pct)}</span> Pontos de Vida</div>
        <div class="stat-hp-numero">
          <input name="hp_atual" type="text" inputmode="numeric" value="${hpAtual}" data-validar="int" id="hp-atual-input" aria-label="PV atual">
          <span class="sep">/</span>
          <input name="hp_max" type="text" inputmode="numeric" value="${hpMax}" data-validar="int" data-min="0" id="hp-max-input" aria-label="PV máximo">
          ${hpTemp > 0 ? `<span class="stat-hp-temp">+${hpTemp} temp</span>` : ''}
        </div>
        <div class="hp-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <div class="hp-fill ${classeBar}" id="hp-fill" style="width:${pct}%"></div>
          <div class="hp-percent" id="hp-percent">${pct}%</div>
        </div>
        <div class="resumo-hp-quick" aria-label="Atalhos de dano/cura">
          <button type="button" class="q-dano" data-quick="-5">-5</button>
          <button type="button" class="q-dano" data-quick="-1">-1</button>
          <button type="button" class="q-cura" data-quick="1">+1</button>
          <button type="button" class="q-cura" data-quick="5">+5</button>
        </div>
        <div class="resumo-hp-temp-edit">
          PV temp.: <input name="hp_temp" type="text" inputmode="numeric" value="${hpTemp}" data-validar="int" data-min="0" aria-label="PV temporários">
        </div>
      </div>

      <div class="stat-card"><div class="stat-card-label">${ico('escudo')} CA</div><div class="stat-card-valor">${c.ca ?? 10}</div></div>
      <div class="stat-card"><div class="stat-card-label">${ico('iniciativa')} Iniciativa</div><div class="stat-card-valor">${fmtMod(c.iniciativa_bonus ?? 0)}</div></div>
      <div class="stat-card"><div class="stat-card-label">${ico('pegadas')} Deslocamento</div><div class="stat-card-valor">${c.deslocamento ?? 9}m</div></div>

      <div class="stat-card stat-insp">
        <div class="stat-card-label">${ico('inspiracao')} Inspiração</div>
        <div class="resumo-insp-linha">
          <button type="button" class="insp-btn" id="insp-menos" aria-label="Diminuir inspiração">−</button>
          <input type="text" inputmode="numeric" name="inspiracao" id="insp-input" value="${insp}" data-validar="int" data-min="0" class="stat-card-valor resumo-insp-input" aria-label="Inspiração">
          <button type="button" class="insp-btn" id="insp-mais" aria-label="Aumentar inspiração">+</button>
        </div>
      </div>
    </div>
  `;
}

function renderResumoAtaques(c, atrs) {
  const armas = (c.inventario && c.inventario.armas) || [];
  if (!armas.length) {
    return `<div class="item-vazio">Nenhuma arma no inventário. Adicione na aba <strong>Equipamento</strong>.</div>`;
  }
  return `<div class="resumo-ataques">
    ${armas.map((arma, i) => {
      const calc = window.Ataques ? Ataques.calcular(arma, atrs, c.nivel) : null;
      return `<div class="ataque-card">
        <div class="ataque-nome">${escape(arma.nome || 'Arma')}</div>
        ${calc ? `<div class="ataque-info">
          <span title="Bônus de ataque (assume proficiência)">${ico('ataque')} ${fmtMod(calc.bonusAtaque)}</span>
          <span title="Dano">${ico('dano')} ${escape(calc.danoTexto)}${arma.tipo_dano ? ' ' + escape(arma.tipo_dano) : ''}</span>
        </div>` : ''}
        <button type="button" class="btn no-lock" data-resumo-rolar="${i}">🎲 Atacar</button>
      </div>`;
    }).join('')}
  </div>
  <p class="resumo-ataques-nota">Bônus assume proficiência com a arma — ajuste fino chega numa fase futura do Equipamento.</p>`;
}

function renderResumoMagias(c) {
  return `
    <div class="stat-row">
      <div class="stat-card"><div class="stat-card-label">CD de Resistência</div><div class="stat-card-valor">${c.cd_resistencia ?? 8}</div></div>
      <div class="stat-card"><div class="stat-card-label">Ataque Mágico</div><div class="stat-card-valor">${fmtMod(c.bonus_atq_magia ?? 0)}</div></div>
    </div>
    ${renderSlotsResumo(c)}
    <button type="button" class="btn no-lock" data-resumo-ir="magias">${ico('conjurar')} Ver Magias</button>
  `;
}

// Versão compacta e SÓ LEITURA dos espaços de magia — a interativa (clicar
// pra gastar/recuperar) mora na aba Magias/Combate. Mesma fonte de dados
// (SlotsPHB + c.slots_magia), template mais terso pro "olhar e já saber".
function renderSlotsResumo(c) {
  const slotsClasse = (window.SlotsPHB && c.classe) ? window.SlotsPHB.porClasse(c.classe, c.nivel || 1, c.subclasse) : null;
  if (!slotsClasse) return '';
  const slots = c.slots_magia || {};
  const niveis = Object.entries(slotsClasse).filter(([, max]) => max > 0);
  if (!niveis.length) return `<div class="item-vazio">Nenhum espaço de magia neste nível.</div>`;
  return `<div class="resumo-slots">
    ${niveis.map(([nv, max]) => {
      const usados = Math.min((slots[nv]?.atual) || 0, max);
      const disp = max - usados;
      const pips = Array.from({ length: max }).map((_, i) => `<span class="slot-pip-mini ${i < usados ? 'gasto' : ''}"></span>`).join('');
      return `<div class="resumo-slot-linha">
        <span class="resumo-slot-nv">${nv}º</span>
        <span class="resumo-slot-pips">${pips}</span>
        <span class="resumo-slot-disp">${disp}/${max}</span>
      </div>`;
    }).join('')}
  </div>`;
}

// ── Favoritas (Fase 5, §11: "as habilidades favoritas podem aparecer no
// Resumo") ── charAtivo.habilidades_favoritas (lista de slugs) já vem
// carregado com o personagem; os NOMES/descrições, porém, dependem do
// catálogo de classe (fetch assíncrono, cacheado em HABILIDADES_CLASSES
// por nucleo.js) — por isso o placeholder síncrono + preenchimento async,
// igual carregarMagiasPreparadas() faz pra #magias-prep.
function renderResumoFavoritas(c) {
  const favs = Array.isArray(c.habilidades_favoritas) ? c.habilidades_favoritas : [];
  if (!favs.length) return '';
  return `
    <section class="resumo-secao">
      <h3>Favoritas</h3>
      <div id="resumo-favoritas-wrap">Carregando…</div>
    </section>`;
}

async function carregarResumoFavoritas() {
  const wrap = document.getElementById('resumo-favoritas-wrap');
  if (!wrap || !charAtivo) return;
  const favs = Array.isArray(charAtivo.habilidades_favoritas) ? charAtivo.habilidades_favoritas : [];
  if (!favs.length) { wrap.innerHTML = ''; return; }
  const todas = await todasHabilidadesPJ(charAtivo);
  const porSlug = new Map(todas.map(h => [h.slug, h]));
  const lista = favs.map(slug => porSlug.get(slug)).filter(Boolean);
  if (!lista.length) {
    wrap.innerHTML = `<div class="item-vazio">Habilidades favoritadas não encontradas (podem ter sido removidas).</div>`;
    return;
  }
  wrap.innerHTML = lista.map(h => `
    <div class="fav-hab-card">
      <div class="fav-hab-nome">${escape(h.nome)}${h.tipoAcao !== 'passiva' ? ` <span class="hab-tipo-badge hab-tipo-${h.tipoAcao}">${rotuloTipoAcao(h.tipoAcao)}</span>` : ''}</div>
      <div class="fav-hab-desc">${escape(h.desc || '—')}</div>
    </div>
  `).join('');
}

let _condicaoExpandida = null;

function renderResumoOutros(c) {
  const ativas = Array.isArray(c.condicoes) ? c.condicoes : [];
  const salv = c.salvaguardas || {};

  return `
    <div class="stat-row resumo-outros-grid">
      <div class="stat-card">
        <div class="stat-card-label">${ico('olho')} Percepção Passiva</div>
        <div class="stat-card-valor">${percepcaoPassiva(c)}</div>
      </div>
    </div>

    <h4 class="resumo-sub">Condições</h4>
    ${renderCondicoesBloco('resumo-condicoes-wrap', ativas)}

    <h4 class="resumo-sub">Salvaguardas</h4>
    <div class="resumo-salvs">
      ${ATRIBUTOS.map(([k, nome]) => {
        const prof = salvProf(salv, k);
        return `<span class="resumo-salv-chip ${prof ? 'prof' : ''}" title="${escape(nome)}${prof ? ' (proficiente)' : ''}">
          ${nome.slice(0, 3).toUpperCase()} ${fmtMod(valorSalvaguarda(c, k))}
        </span>`;
      }).join('')}
    </div>

    <h4 class="resumo-sub">Atalhos</h4>
    <div class="resumo-atalhos">
      <button type="button" class="btn no-lock" data-resumo-ir="equipamento">${ico('mochila')} Equipamento</button>
      <button type="button" class="btn no-lock" data-resumo-ir="aliados">${ico('aliado')} Aliados</button>
      <button type="button" class="btn no-lock" data-resumo-ir="habilidades">${ico('brilho')} Habilidades</button>
    </div>
  `;
}

// Bloco de Condições compartilhado com a aba Combate (Fase 4) — o `wrapId`
// deixa cada aba usar seu próprio container (nunca renderizados ao mesmo
// tempo, então IDs iguais não colidiriam de qualquer forma, mas cada aba
// mantém o nome que já usava por clareza no devtools).
function renderCondicoesBloco(wrapId, ativas) {
  return `<div class="resumo-condicoes" id="${wrapId}">${renderChipsCondicoes(ativas)}</div>`;
}

function renderChipsCondicoes(ativas) {
  const lista = ativas.length ? ativas.map(nome => `
    <button type="button" class="condicao-chip ${nome === _condicaoExpandida ? 'aberta' : ''}" data-condicao-ver="${escape(nome)}">
      ${escape(nome)}
      <span class="condicao-x" data-condicao-remover="${escape(nome)}" role="button" tabindex="0" aria-label="Remover ${escape(nome)}">✕</span>
    </button>
  `).join('') : `<span class="item-vazio-inline">Nenhuma condição ativa</span>`;

  const detalhe = _condicaoExpandida && ativas.includes(_condicaoExpandida)
    ? `<div class="condicao-detalhe">${escape(CondicoesRegras.descricao(_condicaoExpandida) || 'Sem descrição.')}</div>`
    : '';

  const disponiveis = (window.CondicoesRegras ? CondicoesRegras.LISTA : []).filter(n => !ativas.includes(n));

  return `
    <div class="resumo-cond-lista">${lista}</div>
    ${detalhe}
    <div class="menu-acoes resumo-cond-add no-lock">
      <button type="button" class="btn no-lock" id="btn-add-condicao" aria-haspopup="true" aria-expanded="false">+ Adicionar condição</button>
      <div class="menu-popover" id="menu-condicoes" role="menu" hidden>
        ${disponiveis.length
          ? disponiveis.map(n => `<button type="button" class="menu-item" role="menuitem" data-condicao-add="${escape(n)}">${escape(n)}</button>`).join('')
          : `<div class="item-vazio" style="padding:8px 12px">Todas já estão ativas</div>`}
      </div>
    </div>
  `;
}

function conectarListenersResumo() {
  carregarResumoFavoritas(); // async — só existe #resumo-favoritas-wrap se houver favoritas

  // Ataques: rolar dado (toast com o resultado — não persiste nada)
  document.querySelectorAll('[data-resumo-rolar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.resumoRolar;
      const arma = (charAtivo.inventario?.armas || [])[idx];
      if (!arma || !window.Ataques) return;
      const r = Ataques.rolar(arma, charAtivo.atributos, charAtivo.nivel, _modoRolagem);
      const critico = r.critico ? ' · CRÍTICO!' : r.falhaCritica ? ' · falha crítica' : '';
      toast(`${arma.nome}: ataque ${r.ataqueTexto}${critico} · dano ${r.danoTexto}`);
    });
  });

  // Atalhos "Ver X" — reusa o clique real da aba (mesma lógica de sempre)
  document.querySelectorAll('[data-resumo-ir]').forEach(btn => {
    btn.addEventListener('click', () => {
      const alvo = document.querySelector(`.tab[data-tab="${btn.dataset.resumoIr}"]`);
      if (alvo) alvo.click();
    });
  });

  conectarListenersCondicoes('resumo-condicoes-wrap');
}

// Isolado de conectarListenersResumo() de propósito: toggle de condição só
// reconstrói o wrap (por padrão #resumo-condicoes-wrap; a aba Combate passa
// '#combate-condicoes-wrap' — Fase 4) e rewire SÓ esse pedaço. Se chamasse
// a função-mãe inteira de novo, os botões de Ataques/Atalhos (que continuam
// no DOM, não foram recriados) ganhariam um listener novo a cada toggle —
// clique acumulando toasts/navegações duplicadas.
function conectarListenersCondicoes(wrapId) {
  wrapId = wrapId || 'resumo-condicoes-wrap';
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;

  const atualizar = () => {
    wrap.innerHTML = renderChipsCondicoes(Array.isArray(charAtivo.condicoes) ? charAtivo.condicoes : []);
    conectarListenersCondicoes(wrapId);
  };

  wrap.querySelectorAll('[data-condicao-ver]').forEach(chip => {
    chip.addEventListener('click', e => {
      if (e.target.closest('[data-condicao-remover]')) return; // o X trata separado
      const nome = chip.dataset.condicaoVer;
      _condicaoExpandida = _condicaoExpandida === nome ? null : nome;
      atualizar();
    });
  });
  wrap.querySelectorAll('[data-condicao-remover]').forEach(x => {
    const remover = (e) => {
      e.stopPropagation();
      alternarCondicao(x.dataset.condicaoRemover);
      if (_condicaoExpandida === x.dataset.condicaoRemover) _condicaoExpandida = null;
      atualizar();
    };
    x.addEventListener('click', remover);
    x.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); remover(e); } });
  });

  const addBtn = document.getElementById('btn-add-condicao');
  const addMenu = document.getElementById('menu-condicoes');
  if (addBtn && addMenu) {
    addBtn.addEventListener('click', e => {
      e.stopPropagation();
      const abrir = addMenu.hidden;
      addMenu.hidden = !abrir;
      addBtn.setAttribute('aria-expanded', String(abrir));
    });
    addMenu.querySelectorAll('[data-condicao-add]').forEach(item => {
      item.addEventListener('click', () => {
        alternarCondicao(item.dataset.condicaoAdd);
        atualizar();
      });
    });
  }
}
// Fecha o popover de "+ Adicionar condição" ao clicar fora — um só listener
// global (não em conectarListenersCondicoes, que roda de novo a cada toggle).
document.addEventListener('click', e => {
  const addBtn = document.getElementById('btn-add-condicao');
  const addMenu = document.getElementById('menu-condicoes');
  if (addMenu && !addMenu.hidden && !addMenu.contains(e.target) && e.target !== addBtn) {
    addMenu.hidden = true;
    if (addBtn) addBtn.setAttribute('aria-expanded', 'false');
  }
});

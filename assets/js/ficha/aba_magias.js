// assets/js/ficha/aba_magias.js
// Aba Magias (Fase 6 do redesign): lista as magias favoritadas no Grimório
// (spell_lists), agora com busca + filtros (nível, escola, tipo de ação,
// concentração, ritual), os espaços de magia interativos no topo (mesma
// renderSlotsMagia de Combate — Combate mantém um resumo colapsado que
// aponta pra cá), accordion de detalhes e o modal de Conjurar.
//
// "Preparadas" não virou filtro: esta lista JÁ é só as magias preparadas
// (favoritadas) — um filtro "Preparadas" aqui seria sempre verdadeiro. Isso
// faz mais sentido no Grimório (paineis/magias.html), que mostra as 361.

function renderMagias(c) {
  const slots = c.slots_magia || {};
  return `
    <h3>Espaços de Magia</h3>
    ${renderSlotsMagia(c, slots)}

    <h3 style="margin-top:22px">Magias Preparadas</h3>
    <p style="color:var(--text-dim);font-style:italic;margin-bottom:14px">
      Aparecem aqui as magias marcadas como favoritas no <a href="magias.html" style="color:var(--gold-bright)">Grimório</a>.
    </p>

    <div class="hab-busca-wrap">
      <input type="search" id="magia-busca" class="hab-busca-input" placeholder="Buscar magia…" aria-label="Buscar magia">
    </div>
    <div class="magia-filtros" id="magia-filtros" hidden>
      <div class="linha-filtro-magia">
        <span class="linha-filtro-lbl">Nível</span>
        <div class="hab-filtros">
          ${[0,1,2,3,4,5,6,7,8,9].map(n => `<button type="button" class="pill ${_magiaNiveis.has(n)?'ativo':''}" data-magia-nivel="${n}" aria-pressed="${_magiaNiveis.has(n)}">${n===0?'Truque':n+'º'}</button>`).join('')}
        </div>
      </div>
      <div class="linha-filtro-magia">
        <span class="linha-filtro-lbl">Escola</span>
        <div class="hab-filtros" id="magia-filtro-escolas"><!-- só as escolas presentes na lista, populado no carregar --></div>
      </div>
      <div class="linha-filtro-magia">
        <span class="linha-filtro-lbl">Ação</span>
        <div class="hab-filtros">
          ${['todas','acao','bonus','reacao','outro'].map(t => `<button type="button" class="pill ${_magiaTipo===t?'ativo':''}" data-magia-tipo="${t}" aria-pressed="${_magiaTipo===t}">${{todas:'Todas',acao:'Ação',bonus:'Ação Bônus',reacao:'Reação',outro:'Outro'}[t]}</button>`).join('')}
        </div>
      </div>
      <div class="linha-filtro-magia">
        <span class="linha-filtro-lbl">&nbsp;</span>
        <div class="hab-filtros">
          <button type="button" class="pill ${_magiaConcentracao?'ativo':''}" data-magia-bool="concentracao" aria-pressed="${_magiaConcentracao}">◐ Concentração</button>
          <button type="button" class="pill ${_magiaRitual?'ativo':''}" data-magia-bool="ritual" aria-pressed="${_magiaRitual}">✦ Ritual</button>
        </div>
      </div>
    </div>

    <div id="magias-prep">Carregando…</div>
    <div id="magias-sem-resultados" class="item-vazio" hidden>Nenhuma magia encontrada com esse filtro/busca.</div>
  `;
}

// Deriva o tipo de ação a partir de tempoCast (campo semiestruturado dos
// dados do Grimório: "1 ação", "1 ação bônus", "1 reação, que…", "1 minuto"
// etc.) — mais confiável que o heurístico de Habilidades porque o campo já
// é sobre tempo de conjuração, não uma descrição livre.
function detectarTipoAcaoMagia(m) {
  const t = (m.tempoCast || '').toLowerCase();
  if (/a[çc][ãa]o\s+b[ôo]nus/.test(t)) return 'bonus';
  if (/rea[çc][ãa]o/.test(t)) return 'reacao';
  if (/^1\s+a[çc][ãa]o\b/.test(t)) return 'acao';
  return 'outro';
}

// ── Estado dos filtros (sessão, não é dado do personagem) ──
let _magiaBusca = '';
let _magiaNiveis = new Set();   // vazio = todos os níveis
let _magiaEscolas = new Set();  // vazio = todas as escolas
let _magiaTipo = 'todas';
let _magiaConcentracao = false;
let _magiaRitual = false;

function semAcentoMagia(s) { return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

function aplicarFiltroMagias() {
  const termo = semAcentoMagia(_magiaBusca.trim());
  let visiveis = 0;
  document.querySelectorAll('#magias-prep .magia-item').forEach(item => {
    const nivel = +item.dataset.magiaNivel;
    const escola = item.dataset.magiaEscola;
    const tipo = item.dataset.magiaTipo;
    const conc = item.dataset.magiaConcentracao === '1';
    const rit = item.dataset.magiaRitual === '1';

    const nivelOk = !_magiaNiveis.size || _magiaNiveis.has(nivel);
    const escolaOk = !_magiaEscolas.size || _magiaEscolas.has(escola);
    const tipoOk = _magiaTipo === 'todas' || _magiaTipo === tipo;
    const concOk = !_magiaConcentracao || conc;
    const ritOk = !_magiaRitual || rit;
    const textoOk = !termo || semAcentoMagia(item.textContent).includes(termo);

    const mostrar = nivelOk && escolaOk && tipoOk && concOk && ritOk && textoOk;
    item.hidden = !mostrar;
    if (mostrar) visiveis++;
  });
  const semResultados = document.getElementById('magias-sem-resultados');
  if (semResultados) semResultados.hidden = visiveis > 0;
}

function conectarListenersFiltroMagias() {
  const busca = document.getElementById('magia-busca');
  if (busca) {
    busca.value = _magiaBusca; // reflete estado se a aba foi re-renderizada (ex.: após conjurar)
    busca.addEventListener('input', () => { _magiaBusca = busca.value; aplicarFiltroMagias(); });
  }

  document.querySelectorAll('[data-magia-nivel]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nv = +btn.dataset.magiaNivel;
      if (_magiaNiveis.has(nv)) _magiaNiveis.delete(nv); else _magiaNiveis.add(nv);
      btn.classList.toggle('ativo', _magiaNiveis.has(nv));
      btn.setAttribute('aria-pressed', String(_magiaNiveis.has(nv)));
      aplicarFiltroMagias();
    });
  });
  document.querySelectorAll('[data-magia-escola]').forEach(btn => {
    btn.addEventListener('click', () => {
      const es = btn.dataset.magiaEscola;
      if (_magiaEscolas.has(es)) _magiaEscolas.delete(es); else _magiaEscolas.add(es);
      btn.classList.toggle('ativo', _magiaEscolas.has(es));
      btn.setAttribute('aria-pressed', String(_magiaEscolas.has(es)));
      aplicarFiltroMagias();
    });
  });
  document.querySelectorAll('[data-magia-tipo]').forEach(btn => {
    btn.addEventListener('click', () => {
      _magiaTipo = btn.dataset.magiaTipo;
      document.querySelectorAll('[data-magia-tipo]').forEach(b => {
        b.classList.toggle('ativo', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      aplicarFiltroMagias();
    });
  });
  document.querySelectorAll('[data-magia-bool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const chave = btn.dataset.magiaBool;
      if (chave === 'concentracao') _magiaConcentracao = !_magiaConcentracao;
      if (chave === 'ritual') _magiaRitual = !_magiaRitual;
      const ativo = chave === 'concentracao' ? _magiaConcentracao : _magiaRitual;
      btn.classList.toggle('ativo', ativo);
      btn.setAttribute('aria-pressed', String(ativo));
      aplicarFiltroMagias();
    });
  });
}

async function carregarMagiasPreparadas() {
  const wrap = document.getElementById('magias-prep');
  if (!wrap) return;
  const favSet = await carregarFavoritasDoBanco();
  if (!favSet.size) {
    wrap.innerHTML = `<div class="item-vazio">Nenhuma magia favoritada. Abra o <a href="magias.html" style="color:var(--gold-bright)">Grimório</a> e clique na estrela ☆ das magias que seu personagem prepara.</div>`;
    return;
  }
  const todas = await carregarMagiasCache();
  const lista = todas.filter(m => favSet.has(m.nome))
    .sort((a,b) => a.nivel - b.nivel || a.nome.localeCompare(b.nome, 'pt'));
  if (!lista.length) { wrap.innerHTML = `<div class="item-vazio">Nenhuma magia encontrada.</div>`; return; }

  // Popula os filtros de escola dinamicamente (só as escolas presentes na
  // lista do PJ — não tem sentido oferecer "Ilusão" se ele não prepara nenhuma).
  const filtrosWrap = document.getElementById('magia-filtros');
  const escolaWrap = document.getElementById('magia-filtro-escolas');
  if (escolaWrap) {
    const escolas = [...new Set(lista.map(m => m.escola))].sort((a,b) => a.localeCompare(b, 'pt'));
    escolaWrap.innerHTML = escolas.map(es => `<button type="button" class="pill ${_magiaEscolas.has(es)?'ativo':''}" data-magia-escola="${escape(es)}" aria-pressed="${_magiaEscolas.has(es)}">${escape(es)}</button>`).join('');
  }
  if (filtrosWrap) filtrosWrap.hidden = lista.length < 2; // com 0-1 magia, filtro é ruído

  wrap.innerHTML = `<div class="magias-lista">${lista.map((m, i) => {
    const nv = m.nivel === 0 ? 'Truque' : `${m.nivel}°`;
    const tipoAcao = detectarTipoAcaoMagia(m);
    const tags = [m.ritual?'<span>Ritual</span>':'', m.concentracao?'<span>Conc.</span>':''].filter(Boolean).join('');
    const descHtml = (m.descricao || '').split(/\n\n+/).map(p => `<p>${escape(p.trim())}</p>`).join('');
    const comps = (m.componentes || '') + (m.material ? ` (${escape(m.material)})` : '');
    return `<div class="magia-item" data-idx="${i}" data-magia-nivel="${m.nivel}" data-magia-escola="${escape(m.escola)}" data-magia-tipo="${tipoAcao}" data-magia-concentracao="${m.concentracao ? 1 : 0}" data-magia-ritual="${m.ritual ? 1 : 0}">
      <div class="magia-row" role="button" tabindex="0" aria-expanded="false">
        <span class="magia-nivel">${nv}</span>
        <span class="magia-nome">${escape(m.nome)}</span>
        <span class="magia-escola">${escape(m.escola)}</span>
        <span class="magia-tags">${tags}</span>
        <button type="button" class="magia-fav-btn no-lock" data-magia-fav="${escape(m.nome)}" aria-label="Remover das preparadas" title="Deixar de preparar (some daqui, continua no Grimório)">★</button>
        <span class="magia-chevron" aria-hidden="true">▸</span>
      </div>
      <div class="magia-detalhe">
        <div class="magia-info">
          <div class="magia-info-item"><div class="magia-info-key">Tempo</div><div class="magia-info-val">${escape(m.tempoCast || '—')}</div></div>
          <div class="magia-info-item"><div class="magia-info-key">Alcance</div><div class="magia-info-val">${escape(m.alcance || '—')}</div></div>
          <div class="magia-info-item"><div class="magia-info-key">Componentes</div><div class="magia-info-val">${comps || '—'}</div></div>
          <div class="magia-info-item"><div class="magia-info-key">Duração</div><div class="magia-info-val">${escape(m.duracao || '—')}</div></div>
        </div>
        <div class="magia-desc">${descHtml || '<p>—</p>'}</div>
        ${m.maiorNivel ? `<div class="magia-maior"><strong>Em Níveis Superiores.</strong> ${escape(m.maiorNivel)}</div>` : ''}
        ${m.nivel > 0 ? `<div class="magia-conjurar-bar">
          <button type="button" class="btn-conjurar" data-conjurar-nv="${m.nivel}" data-conjurar-nome="${escape(m.nome)}" data-conjurar-concentracao="${m.concentracao ? 1 : 0}">
            ${ico('conjurar')} Conjurar
          </button>
        </div>` : `<div class="magia-conjurar-bar"><span class="magia-truque-info">Truque — sem custo de slot</span></div>`}
      </div>
    </div>`;
  }).join('')}</div>`;

  // Toggle expand (UI.accordion, assets/js/ui.js)
  wrap.querySelectorAll('.magia-row').forEach(row => {
    UI.accordion(row, r => r.closest('.magia-item'), { classe: 'aberta' });
  });

  // Botão Conjurar → abre modal de escolha de slot
  wrap.querySelectorAll('.btn-conjurar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nv = +btn.dataset.conjurarNv;
      const nome = btn.dataset.conjurarNome;
      const concentracao = btn.dataset.conjurarConcentracao === '1';
      abrirModalConjurar(nome, nv, concentracao);
    });
  });

  // Estrela ★: deixa de preparar sem precisar sair pro Grimório
  // (paineis/magias.html) só pra desmarcar — a magia continua lá, só some
  // desta lista de preparadas.
  wrap.querySelectorAll('[data-magia-fav]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const nome = btn.dataset.magiaFav;
      btn.disabled = true;
      const ok = await removerMagiaFavoritaFicha(nome);
      if (ok) {
        toast(`"${nome}" removida das preparadas`);
        carregarMagiasPreparadas();
      } else {
        btn.disabled = false;
        toast('Erro ao remover — tente de novo');
      }
    });
  });

  conectarListenersFiltroMagias();
  aplicarFiltroMagias();
}

// Remove uma magia da lista "Favoritas" (spell_lists) do PJ ativo — mesma
// tabela usada pelo Grimório (assets/js/favoritas.js), só que direto daqui
// pra não obrigar o jogador a abrir outra página só pra desmarcar.
async function removerMagiaFavoritaFicha(nome) {
  if (!window.sb || !charAtivo?.id) return false;
  const { data: existente, error: errBusca } = await window.sb
    .from('spell_lists')
    .select('id, spell_names')
    .eq('character_id', charAtivo.id)
    .eq('nome', 'Favoritas')
    .maybeSingle();
  if (errBusca || !existente) { console.warn('[magias] remover favorita:', errBusca?.message); return false; }
  const novaLista = (existente.spell_names || []).filter(n => n !== nome);
  const { error } = await window.sb.from('spell_lists').update({ spell_names: novaLista }).eq('id', existente.id);
  if (error) { console.warn('[magias] remover favorita:', error.message); return false; }
  return true;
}

// ─── Modal de Conjurar (escolha de slot) ─────────────────────────
function abrirModalConjurar(nomeMagia, nivelMin, ehConcentracao) {
  const c = charAtivo;
  const slotsClasse = (window.SlotsPHB && c.classe) ? window.SlotsPHB.porClasse(c.classe, c.nivel || 1, c.subclasse) : null;
  if (!slotsClasse) {
    alert('Sua classe/subclasse não tem espaços de magia.');
    return;
  }
  const slotsAtuais = c.slots_magia || {};
  // Lista níveis ≥ nivelMin com slots disponíveis
  const opcoes = [];
  for (let n = nivelMin; n <= 9; n++) {
    const max = slotsClasse[n] || 0;
    const usados = (slotsAtuais[n]?.atual) || 0;
    const disp = Math.max(0, max - usados);
    if (max > 0) opcoes.push({ nv: n, disp, max });
  }
  if (!opcoes.length) {
    alert(`Sem espaços de nível ${nivelMin} ou superior nesta classe.`);
    return;
  }

  // Overlay/card genéricos (UI.abrirModal, assets/js/ui.js) — cuidam de
  // criar/remover o DOM e fechar no backdrop/Esc; este modal só entra com o
  // conteúdo e os listeners específicos dele.
  const { overlay, fechar } = UI.abrirModal({
    tituloHtml: `${ico('conjurar')} Conjurar <em>${escape(nomeMagia)}</em>`,
    corpoHtml: `
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:14px">
        Magia de <strong>${nivelMin}° nível</strong>. Escolha em qual espaço gastar:
      </p>
      <div class="modal-slots">
        ${opcoes.map(o => `
          <button type="button" class="modal-slot-btn" ${o.disp <= 0 ? 'disabled' : ''} data-nv="${o.nv}">
            <div class="modal-slot-nv">Nível ${o.nv}</div>
            <div class="modal-slot-disp">${o.disp} / ${o.max}</div>
            <div class="modal-slot-lbl">${o.disp <= 0 ? 'esgotado' : (o.nv > nivelMin ? 'upcast' : 'disponível')}</div>
          </button>
        `).join('')}
      </div>
      <div class="modal-acoes">
        <button type="button" class="btn" id="modal-cancelar">Cancelar</button>
      </div>
    `,
  });
  overlay.querySelector('#modal-cancelar').addEventListener('click', fechar);

  overlay.querySelectorAll('.modal-slot-btn').forEach(btn => {
    if (btn.disabled) return;
    btn.addEventListener('click', async () => {
      const nv = +btn.dataset.nv;
      const slots = c.slots_magia || {};
      const max = slotsClasse[nv] || 0;
      const atual = (slots[nv]?.atual) || 0;
      slots[nv] = { atual: Math.min(max, atual + 1), max };
      c.slots_magia = slots;
      fechar();
      // Salva direto (não passa pelo form, evita conflito de tabs)
      try {
        _ultimoSaveLocal = Date.now();
        await window.sb.from('characters').update({ slots_magia: slots }).eq('id', c.id);
        mostrarToastConjurar(nomeMagia, nv);
        if (ehConcentracao) {
          const interrompida = iniciarConcentracao(nomeMagia);
          if (interrompida) toast(`◐ Concentração em "${interrompida}" foi interrompida`, 'aviso');
        }
        // Re-renderiza a aba: o grid de Espaços de Magia no topo (renderSlotsMagia)
        // foi montado com o slots_magia ANTIGO — sem isso ele fica com dado
        // obsoleto até o jogador trocar de aba e voltar.
        render();
      } catch (e) {
        alert('Erro ao gastar slot: ' + e.message);
      }
    });
  });
}

function mostrarToastConjurar(nome, nv) {
  const t = document.createElement('div');
  t.className = 'toast-conjurar';
  t.innerHTML = `${ico('brilho')} <strong>${escape(nome)}</strong> conjurada · slot de nível ${nv} gasto`;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2500);
}

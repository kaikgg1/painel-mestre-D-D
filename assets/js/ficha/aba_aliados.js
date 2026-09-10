// assets/js/ficha/aba_aliados.js
// Aba Aliados: criaturas/NPCs controlados pelo personagem (stat block completo,
// HP gastável, imagem) + o buscador do Bestiário e seus favoritos.
// Persiste em characters.companions e characters.bestiario_favoritos.

/* ============================================================
   ALIADOS — criaturas/NPCs controlados pelo personagem
   (invocações, familiares, golems, companheiros animais)
   Persiste em characters.companions (jsonb array)
   ============================================================ */
const ATR_CRIATURA = [['for','FOR'],['dex','DES'],['con','CON'],['int','INT'],['sab','SAB'],['car','CAR']];

// Templates do Bestiário (stats do Manual dos Monstros / Livro do Jogador 5e)
const TEMPLATES_CRIATURA = {
  golem_carne: {
    nome: 'Golem de Carne', tipo: 'Constructo Médio, neutro',
    ca: 9, hp_max: 93, hp_atual: 93, pv_dados: '11d8 + 44', deslocamento: '9 m',
    atributos: { for:19, dex:9, con:18, int:6, sab:10, car:5 },
    resistencias: '',
    imunidades: 'Dano: elétrico, veneno; concussão, cortante e perfurante de ataques não-mágicos que não sejam de adamante · Condições: amedrontado, enfeitiçado, envenenado, exausto, paralisado, petrificado',
    sentidos: 'Visão no escuro 18 m · Percepção passiva 10',
    idiomas: 'Compreende os idiomas do seu criador, mas não pode falar',
    nd: '5 (1.800 XP)',
    tracos: [
      { nome: 'Absorção de Eletricidade', desc: 'Sempre que for alvo de dano elétrico, não sofre dano e recupera PV iguais ao dano elétrico causado.' },
      { nome: 'Arma Mágica', desc: 'Os ataques de armas do golem são mágicos.' },
      { nome: 'Aversão a Fogo', desc: 'Se sofrer dano de fogo, tem desvantagem nas jogadas de ataque e testes de habilidade até o final do próximo turno.' },
      { nome: 'Forma Imutável', desc: 'Imune a qualquer magia ou efeito que poderia alterar sua forma.' },
      { nome: 'Fúria', desc: 'Sempre que começar um turno com 40 PV ou menos, role 1d6. Num 6, entra em fúria e ataca a criatura mais próxima a cada turno até ser destruído ou recuperar todos os PV. O criador a até 18 m pode usar uma ação e Carisma (Persuasão) CD 15 para acalmá-lo.' },
      { nome: 'Resistência à Magia', desc: 'Tem vantagem nos testes de resistência contra magias e outros efeitos mágicos.' },
    ],
    acoes: [
      { nome: 'Ataques Múltiplos', desc: 'O golem realiza dois ataques de pancada.' },
      { nome: 'Pancada', desc: 'Ataque Corpo-a-Corpo com Arma: +7 para atingir, alcance 1,5 m, um alvo. Acerto: 13 (2d8+4) de dano de concussão.' },
    ],
    notas: 'Fonte: Manual dos Monstros, pág. 176.',
  },
  corvo: {
    nome: 'Corvo', tipo: 'Besta Miúda, imparcial',
    ca: 12, hp_max: 1, hp_atual: 1, pv_dados: '1d4 - 1', deslocamento: '3 m, voo 15 m',
    atributos: { for:2, dex:14, con:8, int:2, sab:12, car:6 },
    resistencias: '', imunidades: '',
    sentidos: 'Percepção passiva 13 · Perícia: Percepção +3',
    idiomas: '—', nd: '0 (10 XP)',
    tracos: [
      { nome: 'Mímica', desc: 'Capaz de imitar sons simples que ouve (pessoas cochichando, bebê chorando, animal rangendo). Quem ouvir pode perceber que são imitações com um teste de Sabedoria (Intuição) CD 10.' },
    ],
    acoes: [
      { nome: 'Bicada', desc: 'Ataque Corpo-a-Corpo com Arma: +4 para atingir, alcance 1,5 m, um alvo. Acerto: 1 de dano perfurante.' },
    ],
    notas: 'Fonte: Manual dos Monstros, pág. 326.',
  },
  novo: {
    nome: 'Nova Criatura', tipo: '',
    ca: 10, hp_max: 1, hp_atual: 1, pv_dados: '', deslocamento: '9 m',
    atributos: { for:10, dex:10, con:10, int:10, sab:10, car:10 },
    resistencias: '', imunidades: '', sentidos: '', idiomas: '', nd: '',
    tracos: [], acoes: [], notas: '',
  },
};

function modCriatura(v) { return Math.floor(((+v||10) - 10) / 2); }

function renderAliados(c) {
  const lista = Array.isArray(c.companions) ? c.companions : [];
  // Uma criatura nova entra sempre expandida (você acabou de adicioná-la,
  // faz sentido já ver/editar o stat block); o resto respeita o que o
  // jogador escolheu (ver _criaturasExpandidas, definida em renderCardCriatura).
  if (_criaturasUltimoTotal !== null && lista.length > _criaturasUltimoTotal) _criaturasExpandidas.add(lista.length - 1);
  _criaturasUltimoTotal = lista.length;
  const cards = lista.map((cr, i) => renderCardCriatura(cr, i)).join('');
  return `
    <div class="aliados-topo">
      <div>
        <h3 style="margin:0">Aliados & Criaturas</h3>
        <p style="color:var(--text-dim);font-style:italic;font-size:12px;margin:4px 0 0">
          NPCs, familiares, invocações e companheiros que você controla. HP gastável em combate.
        </p>
      </div>
      <div class="aliados-add no-lock">
        <button type="button" class="btn primary no-lock" id="btn-buscar-monstro">${ico('buscar')} Buscar no Bestiário</button>
        <select id="aliado-template" class="no-lock" aria-label="Adicionar criatura favorita ou em branco">
          <option value="novo">+ Em branco</option>
          ${favLista().map(n => `<option value="fav:${escape(n)}">★ ${escape(tituloBonito(n))}</option>`).join('')}
        </select>
        <button type="button" class="btn no-lock" id="btn-add-aliado">+ Adicionar</button>
      </div>
    </div>
    ${favLista().length ? '' : `<p style="color:var(--text-dim);font-style:italic;font-size:11px;margin:0 0 12px">★ Dica: favorite criaturas no <strong>${ico('buscar')} Buscar no Bestiário</strong> (estrela) para elas aparecerem aqui como atalho rápido.</p>`}
    <div id="aliados-wrap">
      ${lista.length ? cards : `<div class="item-vazio">Nenhuma criatura ainda. Use <strong>${ico('buscar')} Buscar no Bestiário</strong> ou escolha um favorito acima.</div>`}
    </div>
  `;
}

// Estado de recolhido/expandido (Fase 8, §15) — sessão apenas, não é dado
// do personagem. Rastreado por ÍNDICE (mesma convenção de data-cr="i" que
// o resto deste arquivo já usa pra tudo) — remover uma criatura no meio da
// lista pode deixar o estado de expansão "deslocado" por uma renderização,
// limitação aceita (é só preferência de UI, não perde dado nenhum).
let _criaturasExpandidas = new Set();
// null = "ainda não vimos a lista nenhuma vez" — distingue a PRIMEIRA
// renderização (personagem carregado já com criaturas: não expandir nada)
// de um item genuinamente ADICIONADO durante a sessão (aí sim expande).
// Sem essa distinção, todo personagem com aliados já salvos abriria com o
// último expandido só por causa do primeiro render.
let _criaturasUltimoTotal = null;

function renderCardCriatura(cr, i) {
  const a = cr.atributos || {};
  const hpMax = cr.hp_max ?? 1;
  const hpAtual = cr.hp_atual ?? hpMax;
  const pct = hpMax > 0 ? Math.max(0, Math.min(100, Math.round(hpAtual / hpMax * 100))) : 0;
  const classeBar = pct <= 15 ? 'critico' : pct <= 35 ? 'baixo' : pct <= 65 ? 'medio' : '';
  const listaCr = (arr) => (arr || [])
    .map(t => `<li><strong>${escape(t.nome)}.</strong> ${escape(t.desc)}</li>`).join('');
  const tracos    = listaCr(cr.tracos);
  const acoes     = listaCr(cr.acoes);
  const crBonus   = listaCr(cr.acoes_bonus);
  const crReacoes = listaCr(cr.reacoes);
  const crLend    = listaCr(cr.acoes_lendarias);
  const crCovil   = listaCr(cr.acoes_covil);
  const aberto = _criaturasExpandidas.has(i);

  return `
    <div class="criatura-card" data-cr="${i}">
      <div class="criatura-resumo no-lock" data-cr-toggle="${i}" role="button" tabindex="0" aria-expanded="${aberto}" aria-controls="criatura-corpo-${i}">
        <div class="criatura-resumo-img" aria-hidden="true">
          ${cr.imagem ? `<img src="${escape(cr.imagem)}" alt="" onerror="this.style.display='none'">` : ico('retrato')}
        </div>
        <div class="criatura-resumo-info">
          <span class="criatura-resumo-nome">${escape(cr.nome || 'Sem nome')}</span>
          <span class="criatura-resumo-stats">
            <span class="cr-resumo-hp-linha no-lock">
              <button type="button" class="cr-resumo-hp-btn no-lock" data-cr-dmg="${i}" data-v="-1" aria-label="−1 PV" title="−1 PV">−</button>
              PV <span class="cr-resumo-hp-txt" data-cr-hp-txt="${i}">${hpAtual}/${hpMax}</span>
              <button type="button" class="cr-resumo-hp-btn no-lock" data-cr-dmg="${i}" data-v="1" aria-label="+1 PV" title="+1 PV">+</button>
            </span>
            · CA ${cr.ca ?? 10} · Mov. ${escape(cr.deslocamento || '—')} · ND ${escape(cr.nd || '—')}
          </span>
          <span class="cr-resumo-hpbar"><span class="cc-hpfill ${classeBar}" style="width:${pct}%"></span></span>
        </div>
        <span class="criatura-resumo-chevron" aria-hidden="true">${aberto ? '▾' : '▸'}</span>
      </div>

      <div class="criatura-corpo" id="criatura-corpo-${i}" ${aberto ? '' : 'hidden'}>
      <div class="criatura-head">
        <div class="criatura-img-wrap">
          <div class="criatura-img no-lock ${cr.imagem ? 'tem' : ''}" data-cr-img="${i}" role="button" tabindex="0" title="${cr.imagem ? 'Clique para ampliar' : 'Adicionar imagem (URL)'}" aria-label="Imagem da criatura">
            ${cr.imagem ? `<img src="${escape(cr.imagem)}" alt="${escape(cr.nome||'')}" onerror="tentarRecuperarImagemCriatura(this, ${i})">` : `<span class="criatura-img-ph">${ico('retrato')}</span>`}
          </div>
          <button type="button" class="criatura-img-edit no-lock" data-cr-img-edit="${i}" title="Trocar/remover imagem (URL)" aria-label="Editar imagem">${ico('editar')}</button>
        </div>
        <div class="criatura-id">
          <input class="criatura-nome" data-cr-campo="nome" data-cr="${i}" value="${escape(cr.nome||'')}" placeholder="Nome" aria-label="Nome da criatura">
          <input class="criatura-tipo" data-cr-campo="tipo" data-cr="${i}" value="${escape(cr.tipo||'')}" placeholder="Tipo (ex.: Besta Média)" aria-label="Tipo">
        </div>
        <button type="button" class="criatura-del no-lock" data-cr-del="${i}" title="Remover criatura" aria-label="Remover criatura">${ico('lixeira')}</button>
      </div>

      <div class="criatura-combate">
        <div class="cc-box">
          <label>${ico('escudo')} CA</label>
          <input class="cc-num" data-cr-campo="ca" data-cr="${i}" inputmode="numeric" value="${cr.ca ?? 10}">
        </div>
        <div class="cc-box cc-hp">
          <label>${ico('vida')} PV ${cr.pv_dados ? `<span class="cc-dados" title="Dados de Vida — clique no dado pra rolar">(${escape(cr.pv_dados)})</span>` : ''}</label>
          <div class="cc-hp-row">
            <input class="cc-num" data-cr-campo="hp_atual" data-cr="${i}" inputmode="numeric" value="${hpAtual}" aria-label="PV atual">
            <span>/</span>
            <input class="cc-num" data-cr-campo="hp_max" data-cr="${i}" inputmode="numeric" value="${hpMax}" aria-label="PV máximo">
            ${cr.pv_dados ? `<button type="button" class="cc-rolar no-lock" data-cr-rolar="${i}" title="Rolar ${escape(cr.pv_dados)} para definir o PV máximo" aria-label="Rolar dados de vida">${ico('dado')}</button>` : ''}
          </div>
          <input type="hidden" data-cr-campo="pv_dados" data-cr="${i}" value="${escape(cr.pv_dados||'')}">
          <div class="cc-hpbar"><div class="cc-hpfill ${classeBar}" style="width:${pct}%"></div></div>
          <div class="cc-hp-quick no-lock">
            <button type="button" data-cr-dmg="${i}" data-v="-5">-5</button>
            <button type="button" data-cr-dmg="${i}" data-v="-1">-1</button>
            <button type="button" data-cr-dmg="${i}" data-v="1">+1</button>
            <button type="button" data-cr-dmg="${i}" data-v="5">+5</button>
          </div>
        </div>
        <div class="cc-box">
          <label>${ico('pegadas')} Desloc.</label>
          <input class="cc-txt" data-cr-campo="deslocamento" data-cr="${i}" value="${escape(cr.deslocamento||'')}" placeholder="9 m">
        </div>
        <div class="cc-box">
          <label>${ico('ataque')} ND</label>
          <input class="cc-txt" data-cr-campo="nd" data-cr="${i}" value="${escape(cr.nd||'')}" placeholder="—">
        </div>
      </div>

      <div class="criatura-atrs">
        ${ATR_CRIATURA.map(([k, lbl]) => `
          <div class="cr-atr">
            <span class="cr-atr-lbl">${lbl}</span>
            <input class="cr-atr-val" data-cr-atr="${k}" data-cr="${i}" inputmode="numeric" value="${a[k] ?? 10}" aria-label="${lbl}">
            <span class="cr-atr-mod" data-cr-mod="${i}-${k}">${fmtMod(modCriatura(a[k]))}</span>
          </div>
        `).join('')}
      </div>

      <div class="criatura-meta">
        <div class="cm-row"><label>Resistências</label><input data-cr-campo="resistencias" data-cr="${i}" value="${escape(cr.resistencias||'')}" placeholder="—"></div>
        <div class="cm-row"><label>Imunidades</label><input data-cr-campo="imunidades" data-cr="${i}" value="${escape(cr.imunidades||'')}" placeholder="—"></div>
        <div class="cm-row"><label>Sentidos</label><input data-cr-campo="sentidos" data-cr="${i}" value="${escape(cr.sentidos||'')}" placeholder="—"></div>
        <div class="cm-row"><label>Idiomas</label><input data-cr-campo="idiomas" data-cr="${i}" value="${escape(cr.idiomas||'')}" placeholder="—"></div>
      </div>

      ${tracos ? `<div class="criatura-sec"><h4>Traços</h4><ul class="criatura-lista">${tracos}</ul></div>` : ''}
      ${acoes ? `<div class="criatura-sec"><h4>Ações</h4><ul class="criatura-lista">${acoes}</ul></div>` : ''}
      ${crBonus ? `<div class="criatura-sec"><h4>Ações Bônus</h4><ul class="criatura-lista">${crBonus}</ul></div>` : ''}
      ${crReacoes ? `<div class="criatura-sec"><h4>Reações</h4><ul class="criatura-lista">${crReacoes}</ul></div>` : ''}
      ${crLend ? `<div class="criatura-sec"><h4>Ações Lendárias</h4><ul class="criatura-lista">${crLend}</ul></div>` : ''}
      ${crCovil ? `<div class="criatura-sec"><h4>Ações de Covil</h4><ul class="criatura-lista">${crCovil}</ul></div>` : ''}

      <div class="criatura-sec">
        <h4>Notas</h4>
        <textarea class="criatura-notas" data-cr-campo="notas" data-cr="${i}" placeholder="Anotações livres, traços/ações personalizadas…">${escape(cr.notas||'')}</textarea>
      </div>
      </div>
    </div>
  `;
}

function _companionsAtuais() {
  if (!Array.isArray(charAtivo.companions)) charAtivo.companions = [];
  return charAtivo.companions;
}

// Lightbox: amplia a imagem da criatura em tela cheia
function abrirLightboxCriatura(url, nome) {
  let lb = document.getElementById('cr-lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'cr-lightbox';
    lb.className = 'cr-lightbox';
    lb.innerHTML = '<button type="button" class="cr-lb-fechar" aria-label="Fechar">✕</button><img alt="">';
    document.body.appendChild(lb);
    const fechar = () => { lb.classList.remove('open'); document.body.style.overflow = ''; };
    lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('cr-lb-fechar')) fechar(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); });
  }
  const im = lb.querySelector('img');
  im.src = url; im.alt = nome || '';
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

// Imagem quebrada (comum em aliados adicionados antes de a imagem existir
// no bestiário, ou com URL antiga/trocada) — tenta recuperar buscando o
// caminho ATUAL no bestiário pelo nome, e corrige o dado salvo se achar.
// Se não achar nada melhor, mantém o aviso (⚠) já mostrado via classe .erro.
async function tentarRecuperarImagemCriatura(imgEl, idx) {
  const wrap = imgEl.closest('.criatura-img');
  if (wrap) wrap.classList.add('erro');
  try {
    const lista = await carregarBestiario();
    if (!lista) return;
    const cr = _companionsAtuais()[idx];
    if (!cr) return;
    const alvo = semAcento(cr.nome || '');
    if (!alvo) return;
    const achado = lista.find(m => semAcento(m.nome || '') === alvo);
    if (achado && achado.imagem && achado.imagem !== cr.imagem) {
      cr.imagem = achado.imagem;
      salvarCompanionsSeguro();
      imgEl.onerror = () => { if (wrap) wrap.classList.add('erro'); };
      imgEl.src = achado.imagem;
      if (wrap) wrap.classList.remove('erro');
    }
  } catch (e) { /* mantém o aviso já mostrado */ }
}

// Destaca o último card de criatura (efeito "novo") após adicionar
function destacarUltimaCriatura() {
  if (!window.FX) return;
  const cards = document.querySelectorAll('.criatura-card');
  const ult = cards[cards.length - 1];
  if (ult) { FX.novo(ult); ult.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}

async function salvarCompanions() {
  if (!charAtivo?.id) return;
  _ultimoSaveLocal = Date.now();
  const { error } = await window.sb.from('characters')
    .update({ companions: charAtivo.companions || [] })
    .eq('id', charAtivo.id);
  if (error) console.warn('[aliados] erro ao salvar:', error);
}
function salvarCompanionsSeguro() { salvarCompanions().catch(()=>{}); }

/* ===== BUSCADOR DO BESTIÁRIO (Manual dos Monstros) ===== */
let _bestiario = null;          // cache do monstros_data.json
let _bestiarioErro = false;

/* Favoritos do bestiário POR PERSONAGEM — em characters.bestiario_favoritos (banco).
   Guardados pelo NOME canônico (maiúsculas, como no monstros_data.json). */
function favLista() {
  if (!charAtivo) return [];
  if (!Array.isArray(charAtivo.bestiario_favoritos)) charAtivo.bestiario_favoritos = [];
  return charAtivo.bestiario_favoritos;
}
function favTem(nome) { return favLista().includes(nome); }
function favToggle(nome) {
  const lista = favLista();
  const i = lista.indexOf(nome);
  if (i >= 0) lista.splice(i, 1); else lista.push(nome);
  salvarFavoritosBestiario();
  return lista.includes(nome);
}
async function salvarFavoritosBestiario() {
  if (!charAtivo?.id) return;
  _ultimoSaveLocal = Date.now();
  const { error } = await window.sb.from('characters')
    .update({ bestiario_favoritos: charAtivo.bestiario_favoritos || [] })
    .eq('id', charAtivo.id);
  if (error) console.warn('[favoritos] erro ao salvar:', error);
}

function semAcento(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function tituloBonito(s) {
  // "GOLEM DE CARNE" → "Golem de Carne"
  const minusc = new Set(['de','da','do','dos','das','e','a','o','com','na','no','à']);
  return (s || '').toLowerCase().split(/\s+/).map((w, i) =>
    (i > 0 && minusc.has(w)) ? w : (w.charAt(0).toUpperCase() + w.slice(1))
  ).join(' ');
}

async function carregarBestiario() {
  if (_bestiario) return _bestiario;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch('../data/monstros_data.json', { signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    _bestiario = await r.json();
    return _bestiario;
  } catch (e) {
    _bestiarioErro = true;
    console.warn('[bestiário] falha:', e);
    return null;
  } finally { clearTimeout(t); }
}

function abrirBuscadorMonstros() {
  let ov = document.getElementById('bm-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'bm-overlay';
    ov.className = 'bm-overlay';
    ov.innerHTML = `
      <div class="bm-modal" role="dialog" aria-modal="true" aria-labelledby="bm-titulo">
        <div class="bm-header">
          <div class="bm-titulo" id="bm-titulo">${ico('buscar')} Bestiário — Manual dos Monstros</div>
          <button type="button" class="bm-close" id="bm-close">Fechar ✕</button>
        </div>
        <div class="bm-search">
          <input type="search" id="bm-input" placeholder="Buscar criatura pelo nome… (ex.: dragão, golem, lobo)" autocomplete="off">
        </div>
        <div class="bm-result" id="bm-result"></div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) fecharBuscadorMonstros(); });
    document.getElementById('bm-close').addEventListener('click', fecharBuscadorMonstros);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.getElementById('bm-overlay')?.classList.contains('open')) fecharBuscadorMonstros();
    });
    const inp = document.getElementById('bm-input');
    inp.addEventListener('input', () => renderResultadosMonstros(inp.value));
    // delegação: adicionar + favoritar
    document.getElementById('bm-result').addEventListener('click', e => {
      const add = e.target.closest('[data-add-monstro]');
      if (add) { adicionarMonstroBusca(+add.dataset.addMonstro, add); return; }
      const fav = e.target.closest('[data-fav-monstro]');
      if (fav) {
        const m = _bestiario[+fav.dataset.favMonstro];
        if (!m) return;
        const agora = favToggle(m.nome);
        fav.textContent = agora ? '★' : '☆';
        fav.classList.toggle('on', agora);
        fav.setAttribute('aria-pressed', String(agora));
        fav.title = agora ? 'Remover dos favoritos' : 'Favoritar';
        if (window.FX) FX.favorito(fav, agora);
      }
    });
  }
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
  const result = document.getElementById('bm-result');
  result.innerHTML = Array.from({length:6}, () => `
    <div class="bm-item bm-skel">
      <div class="bm-thumb shimmer"></div>
      <div class="bm-item-info" style="flex:1">
        <div class="shimmer" style="height:14px;width:55%;border-radius:4px;margin-bottom:7px"></div>
        <div class="shimmer" style="height:11px;width:38%;border-radius:4px;margin-bottom:7px"></div>
        <div class="shimmer" style="height:11px;width:70%;border-radius:4px"></div>
      </div>
    </div>`).join('');
  carregarBestiario().then(b => {
    if (!b) { result.innerHTML = `<div class="bm-vazio">${ico('aviso')} Não foi possível carregar o bestiário.</div>`; return; }
    renderResultadosMonstros(document.getElementById('bm-input').value);
    setTimeout(() => document.getElementById('bm-input')?.focus(), 60);
  });
}

let _bmAdicionou = false;
function fecharBuscadorMonstros() {
  const ov = document.getElementById('bm-overlay');
  if (ov) ov.classList.remove('open');
  document.body.style.overflow = '';
  _bmAdicionou = false;
  // Re-renderiza a aba (atualiza lista de aliados E o dropdown de favoritos)
  if (tabAtiva === 'aliados') render();
}

function itemMonstroHTML(m) {
  const idx = _bestiario.indexOf(m);
  const fav = favTem(m.nome);
  const thumb = m.imagem
    ? `<div class="bm-thumb"><img src="${escape(m.imagem)}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"></div>`
    : `<div class="bm-thumb bm-thumb-vazio">${ico('dragao')}</div>`;
  return `
    <div class="bm-item">
      <button type="button" class="bm-fav ${fav ? 'on' : ''}" data-fav-monstro="${idx}" aria-pressed="${fav}" title="${fav ? 'Remover dos favoritos' : 'Favoritar'}">${fav ? '★' : '☆'}</button>
      ${thumb}
      <div class="bm-item-info">
        <div class="bm-item-nome">${escape(tituloBonito(m.nome))}</div>
        <div class="bm-item-meta">${escape(m.tipo || '')}</div>
        <div class="bm-item-stats">${ico('escudo')} CA ${m.ca} · ${ico('vida')} ${m.hp_max} PV · ${ico('ataque')} ${escape(m.nd || 'ND —')}</div>
      </div>
      <button type="button" class="bm-add no-lock" data-add-monstro="${idx}" title="Adicionar à ficha">+ Adicionar</button>
    </div>`;
}

function renderResultadosMonstros(termo) {
  const result = document.getElementById('bm-result');
  if (!_bestiario) return;
  const q = semAcento(termo).trim();

  if (!q) {
    // Sem busca: mostra Favoritos no topo + dica
    const favs = _bestiario.filter(m => favTem(m.nome));
    let html = '';
    if (favs.length) {
      html += `<div class="bm-secao">★ Favoritos</div>` + favs.map(itemMonstroHTML).join('');
      html += `<div class="bm-secao">Todas as criaturas</div>`;
    }
    html += `<div class="bm-dica">${_bestiario.length} criaturas. Digite para filtrar pelo nome.</div>`;
    html += _bestiario.slice(0, 60).map(itemMonstroHTML).join('');
    if (_bestiario.length > 60) html += `<div class="bm-dica">Mostrando 60 de ${_bestiario.length}. Use a busca.</div>`;
    result.innerHTML = html;
    return;
  }

  const lista = _bestiario.filter(m => semAcento(m.nome).includes(q));
  const total = lista.length;
  if (!total) {
    result.innerHTML = `<div class="bm-vazio">Nenhuma criatura encontrada para “${escape(termo)}”.</div>`;
    return;
  }
  result.innerHTML =
    lista.slice(0, 80).map(itemMonstroHTML).join('') +
    (total > 80 ? `<div class="bm-dica">Mostrando 80 de ${total}. Refine a busca.</div>` : '');
}

// Converte um monstro do bestiário em companion e adiciona à ficha.
function adicionarMonstroObj(m) {
  if (!m) return null;
  const sentidos = [m.sentidos, m.pericias && ('Perícias: ' + m.pericias)].filter(Boolean).join(' · ');
  const resist = [m.resistencias, m.vulnerabilidades && ('Vulnerável: ' + m.vulnerabilidades)].filter(Boolean).join(' · ');
  const nova = {
    id: 'cr_' + Date.now().toString(36) + Math.floor(Math.random()*1000),
    nome: tituloBonito(m.nome),
    tipo: m.tipo || '',
    ca: m.ca || 10, hp_max: m.hp_max || 1, hp_atual: m.hp_max || 1,
    pv_dados: m.pv_dados || '',
    imagem: m.imagem || '',
    deslocamento: m.deslocamento || '',
    atributos: { ...m.atributos },
    resistencias: resist,
    imunidades: m.imunidades || '',
    sentidos,
    idiomas: m.idiomas || '',
    nd: m.nd || '',
    tracos: (m.tracos || []).map(t => ({ ...t })),
    acoes: (m.acoes || []).map(t => ({ ...t })),
    acoes_bonus: (m.acoes_bonus || []).map(t => ({ ...t })),
    reacoes: (m.reacoes || []).map(t => ({ ...t })),
    acoes_lendarias: (m.acoes_lendarias || []).map(t => ({ ...t })),
    acoes_covil: (m.acoes_covil || []).map(t => ({ ...t })),
    notas: 'Fonte: Manual dos Monstros.',
  };
  _companionsAtuais().push(nova);
  salvarCompanionsSeguro();
  toast(`✓ ${nova.nome} adicionado aos Aliados`);
  return nova;
}

function adicionarMonstroBusca(idx, btn) {
  const m = _bestiario && _bestiario[idx];
  if (!m) return;
  adicionarMonstroObj(m);
  _bmAdicionou = true;
  // feedback sem fechar (permite adicionar vários)
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ Adicionado';
    btn.classList.add('add-ok');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('add-ok'); }, 1400);
  }
}

function conectarListenersAliados() {
  const wrap = document.getElementById('aliados-wrap');

  // Teclado no resumo recolhido/expandido (div[role="button"], não <button>
  // de verdade — precisa de Enter/Espaço manual, igual .magia-row já faz).
  if (wrap) wrap.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    // e.target === o próprio container (não .closest — os botões −/+ de PV
    // já são <button> nativos lá dentro e tratam Enter/Espaço sozinhos;
    // usar closest aqui disparava o toggle DE NOVO em cima do clique deles).
    if (!e.target.hasAttribute('data-cr-toggle')) return;
    e.preventDefault();
    e.target.click();
  });

  // Adicionar criatura (template rápido)
  const btnAdd = document.getElementById('btn-add-aliado');
  if (btnAdd) btnAdd.addEventListener('click', async () => {
    const sel = document.getElementById('aliado-template');
    const valor = sel ? sel.value : 'novo';
    if (valor.startsWith('fav:')) {
      // Favorito → busca a criatura no bestiário pelo nome canônico
      const nome = valor.slice(4);
      btnAdd.disabled = true;
      const bestiario = await carregarBestiario();
      btnAdd.disabled = false;
      const m = bestiario && bestiario.find(x => x.nome === nome);
      if (!m) { toast('Criatura não encontrada no bestiário', 'aviso'); return; }
      adicionarMonstroObj(m);
      render();
      destacarUltimaCriatura();
      return;
    }
    // Em branco
    const nova = JSON.parse(JSON.stringify(TEMPLATES_CRIATURA.novo));
    nova.id = 'cr_' + Date.now().toString(36);
    _companionsAtuais().push(nova);
    salvarCompanionsSeguro();
    render();
    destacarUltimaCriatura();
  });

  // Buscar no bestiário completo
  const btnBuscar = document.getElementById('btn-buscar-monstro');
  if (btnBuscar) btnBuscar.addEventListener('click', abrirBuscadorMonstros);

  if (!wrap) return;

  // Edição de campos de texto/número (delegação)
  wrap.addEventListener('input', e => {
    const el = e.target;
    const i = el.dataset.cr;
    if (i === undefined) return;
    const cr = _companionsAtuais()[+i];
    if (!cr) return;

    if (el.dataset.crCampo) {
      const campo = el.dataset.crCampo;
      if (['ca','hp_atual','hp_max'].includes(campo)) {
        cr[campo] = parseInt(el.value, 10) || 0;
        if (campo === 'hp_atual' || campo === 'hp_max') atualizarBarraHpCriatura(+i);
      } else {
        cr[campo] = el.value;
      }
    } else if (el.dataset.crAtr) {
      if (!cr.atributos) cr.atributos = {};
      cr.atributos[el.dataset.crAtr] = parseInt(el.value, 10) || 10;
      const modEl = document.querySelector(`[data-cr-mod="${i}-${el.dataset.crAtr}"]`);
      if (modEl) modEl.textContent = fmtMod(modCriatura(cr.atributos[el.dataset.crAtr]));
    }
    agendarSalvarCompanions();
  });

  // Recolher/expandir (Fase 8, §15) + dano/cura rápida + deletar (click delegado)
  // data-cr-dmg vem ANTES de data-cr-toggle nesta checagem: os botões −/+ de
  // PV do resumo ficam DENTRO do container clicável de toggle (data-cr-toggle
  // é uma <div role="button">, não <button>, senão não poderia conter outros
  // botões — HTML não permite <button> dentro de <button>), então um clique
  // neles também bate no .closest('[data-cr-toggle]'). Checar dmg primeiro
  // e dar `return` evita abrir/fechar o card sem querer ao só ajustar PV.
  wrap.addEventListener('click', e => {
    const dmg = e.target.closest('[data-cr-dmg]');
    if (dmg) {
      const i = +dmg.dataset.crDmg;
      const v = +dmg.dataset.v;
      const cr = _companionsAtuais()[i];
      if (!cr) return;
      const max = cr.hp_max ?? 1;
      cr.hp_atual = Math.max(0, Math.min(max, (cr.hp_atual ?? max) + v));
      const inp = document.querySelector(`input[data-cr-campo="hp_atual"][data-cr="${i}"]`);
      if (inp) inp.value = cr.hp_atual;
      atualizarBarraHpCriatura(i);
      agendarSalvarCompanions();
      return;
    }
    const toggle = e.target.closest('[data-cr-toggle]');
    if (toggle) {
      const i = +toggle.dataset.crToggle;
      const corpo = document.getElementById('criatura-corpo-' + i);
      if (!corpo) return;
      const abrir = corpo.hidden;
      corpo.hidden = !abrir;
      toggle.setAttribute('aria-expanded', String(abrir));
      const chevron = toggle.querySelector('.criatura-resumo-chevron');
      if (chevron) chevron.textContent = abrir ? '▾' : '▸';
      if (abrir) _criaturasExpandidas.add(i); else _criaturasExpandidas.delete(i);
      return;
    }
    const rolar = e.target.closest('[data-cr-rolar]');
    if (rolar) {
      const i = +rolar.dataset.crRolar;
      const cr = _companionsAtuais()[i];
      if (!cr || !cr.pv_dados) return;
      const novoHp = rolarDadosVida(cr.pv_dados);
      if (novoHp == null) { toast('Fórmula de dados inválida', 'aviso'); return; }
      cr.hp_max = novoHp;
      cr.hp_atual = novoHp;
      const inpMax = document.querySelector(`input[data-cr-campo="hp_max"][data-cr="${i}"]`);
      const inpAtu = document.querySelector(`input[data-cr-campo="hp_atual"][data-cr="${i}"]`);
      const aplicar = () => {
        if (inpAtu) inpAtu.value = novoHp;
        atualizarBarraHpCriatura(i);
        agendarSalvarCompanions();
        toast(`${cr.nome}: ${cr.pv_dados} = ${novoHp} PV`, 'dado');
      };
      // Animação de rolagem no campo de PV máx, depois assenta
      if (window.FX && inpMax && inpMax.tagName === 'INPUT') {
        // input não anima textContent; embaralha o value
        let n = 0; const passos = 12;
        const timer = setInterval(() => {
          n++; inpMax.value = 1 + Math.floor(Math.random() * Math.max(novoHp, 6));
          if (n >= passos) { clearInterval(timer); inpMax.value = novoHp; FX.pulso(inpMax); aplicar(); }
        }, 45);
      } else {
        if (inpMax) inpMax.value = novoHp;
        aplicar();
      }
      return;
    }
    const imgEdit = e.target.closest('[data-cr-img-edit]');
    if (imgEdit) {
      const i = +imgEdit.dataset.crImgEdit;
      const cr = _companionsAtuais()[i];
      if (!cr) return;
      const url = prompt('Cole a URL da imagem da criatura (deixe vazio para remover):', cr.imagem || '');
      if (url === null) return;  // cancelou
      cr.imagem = url.trim();
      salvarCompanionsSeguro();
      render();
      return;
    }
    const img = e.target.closest('[data-cr-img]');
    if (img) {
      const i = +img.dataset.crImg;
      const cr = _companionsAtuais()[i];
      if (!cr) return;
      if (cr.imagem) abrirLightboxCriatura(cr.imagem, cr.nome);   // tem imagem → amplia
      else {                                                       // sem imagem → adiciona
        const url = prompt('Cole a URL da imagem da criatura:', '');
        if (url === null) return;
        cr.imagem = url.trim();
        salvarCompanionsSeguro();
        render();
      }
      return;
    }
    const del = e.target.closest('[data-cr-del]');
    if (del) {
      const i = +del.dataset.crDel;
      const cr = _companionsAtuais()[i];
      window.Confirmar
        ? window.Confirmar.perguntar({ titulo: 'Remover criatura?', mensagem: `"${cr?.nome||'Criatura'}" será removida.`, confirmar: 'Remover', danger: true }).then(ok => {
            if (ok) { _companionsAtuais().splice(i, 1); salvarCompanionsSeguro(); render(); }
          })
        : (confirm('Remover criatura?') && (_companionsAtuais().splice(i,1), salvarCompanionsSeguro(), render()));
    }
  });
}

// Rola uma fórmula de dados de vida (ex.: "11d8 + 44", "2d8 - 1") e retorna o total (mín. 1)
function rolarDadosVida(formula) {
  const m = (formula || '').replace(/\s/g, '').replace('–', '-').match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  const qtd = +m[1], faces = +m[2], bonus = m[3] ? +m[3] : 0;
  if (qtd < 1 || qtd > 100 || faces < 2) return null;
  let total = 0;
  for (let r = 0; r < qtd; r++) total += 1 + Math.floor(Math.random() * faces);
  return Math.max(1, total + bonus);
}

function atualizarBarraHpCriatura(i) {
  const cr = _companionsAtuais()[i];
  if (!cr) return;
  const max = cr.hp_max ?? 1;
  const atual = cr.hp_atual ?? max;
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round(atual / max * 100))) : 0;
  const classe = 'cc-hpfill ' + (pct <= 15 ? 'critico' : pct <= 35 ? 'baixo' : pct <= 65 ? 'medio' : '');
  // Duas barras agora (resumo recolhido + corpo expandido) — atualiza as duas.
  document.querySelectorAll(`.criatura-card[data-cr="${i}"] .cc-hpfill`).forEach(fill => {
    fill.style.width = pct + '%';
    fill.className = classe;
  });
  const txt = document.querySelector(`[data-cr-hp-txt="${i}"]`);
  if (txt) txt.textContent = `${atual}/${max}`;
}

let _salvarCompTimer = null;
function agendarSalvarCompanions() {
  if (_salvarCompTimer) clearTimeout(_salvarCompTimer);
  _salvarCompTimer = setTimeout(salvarCompanionsSeguro, 700);
}


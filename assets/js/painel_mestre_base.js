// assets/js/painel_mestre_base.js
// Funções/constantes que existiam coladas, idênticas (só formatação
// divergia), em painel_mestre_dnd5e.html E painel_barovia_dnd5e.html —
// um só lugar agora (mst-12). Continuam expostas como globais soltos (não
// window.PainelMestreBase.X) de propósito: são chamadas assim (escapeHtml(x),
// toast(x), CONDICOES etc.) em dezenas de lugares nos dois arquivos, e
// namespacing exigiria reescrever cada call site à toa.
//
// NÃO inclui criarPersonagem()/CAMPANHA/PERSONAGENS_INICIAIS — esses
// genuinamente divergem entre os dois painéis (barovia tem campos extras
// como atributos/deslocamento que painel_mestre ainda não usa na criação
// local), então continuam próprios de cada arquivo.

const CONDICOES = [
  'Agarrado', 'Amedrontado', 'Atordoado', 'Caído', 'Cego', 'Enfeitiçado',
  'Envenenado', 'Impedido', 'Incapacitado', 'Inconsciente', 'Invisível',
  'Paralisado', 'Petrificado', 'Surdo'
];

const NIVEIS_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// ─── Anti-eco: marca saves locais pra ignorar o próprio realtime echo ───
const _ecoLocal = new Map();
function marcarEcoLocal(id) {
  if (!id) return;
  _ecoLocal.set(id, Date.now());
  setTimeout(() => _ecoLocal.delete(id), 3000);
}
function ehEcoLocal(id) {
  const t = _ecoLocal.get(id);
  return t && (Date.now() - t < 2500);
}

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

// Fonte de Magia (conversor pontos ⇄ espaços) + Metamágica do Feiticeiro
// (assets/js/feiticeiro_ui.js). salvar/salvarRecursosMesclado/rerenderCard
// são de cada painel (painel_*_inline.js), chamados só no clique.
function montarBlocoFeiticeiro(p) {
  const chave = (p.classe || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (chave !== 'feiticeiro' || !window.FeiticeiroUI) return null;
  if (!p.recursosUsados || typeof p.recursosUsados !== 'object') p.recursosUsados = {};
  if (!p.slots) p.slots = {};
  return window.FeiticeiroUI.bloco({
    nivel: p.nivel,
    getRec: () => p.recursosUsados,
    getSlots: () => p.slots,
    getMetamagias: () => p.metamagias || [],
    salvarRecursos: patch => salvarRecursosMesclado(p, patch),
    salvarSlots: () => salvar(p),
    salvarMetamagias: async arr => {
      p.metamagias = arr;
      marcarEcoLocal(p.id);
      const { error } = await window.sb.from('characters').update({ metamagias: arr }).eq('id', p.id);
      if (error) toast('Erro ao salvar Metamágica: ' + error.message);
    },
    atualizar: () => rerenderCard(p),
    avisar: msg => toast(msg),
  });
}

// Seção "Habilidades" do card: todas as de classe + subclasse até o nível,
// agrupadas por nível, com a descrição abrindo ali mesmo (<details>) — o
// modal do DetalhesCatalogo busca por nome e várias subclasses repetem nomes
// ("Magias de Juramento"), então mostraria a descrição da subclasse errada.
// Soma as características personalizadas/talentos que o jogador criou na ficha.
const CSS_HAB_MESTRE = `
.hab-mestre-nivel { font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--gold, #c49a3a); margin: 10px 0 4px; }
.hab-mestre-item { border-bottom: 1px solid rgba(139,105,20,.15); }
.hab-mestre-item > summary { cursor: pointer; padding: 7px 2px; min-height: 36px; display: flex; align-items: center; gap: 8px; list-style: none; font-size: 14px; }
.hab-mestre-item > summary::-webkit-details-marker { display: none; }
.hab-mestre-item > summary::after { content: '▾'; margin-left: auto; color: var(--gold, #c49a3a); font-size: 12px; }
.hab-mestre-item[open] > summary::after { content: '▴'; }
.hab-mestre-sub { font-family: 'Cinzel', serif; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #b88a2c; border: 1px solid rgba(139,105,20,.5); border-radius: 999px; padding: 1px 6px; white-space: nowrap; }
.hab-mestre-desc { font-size: 13px; line-height: 1.45; color: var(--parchment-dim, #b8a988); padding: 0 2px 10px; white-space: pre-line; }
.hab-mestre-vazio { font-size: 12px; font-style: italic; color: var(--parchment-dim, #8c7d5e); padding: 6px 0; }
`;
let _cssHabMestre = false;

function montarSecaoHabilidades(p) {
  if (!_cssHabMestre) {
    _cssHabMestre = true;
    const s = document.createElement('style');
    s.textContent = CSS_HAB_MESTRE;
    document.head.appendChild(s);
  }
  const sec = document.createElement('div');
  sec.className = 'section';
  sec.innerHTML = `<div class="section-title">Habilidades</div>`;
  const corpo = document.createElement('div');
  corpo.innerHTML = `<div class="hab-mestre-vazio">Carregando…</div>`;
  sec.appendChild(corpo);

  const item = (nome, desc, tag) => {
    const d = document.createElement('details');
    d.className = 'hab-mestre-item';
    const s = document.createElement('summary');
    s.appendChild(document.createTextNode(nome));
    if (tag) {
      const t = document.createElement('span');
      t.className = 'hab-mestre-sub';
      t.textContent = tag;
      s.appendChild(t);
    }
    d.appendChild(s);
    const txt = document.createElement('div');
    txt.className = 'hab-mestre-desc';
    txt.textContent = desc || 'Sem descrição.';
    d.appendChild(txt);
    return d;
  };
  const titulo = texto => {
    const h = document.createElement('div');
    h.className = 'hab-mestre-nivel';
    h.textContent = texto;
    return h;
  };

  if (!window.HabilidadesRegras || !p.classe) {
    corpo.innerHTML = `<div class="hab-mestre-vazio">${p.classe ? 'Catálogo indisponível.' : 'Sem classe definida.'}</div>`;
    return sec;
  }
  window.HabilidadesRegras.doPersonagem(p.classe, p.nivel, p._subclasse).then(habs => {
    corpo.textContent = '';
    if (!p._subclasse && habs.some(h => /Arqu[ée]tipo|Juramento Sagrado|Dom[ií]nio Divino|Origem Feiticeira|Patrono|C[ií]rculo Dru|Tradi[çc][ãa]o|Col[ée]gio|Caminho Primitivo/.test(h.nome))) {
      const aviso = document.createElement('div');
      aviso.className = 'hab-mestre-vazio';
      aviso.textContent = 'Subclasse ainda não escolhida — as habilidades dela não aparecem.';
      corpo.appendChild(aviso);
    }
    const porNivel = new Map();
    habs.forEach(h => { if (!porNivel.has(h.nivel)) porNivel.set(h.nivel, []); porNivel.get(h.nivel).push(h); });
    // Conjuradores ganham magias de nível mais alto em níveis sem habilidade
    // nova no livro (Feiticeiro 5/7/9…) — sem isto a lista parecia parar antes
    // do nível do personagem.
    if (window.SlotsPHB) {
      const maxCirculo = n => {
        const s = window.SlotsPHB.porClasse(p.classe, n, p._subclasse) || {};
        let m = 0;
        for (let i = 1; i <= 9; i++) if ((s[i] || 0) > 0) m = i;
        return m;
      };
      for (let n = 1, antes = 0; n <= Math.min(20, +p.nivel || 1); n++) {
        const m = maxCirculo(n);
        if (m > antes) {
          if (!porNivel.has(n)) porNivel.set(n, []);
          porNivel.get(n).push({ nivel: n, nome: `Magias de ${m}° nível`, desc: `A partir deste nível você tem espaços de magia de ${m}° nível e pode conjurar magias desse nível.` });
        }
        antes = Math.max(antes, m);
      }
    }
    [...porNivel.keys()].sort((a, b) => a - b).forEach(nv => {
      corpo.appendChild(titulo(`Nível ${nv}`));
      porNivel.get(nv).forEach(h => corpo.appendChild(item(h.nome, h.desc, h.subclasse)));
    });
    const extras = (p._featuresPersonalizadas || []).filter(f => (f.nome || '').trim());
    if (extras.length) {
      corpo.appendChild(titulo('Talentos e características do jogador'));
      extras.forEach(f => corpo.appendChild(item(f.nome, f.desc, f.talento ? 'Talento' : null)));
    }
    // O que o jogador escolheu ao subir de nível (assets/js/ficha/subida_nivel.js).
    const hist = p._nivelEscolhas?.historico || {};
    const niveisHist = Object.keys(hist).map(Number).sort((a, b) => a - b)
      .filter(n => window.ProgressaoPHB?.resumoRegistro(hist[n]));
    if (niveisHist.length) {
      corpo.appendChild(titulo('Escolhas ao subir de nível'));
      niveisHist.forEach(n => {
        const linha = document.createElement('div');
        linha.className = 'hab-mestre-desc';
        linha.style.padding = '4px 2px';
        const forte = document.createElement('strong');
        forte.textContent = `Nível ${n}: `;
        linha.appendChild(forte);
        linha.appendChild(document.createTextNode(window.ProgressaoPHB.resumoRegistro(hist[n])));
        corpo.appendChild(linha);
      });
    }
    const pend = p._nivelEscolhas?.ultimoNivelProcessado;
    if (Number.isInteger(+pend) && +p.nivel > +pend) {
      const aviso = document.createElement('div');
      aviso.className = 'hab-mestre-vazio';
      const av = p._nivelEscolhas.aviso;
      aviso.textContent = av && +av.nivel === +pend + 1
        ? `⚠ O jogador não conseguiu concluir o nível ${av.nivel}: ${av.motivo || 'sem motivo'}. A caixa volta quando ele recarregar a ficha.`
        : `O jogador ainda não fez as escolhas do nível ${+pend + 1} (a caixa abre na ficha dele).`;
      corpo.insertBefore(aviso, corpo.firstChild);
    }
    if (!corpo.children.length) corpo.innerHTML = `<div class="hab-mestre-vazio">Nenhuma habilidade encontrada.</div>`;
  });
  return sec;
}

// Falha de autosave (DBSync.salvarCampo) hoje só ia pro console — o Mestre
// achava que tinha salvo e não tinha. Avisa na tela.
window.addEventListener('dbsync:erro', () => toast('⚠ Falha ao salvar — verifique sua conexão'));

// Aplica "=N" (define), "+N"/"-N" (soma/subtrai) ou "N" (define) num valor
// atual — usado pelos inputs numéricos dos cards (PV, CA etc.) pra permitir
// tanto digitar o valor final quanto uma variação rápida.
function aplicarMatematica(valorAtual, entrada) {
  const txt = String(entrada).trim();
  if (txt === '') return valorAtual;
  if (txt.startsWith('=')) {
    const n = parseInt(txt.slice(1));
    return isNaN(n) ? valorAtual : n;
  }
  if (txt.startsWith('+')) {
    const n = parseInt(txt.slice(1));
    return isNaN(n) ? valorAtual : valorAtual + n;
  }
  if (txt.startsWith('-') && txt.length > 1) {
    const n = parseInt(txt.slice(1));
    return isNaN(n) ? valorAtual : valorAtual - n;
  }
  const n = parseInt(txt);
  return isNaN(n) ? valorAtual : n;
}

// Escape HTML básico
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

// Input numérico reutilizável (PV/CA/Nível/etc.): Enter ou perder foco
// aplica aplicarMatematica() no valor digitado.
function inputNumerico(valor, callback, classes = '', min = null) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'stat-input ' + classes;
  input.value = valor;
  input.dataset.valor = valor;

  const aplicar = () => {
    const atual = parseInt(input.dataset.valor) || 0;
    let novo = aplicarMatematica(atual, input.value);
    if (min !== null) novo = Math.max(min, novo);
    input.value = novo;
    input.dataset.valor = novo;
    callback(novo);
  };

  input.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); aplicar(); input.blur(); }
  };
  input.onblur = aplicar;
  input.onfocus = () => input.select();
  return input;
}

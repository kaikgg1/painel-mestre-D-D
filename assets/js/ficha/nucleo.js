// assets/js/ficha/nucleo.js
// Base da ficha: constantes de regras (raças, classes, subclasses, atributos,
// perícias, dado de vida), helpers (mod, bonusProf, escape, parseNum), estado
// global (usuario, chars, charAtivo, tabAtiva), caches, init(), Realtime com o
// Mestre, toast e CRUD de personagem.
//
// Scripts da ficha são CLÁSSICOS e compartilham o escopo global — a ordem em
// paineis/ficha.html é o contrato. Este é o primeiro.

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

// Atalho pros ícones vetoriais (assets/js/icones.js). Devolve '' se o módulo
// não carregou, então a ficha nunca quebra por causa de um ícone.
const ico = (chave, opts) => (window.Icones ? window.Icones.html(chave, opts) : '');

const RACAS = ['','Anão','Elfo','Halfling','Humano','Draconato','Gnomo','Meio-Elfo','Meio-Orc','Tiefling'];
const CLASSES = ['','Bárbaro','Bardo','Bruxo','Clérigo','Druida','Feiticeiro','Guerreiro','Ladino','Mago','Monge','Paladino','Patrulheiro'];
const ALINHAMENTOS = ['','Leal e Bom','Neutro e Bom','Caótico e Bom','Leal e Neutro','Neutro','Caótico e Neutro','Leal e Mau','Neutro e Mau','Caótico e Mau'];
const ATRIBUTOS = [['for','Força'],['dex','Destreza'],['con','Constituição'],['int','Inteligência'],['sab','Sabedoria'],['car','Carisma']];
const CAMPANHAS = [
  ['', '— sem campanha —'],
  ['barovia', 'Maldição de Strahd (Barovia)'],
  ['mestre',  'Crônica dos Aventureiros'],
];

// Dado de vida fixo por classe (PHB 5e)
const DADO_VIDA_POR_CLASSE = {
  'barbaro': 12, 'bardo': 8, 'bruxo': 8, 'clerigo': 8, 'druida': 8,
  'feiticeiro': 6, 'guerreiro': 10, 'ladino': 8, 'mago': 6, 'monge': 8,
  'paladino': 10, 'patrulheiro': 10,
};
function dadoVidaDaClasse(classe) {
  return DADO_VIDA_POR_CLASSE[chaveDeClasse(classe)] || null;
}

// Subclasses oficiais do PHB 5e por classe (chave normalizada → lista)
const SUBCLASSES_POR_CLASSE = {
  'barbaro':    ['Caminho do Furioso', 'Caminho do Guerreiro Totêmico'],
  'bardo':      ['Colégio do Conhecimento', 'Colégio do Valor'],
  'bruxo':      ['Patrono Arquifada', 'Patrono Senhor das Trevas', 'Patrono Grande Antigo'],
  'clerigo':    ['Domínio do Conhecimento', 'Domínio da Vida', 'Domínio da Luz', 'Domínio da Natureza', 'Domínio da Tempestade', 'Domínio Trapaceiro', 'Domínio da Guerra', 'Domínio da Morte'],
  'druida':     ['Círculo da Terra', 'Círculo da Lua'],
  'feiticeiro': ['Linhagem Dracônica', 'Magia Selvagem'],
  'guerreiro':  ['Campeão', 'Mestre de Batalha', 'Cavaleiro Místico'],
  'ladino':     ['Ladrão', 'Assassino', 'Trapaceiro Arcano'],
  'mago':       ['Escola de Abjuração', 'Escola de Adivinhação', 'Escola de Conjuração', 'Escola de Encantamento', 'Escola de Evocação', 'Escola de Ilusão', 'Escola de Necromancia', 'Escola de Transmutação'],
  'monge':      ['Caminho da Mão Aberta', 'Caminho da Sombra', 'Caminho dos Quatro Elementos'],
  'paladino':   ['Juramento de Devoção', 'Juramento dos Anciões', 'Juramento de Vingança', 'Quebrador de Juramento'],
  'patrulheiro':['Caçador', 'Mestre das Feras'],
};

// Perícias do PHB 5e (PT-BR) — mapeadas para o atributo base
const PERICIAS = [
  ['acrobacia',         'Acrobacia',         'dex'],
  ['adestrar_animais',  'Adestrar Animais',  'sab'],
  ['arcanismo',         'Arcanismo',         'int'],
  ['atletismo',         'Atletismo',         'for'],
  ['atuacao',           'Atuação',           'car'],
  ['enganacao',         'Enganação',         'car'],
  ['furtividade',       'Furtividade',       'dex'],
  ['historia',          'História',          'int'],
  ['intimidacao',       'Intimidação',       'car'],
  ['intuicao',          'Intuição',          'sab'],
  ['investigacao',      'Investigação',      'int'],
  ['medicina',          'Medicina',          'sab'],
  ['natureza',          'Natureza',          'int'],
  ['percepcao',         'Percepção',         'sab'],
  ['persuasao',         'Persuasão',         'car'],
  ['prestidigitacao',   'Prestidigitação',   'dex'],
  ['religiao',          'Religião',          'int'],
  ['sobrevivencia',     'Sobrevivência',     'sab'],
];

// Habilidades fixas por classe x nível (carregadas async)
let HABILIDADES_CLASSES = null;
async function carregarHabilidadesClasses() {
  if (HABILIDADES_CLASSES) return HABILIDADES_CLASSES;
  // Timeout de 8s pra não ficar carregando pra sempre
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch('../data/habilidades_classes.json', { signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    HABILIDADES_CLASSES = await r.json();
    return HABILIDADES_CLASSES;
  } catch (e) {
    console.warn('[habilidades] falha ao carregar:', e);
    return null;  // sinaliza falha pro caller
  } finally {
    clearTimeout(t);
  }
}
function chaveDeClasse(classe) {
  return (classe || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function classeUsaMagia(c) {
  if (!c) return false;
  const tipo = window.SlotsPHB ? window.SlotsPHB.tipoDaClasse(c.classe, c.subclasse) : null;
  return !!tipo;
}

const mod = v => Math.floor(((+v||10) - 10) / 2);
const fmtMod = m => (m >= 0 ? '+' : '') + m;
// Bônus de proficiência por nível (PHB 5e): 1-4=+2, 5-8=+3, 9-12=+4, 13-16=+5, 17-20=+6
const bonusProf = nv => Math.floor(((+nv || 1) - 1) / 4) + 2;

// Salvaguardas aceitam formato legado (bool = proficiência) OU objeto {prof,bonus}
function salvProf(salv, k) { const v = salv?.[k]; return v === true || !!(v && v.prof); }
function salvBonus(salv, k) { const v = salv?.[k]; return (v && typeof v === 'object' && +v.bonus) || 0; }

let usuario = null;
let chars = [];
let charAtivo = null;
let tabAtiva = 'identidade';
let _ultimoSaveLocal = 0;          // pra ignorar echo do próprio save
let canalFicha = null;             // canal realtime
// (mudancaPendente removido — updates externos se aplicam automaticamente)

// Favoritas: SOMENTE do banco (spell_lists do PJ ativo)
async function carregarFavoritasDoBanco() {
  if (!window.sb || !charAtivo?.id) return new Set();
  const { data, error } = await window.sb
    .from('spell_lists')
    .select('spell_names')
    .eq('character_id', charAtivo.id)
    .eq('nome', 'Favoritas')
    .maybeSingle();
  if (error) { console.warn('[ficha] favoritas:', error.message); return new Set(); }
  return new Set(data?.spell_names || []);
}

// Catálogo de magias (carrega só quando necessário)
let magiasCache = null;
async function carregarMagiasCache() {
  if (magiasCache) return magiasCache;
  try {
    const r = await fetch('../data/magias_data.json');
    magiasCache = await r.json();
    return magiasCache;
  } catch { return []; }
}

async function init() {
  usuario = await window.Auth.requerLogin('login.html');
  if (!usuario) return;
  await window.Auth.renderHeader('#auth-slot');
  await carregarPersonagens();
  escutarMudancasExternas();
  configurarToastExterno();
}

// ─── Realtime: detecta quando o Mestre (ou outra aba) edita meu PJ ─
function escutarMudancasExternas() {
  if (!window.sb || !usuario) return;
  if (canalFicha) canalFicha.unsubscribe();
  canalFicha = window.sb.channel('ficha-' + usuario.id)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'characters', filter: `user_id=eq.${usuario.id}` },
      payload => onUpdateExterno(payload.new))
    .subscribe();
}

// Campos que, se mudarem, justificam re-render. Ignora ruído de updated_at etc.
function _assinaturaRelevante(c) {
  if (!c) return '';
  const campos = [
    'nome','raca','classe','subclasse','nivel','origem','alinhamento',
    'hp_max','hp_atual','hp_temp','ca','iniciativa_bonus','deslocamento',
    'dado_vida_tipo','dado_vida_atual','exaustao','inspiracao',
    'atributos','salvaguardas','pericias','slots_magia','condicoes',
    'recursos_usados','features_personalizadas','companions','inventario',
    'truques_conhecidos','magias_conhecidas','cd_resistencia','bonus_atq_magia',
    'tracos_pessoais','ideais','vinculos','defeitos','historia','notas',
    'tracos_raciais','idiomas','ferramentas','imagem_url','caracteristicas_adicionais'
  ];
  try { return JSON.stringify(campos.map(k => c[k] ?? null)); } catch { return ''; }
}

let _aplicarExternoPendente = null;
let _aplicarExternoAvisar = false;
function onUpdateExterno(novo) {
  // Ignora se foi nosso próprio save (echo do realtime — em até 3s, mesmo aparelho)
  if (Date.now() - _ultimoSaveLocal < 3000) return;
  // Atualiza chars silenciosamente sempre (mantém cache fresco)
  const idx = chars.findIndex(c => c.id === novo.id);
  if (idx >= 0) chars[idx] = novo;
  // Só age se for o PJ ativo aberto
  if (!charAtivo || novo.id !== charAtivo.id) return;
  // Nada relevante mudou? Não re-renderiza (evita "piscar" sem motivo)
  if (_assinaturaRelevante(novo) === _assinaturaRelevante(charAtivo)) {
    charAtivo = novo;  // sincroniza cache mesmo assim
    chars = chars.map(c => c.id === charAtivo.id ? charAtivo : c);
    return;
  }
  // Quem alterou? Só avisa "pelo Mestre" se o autor for DIFERENTE do jogador
  // (o próprio jogador em outro aparelho NÃO deve gerar o aviso).
  const meuId = usuario && usuario.id;
  const foiOutraPessoa = !!(novo.updated_by && meuId && novo.updated_by !== meuId);
  // Aplica automaticamente — mas não atropela o jogador se ele está digitando.
  aplicarExterno(novo, foiOutraPessoa);
}

// Aplica o estado externo. Se o jogador está com foco em algum campo editável,
// adia até ele sair do campo (focusout) pra não perder o que está digitando.
// avisar=true → mostra o toast "atualizada pelo Mestre".
function aplicarExterno(novo, avisar) {
  const ativo = document.activeElement;
  const editando = ativo && ativo.closest && ativo.closest('.tab-content') &&
    /input|textarea|select/i.test(ativo.tagName || '');

  if (editando) {
    _aplicarExternoPendente = novo;
    _aplicarExternoAvisar = avisar;
    const form = document.getElementById('ficha-form');
    if (form && !form._aguardandoBlur) {
      form._aguardandoBlur = true;
      form.addEventListener('focusout', function handler() {
        form.removeEventListener('focusout', handler);
        form._aguardandoBlur = false;
        // pequeno atraso pra deixar o auto-save do campo concluir
        setTimeout(() => {
          const pend = _aplicarExternoPendente;
          const avisarPend = _aplicarExternoAvisar;
          _aplicarExternoPendente = null;
          if (pend && (!document.activeElement || !document.activeElement.closest('.tab-content'))) {
            charAtivo = pend;
            chars = chars.map(c => c.id === charAtivo.id ? charAtivo : c);
            render();
            if (avisarPend) toast('Ficha atualizada pelo Mestre', 'editar');
          }
        }, 300);
      });
    }
    return;
  }

  charAtivo = novo;
  chars = chars.map(c => c.id === charAtivo.id ? charAtivo : c);
  render();
  if (avisar) toast('Ficha atualizada pelo Mestre', 'editar');
}

function configurarToastExterno() {
  // Mantido por compatibilidade (chamado no init). O sistema de toast de
  // permissão foi removido — mudanças do Mestre agora se aplicam sozinhas.
}

let _toastTimer = null;
// toast('texto')            -> só texto (como antes)
// toast('texto', 'editar')  -> ícone vetorial + texto
// O texto continua entrando como nó de texto (nunca como HTML), então
// nada aqui abre brecha de injeção.
function toast(msg, chaveIcone) {
  const el = document.getElementById('toast-auto');
  if (!el) return;
  el.textContent = '';
  const marcado = chaveIcone ? ico(chaveIcone) : '';
  if (marcado) {
    const span = document.createElement('span');
    span.innerHTML = marcado;
    el.appendChild(span);
    el.appendChild(document.createTextNode(' '));
  }
  el.appendChild(document.createTextNode(msg));
  el.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

async function carregarPersonagens() {
  const { data, error } = await window.sb
    .from('characters').select('*')
    .eq('user_id', usuario.id)
    .order('created_at', { ascending: true });
  if (error) {
    $('#conteudo').innerHTML = `<div class="estado">Erro ao carregar: ${escape(error.message)}</div>`;
    return;
  }
  chars = data || [];
  if (!chars.length) {
    // O Mestre não deve ganhar uma ficha de jogador automática.
    let ehMestre = false;
    try { ehMestre = window.Auth && await window.Auth.ehMestre(); } catch {}
    if (ehMestre) {
      $('#conteudo').innerHTML = `<div class="estado">Esta é a conta do <strong>Mestre</strong> — sem ficha de jogador. Use o <a href="painel_mestre_dnd5e.html">Painel do Mestre</a>.</div>`;
      return;
    }
    await criarPersonagem('Meu Personagem', true);  // novo PJ já ativo
    return;
  }
  charAtivo = chars[0];
  render();
}

async function criarPersonagem(nome, jaAtivo = false) {
  const payload = { user_id: usuario.id, nome: nome || 'Novo Personagem' };
  if (jaAtivo) payload.is_active = true;
  const { data, error } = await window.sb.from('characters').insert(payload).select('*').single();
  if (error) { alert('Erro ao criar personagem: ' + error.message); return; }
  chars.push(data);
  charAtivo = data;
  render();
}

async function deletarPersonagem(id) {
  // Confirmar.perguntar() no lugar do confirm() nativo (assets/js/confirmar.js) —
  // mesmo modal usado no painel do Mestre, coerente com o resto do redesign.
  const cf = window.Confirmar
    ? await Confirmar.perguntar({
        titulo: 'Excluir personagem?',
        mensagem: 'Suas favoritas e todos os dados desta ficha serão perdidos. Esta ação não pode ser desfeita.',
        confirmar: 'Excluir', danger: true,
      })
    : confirm('Deletar este personagem? Suas favoritas e dados serão perdidos.');
  if (!cf) return;
  const { error } = await window.sb.from('characters').delete().eq('id', id);
  if (error) { alert('Erro ao deletar: ' + error.message); return; }
  chars = chars.filter(c => c.id !== id);
  charAtivo = chars[0] || null;
  if (!charAtivo) {
    let ehMestre = false;
    try { ehMestre = window.Auth && await window.Auth.ehMestre(); } catch {}
    if (ehMestre) {
      $('#conteudo').innerHTML = `<div class="estado">Conta do <strong>Mestre</strong> — sem ficha de jogador. Use o <a href="painel_mestre_dnd5e.html">Painel do Mestre</a>.</div>`;
      return;
    }
    await criarPersonagem('Meu Personagem', true);
    return;
  }
  render();
}

// Clona a ficha ativa inteira (identidade, combate, magias, habilidades,
// inventário, aliados…) num personagem novo, inativo. Útil pra testar uma
// variação (respec, "e se") sem mexer no original.
async function duplicarPersonagem() {
  if (!charAtivo) return;
  const payload = {
    ...charAtivo,
    user_id: usuario.id,
    nome: (charAtivo.nome || 'Personagem') + ' (cópia)',
    is_active: false,
  };
  delete payload.id; delete payload.created_at; delete payload.updated_at; delete payload.updated_by;
  const { data, error } = await window.sb.from('characters').insert(payload).select('*').single();
  if (error) { alert('Erro ao duplicar personagem: ' + error.message); return; }
  chars.push(data);
  charAtivo = data;
  render();
  toast('Personagem duplicado', 'salvar');
}

async function alternarAtivo() {
  const novo = !charAtivo.is_active;
  const { error } = await window.sb
    .from('characters').update({ is_active: novo }).eq('id', charAtivo.id);
  if (error) { alert('Erro: ' + error.message); return; }
  // Trigger no banco desativa os outros do mesmo user
  charAtivo.is_active = novo;
  if (novo) chars = chars.map(c => ({ ...c, is_active: c.id === charAtivo.id }));
  render();
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Parser de número com vírgula PT-BR (10,5 → 10.5)
function parseNum(txt, opts = {}) {
  if (txt === null || txt === undefined || txt === '') return opts.padrao ?? 0;
  const s = String(txt).replace(',', '.').trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = parseFloat(s);
  if (opts.min !== undefined && n < opts.min) return null;
  if (opts.max !== undefined && n > opts.max) return null;
  if (opts.inteiro && !Number.isInteger(n)) return null;
  return n;
}


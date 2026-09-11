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

// Modo de rolagem de d20 (Normal/Vantagem/Desvantagem) — estado de sessão,
// não persiste no personagem (é uma condição temporária de mesa, tipo "estou
// deitado" ou "o alvo está agarrado"). Compartilhado por Ataques (Resumo) e
// pelos botões de rolar perícia/salvaguarda (Combate) — trocar aqui afeta a
// PRÓXIMA rolagem em qualquer aba.
let _modoRolagem = 'normal';
const ROTULO_MODO_ROLAGEM = { normal: 'Normal', vantagem: 'Vantagem', desvantagem: 'Desvantagem' };
function cicloModoRolagem() {
  _modoRolagem = _modoRolagem === 'normal' ? 'vantagem' : _modoRolagem === 'vantagem' ? 'desvantagem' : 'normal';
}

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

// Multiclasse (jog-4): characters.classes_secundarias é um array opcional
// [{classe, nivel}] além da classe principal (colunas classe/nivel de
// sempre). PHB: bônus de proficiência usa a SOMA do nível de todas as
// classes — sem classes secundárias, isso é exatamente c.nivel (nenhuma
// mudança de comportamento pro personagem de classe única).
function nivelTotalPersonagem(c) {
  const secundarias = Array.isArray(c?.classes_secundarias) ? c.classes_secundarias : [];
  return (+c?.nivel || 1) + secundarias.reduce((soma, cl) => soma + (Math.max(0, +cl?.nivel || 0)), 0);
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

// Perícias e testes de resistência de classe (PHB 5e, cap. 3, "Proficiências"
// de cada classe) — usados só pelo Assistente de Criação (jog-9) pra saber
// QUANTAS perícias escolher e de qual lista, e quais salvaguardas marcar
// como proficientes automaticamente. 'todas' (Bardo) = qualquer uma das 18.
const PERICIAS_POR_CLASSE = {
  'barbaro':     { escolhas: 2, opcoes: ['adestrar_animais','atletismo','intimidacao','natureza','percepcao','sobrevivencia'] },
  'bardo':       { escolhas: 3, opcoes: 'todas' },
  'bruxo':       { escolhas: 2, opcoes: ['arcanismo','enganacao','historia','intimidacao','investigacao','natureza','religiao'] },
  'clerigo':     { escolhas: 2, opcoes: ['historia','intuicao','medicina','persuasao','religiao'] },
  'druida':      { escolhas: 2, opcoes: ['arcanismo','adestrar_animais','intuicao','medicina','natureza','percepcao','religiao','sobrevivencia'] },
  'feiticeiro':  { escolhas: 2, opcoes: ['arcanismo','enganacao','intuicao','intimidacao','persuasao','religiao'] },
  'guerreiro':   { escolhas: 2, opcoes: ['acrobacia','adestrar_animais','atletismo','historia','intuicao','intimidacao','percepcao','sobrevivencia'] },
  'ladino':      { escolhas: 4, opcoes: ['acrobacia','atletismo','atuacao','enganacao','furtividade','intimidacao','intuicao','investigacao','percepcao','persuasao','prestidigitacao'] },
  'mago':        { escolhas: 2, opcoes: ['arcanismo','historia','intuicao','investigacao','medicina','religiao'] },
  'monge':       { escolhas: 2, opcoes: ['acrobacia','atletismo','furtividade','historia','intuicao','religiao'] },
  'paladino':    { escolhas: 2, opcoes: ['atletismo','intuicao','intimidacao','medicina','persuasao','religiao'] },
  'patrulheiro': { escolhas: 3, opcoes: ['adestrar_animais','atletismo','furtividade','intuicao','investigacao','natureza','percepcao','sobrevivencia'] },
};
const SALVAGUARDAS_POR_CLASSE = {
  'barbaro': ['for','con'], 'bardo': ['dex','car'], 'bruxo': ['sab','car'],
  'clerigo': ['sab','car'], 'druida': ['int','sab'], 'feiticeiro': ['con','car'],
  'guerreiro': ['for','con'], 'ladino': ['dex','int'], 'mago': ['int','sab'],
  'monge': ['for','dex'], 'paladino': ['sab','car'], 'patrulheiro': ['for','dex'],
};
function opcoesPericiasDaClasse(classe) {
  const def = PERICIAS_POR_CLASSE[chaveDeClasse(classe)];
  if (!def) return null;
  return { escolhas: def.escolhas, opcoes: def.opcoes === 'todas' ? PERICIAS.map(p => p[0]) : def.opcoes };
}

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

// Fórmulas centrais em assets/js/regras_base.js (carregar antes deste arquivo).
// Continuam expostas como globais soltos aqui porque TODOS os módulos de
// assets/js/ficha/*.js já chamam mod()/fmtMod()/bonusProf() assim.
const mod = window.Regras.mod;
const fmtMod = window.Regras.fmtMod;
const bonusProf = window.Regras.bonusProf;

// Salvaguardas aceitam formato legado (bool = proficiência) OU objeto {prof,bonus}
function salvProf(salv, k) { const v = salv?.[k]; return v === true || !!(v && v.prof); }
function salvBonus(salv, k) { const v = salv?.[k]; return (v && typeof v === 'object' && +v.bonus) || 0; }

// Valor final de salvaguarda/perícia a partir do PERSONAGEM SALVO (charAtivo).
// Usado no primeiro render de Combate e no Resumo — mesma fórmula, um só
// lugar, os dois nunca divergem. (Diferente de recalcularValoresPericiasSalv()
// em listeners.js, que lê o DOM ao vivo pra refletir edições ainda não
// salvas — proposta diferente, não dá pra unificar sem misturar as duas.)
function valorSalvaguarda(c, atrKey) {
  const salv = c.salvaguardas || {};
  const m = mod((c.atributos || {})[atrKey] ?? 10);
  return m + (salvProf(salv, atrKey) ? bonusProf(nivelTotalPersonagem(c)) : 0) + salvBonus(salv, atrKey);
}
function valorPericia(c, periciaKey, atrKey) {
  const p = (c.pericias || {})[periciaKey] || {};
  const m = mod((c.atributos || {})[atrKey] ?? 10);
  const bp = bonusProf(nivelTotalPersonagem(c));
  return m + (p.prof ? bp : 0) + (p.exp ? bp : 0) + (+p.bonus || 0);
}
// Percepção passiva (10 + Percepção) — mesmo valor que a coluna percepcao_passiva
// do banco deveria refletir pro painel do Mestre (ver salvarPercepcaoPassiva).
function percepcaoPassiva(c) {
  return 10 + valorPericia(c, 'percepcao', 'sab');
}

let usuario = null;
let chars = [];
let charAtivo = null;
let tabAtiva = 'resumo'; // Resumo (Fase 3) é a tela principal de uso em sessão
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

// ── Condições (characters.condicoes, text[]) ────────────────────────
// Mesma coluna que o painel do Mestre já lê/escreve (ver
// assets/js/condicoes_regras.js) — usada primeiro no Resumo (Fase 3) e
// depois também na aba Combate (Fase 4), por isso vive aqui em vez de
// dentro de um aba_*.js só.
async function salvarCondicoes() {
  if (!charAtivo?.id) return;
  _ultimoSaveLocal = Date.now();
  const { error } = await window.sb.from('characters')
    .update({ condicoes: charAtivo.condicoes || [] })
    .eq('id', charAtivo.id);
  if (error) console.warn('[condicoes] erro ao salvar:', error);
}
function alternarCondicao(nome) {
  const atuais = new Set(charAtivo.condicoes || []);
  if (atuais.has(nome)) atuais.delete(nome); else atuais.add(nome);
  charAtivo.condicoes = Array.from(atuais);
  salvarCondicoes();
}

// ── Habilidades favoritas (characters.habilidades_favoritas, Fase 5) ──
// Mesmo padrão de salvarCondicoes, com uma diferença: a coluna vem de uma
// migration NOVA (sql/022_habilidades_favoritas.sql) que pode ainda não
// ter rodado no banco do usuário. Nesse caso o UPDATE falha (coluna não
// existe) — a UI já aplicou a mudança localmente (otimista), só a
// persistência falha silenciosamente (log de aviso, sem travar nada).
async function salvarHabilidadesFavoritas() {
  if (!charAtivo?.id) return;
  _ultimoSaveLocal = Date.now();
  const { error } = await window.sb.from('characters')
    .update({ habilidades_favoritas: charAtivo.habilidades_favoritas || [] })
    .eq('id', charAtivo.id);
  if (error) console.warn('[habilidades] favoritas não persistiram (rode a migration 022_habilidades_favoritas.sql?):', error.message);
}
function alternarHabilidadeFavorita(slug) {
  const atuais = new Set(Array.isArray(charAtivo.habilidades_favoritas) ? charAtivo.habilidades_favoritas : []);
  if (atuais.has(slug)) atuais.delete(slug); else atuais.add(slug);
  charAtivo.habilidades_favoritas = Array.from(atuais);
  salvarHabilidadesFavoritas();
}

// Multiclasse (jog-4): array próprio (não um <input name=...> do form), tem
// save dedicado no mesmo padrão de habilidades_favoritas/features_personalizadas
// — precisa estar em salvar.js na lista de `delete payload.X` do autosave
// genérico, senão uma submissão de outra aba pode sobrescrever com dado velho.
async function salvarClassesSecundarias() {
  if (!charAtivo?.id) return;
  _ultimoSaveLocal = Date.now();
  const { error } = await window.sb.from('characters')
    .update({ classes_secundarias: charAtivo.classes_secundarias || [] })
    .eq('id', charAtivo.id);
  if (error) console.warn('[multiclasse] não persistiu (rode a migration 024_multiclasse.sql?):', error.message);
}

// ── Concentração (characters.concentracao {ativa,magia}, migration 021) ──
// Coluna já existia (lida pelo painel do Mestre, painel_barovia_dnd5e.html,
// pra mostrar "🔮 Concentrando" na barra de PJs) mas a ficha do jogador
// nunca escrevia nela — o jogador tinha que lembrar de "concentração" só
// de cabeça. Agora: iniciar concentração ao conjurar uma magia de
// concentração (aba_magias.js) encerra automaticamente a anterior (regra
// do PHB — só se concentra numa magia por vez); um botão em Combate encerra
// manualmente (ex.: falhou no teste de Constituição); o teste de
// Constituição em si continua manual (a ficha não rola por você) — só
// lembra a CD (10 ou metade do dano, o que for maior) no toast de dano.
async function salvarConcentracao() {
  if (!charAtivo?.id) return;
  _ultimoSaveLocal = Date.now();
  const { error } = await window.sb.from('characters')
    .update({ concentracao: charAtivo.concentracao || { ativa: false, magia: '' } })
    .eq('id', charAtivo.id);
  if (error) console.warn('[concentracao] erro ao salvar:', error);
}
function iniciarConcentracao(nomeMagia) {
  const anterior = charAtivo.concentracao?.ativa ? charAtivo.concentracao.magia : null;
  charAtivo.concentracao = { ativa: true, magia: nomeMagia };
  salvarConcentracao();
  return anterior && anterior !== nomeMagia ? anterior : null;
}
function encerrarConcentracao() {
  charAtivo.concentracao = { ativa: false, magia: '' };
  salvarConcentracao();
}

// Mesma fonte de verdade que aplicarEstadoLock() (lock.js) usa — Fase 9:
// a aba Personagem lê isso pra decidir se mostra campos de leitura (cards
// de texto) ou o formulário de edição de sempre. Um só lugar faz a leitura
// do localStorage; lock.js e render.js/aba_roleplay.js chamam esta função
// em vez de repetir o try/catch.
function estaDesbloqueado() {
  try { return localStorage.getItem('ficha_unlock') === '1'; } catch { return false; }
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


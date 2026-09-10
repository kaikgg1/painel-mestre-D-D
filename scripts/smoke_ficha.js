// scripts/smoke_ficha.js  —  npm run smoke
//
// Rede de segurança da refatoração da ficha. Carrega os módulos de
// assets/js/ficha/ dentro de um jsdom, na MESMA ordem de paineis/ficha.html
// (como <script> de verdade, pra os let/const de topo compartilharem o escopo
// global igual no navegador) e confere que:
//
//   1. todo módulo executa sem lançar;
//   2. as funções globais esperadas continuam existindo — inclusive as
//      chamadas por handlers inline no HTML gerado (popularHabilidades,
//      tentarRecuperarImagemCriatura);
//   3. as constantes de regra continuam no escopo;
//   4. os cálculos de D&D (bônus de proficiência, modificador, dado de vida,
//      salvaguardas legadas, detecção de usos) dão os mesmos resultados;
//   5. cada aba renderiza HTML não-vazio com um personagem de exemplo.
//
// Não substitui teste no navegador (não mede layout nem CSS), mas pega
// regressão estrutural de graça a cada fase.
const fs = require('fs');
const path = require('path');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { console.error('jsdom nao instalado. Rode: npm install'); process.exit(1); }

const raiz = process.argv[2] || path.join(__dirname, '..');
const html = fs.readFileSync(path.join(raiz, 'paineis/ficha.html'), 'utf8');

// Só o markup — os <script> externos são injetados manualmente abaixo.
const corpo = html
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<link[^>]*>/g, '');

const dom = new JSDOM(corpo, { runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;

// Stubs mínimos: init() sai cedo se não houver usuário logado.
window.Auth = { requerLogin: async () => null, renderHeader: async () => {}, ehMestre: async () => false };
// Stub de assets/js/confirmar.js: o modal real espera clique do usuário
// (Promise que só resolve com a interação); aqui simula "sempre confirma",
// suficiente pra exercitar os call sites (deletarPersonagem, remover
// característica personalizada) sem reimplementar um modal no jsdom.
window.Confirmar = { perguntar: async () => true };
// window.__ultimoUpdatePayload grava o payload do update() mais recente —
// usado pra inspecionar o que salvar() realmente monta e mandaria pro banco
// (ver os testes "salvar() de verdade" mais abaixo).
window.__ultimoUpdatePayload = null;
// Query builder encadeável de verdade (não um objeto ad-hoc por chamada):
// .eq()/.order() podem ser encadeados qualquer número de vezes, em
// qualquer ordem, terminando em .single()/.maybeSingle() (promise de
// {data,error}) OU sendo usado diretamente como promise (award direto,
// como salvarCondicoes/salvarRecursos fazem: `await ...update(...).eq(...)`
// sem terminal — o builder abaixo é "thenable" pra isso funcionar também).
function construirQuery(payloadUpdate) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    update: (payload) => { window.__ultimoUpdatePayload = payload; return construirQuery(payload); },
    single: async () => ({ data: payloadUpdate ? { ...payloadUpdate } : {}, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    // Permite `await query` sem terminal explícito (uso real em salvarCondicoes etc.)
    then: (resolve) => resolve({ data: payloadUpdate ? { ...payloadUpdate } : [], error: null }),
  };
  return builder;
}
window.sb = { from: () => construirQuery(null) };
// nucleo.js faz fetch('../data/habilidades_classes.json') e
// fetch('../data/magias_data.json') — serve os arquivos reais do disco
// (mesmo dado que o navegador pegaria) em vez de simular "sem rede", senão
// popularHabilidades()/carregarMagiasPreparadas() nunca populam de verdade
// e a Fase 5 (busca/filtro/favoritar sobre o catálogo) fica sem cobertura.
window.fetch = async (url) => {
  const arquivo = String(url).replace(/^\.\.\//, '');
  const caminho = path.join(raiz, arquivo);
  if (fs.existsSync(caminho) && /^data\//.test(arquivo)) {
    return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(caminho, 'utf8')) };
  }
  throw new Error('sem rede no smoke test (' + url + ')');
};
// Polyfills de coisas que o jsdom nao implementa (nao sao problema do codigo)
window.Element.prototype.scrollIntoView = function () {};
window.HTMLCanvasElement.prototype.getContext = () => null;
if (!window.CSS) window.CSS = {};
if (!window.CSS.escape) window.CSS.escape = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c);

// Modulos compartilhados que a ficha consome (PHB, slots, exaustao, recursos, icones)
for (const m of ['icones.js','phb_catalogo.js','phb_slots.js','exaustao_regras.js','recursos_classe.js','ataques.js','condicoes_regras.js']) {
  const el = window.document.createElement('script');
  el.textContent = fs.readFileSync(path.join(raiz, 'assets/js', m), 'utf8');
  window.document.head.appendChild(el);
}

const ordem = [
  'nucleo.js','render.js','header.js','nav_mobile.js','aba_resumo.js',
  'aba_combate.js','recursos.js','aba_habilidades.js','aba_magias.js',
  'aba_equipamento.js','aba_aliados.js','aba_roleplay.js','lock.js',
  'listeners.js','salvar.js',
];

const erros = [];
window.addEventListener('error', e => erros.push(e.message || String(e.error)));
const vc = dom.virtualConsole || null;

// A partir daqui tudo roda dentro de uma IIFE async: a Fase 5 precisa
// esperar o fetch() (agora servindo data/habilidades_classes.json de
// verdade) resolver antes de checar o catálogo populado. Sem isso o teste
// corria síncrono e nunca via o conteúdo real do catálogo.
(async () => {

for (const arq of ordem) {
  const src = fs.readFileSync(path.join(raiz, 'assets/js/ficha', arq), 'utf8');
  // <script> DE VERDADE (não eval): só assim os let/const de topo entram no
  // escopo léxico global compartilhado, que é o que o navegador faz.
  const antes = erros.length;
  const el = window.document.createElement('script');
  el.textContent = src;
  window.document.head.appendChild(el);
  console.log(erros.length > antes ? '  FALHOU     ' + arq : '  executou   ' + arq);
}

// As funções que precisam continuar globais (inclusive as chamadas por
// handlers inline no HTML gerado: popularHabilidades, tentarRecuperarImagemCriatura).
const esperadas = [
  'render','renderTab','renderIdentidade','renderCombate','renderHabilidades',
  'renderMagias','renderEquipamento','renderAliados','renderRoleplay',
  'renderSlotsMagia','renderRecursosClasse','renderCardCriatura','renderTabelaItens',
  'popularHabilidades','popularFeaturesPersonalizadas','tentarRecuperarImagemCriatura',
  'conectarListeners','conectarListenersEquipamento','conectarListenersTags',
  'conectarListenersAliados','salvar','salvarRecursos','salvarCompanions',
  'abrirModalConjurar','abrirModalConversorFeit','abrirBuscadorMonstros',
  'aplicarEstadoLock','aplicarTabIndexLock','atualizarExaustaoUI',
  'recalcularValoresPericiasSalv','validarCampo','detectarUsosLimitados',
  'slugFeature','dadoVidaDaClasse','chaveDeClasse','classeUsaMagia','init','toast',
  'renderHeader','conectarListenersHeader','avatarIniciais','corAvatar',
  'duplicarPersonagem','deletarPersonagem','alternarAtivo','definirStatusAutosave',
  'renderBottomNav','abrirSheetMais','valorSalvaguarda','valorPericia','percepcaoPassiva',
  'renderResumo','renderResumoStatus','renderResumoAtaques','renderResumoMagias',
  'renderSlotsResumo','renderResumoOutros','renderChipsCondicoes',
  'conectarListenersResumo','conectarListenersCondicoes','salvarCondicoes','alternarCondicao',
];

// Ataques.js e condicoes_regras.js expõem objetos (não funções) — checa a API.
const apiObjetos = [
  ['Ataques', ['calcular', 'rolar', 'ehDistancia', 'temAcuidade']],
  ['CondicoesRegras', ['descricao']],
];
for (const [nomeObj, metodos] of apiObjetos) {
  const obj = window[nomeObj];
  if (!obj) { erros.push('objeto global ausente: ' + nomeObj); continue; }
  for (const m of metodos) {
    if (typeof obj[m] !== 'function') erros.push(nomeObj + '.' + m + ' não é função');
  }
}
if (!Array.isArray(window.CondicoesRegras?.LISTA)) erros.push('CondicoesRegras.LISTA não é array');
else {
  // Mesmos 14 nomes, mesma ordem, do array CONDICOES em painel_mestre_dnd5e.html —
  // as duas telas leem/escrevem characters.condicoes (text[]); uma lista
  // diferente aqui quebraria a compatibilidade entre ficha e painel do Mestre.
  const ESPERADO_MESTRE = ['Agarrado','Amedrontado','Atordoado','Caído','Cego','Enfeitiçado',
    'Envenenado','Impedido','Incapacitado','Inconsciente','Invisível','Paralisado','Petrificado','Surdo'];
  if (JSON.stringify(window.CondicoesRegras.LISTA) !== JSON.stringify(ESPERADO_MESTRE)) {
    erros.push('CondicoesRegras.LISTA diverge da lista CONDICOES do painel do Mestre');
  }
}
const faltando = esperadas.filter(n => typeof window[n] !== 'function');
if (faltando.length) erros.push('funções globais ausentes: ' + faltando.join(', '));

// Constantes de regras (let/const de topo não viram window.*, então testamos via eval)
const consts = ['ATRIBUTOS','PERICIAS','CLASSES','RACAS','ALINHAMENTOS','CAMPANHAS',
  'SUBCLASSES_POR_CLASSE','DADO_VIDA_POR_CLASSE','TEMPLATES_CRIATURA','ATR_CRIATURA',
  'CUSTO_SLOT_DE_PONTOS'];
for (const c of consts) {
  try { if (window.eval('typeof ' + c) === 'undefined') erros.push('constante ausente: ' + c); }
  catch (e) { erros.push('constante ' + c + ' → ' + e.message); }
}

// Sanidade das regras: um punhado de cálculos que não podem ter mudado
const checks = [
  ['bonusProf(1)', 2], ['bonusProf(5)', 3], ['bonusProf(9)', 4], ['bonusProf(20)', 6],
  ['mod(8)', -1], ['mod(10)', 0], ['mod(18)', 4],
  ['dadoVidaDaClasse("Bárbaro")', 12], ['dadoVidaDaClasse("Feiticeiro")', 6],
  ['ATRIBUTOS.length', 6], ['PERICIAS.length', 18],
  ['salvProf({for:true},"for")', true], ['salvBonus({for:{prof:true,bonus:3}},"for")', 3],
  ['fmtMod(3)', '+3'], ['fmtMod(-1)', '-1'],
  ['parseNum("10,5")', 10.5], ['parseNum("abc")', null],
  ['escape("<b>")', '&lt;b&gt;'],
  ['detectarUsosLimitados({nome:"Canalizar Divindade (1/descanso)",desc:""}).max', 1],
  ['slugFeature("Ação Ardilosa")', 'acao_ardilosa'],
  // valorSalvaguarda/valorPericia (Fase 3): mesma fórmula usada em Combate
  // (aba_combate.js) e no Resumo — travando aqui os dois nunca podem divergir.
  ['valorSalvaguarda({nivel:9,atributos:{sab:20},salvaguardas:{sab:true}},"sab")', 9],
  ['valorSalvaguarda({nivel:9,atributos:{car:10},salvaguardas:{car:{prof:true,bonus:1}}},"car")', 5],
  ['valorSalvaguarda({nivel:9,atributos:{for:8},salvaguardas:{for:false}},"for")', -1],
  ['valorPericia({nivel:9,atributos:{sab:20},pericias:{percepcao:{prof:true,exp:true}}},"percepcao","sab")', 13],
  ['percepcaoPassiva({nivel:9,atributos:{sab:20},pericias:{percepcao:{prof:true,exp:true}}})', 23],
  // Ataques.calcular (Fase 3): corpo-a-corpo usa FOR, à distância usa DES,
  // Acuidade usa o melhor dos dois — travado aqui pra não regredir.
  ['Ataques.calcular({categoria:"Marcial corpo-a-corpo",propriedades:"Versátil (1d10)"},{for:16,dex:10},5).atrKey', 'for'],
  ['Ataques.calcular({categoria:"Simples distância",propriedades:""},{for:16,dex:10},5).atrKey', 'dex'],
  ['Ataques.calcular({categoria:"Marcial corpo-a-corpo",propriedades:"Acuidade"},{for:10,dex:18},5).atrKey', 'dex'],
  ['Ataques.calcular({categoria:"Marcial corpo-a-corpo",propriedades:"Acuidade"},{for:10,dex:18},5).bonusAtaque', 7],
  ['CondicoesRegras.LISTA.length', 14],
];
for (const [expr, esperado] of checks) {
  let got;
  try { got = window.eval(expr); } catch (e) { erros.push(expr + ' lançou ' + e.message); continue; }
  if (got !== esperado) erros.push(`${expr} → ${JSON.stringify(got)} (esperado ${JSON.stringify(esperado)})`);
}

// ---- Render real de todas as abas ----
const PJ = {
  id: 'x', user_id: 'u', nome: 'Lilith Goldengrove', raca: 'Humano', classe: 'Clérigo',
  subclasse: 'Domínio da Morte', nivel: 9, origem: 'Acólito', alinhamento: 'Neutro',
  campanha: 'barovia', is_active: true,
  atributos: { for: 8, dex: 14, con: 16, int: 12, sab: 20, car: 10 },
  hp_atual: 42, hp_max: 67, hp_temp: 5, ca: 18, iniciativa_bonus: 2, deslocamento: 9,
  dado_vida_tipo: 8, dado_vida_atual: 9, exaustao: 2, inspiracao: 1,
  slots_magia: { 1:{max:4,atual:2}, 2:{max:3,atual:0}, 3:{max:3,atual:1}, 4:{max:3,atual:0}, 5:{max:1,atual:0} },
  salvaguardas: { sab: true, car: { prof: true, bonus: 1 }, for: false },
  pericias: { intuicao:{prof:true}, medicina:{prof:true}, percepcao:{prof:true,exp:true}, religiao:{prof:true,bonus:2} },
  truques_conhecidos: 4, magias_conhecidas: 0, cd_resistencia: 17, bonus_atq_magia: 9,
  idiomas: ['Comum','Celestial'], ferramentas: ['Kit de herbalismo'],
  tracos_raciais: 'Versatilidade', caracteristicas_adicionais: 'Notas livres',
  inventario: { moedas:{po:120,pp:3,pe:0,pc:8,pl:0},
    armas:[{nome:'Maça',dano:'1d6',tipo_dano:'Concussão',propriedades:'—'}],
    armaduras:[{nome:'Cota de Malha',ca:'16',tipo:'Pesada',forca:'13'}],
    itens:[{nome:'Corda de Cânhamo',qtd:1,peso:5}] },
  recursos_usados: { canalizar_divindade: 1 },
  features_personalizadas: [{ id:'f1', nome:'Dádiva de Strahd', desc:'teste', max:2 }],
  companions: [{ nome:'Corvo', tipo:'Besta Miúda', ca:12, hp_max:1, hp_atual:1,
    atributos:{for:2,dex:14,con:8,int:2,sab:12,car:6}, tracos:[{nome:'Mímica',desc:'…'}],
    acoes:[{nome:'Bicada',desc:'…'}] }],
  bestiario_favoritos: ['corvo'],
  tracos_pessoais: 'Idolatro um herói.', ideais: 'Fé.', vinculos: 'Meu templo.',
  defeitos: 'Teimosa.', historia: 'História…', notas: 'Notas…', imagem_url: '',
};
// Segundo personagem só pra exercitar o ramo "há mais de 1 PJ" do trocador
// no header (renderHeader só desenha o <select> nesse caso).
const setup = window.document.createElement('script');
setup.textContent = 'usuario = { id: "u" }; charAtivo = ' + JSON.stringify(PJ) +
  '; chars = [charAtivo, {...charAtivo, id: "y", nome: "Segundo PJ"}];';
window.document.head.appendChild(setup);

const abas = ['resumo','combate','magias','habilidades','equipamento','aliados','identidade','roleplay'];
console.log('');
for (const aba of abas) {
  const antes = erros.length;
  let tamanho = 0;
  try {
    const sc = window.document.createElement('script');
    sc.textContent = 'tabAtiva = ' + JSON.stringify(aba) + '; render(); window.__len = document.getElementById("conteudo").innerHTML.length;';
    window.document.head.appendChild(sc);
    tamanho = window.__len || 0;
    if (!tamanho) erros.push('aba ' + aba + ' renderizou vazio');
  } catch (e) { erros.push('aba ' + aba + ' → ' + e.message); }
  console.log(erros.length > antes
    ? '  FALHOU     aba ' + aba
    : '  renderizou aba ' + aba + ' (' + tamanho + ' chars de HTML)');
}

// Resumo (Fase 3): renderiza de novo explicitamente (a última aba do loop
// acima foi 'roleplay') e confere as seções + o ciclo completo de uma
// condição — adicionar pelo menu, ver descrição expandida, remover.
console.log('');
{
  const sc = window.document.createElement('script');
  sc.textContent = 'tabAtiva = "resumo"; charAtivo.condicoes = []; render();';
  window.document.head.appendChild(sc);

  const RESUMO_CHECKS = [
    ['.resumo-grid', 'grid do dashboard'],
    ['.ataque-card', 'card de ataque (arma do inventário)'],
    ['#recursos-classe-wrap .rc-painel', 'recursos de classe reaproveitados (mesmo painel de Habilidades)'],
    ['.resumo-slots .resumo-slot-linha', 'resumo de espaços de magia'],
    ['.resumo-salv-chip', 'chips de salvaguarda'],
    ['#resumo-condicoes-wrap .item-vazio-inline', 'estado vazio de condições'],
  ];
  for (const [sel, rotulo] of RESUMO_CHECKS) {
    if (!window.document.querySelector(sel)) erros.push('resumo: "' + rotulo + '" (' + sel + ') não encontrado');
  }

  // Ciclo de condição: abrir o menu, adicionar "Envenenado", conferir o chip,
  // expandir a descrição, remover — tudo via clique real (não chamada direta).
  const antesCondicao = erros.length;
  try {
    window.document.getElementById('btn-add-condicao')?.click();
    window.document.querySelector('[data-condicao-add="Envenenado"]')?.click();
    const chip = window.document.querySelector('[data-condicao-ver="Envenenado"]');
    if (!chip) erros.push('resumo: condição "Envenenado" não apareceu como chip após adicionar');
    else {
      chip.click(); // expande a descrição
      const detalhe = window.document.querySelector('.condicao-detalhe');
      if (!detalhe || !detalhe.textContent.trim()) erros.push('resumo: descrição da condição não expandiu');
      window.document.querySelector('[data-condicao-remover="Envenenado"]')?.click();
      if (window.document.querySelector('[data-condicao-ver="Envenenado"]')) erros.push('resumo: condição não foi removida ao clicar no X');
      const condFinal = window.eval('charAtivo.condicoes');
      if (!Array.isArray(condFinal) || condFinal.length) erros.push('resumo: charAtivo.condicoes não voltou vazio após remover');
    }
  } catch (e) { erros.push('resumo: ciclo de condição → ' + e.message); }

  console.log(erros.length > antesCondicao || RESUMO_CHECKS.some(([sel]) => !window.document.querySelector(sel))
    ? '  FALHOU     resumo (ver FALHAS abaixo)'
    : '  aba resumo: seções + ciclo completo de condição (adicionar/ver/remover) ok');

  // Direção perigosa da guarda por aba (salvar.js): submeter a partir do
  // Resumo (sem _aba_combate/slot_1_max no form) precisa OMITIR
  // salvaguardas/pericias/slots_magia do payload — não mandar valor
  // nenhum, nem vazio. Se essa guarda quebrasse, o autosave de QUALQUER
  // campo do Resumo apagaria esses dados no banco (a causa raiz que o
  // comentário em salvar.js documenta). Este é o teste mais importante
  // desta fase pra essa guarda continuar de pé.
  const antesGuarda = erros.length;
  try {
    window.__ultimoUpdatePayload = null;
    window.document.getElementById('ficha-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    const p = window.__ultimoUpdatePayload;
    if (!p) erros.push('salvar(): window.sb.update() não foi chamado a partir do Resumo');
    else {
      if ('salvaguardas' in p) erros.push('salvar(): payload do Resumo NÃO deveria ter salvaguardas (guarda de aba furou)');
      if ('pericias' in p) erros.push('salvar(): payload do Resumo NÃO deveria ter pericias (guarda de aba furou)');
      if ('slots_magia' in p) erros.push('salvar(): payload do Resumo NÃO deveria ter slots_magia (guarda de aba furou)');
      if (p.hp_atual !== 42) erros.push('salvar(): hp_atual do Resumo esperado 42, veio ' + p.hp_atual);
    }
  } catch (e) { erros.push('salvar() a partir do Resumo → ' + e.message); }
  console.log(erros.length > antesGuarda
    ? '  FALHOU     guarda por aba a partir do Resumo (ver FALHAS abaixo)'
    : '  guarda por aba OK: submit do Resumo NÃO manda salvaguardas/pericias/slots_magia');
}

// Combate (Fase 4): stat-row/HP completo, salvaguardas/perícias em
// acordeão (linha compacta ○/●/◆ que abre um editor com os MESMOS campos
// guardados de sempre), condições reaproveitadas com um wrapId diferente
// do Resumo, e o <details> de conjuração recolhido por padrão.
console.log('');
{
  const antes = erros.length;
  const sc = window.document.createElement('script');
  sc.textContent = 'tabAtiva = "combate"; render();';
  window.document.head.appendChild(sc);

  const COMBATE_CHECKS = [
    ['.stat-card.stat-hp #hp-atual-input', 'card de HP completo'],
    ['.stat-row.combate-topo .stat-card', 'CA/Iniciativa/Deslocamento/Inspiração no stat-row'],
    ['#combate-condicoes-wrap', 'bloco de condições (mesma função do Resumo, wrapId diferente)'],
    ['.linha-gatilho[data-toggle-editor="per-percepcao"]', 'linha compacta de perícia'],
    ['#editor-per-percepcao[hidden]', 'editor de perícia começa recolhido'],
    ['.detalhes-conjuracao:not([open])', '<details> de conjuração começa recolhido'],
    ['.detalhes-conjuracao .slot-pip', 'espaços de magia interativos dentro do <details>'],
  ];
  for (const [sel, rotulo] of COMBATE_CHECKS) {
    if (!window.document.querySelector(sel)) erros.push('combate: "' + rotulo + '" (' + sel + ') não encontrado');
  }

  // Acordeão: clicar no gatilho da Percepção abre o editor e marca aria-expanded.
  try {
    const gatilho = window.document.querySelector('[data-toggle-editor="per-percepcao"]');
    const editor = window.document.getElementById('editor-per-percepcao');
    gatilho?.click();
    if (!editor || editor.hidden) erros.push('combate: editor de Percepção não abriu ao clicar no gatilho');
    if (gatilho?.getAttribute('aria-expanded') !== 'true') erros.push('combate: aria-expanded não virou "true" ao abrir o editor');
  } catch (e) { erros.push('combate: toggle do acordeão → ' + e.message); }

  // Símbolo ao vivo: desmarcar "Proficiente" de Intuição (o PJ de teste não
  // tem essa perícia marcada — então MARCAR e ver o símbolo ir de ○ pra ●).
  try {
    const cbIntuicao = window.document.querySelector('[data-per="intuicao"]');
    const simbIntuicao = window.document.querySelector('[data-per-simbolo="intuicao"]');
    if (!cbIntuicao || !simbIntuicao) erros.push('combate: checkbox/símbolo de Intuição não encontrados');
    else {
      const antesSimbolo = simbIntuicao.textContent;
      cbIntuicao.checked = !cbIntuicao.checked;
      cbIntuicao.dispatchEvent(new window.Event('change', { bubbles: true }));
      if (simbIntuicao.textContent === antesSimbolo) erros.push('combate: símbolo de Intuição não mudou ao (des)marcar Proficiente');
    }
  } catch (e) { erros.push('combate: símbolo ao vivo → ' + e.message); }

  console.log(erros.length > antes
    ? '  FALHOU     combate (ver FALHAS abaixo)'
    : '  aba combate: acordeão de perícia/salvaguarda + condições reaproveitadas + símbolo ao vivo ok');

  // Invariante crítica (Fase 4): campos dentro de [hidden] (editores em
  // acordeão) e dentro de um <details> FECHADO (bloco de conjuração) ainda
  // entram no FormData — é disso que depende salvar.js continuar salvando
  // salvaguardas/perícias/slots mesmo com o editor/details recolhido. Não é
  // óbvio (muita gente espera o oposto) e um refactor futuro que
  // adicionasse `disabled` a esses campos quebraria o autosave em silêncio.
  const antesForm = erros.length;
  try {
    const form = window.document.getElementById('ficha-form');
    const fd = new window.FormData(form);
    if (!fd.has('salv_for_bonus')) erros.push('combate: campo dentro de editor [hidden] sumiu do FormData (salv_for_bonus)');
    if (!fd.has('slot_1_max')) erros.push('combate: campo dentro de <details> fechado sumiu do FormData (slot_1_max)');
  } catch (e) { erros.push('combate: invariante de FormData → ' + e.message); }
  console.log(erros.length > antesForm
    ? '  FALHOU     invariante de FormData (ver FALHAS abaixo)'
    : '  invariante confirmada: [hidden] e <details> fechado continuam no FormData');

  // salvar() de verdade (não só a leitura de FormData acima): dispara um
  // submit real no form da aba Combate e inspeciona o payload que
  // window.sb.update() recebeu — confirma que a reforma visual não mudou
  // o que de fato vai pro banco (as guardas fd.has('_aba_combate')/
  // fd.has('slot_1_max') de salvar.js continuam vendo os campos certos).
  const antesSalvar = erros.length;
  try {
    window.__ultimoUpdatePayload = null;
    const ficha = window.document.getElementById('ficha-form');
    // salvar() é async, mas tudo antes do único await (o próprio update())
    // roda síncrono — dispatchEvent chama o listener na hora, então o
    // payload já está capturado quando dispatchEvent() retorna. Sem
    // top-level await (este arquivo é CommonJS, não módulo ES).
    ficha.dispatchEvent(new window.Event('submit', { cancelable: true }));
    const p = window.__ultimoUpdatePayload;
    if (!p) erros.push('salvar(): window.sb.update() não foi chamado');
    else {
      if (!('salvaguardas' in p)) erros.push('salvar(): payload sem salvaguardas (guarda fd.has("_aba_combate") deveria ter deixado passar)');
      if (!('pericias' in p)) erros.push('salvar(): payload sem pericias');
      if (!('slots_magia' in p)) erros.push('salvar(): payload sem slots_magia (guarda fd.has("slot_1_max"))');
      if (p.hp_atual !== 42) erros.push('salvar(): hp_atual esperado 42, veio ' + p.hp_atual);
      if (p.ca !== 18) erros.push('salvar(): ca esperado 18, veio ' + p.ca);
    }
  } catch (e) { erros.push('salvar() de verdade → ' + e.message); }
  console.log(erros.length > antesSalvar
    ? '  FALHOU     salvar() real a partir de Combate (ver FALHAS abaixo)'
    : '  salvar() real: submit da aba Combate grava salvaguardas/pericias/slots_magia no payload');
}

// Habilidades (Fase 5): busca, filtro por tipo de ação e favoritar — sobre
// o CATÁLOGO DE VERDADE (data/habilidades_classes.json via o fetch mock
// acima), não um placeholder. Clérigo nível 9 tem exatamente 1 feature
// classificada 'acao' ("Canalizar Divindade: Expulsar Mortos-Vivos") entre
// as 12 do nível — número travado por checagem separada em node direto.
console.log('');
{
  const antes = erros.length;
  const sc = window.document.createElement('script');
  sc.textContent = 'tabAtiva = "habilidades"; render();';
  window.document.head.appendChild(sc);

  // popularHabilidades() é assíncrono (fetch real, mockado acima) — espera
  // o catálogo terminar de popular #hab-wrap antes de checar qualquer coisa.
  const habWrap = () => window.document.getElementById('hab-wrap');
  for (let i = 0; i < 50 && habWrap() && /Carregando/.test(habWrap().textContent); i++) {
    await new Promise(r => setTimeout(r, 20));
  }

  const featuresCatalogo = () => Array.from(window.document.querySelectorAll('#hab-wrap .hab-feature'));
  if (!featuresCatalogo().length) erros.push('habilidades: catálogo não populou (fetch mock ou popularHabilidades quebrou)');

  const HAB_CHECKS = [
    ['#hab-busca', 'campo de busca'],
    ['[data-hab-filtro="todas"].ativo', 'pill "Todas" ativo por padrão'],
    ['#hab-wrap .hab-feature[data-hab-tipo="acao"]', 'feature classificada como Ação'],
    ['#hab-wrap .hab-fav-btn', 'botão de favoritar no catálogo'],
    ['#hab-wrap .hab-pip', 'pips de uso redesenhados'],
    ['#hab-custom-wrap', 'wrap de características personalizadas'],
  ];
  for (const [sel, rotulo] of HAB_CHECKS) {
    if (!window.document.querySelector(sel)) erros.push('habilidades: "' + rotulo + '" (' + sel + ') não encontrado');
  }

  // Filtro "Ações": só a 1 feature 'acao' deve continuar visível no catálogo.
  try {
    window.document.querySelector('[data-hab-filtro="acao"]')?.click();
    const visiveis = featuresCatalogo().filter(el => !el.hidden);
    if (visiveis.length !== 1) erros.push('habilidades: filtro "Ações" deveria deixar 1 feature visível, ficaram ' + visiveis.length);
    else if (visiveis[0].dataset.habTipo !== 'acao') erros.push('habilidades: filtro "Ações" deixou visível uma feature do tipo ' + visiveis[0].dataset.habTipo);
    window.document.querySelector('[data-hab-filtro="todas"]')?.click(); // volta ao normal
  } catch (e) { erros.push('habilidades: filtro por tipo → ' + e.message); }

  // Busca por texto: "aumento" só bate em "Aumento de Pontuação de Atributo".
  try {
    const busca = window.document.getElementById('hab-busca');
    busca.value = 'aumento';
    busca.dispatchEvent(new window.Event('input', { bubbles: true }));
    const visiveis = featuresCatalogo().filter(el => !el.hidden);
    if (!visiveis.length) erros.push('habilidades: busca "aumento" não achou nada');
    if (visiveis.some(el => !/aumento/i.test(el.textContent))) erros.push('habilidades: busca "aumento" deixou visível algo que não bate');
    busca.value = ''; busca.dispatchEvent(new window.Event('input', { bubbles: true })); // limpa
  } catch (e) { erros.push('habilidades: busca por texto → ' + e.message); }

  // Favoritar uma feature do catálogo → aparece em charAtivo.habilidades_favoritas
  // → persiste (payload do update mockado) → aparece na seção Favoritas do Resumo.
  try {
    const primeiroFav = window.document.querySelector('#hab-wrap .hab-fav-btn');
    const slugFavoritado = primeiroFav?.dataset.habFav;
    window.__ultimoUpdatePayload = null;
    primeiroFav?.click();
    const favs = window.eval('charAtivo.habilidades_favoritas');
    if (!Array.isArray(favs) || !favs.includes(slugFavoritado)) erros.push('habilidades: favoritar não gravou o slug em charAtivo.habilidades_favoritas');
    const p = window.__ultimoUpdatePayload;
    if (!p || !('habilidades_favoritas' in p)) erros.push('habilidades: favoritar não tentou persistir via window.sb.update()');

    // Vai pro Resumo e confere que a favorita aparece (espera o fetch assíncrono de novo)
    const scResumo = window.document.createElement('script');
    scResumo.textContent = 'tabAtiva = "resumo"; render();';
    window.document.head.appendChild(scResumo);
    const favWrap = () => window.document.getElementById('resumo-favoritas-wrap');
    for (let i = 0; i < 50 && favWrap() && /Carregando/.test(favWrap().textContent); i++) {
      await new Promise(r => setTimeout(r, 20));
    }
    if (!favWrap() || !favWrap().querySelector('.fav-hab-card')) erros.push('resumo: seção Favoritas não mostrou a habilidade recém-favoritada');
  } catch (e) { erros.push('habilidades: ciclo de favoritar → ' + e.message); }

  console.log(erros.length > antes
    ? '  FALHOU     habilidades (ver FALHAS abaixo)'
    : '  aba habilidades: catálogo real + filtro por tipo + busca + favoritar (com reflexo no Resumo) ok');
}

// Característica personalizada: adicionar → nomear → favoritar → remover
// (confirmação via o stub de Confirmar.perguntar acima). Cobre o segundo
// tipo de habilidade (custom, não-catálogo) que compartilha os mesmos
// data-hab-tipo/favoritar/filtro do catálogo.
console.log('');
{
  const antes = erros.length;
  const scHab = window.document.createElement('script');
  scHab.textContent = 'tabAtiva = "habilidades"; render();';
  window.document.head.appendChild(scHab);

  try {
    window.document.getElementById('btn-add-feature')?.click();
    const nomeInput = window.document.querySelector('#hab-custom-wrap .cfeat-nome');
    if (!nomeInput) erros.push('habilidades: adicionar característica personalizada não criou o input de nome');
    else {
      nomeInput.value = 'Dádiva de Teste';
      nomeInput.dispatchEvent(new window.Event('input', { bubbles: true }));

      const favBtn = window.document.querySelector('#hab-custom-wrap .hab-fav-btn');
      const slugCustom = favBtn?.dataset.habFav;
      favBtn?.click();
      const favs = window.eval('charAtivo.habilidades_favoritas') || [];
      if (!slugCustom || !favs.includes(slugCustom)) erros.push('habilidades: favoritar característica personalizada não gravou o slug');

      const antesQtd = (window.eval('charAtivo.features_personalizadas') || []).length;
      window.document.querySelector('#hab-custom-wrap .cfeat-remove')?.click();
      await Promise.resolve().then(() => {}).then(() => {}); // deixa o await Confirmar.perguntar() (stub) resolver
      const depoisQtd = (window.eval('charAtivo.features_personalizadas') || []).length;
      if (depoisQtd !== antesQtd - 1) erros.push('habilidades: remover característica personalizada (com Confirmar.perguntar) não tirou do array — antes=' + antesQtd + ' depois=' + depoisQtd);
      const favsDepois = window.eval('charAtivo.habilidades_favoritas') || [];
      if (favsDepois.includes(slugCustom)) erros.push('habilidades: remover característica personalizada não limpou o favorito órfão');
    }
  } catch (e) { erros.push('habilidades: ciclo de característica personalizada → ' + e.message); }

  console.log(erros.length > antes
    ? '  FALHOU     característica personalizada (ver FALHAS abaixo)'
    : '  característica personalizada: adicionar/favoritar/remover (com Confirmar.perguntar) ok');
}

// Header (Fase 2): avatar+nome+trocador, campanha, autosave, editar/travar,
// menu ⋯, e a navegação inferior mobile — tudo populado pelo último render().
console.log('');
const HEADER_CHECKS = [
  ['#hdr-id .hdr-nome', 'nome no header'],
  ['#hdr-id .hdr-trocar-select', 'trocador de personagem (2+ PJs)'],
  ['#hdr-id .hdr-subtitulo', 'subtítulo classe/nível'],
  ['#hdr-meta .hdr-campanha', 'pill de campanha'],
  ['#hdr-meta .status-msg', 'badge de autosave'],
  ['#hdr-meta #btn-lock-toggle', 'botão editar/travar'],
  ['#hdr-meta #btn-menu-toggle', 'botão do menu ⋯'],
  ['#hdr-meta #menu-popover .menu-item', 'itens do menu ⋯'],
  ['#bottom-nav .bn-item', 'itens da navegação inferior mobile'],
];
for (const [sel, rotulo] of HEADER_CHECKS) {
  const achou = window.document.querySelector(sel);
  if (!achou) erros.push('header: "' + rotulo + '" (' + sel + ') não encontrado após render()');
}
console.log(erros.some(e => e.startsWith('header:'))
  ? '  FALHOU     header/nav (ver FALHAS abaixo)'
  : '  header + nav inferior populados (' + HEADER_CHECKS.length + ' elementos conferidos)');

console.log('');
if (erros.length) { console.log('FALHAS:'); erros.forEach(e => console.log('  ✗ ' + e)); process.exit(1); }
console.log(`OK — ${ordem.length} módulos, ${abas.length} abas renderizadas, ${esperadas.length} funções globais, ${consts.length} constantes e ${checks.length} cálculos de regra.`);
// Saída imediata: fetch/Supabase stubados ainda têm promises pendentes,
// que só gerariam ruído no console depois do resultado.
process.exit(0);

})().catch(e => { console.error('ERRO NAO TRATADO NO SMOKE TEST:', e); process.exit(1); });

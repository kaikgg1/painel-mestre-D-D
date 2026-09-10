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
window.sb = { from: () => ({
  select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
  // update().eq() é chamado por salvarCondicoes/salvarRecursos etc. — sem
  // isso a promise rejeita (unhandled rejection) mesmo sem afetar o teste.
  update: () => ({ eq: async () => ({ error: null }) }),
}) };
window.fetch = async () => { throw new Error('sem rede no smoke test'); };
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

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

// url: sem isso o jsdom usa about:blank (origem opaca) e window.localStorage
// lança SecurityError — precisamos dele de verdade pro teste de "recentes"
// do seletor (Fase 7).
const dom = new JSDOM(corpo, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/paineis/ficha.html' });
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
// window.__magiasFavoritasTeste: nomes que carregarFavoritasDoBanco() (que
// consulta a tabela spell_lists) deve "achar" — setado antes do bloco de
// testes da aba Magias, null nos demais (spell_lists vazia, como qualquer
// outra tabela/consulta que não seja um update em characters).
window.__magiasFavoritasTeste = null;
let __proximoIdInsert = 1;
function construirQuery(tabela, payloadUpdate) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    // insert(): usado por criarPersonagem()/criarPersonagemComWizard() (Assistente
    // de Criação) — devolve o payload com um id sintético, como o Supabase faria.
    insert: (payload) => {
      const comId = { id: 'novo-' + (__proximoIdInsert++), ...payload };
      window.__ultimoInsertPayload = comId;
      return construirQuery(tabela, comId);
    },
    update: (payload) => {
      window.__ultimoUpdatePayload = payload;
      // Além do "último" (compatibilidade com testes antigos), acumula TODOS
      // os updates desta rodada — uma ação pode disparar mais de um update
      // encadeado (ex.: conjurar uma magia de concentração grava slots_magia
      // E concentracao em updates separados) e um teste que só olha o
      // "último" pode pegar o update errado dependendo da ordem.
      (window.__todosUpdatePayloads = window.__todosUpdatePayloads || []).push(payload);
      // spell_lists: reflete o update no fixture de favoritas, senão um
      // teste que remove uma favorita e depois recarrega a lista (que
      // consulta spell_lists de novo) veria o array antigo, como se a
      // remoção nunca tivesse sido persistida.
      if (tabela === 'spell_lists' && Array.isArray(payload?.spell_names)) {
        window.__magiasFavoritasTeste = payload.spell_names;
      }
      return construirQuery(tabela, payload);
    },
    single: async () => ({ data: payloadUpdate ? { ...payloadUpdate } : {}, error: null }),
    maybeSingle: async () => (
      tabela === 'spell_lists' && window.__magiasFavoritasTeste
        ? { data: { spell_names: window.__magiasFavoritasTeste }, error: null }
        : { data: null, error: null }
    ),
    // Permite `await query` sem terminal explícito (uso real em salvarCondicoes etc.)
    then: (resolve) => resolve({ data: payloadUpdate ? { ...payloadUpdate } : [], error: null }),
  };
  return builder;
}
window.sb = { from: (tabela) => construirQuery(tabela, null) };
// nucleo.js faz fetch('../data/habilidades_classes.json') e
// fetch('../data/magias_data.json') — serve os arquivos reais do disco
// (mesmo dado que o navegador pegaria) em vez de simular "sem rede", senão
// popularHabilidades()/carregarMagiasPreparadas() nunca populam de verdade
// e a Fase 5 (busca/filtro/favoritar sobre o catálogo) fica sem cobertura.
window.fetch = async (url) => {
  const arquivo = decodeURIComponent(String(url).replace(/^\.\.\//, ''));
  const caminho = path.join(raiz, arquivo);
  if (fs.existsSync(caminho) && /^data\//.test(arquivo)) {
    return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(caminho, 'utf8')) };
  }
  // docs/fichas/*.pdf — exportarFichaPDF() (exportar_pdf.js) busca o modelo
  // real do disco pra preencher; serve como bytes de verdade (arrayBuffer),
  // mesmo dado que o navegador pegaria.
  if (fs.existsSync(caminho) && /^docs\/fichas\//.test(arquivo)) {
    const buf = fs.readFileSync(caminho);
    // Precisa ser um ArrayBuffer do REALM da jsdom window (não do Node) —
    // pdf-lib faz `instanceof ArrayBuffer` internamente, que falha em
    // silêncio (erro "type NaN") pra um ArrayBuffer de outro realm.
    return { ok: true, status: 200, arrayBuffer: async () => { const u8 = new window.Uint8Array(buf.byteLength); u8.set(buf); return u8.buffer; } };
  }
  throw new Error('sem rede no smoke test (' + url + ')');
};
// Polyfills de coisas que o jsdom nao implementa (nao sao problema do codigo)
window.Element.prototype.scrollIntoView = function () {};
window.HTMLCanvasElement.prototype.getContext = () => null;
// jsdom tenta "navegar" quando um <a href="blob:..."> é clicado (mesmo com
// download), o que loga "Not implemented: navigation..." — inofensivo, mas
// suprime aqui pra manter a saída do smoke test limpa.
window.HTMLAnchorElement.prototype.click = function () {};
if (!window.CSS) window.CSS = {};
if (!window.CSS.escape) window.CSS.escape = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c);
// jsdom não implementa URL.createObjectURL — exportarFichaPDF() (exportar_pdf.js)
// usa isso pra baixar o PDF gerado. Guarda o Blob num global pra o teste
// poder reabrir os bytes depois (mesmo padrão de "captura o que seria
// enviado pro browser" já usado com window.sb acima).
window.URL.createObjectURL = (blob) => { window.__ultimoBlobPDF = blob; return 'blob:teste'; };
window.URL.revokeObjectURL = () => {};

// Modulos compartilhados que a ficha consome (PHB, slots, exaustao, recursos, icones)
for (const m of ['icones.js','ui.js','regras_base.js','phb_catalogo.js','phb_slots.js','exaustao_regras.js','recursos_classe.js','ataques.js','condicoes_regras.js']) {
  const el = window.document.createElement('script');
  el.textContent = fs.readFileSync(path.join(raiz, 'assets/js', m), 'utf8');
  window.document.head.appendChild(el);
}
{
  const el = window.document.createElement('script');
  el.textContent = fs.readFileSync(path.join(raiz, 'assets/vendor/pdf-lib.min.js'), 'utf8');
  window.document.head.appendChild(el);
}

const ordem = [
  'nucleo.js','render.js','header.js','wizard_dados.js','wizard_criacao.js','exportar_pdf.js','nav_mobile.js','seletor.js','aba_resumo.js',
  'aba_combate.js','recursos.js','aba_habilidades.js','aba_magias.js',
  'aba_equipamento.js','aba_aliados.js','aba_roleplay.js','lock.js',
  'listeners.js','salvar.js',
];

const erros = [];
window.addEventListener('error', e => {
  const linha = e.error && e.error.stack ? e.error.stack.split('\n').slice(0, 4).join(' | ') : (e.message || String(e.error));
  erros.push(linha);
});
window.addEventListener('unhandledrejection', e => {
  const linha = e.reason && e.reason.stack ? e.reason.stack.split('\n').slice(0, 4).join(' | ') : String(e.reason);
  erros.push('REJEIÇÃO NÃO TRATADA: ' + linha);
});
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
  'render','renderTab','renderPersonagem','renderCombate','renderHabilidades',
  'renderMagias','renderEquipamento','renderAliados','renderRoleplayBloco',
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
  ['UI', ['abrirSeletor']],
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
  // calcularCarga (Fase 5): PHB — capacidade = 7,5x Força; sobrecarga leve
  // acima de 2,5x, pesada acima de 5x. For 10 → capacidade 75kg.
  ['calcularCarga({atributos:{for:10},inventario:{armas:[{peso:2}],armaduras:[],itens:[{peso:1,qtd:3}],moedas:{po:100}}}).total', 6],
  ['calcularCarga({atributos:{for:10},inventario:{armas:[],armaduras:[],itens:[],moedas:{}}}).capacidade', 75],
  ['calcularCarga({atributos:{for:10},inventario:{armas:[{peso:30}],armaduras:[],itens:[],moedas:{}}}).nivel', 'leve'],
  ['calcularCarga({atributos:{for:10},inventario:{armas:[{peso:60}],armaduras:[],itens:[],moedas:{}}}).nivel', 'pesada'],
  ['calcularCarga({atributos:{for:10},inventario:{armas:[{peso:80}],armaduras:[],itens:[],moedas:{}}}).nivel', 'excede'],
];
for (const [expr, esperado] of checks) {
  let got;
  try { got = window.eval(expr); } catch (e) { erros.push(expr + ' lançou ' + e.message); continue; }
  if (got !== esperado) erros.push(`${expr} → ${JSON.stringify(got)} (esperado ${JSON.stringify(esperado)})`);
}

// Regras.rolarD20 (Fase 5, vantagem/desvantagem): roda várias vezes porque
// depende de Math.random — trava o INVARIANTE (usado = maior/menor dos 2
// dados, total = usado + bônus), não um valor fixo.
try {
  const falhouVantagem = window.eval(`
    Array.from({length:30}, () => Regras.rolarD20(3, 'vantagem'))
      .some(r => r.usado !== Math.max(r.d1, r.d2) || r.total !== r.usado + 3 || r.d2 === null)
  `);
  if (falhouVantagem) erros.push('Regras.rolarD20("vantagem"): usado deveria ser sempre o maior dos 2 dados');
  const falhouDesvantagem = window.eval(`
    Array.from({length:30}, () => Regras.rolarD20(3, 'desvantagem'))
      .some(r => r.usado !== Math.min(r.d1, r.d2) || r.total !== r.usado + 3 || r.d2 === null)
  `);
  if (falhouDesvantagem) erros.push('Regras.rolarD20("desvantagem"): usado deveria ser sempre o menor dos 2 dados');
  const normal = window.eval(`Regras.rolarD20(3, 'normal')`);
  if (normal.d2 !== null) erros.push('Regras.rolarD20("normal") não deveria rolar um 2º dado (d2=' + normal.d2 + ')');
} catch (e) { erros.push('Regras.rolarD20: ' + e.message);
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

const abas = ['resumo','combate','magias','habilidades','equipamento','aliados','personagem'];
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

// UI.abrirModal/UI.accordion (jog-10/jog-11, assets/js/ui.js): contrato
// genérico isolado, sem depender de nenhuma aba específica — os modais reais
// (Conjurar, conversor de pontos de feitiçaria) e os acordeões reais (Combate,
// Magias) são cobertos nos próprios testes de cada aba mais abaixo.
console.log('');
{
  const antes = erros.length;
  try {
    const { overlay, card } = window.UI.abrirModal({ tituloHtml: 'Título', corpoHtml: '<p>corpo</p>' });
    if (!window.document.body.contains(overlay)) erros.push('UI.abrirModal: overlay não foi anexado ao body');
    if (!overlay.classList.contains('modal-overlay')) erros.push('UI.abrirModal: overlay sem a classe modal-overlay');
    if (!card || card.textContent.indexOf('corpo') === -1) erros.push('UI.abrirModal: corpoHtml não apareceu no card');

    // Clique no backdrop (dispatch direto no próprio overlay, não no card
    // dentro dele — e.target vem como o overlay nesse caso) fecha o modal.
    overlay.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    if (window.document.body.contains(overlay)) erros.push('UI.abrirModal: clique no backdrop não fechou o modal');
  } catch (e) { erros.push('UI.abrirModal: backdrop → ' + e.message); }

  // Fecha no Esc (testado num modal novo, já que o de cima pode ter fechado
  // via backdrop dependendo do jsdom simular "target" corretamente).
  try {
    const { overlay, fechar } = window.UI.abrirModal({ corpoHtml: '<p>x</p>' });
    window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    if (window.document.body.contains(overlay)) erros.push('UI.abrirModal: Esc não fechou o modal');
  } catch (e) { erros.push('UI.abrirModal: Esc → ' + e.message); }

  // Fecha via fechar() explícito, e não reage mais ao Esc depois de fechado
  // (o listener de keydown tem que ser removido, senão vaza um por modal).
  try {
    const { overlay, fechar } = window.UI.abrirModal({ corpoHtml: '<p>y</p>' });
    fechar();
    if (window.document.body.contains(overlay)) erros.push('UI.abrirModal: fechar() não removeu o overlay');
  } catch (e) { erros.push('UI.abrirModal: fechar() → ' + e.message); }

  // Accordion: gatilho <button> (sem classe → alterna .hidden) e gatilho
  // <div role="button"> (com classe → alterna a classe no alvo).
  try {
    const btn = window.document.createElement('button');
    const painel = window.document.createElement('div');
    painel.hidden = true;
    window.UI.accordion(btn, () => painel);
    btn.click();
    if (painel.hidden) erros.push('UI.accordion (button, sem classe): clique deveria desesconder o painel');
    if (btn.getAttribute('aria-expanded') !== 'true') erros.push('UI.accordion (button): aria-expanded deveria virar "true"');

    const divBtn = window.document.createElement('div');
    const item = window.document.createElement('div');
    window.UI.accordion(divBtn, () => item, { classe: 'aberta' });
    divBtn.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));
    if (!item.classList.contains('aberta')) erros.push('UI.accordion (div role=button, classe): Enter deveria abrir (classe "aberta")');
  } catch (e) { erros.push('UI.accordion: ' + e.message); }

  console.log(erros.length > antes
    ? '  FALHOU     UI.abrirModal/UI.accordion (ver FALHAS abaixo)'
    : '  UI.abrirModal (overlay/backdrop/Esc/fechar) + UI.accordion (button e div role=button) ok');
}

// Resumo (Fase 3): renderiza de novo explicitamente (a última aba do loop
// acima foi 'personagem') e confere as seções + o ciclo completo de uma
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

  // Descanso Longo (Fase 5, correção da auditoria): clique de verdade no
  // botão, confere que TODOS os slots de magia zeram, PV volta ao máximo,
  // dado de vida recupera (capado no nível) e o recurso auto-detectado
  // (Canalizar Divindade) também zera — e que tudo isso é persistido via
  // window.sb.update (não só mutado em memória).
  {
    const antes = erros.length;
    try {
      // O teste anterior (toggle de Percepção/Intuição) disparou 'change' no
      // form, que agenda o auto-save de verdade (debounce de 800ms,
      // listeners.js). Drena esse auto-save ANTES de mutar nada aqui: espera
      // o suficiente pra ele disparar e terminar (o mock de window.sb
      // resolve na hora, então não precisa esperar 800ms de verdade — só o
      // bastante pra qualquer requisição já EM VOO nesse instante assentar).
      await new Promise(r => setTimeout(r, 30));
      window.eval('if (typeof _debounceTimers !== "undefined") { _debounceTimers.forEach(t => clearTimeout(t)); _debounceTimers.clear(); }');
      await Promise.resolve();

      // Só agora, com nenhum auto-save pendente, muta o estado de teste
      // (reduz o dado de vida artificialmente pra testar a recuperação —
      // o PJ de teste normalmente já está com o dado de vida cheio).
      window.eval(`
        charAtivo.dado_vida_atual = 2; charAtivo.hp_atual = 10;
        const _i1 = document.querySelector('[name="dado_vida_atual"]'); if (_i1) _i1.value = '2';
        const _i2 = document.querySelector('[name="hp_atual"]'); if (_i2) _i2.value = '10';
      `);
      window.__ultimoUpdatePayload = null;
      const btnLongo = window.document.querySelector('[data-descanso="longo"]');
      if (!btnLongo) erros.push('descanso: botão "Descanso Longo" não encontrado na aba Combate');
      else {
        btnLongo.click();
        // aplicarDescanso é assíncrona (fetch de habilidades_classes.json + update);
        // dá tempo pra cadeia de promises resolver antes de checar o resultado.
        for (let i = 0; i < 5; i++) await Promise.resolve();

        const sm = window.eval('charAtivo.slots_magia');
        const algumSlotAindaGasto = Object.values(sm).some(s => (s.atual || 0) > 0);
        if (algumSlotAindaGasto) erros.push('descanso longo: nem todos os slots de magia zeraram — ' + JSON.stringify(sm));

        const hpDepois = window.eval('charAtivo.hp_atual');
        const hpMax = window.eval('charAtivo.hp_max');
        if (hpDepois !== hpMax) erros.push(`descanso longo: PV não voltou ao máximo (hp_atual=${hpDepois}, hp_max=${hpMax})`);

        const dvDepois = window.eval('charAtivo.dado_vida_atual');
        // nível 9 → recupera max(1, floor(9/2))=4, de 2 pra 6 (capado em 9)
        if (dvDepois !== 6) erros.push('descanso longo: dado de vida deveria ir de 2 pra 6, foi pra ' + dvDepois);

        const canalizar = (window.eval('charAtivo.recursos_usados') || {}).canalizar_divindade;
        const canalizarZerado = !canalizar || (typeof canalizar === 'object' ? (canalizar.atual || 0) === 0 : canalizar === 0);
        if (!canalizarZerado) erros.push('descanso longo: Canalizar Divindade não zerou — ' + JSON.stringify(canalizar));

        const p = window.__ultimoUpdatePayload;
        if (!p || !('slots_magia' in p) || !('hp_atual' in p) || !('dado_vida_atual' in p)) {
          erros.push('descanso longo: payload persistido incompleto — ' + JSON.stringify(p));
        }
      }
    } catch (e) { erros.push('descanso longo: ' + e.message); }
    console.log(erros.length > antes
      ? '  FALHOU     descanso longo (ver FALHAS abaixo)'
      : '  aba combate: botão Descanso Longo reseta slots/recursos + restaura PV + recupera dado de vida ok');

    // Devolve o estado exatamente como a fixture original definiu — os
    // testes seguintes (inclusive "salvar() real a partir de Combate",
    // mais abaixo) esperam os valores originais do personagem de exemplo.
    window.eval(`
      charAtivo.hp_atual = 42;
      charAtivo.dado_vida_atual = 9;
      charAtivo.slots_magia = { 1:{max:4,atual:2}, 2:{max:3,atual:0}, 3:{max:3,atual:1}, 4:{max:3,atual:0}, 5:{max:1,atual:0} };
      charAtivo.recursos_usados = { canalizar_divindade: 1 };
      render();
    `);
  }

  // Descanso Curto (mesma função, ramo diferente): checagem leve — não
  // deve lançar, não deve mexer em PV/dado de vida (só o longo faz isso),
  // e o Clérigo de teste não tem Magia do Pacto, então slots_magia não
  // deveria mudar nesse personagem específico.
  {
    const antes = erros.length;
    try {
      await new Promise(r => setTimeout(r, 30));
      window.eval('if (typeof _debounceTimers !== "undefined") { _debounceTimers.forEach(t => clearTimeout(t)); _debounceTimers.clear(); }');
      await Promise.resolve();
      window.__ultimoUpdatePayload = null;
      const btnCurto = window.document.querySelector('[data-descanso="curto"]');
      if (!btnCurto) erros.push('descanso: botão "Descanso Curto" não encontrado na aba Combate');
      else {
        btnCurto.click();
        for (let i = 0; i < 5; i++) await Promise.resolve();
        const hpDepois = window.eval('charAtivo.hp_atual');
        if (hpDepois !== 42) erros.push('descanso curto: não deveria mexer em PV (hp_atual virou ' + hpDepois + ')');
        const sm = window.eval('charAtivo.slots_magia');
        if (sm['1'].atual !== 2) erros.push('descanso curto: não deveria mexer em slots_magia de um Clérigo (sem Magia do Pacto) — slot 1 atual=' + sm['1'].atual);
        if (!window.__ultimoUpdatePayload) erros.push('descanso curto: não persistiu nada via window.sb.update()');
      }
    } catch (e) { erros.push('descanso curto: ' + e.message); }
    console.log(erros.length > antes
      ? '  FALHOU     descanso curto (ver FALHAS abaixo)'
      : '  aba combate: botão Descanso Curto não mexe em PV/dado de vida/slots de classe comum ok');
    window.eval('charAtivo.hp_atual = 42; render();');
  }

  // Gastar Dado de Vida (jog-16, PHB "Descanso Curto"): rola o dado da
  // classe (Clérigo = d8) + mod. de Constituição (+3, atributos.con=16),
  // aplica no PV e desconta 1 DV — via os inputs do form (mesmo caminho de
  // aplicarHP em listeners.js).
  {
    const antes = erros.length;
    try {
      const btnGastar = window.document.getElementById('btn-gastar-dado-vida');
      const inpDv = window.document.getElementById('dv-atual-input');
      const inpHp = window.document.querySelector('[name="hp_atual"]');
      if (!btnGastar || !inpDv || !inpHp) erros.push('dado de vida: botão/inputs não encontrados na aba Combate');
      else {
        const dvAntes = +inpDv.value;
        const hpAntes = +inpHp.value;
        btnGastar.click();
        const dvDepois = +inpDv.value;
        const hpDepois = +inpHp.value;
        if (dvDepois !== dvAntes - 1) erros.push(`dado de vida: DV restantes deveria cair de ${dvAntes} pra ${dvAntes - 1}, foi pra ${dvDepois}`);
        const ganho = hpDepois - hpAntes;
        if (ganho < 4 || ganho > 11) erros.push(`dado de vida: PV ganho fora do intervalo esperado (d8+3 → 4 a 11), foi ${ganho}`);

        // Sem DV restante: botão não deve conceder PV nem descontar mais.
        window.eval('const _i = document.getElementById("dv-atual-input"); if (_i) _i.value = "0";');
        window.__ultimoUpdatePayload = null;
        const hpAntesSemDv = +inpHp.value;
        btnGastar.click();
        if (+inpHp.value !== hpAntesSemDv) erros.push('dado de vida: com 0 DV restantes, não deveria conceder PV nenhum');
      }
    } catch (e) { erros.push('dado de vida: ' + e.message); }
    console.log(erros.length > antes
      ? '  FALHOU     gastar dado de vida (ver FALHAS abaixo)'
      : '  aba combate: botão Gastar Dado de Vida rola d(classe)+CON e desconta 1 DV ok');
    window.eval('charAtivo.hp_atual = 42; charAtivo.dado_vida_atual = 9; render();');
  }

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
      // percepcao_passiva: nunca era gravada no banco (só calculada em
      // memória) — o painel do mestre lia a coluna direto e ficava sempre
      // preso no valor padrão. Confere que salvar() agora grava o mesmo
      // valor que a própria ficha calcula e mostra pro jogador.
      const esperadoPP = window.eval('percepcaoPassiva(charAtivo)');
      if (p.percepcao_passiva !== esperadoPP) erros.push(`salvar(): percepcao_passiva esperado ${esperadoPP} (mesmo cálculo da ficha), veio ${p.percepcao_passiva}`);
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

// Talento (feat) como tipo estruturado: marcar "É um talento", aplicar bônus
// de atributo, desfazer, aplicar de novo e então remover a característica
// AINDA com o bônus aplicado — o bônus tem que ser revertido automaticamente
// (senão fica um +N órfão em Atributos sem explicação nenhuma).
console.log('');
{
  const antes = erros.length;
  const scHab = window.document.createElement('script');
  scHab.textContent = 'tabAtiva = "habilidades"; render();';
  window.document.head.appendChild(scHab);

  try {
    const forAntes = window.eval('charAtivo.atributos.for');
    window.document.getElementById('btn-add-feature')?.click();
    const idx = (window.eval('charAtivo.features_personalizadas') || []).length - 1;

    const chk = window.document.querySelector(`[data-cfeat-talento="${idx}"]`);
    if (!chk) erros.push('talento: checkbox "É um talento" não foi renderizado');
    else {
      chk.checked = true;
      chk.dispatchEvent(new window.Event('change', { bubbles: true }));

      const sel = window.document.querySelector(`[data-cfeat-talento-atr="${idx}"]`);
      const bonusInp = window.document.querySelector(`[data-cfeat-talento-bonus="${idx}"]`);
      if (!sel || !bonusInp) erros.push('talento: mini-formulário (atributo/bônus) não apareceu após marcar o checkbox');
      else {
        sel.value = 'for';
        sel.dispatchEvent(new window.Event('change', { bubbles: true }));
        bonusInp.value = '2';
        bonusInp.dispatchEvent(new window.Event('change', { bubbles: true }));

        window.document.querySelector(`[data-cfeat-talento-aplicar="${idx}"]`)?.click();
        const forDepoisAplicar = window.eval('charAtivo.atributos.for');
        if (forDepoisAplicar !== forAntes + 2) erros.push(`talento: aplicar bônus não somou +2 em FOR (antes=${forAntes} depois=${forDepoisAplicar})`);
        if (!window.eval(`charAtivo.features_personalizadas[${idx}].talentoAplicado`)) erros.push('talento: talentoAplicado não ficou true após aplicar');

        // Desfazer bônus (toggle) — deve voltar ao valor original.
        window.document.querySelector(`[data-cfeat-talento-aplicar="${idx}"]`)?.click();
        const forDepoisDesfazer = window.eval('charAtivo.atributos.for');
        if (forDepoisDesfazer !== forAntes) erros.push(`talento: desfazer bônus não voltou FOR ao valor original (esperado=${forAntes} obtido=${forDepoisDesfazer})`);

        // Aplica de novo e remove a característica ainda aplicada — o bônus
        // tem que ser revertido junto com a remoção (senão fica órfão).
        window.document.querySelector(`[data-cfeat-talento-aplicar="${idx}"]`)?.click();
        window.document.querySelector(`[data-cfeat-rm="${idx}"]`)?.click();
        await Promise.resolve().then(() => {}).then(() => {}); // deixa o await Confirmar.perguntar() (stub) resolver
        const forDepoisRemover = window.eval('charAtivo.atributos.for');
        if (forDepoisRemover !== forAntes) erros.push(`talento: remover característica com bônus aplicado não reverteu FOR (esperado=${forAntes} obtido=${forDepoisRemover})`);
      }
    }
  } catch (e) { erros.push('talento: ciclo de aplicar/desfazer/remover → ' + e.message); }

  console.log(erros.length > antes
    ? '  FALHOU     talento com bônus de atributo (ver FALHAS abaixo)'
    : '  talento (feat): marcar/aplicar/desfazer bônus + reversão automática ao remover ok');
}

// Magias (Fase 6): 3 magias reais de data/magias_data.json favoritadas
// ("Bênção" 1º/Ação, "Arma Espiritual" 2º/Ação Bônus, "Augúrio" 2º/Ritual/
// Outro) — filtros de nível/tipo/ritual isolam cada uma, e o fluxo de
// Conjurar de verdade gasta um slot e persiste.
console.log('');
{
  const antes = erros.length;
  window.__magiasFavoritasTeste = ['Arma Espiritual', 'Bênção', 'Augúrio'];
  // Clique de verdade no botão da aba (não "tabAtiva='magias'; render()"
  // direto) — só assim passa pelo mesmo listener de clique que o usuário
  // real aciona. Um bug real (2 listeners duplicados religando os pills de
  // filtro a cada troca de aba, cancelando o próprio clique) só existia
  // nesse caminho — chamar render() direto no script escondia o problema.
  window.document.querySelector('.tab[data-tab="magias"]')?.click();

  const magiasWrap = () => window.document.getElementById('magias-prep');
  for (let i = 0; i < 50 && magiasWrap() && /Carregando/.test(magiasWrap().textContent); i++) {
    await new Promise(r => setTimeout(r, 20));
  }

  const itens = () => Array.from(window.document.querySelectorAll('#magias-prep .magia-item'));
  if (itens().length !== 3) erros.push('magias: esperava 3 magias favoritadas populadas, vieram ' + itens().length);

  const MAGIA_CHECKS = [
    ['#magia-busca', 'campo de busca'],
    ['.slots-grid, .slot-pip', 'grid de espaços de magia no topo da aba (renderSlotsMagia reaproveitado)'],
    ['[data-magia-nivel="1"]', 'pill de filtro por nível'],
    ['#magia-filtro-escolas .pill', 'pills de escola (populadas a partir das magias do PJ)'],
    ['[data-magia-bool="ritual"]', 'toggle de Ritual'],
  ];
  for (const [sel, rotulo] of MAGIA_CHECKS) {
    if (!window.document.querySelector(sel)) erros.push('magias: "' + rotulo + '" (' + sel + ') não encontrado');
  }

  // Expandir/recolher uma magia (UI.accordion, jog-10/jog-11): clicar na
  // linha marca .aberta no item e aria-expanded="true" na linha.
  try {
    const primeiraLinha = window.document.querySelector('.magia-row');
    const item = primeiraLinha?.closest('.magia-item');
    if (!primeiraLinha || !item) erros.push('magias: nenhuma .magia-row encontrada pra testar o acordeão');
    else {
      primeiraLinha.click();
      if (!item.classList.contains('aberta')) erros.push('magias: clicar na linha deveria abrir o item (.aberta)');
      if (primeiraLinha.getAttribute('aria-expanded') !== 'true') erros.push('magias: aria-expanded não virou "true" ao abrir');
      primeiraLinha.click();
      if (item.classList.contains('aberta')) erros.push('magias: clicar de novo deveria fechar o item');
    }
  } catch (e) { erros.push('magias: acordeão de expandir/recolher → ' + e.message); }

  // Filtro por nível 1 → só "Bênção"
  try {
    window.document.querySelector('[data-magia-nivel="1"]')?.click();
    const visiveis = itens().filter(el => !el.hidden);
    if (visiveis.length !== 1 || !/Bênção/.test(visiveis[0].textContent)) erros.push('magias: filtro nível 1 deveria isolar "Bênção", achou ' + visiveis.map(v=>v.querySelector('.magia-nome')?.textContent));
    window.document.querySelector('[data-magia-nivel="1"]')?.click(); // desliga de novo
  } catch (e) { erros.push('magias: filtro por nível → ' + e.message); }

  // Filtro por tipo "Ação Bônus" → só "Arma Espiritual"
  try {
    window.document.querySelector('[data-magia-tipo="bonus"]')?.click();
    const visiveis = itens().filter(el => !el.hidden);
    if (visiveis.length !== 1 || !/Arma Espiritual/.test(visiveis[0].textContent)) erros.push('magias: filtro "Ação Bônus" deveria isolar "Arma Espiritual"');
    window.document.querySelector('[data-magia-tipo="todas"]')?.click();
  } catch (e) { erros.push('magias: filtro por tipo de ação → ' + e.message); }

  // Toggle Ritual → só "Augúrio"
  try {
    window.document.querySelector('[data-magia-bool="ritual"]')?.click();
    const visiveis = itens().filter(el => !el.hidden);
    if (visiveis.length !== 1 || !/Augúrio/.test(visiveis[0].textContent)) erros.push('magias: filtro Ritual deveria isolar "Augúrio"');
    window.document.querySelector('[data-magia-bool="ritual"]')?.click();
  } catch (e) { erros.push('magias: filtro Ritual → ' + e.message); }

  // Busca por texto
  try {
    const busca = window.document.getElementById('magia-busca');
    busca.value = 'espiritual';
    busca.dispatchEvent(new window.Event('input', { bubbles: true }));
    const visiveis = itens().filter(el => !el.hidden);
    if (visiveis.length !== 1) erros.push('magias: busca "espiritual" deveria achar 1, achou ' + visiveis.length);
    busca.value = ''; busca.dispatchEvent(new window.Event('input', { bubbles: true }));
  } catch (e) { erros.push('magias: busca por texto → ' + e.message); }

  // Conjurar "Bênção" (1º nível) de verdade: abre modal, clica no slot de
  // nível 1, confere slots_magia atualizado E persistido via window.sb.update.
  try {
    const antesAtual = (window.eval('charAtivo.slots_magia') || {})['1']?.atual || 0;
    const btnConjurar = Array.from(window.document.querySelectorAll('.btn-conjurar'))
      .find(b => b.dataset.conjurarNome === 'Bênção');
    btnConjurar?.click();
    const slotBtn = window.document.querySelector('.modal-slot-btn[data-nv="1"]');
    if (!slotBtn) erros.push('magias: modal de Conjurar não ofereceu o slot de nível 1');
    else {
      window.__todosUpdatePayloads = [];
      slotBtn.click();
      await Promise.resolve().then(() => {}).then(() => {}); // deixa os awaits do update() (mock) resolverem
      const depoisAtual = (window.eval('charAtivo.slots_magia') || {})['1']?.atual || 0;
      if (depoisAtual !== antesAtual + 1) erros.push('magias: conjurar não incrementou slots_magia[1].atual (antes=' + antesAtual + ' depois=' + depoisAtual + ')');
      // "Bênção" é magia de concentração: conjurar dispara 2 updates
      // separados (slots_magia + concentracao) — checa os dois, não só
      // "o último" (a ordem entre updates fire-and-forget não é garantida).
      const todos = window.__todosUpdatePayloads || [];
      if (!todos.some(p => p && 'slots_magia' in p)) erros.push('magias: conjurar não persistiu slots_magia via window.sb.update()');
      if (!todos.some(p => p && p.concentracao?.ativa && p.concentracao?.magia === 'Bênção')) {
        erros.push('magias: conjurar magia de concentração não gravou characters.concentracao — ' + JSON.stringify(todos));
      }
      if (window.eval('charAtivo.concentracao?.magia') !== 'Bênção') erros.push('magias: charAtivo.concentracao não refletiu "Bênção" localmente');
      if (window.document.querySelector('.modal-overlay')) erros.push('magias: modal de Conjurar não fechou após escolher o slot');
    }
  } catch (e) { erros.push('magias: fluxo de Conjurar → ' + e.message); }

  // Estrela ★ (jog-12): remove uma magia das preparadas direto na ficha,
  // sem precisar abrir o Grimório (paineis/magias.html) — persiste em
  // spell_lists e a lista recarrega sem a magia removida.
  try {
    // O Conjurar de "Bênção" acima terminou com um render() completo da aba
    // (aba_magias.js), que reagenda carregarMagiasPreparadas() de novo
    // (listeners.js) — espera essa recarga assíncrona terminar antes de
    // procurar o botão, senão #magias-prep ainda está em "Carregando…".
    const magiasWrapAntes = () => window.document.getElementById('magias-prep');
    for (let i = 0; i < 50 && magiasWrapAntes() && /Carregando/.test(magiasWrapAntes().textContent); i++) {
      await new Promise(r => setTimeout(r, 20));
    }
    const btnFav = Array.from(window.document.querySelectorAll('[data-magia-fav]'))
      .find(b => b.dataset.magiaFav === 'Augúrio');
    if (!btnFav) erros.push('magias: botão ★ de remover das preparadas não encontrado em "Augúrio"');
    else {
      btnFav.click();
      // removerMagiaFavoritaFicha() + a recarga de carregarMagiasPreparadas()
      // que ela dispara em seguida encadeiam vários awaits reais (não só
      // microtasks) — espera tempo real em vez de só Promise.resolve().
      await new Promise(r => setTimeout(r, 30));
      const nomesRestantes = itens().map(el => el.querySelector('.magia-nome')?.textContent);
      if (nomesRestantes.includes('Augúrio')) erros.push('magias: ★ clicado em "Augúrio" mas ela continua nas preparadas — ' + JSON.stringify(nomesRestantes));
      if (itens().length !== 2) erros.push('magias: esperava 2 magias preparadas após remover 1 de 3, ficaram ' + itens().length);
    }
  } catch (e) { erros.push('magias: remover favorita pela estrela → ' + e.message); }

  window.__magiasFavoritasTeste = null;
  console.log(erros.length > antes
    ? '  FALHOU     magias (ver FALHAS abaixo)'
    : '  aba magias: filtros (nível/tipo/ritual/busca) + espaços interativos + Conjurar de verdade ok');
}

// Equipamento (Fase 7): UI.abrirSeletor() no lugar do <select> nativo —
// abre, busca "Espada Longa" de verdade em window.PHB.ARMAS, escolhe,
// confere o card de arma (bônus calculado por Ataques.calcular, igual ao
// Resumo), rola o ataque, remove e confere "recentes" no localStorage.
console.log('');
{
  const antes = erros.length;
  const sc = window.document.createElement('script');
  sc.textContent = 'charAtivo.inventario = {moedas:{},armas:[],armaduras:[],itens:[]}; tabAtiva = "equipamento"; render();';
  window.document.head.appendChild(sc);

  const EQUIP_CHECKS = [
    ['#btn-abrir-seletor-arma', 'botão de adicionar arma'],
    ['#btn-abrir-seletor-armadura', 'botão de adicionar armadura'],
    ['#btn-abrir-seletor-item', 'botão de adicionar item'],
    ['#add-item-nome', 'campo de item personalizado (preservado)'],
  ];
  for (const [sel, rotulo] of EQUIP_CHECKS) {
    if (!window.document.querySelector(sel)) erros.push('equipamento: "' + rotulo + '" (' + sel + ') não encontrado');
  }

  try {
    window.document.getElementById('btn-abrir-seletor-arma')?.click();
    await new Promise(r => setTimeout(r, 20)); // requestAnimationFrame do abrirSeletor

    const overlay = window.document.querySelector('.seletor-overlay');
    if (!overlay) erros.push('equipamento: UI.abrirSeletor() não abriu o overlay');
    else {
      const busca = overlay.querySelector('.seletor-busca');
      busca.value = 'espada longa';
      busca.dispatchEvent(new window.Event('input', { bubbles: true }));
      const item = Array.from(overlay.querySelectorAll('.seletor-item'))
        .find(b => /espada longa/i.test(b.textContent));
      if (!item) erros.push('equipamento: busca "espada longa" no seletor não achou nada');
      else {
        item.click();
        if (window.document.querySelector('.seletor-overlay.open')) erros.push('equipamento: seletor não fechou ao escolher um item');

        const armas = window.eval('charAtivo.inventario.armas') || [];
        if (armas.length !== 1 || armas[0].nome !== 'Espada Longa') erros.push('equipamento: escolher no seletor não adicionou "Espada Longa" ao inventário');

        const card = window.document.querySelector('.ataque-card');
        if (!card) erros.push('equipamento: card de arma não renderizou após adicionar');
        else {
          // FOR 8 (mod -1) + bonusProf(9)=4 = +3 — mesma fórmula do Resumo (Fase 3)
          if (!/\+3/.test(card.querySelector('.ataque-info')?.textContent || '')) {
            erros.push('equipamento: bônus de ataque da Espada Longa esperado +3, card mostra "' + (card.querySelector('.ataque-info')?.textContent || '') + '"');
          }
          const rolarBtn = card.querySelector('[data-equip-rolar]');
          rolarBtn?.click();
          if (!/Espada Longa/.test(window.document.getElementById('toast-auto')?.textContent || '')) {
            erros.push('equipamento: rolar ataque (🎲) não mostrou toast com o nome da arma');
          }
          // Remover agora pede confirmação (jog-13, padronizada como
          // companion/característica) — Confirmar.perguntar é assíncrono
          // mesmo no stub, então precisa de um tick antes de checar.
          card.querySelector('[data-rm="armas"]')?.click();
          await Promise.resolve().then(() => {}).then(() => {});
          const armasDepois = window.eval('charAtivo.inventario.armas') || [];
          if (armasDepois.length) erros.push('equipamento: remover arma (com Confirmar.perguntar) não esvaziou o inventário');
        }

        // "Recentes" (localStorage) — grava o nome pra próxima vez que abrir o seletor
        let recentes = [];
        try { recentes = JSON.parse(window.localStorage.getItem('ficha_recentes_armas') || '[]'); } catch {}
        if (!recentes.includes('Espada Longa')) erros.push('equipamento: "Espada Longa" não foi gravada em localStorage como recente');
      }
    }
  } catch (e) { erros.push('equipamento: fluxo do seletor de armas → ' + e.message); }

  // Mesmo mecanismo pras outras duas listas — só confere que abrem e
  // adicionam (a lógica de busca/categoria já foi testada a fundo acima).
  // Escopado ao ÚLTIMO .seletor-overlay (document.querySelectorAll(...).pop()):
  // o overlay anterior pode ainda estar no DOM terminando sua animação de
  // saída (fechar() só remove de verdade depois de 200ms).
  const ultimoOverlay = () => { const all = window.document.querySelectorAll('.seletor-overlay'); return all[all.length - 1]; };
  try {
    window.document.getElementById('btn-abrir-seletor-armadura')?.click();
    await new Promise(r => setTimeout(r, 20));
    ultimoOverlay()?.querySelector('.seletor-item')?.click();
    if (!(window.eval('charAtivo.inventario.armaduras') || []).length) erros.push('equipamento: seletor de armadura não adicionou nada');

    window.document.getElementById('btn-abrir-seletor-item')?.click();
    await new Promise(r => setTimeout(r, 20));
    ultimoOverlay()?.querySelector('.seletor-item')?.click();
    if (!(window.eval('charAtivo.inventario.itens') || []).length) erros.push('equipamento: seletor de item (ITENS+FERRAMENTAS) não adicionou nada');
  } catch (e) { erros.push('equipamento: seletor de armadura/item → ' + e.message); }

  // Arma/armadura/item FORA do catálogo (jog-17): preenche o formulário e
  // clica em "+ Adicionar" — confere que o peso digitado (não mais travado
  // em "—") entra certo no inventário e soma na barra de carga.
  try {
    const setVal = (id, v) => { const el = window.document.getElementById(id); el.value = v; el.dispatchEvent(new window.Event('input', { bubbles: true })); };

    setVal('add-arma-nome', 'Facão de Barovia');
    setVal('add-arma-dano', '1d8');
    setVal('add-arma-tipodano', 'Cortante');
    window.document.getElementById('add-arma-categoria').value = 'Distância';
    setVal('add-arma-propriedades', 'Acuidade, Arremesso');
    setVal('add-arma-peso', '1,5');
    window.document.getElementById('btn-add-arma-custom')?.click();
    const armasCustom = window.eval('charAtivo.inventario.armas') || [];
    const armaCustom = armasCustom.find(a => a.nome === 'Facão de Barovia');
    if (!armaCustom) erros.push('equipamento: arma fora do catálogo não foi adicionada');
    else {
      if (armaCustom.peso !== 1.5) erros.push('equipamento: peso da arma personalizada veio "' + armaCustom.peso + '" (esperava 1.5 — aceita vírgula PT-BR)');
      if (!window.Ataques?.ehDistancia(armaCustom)) erros.push('equipamento: categoria "Distância" da arma personalizada não foi reconhecida como arma à distância');
    }

    setVal('add-armadura-nome', 'Couraça de Vistani');
    setVal('add-armadura-ca', '13 + DES');
    window.document.getElementById('add-armadura-tipo').value = 'Média';
    setVal('add-armadura-forca', 'F11');
    setVal('add-armadura-peso', '8');
    window.document.getElementById('btn-add-armadura-custom')?.click();
    const armadurasCustom = window.eval('charAtivo.inventario.armaduras') || [];
    const armaduraCustom = armadurasCustom.find(a => a.nome === 'Couraça de Vistani');
    if (!armaduraCustom) erros.push('equipamento: armadura fora do catálogo não foi adicionada');
    else if (armaduraCustom.peso !== 8) erros.push('equipamento: peso da armadura personalizada veio "' + armaduraCustom.peso + '" (esperava 8)');

    setVal('add-item-nome', 'Amuleto de família');
    setVal('add-item-qtd-custom', '1');
    setVal('add-item-peso-custom', '0,3');
    window.document.getElementById('btn-add-item-custom')?.click();
    const itensCustom = window.eval('charAtivo.inventario.itens') || [];
    const itemCustom = itensCustom.find(it => it.nome === 'Amuleto de família');
    if (!itemCustom) erros.push('equipamento: item fora do catálogo não foi adicionado');
    else if (itemCustom.peso !== 0.3) erros.push('equipamento: peso do item personalizado veio "' + itemCustom.peso + '" (esperava 0.3 — antes ficava travado em "—")');

    // A barra de carga (calcularCarga) precisa refletir os 3 pesos novos —
    // senão o peso digitado "existe" no dado mas não conta pra sobrecarga.
    const cargaTxt = window.document.getElementById('carga-total')?.textContent || '';
    const cargaNum = parseFloat(cargaTxt.replace(',', '.'));
    if (!(cargaNum >= 1.5 + 8 + 0.3)) erros.push('equipamento: barra de carga (' + cargaTxt + ') não parece somar os pesos dos itens fora do catálogo');
  } catch (e) { erros.push('equipamento: adicionar fora do catálogo (com peso) → ' + e.message); }

  console.log(erros.length > antes
    ? '  FALHOU     equipamento (ver FALHAS abaixo)'
    : '  aba equipamento: seletor (busca real em PHB.ARMAS) + card de arma com bônus + rolar + remover + recentes + arma/armadura/item fora do catálogo com peso ok');
}

// Aliados (Fase 8): o "Corvo" do PJ de teste começa RECOLHIDO por padrão
// (não é o mais recente e ninguém abriu ainda); abrir mostra o stat block
// completo; os botões −/+ de PV no resumo ajustam sem abrir o card; e uma
// criatura ADICIONADA depois entra automaticamente expandida.
console.log('');
{
  const antes = erros.length;
  const sc = window.document.createElement('script');
  sc.textContent = 'tabAtiva = "aliados"; render();';
  window.document.head.appendChild(sc);

  const card = () => window.document.querySelector('.criatura-card[data-cr="0"]');
  const corpo = () => window.document.getElementById('criatura-corpo-0');
  const resumo = () => window.document.querySelector('[data-cr-toggle="0"]');

  if (!card()) erros.push('aliados: card do Corvo (companion de teste) não renderizou');
  else {
    if (!corpo() || !corpo().hidden) erros.push('aliados: card deveria começar RECOLHIDO por padrão');
    if (!/Corvo/.test(resumo()?.textContent || '')) erros.push('aliados: resumo recolhido não mostra o nome da criatura');
    if (!/PV\s*1\/1/.test((resumo()?.textContent || '').replace(/\s+/g, ' '))) erros.push('aliados: resumo recolhido não mostra PV atual/máximo');

    // Abrir: clique no resumo revela o stat block completo
    resumo()?.click();
    if (!corpo() || corpo().hidden) erros.push('aliados: clicar no resumo não abriu o card');
    else if (!corpo().querySelector('.criatura-atrs')) erros.push('aliados: card aberto não mostra os atributos (stat block completo)');
    if (resumo()?.getAttribute('aria-expanded') !== 'true') erros.push('aliados: aria-expanded não virou "true" ao abrir');

    // PV rápido no resumo NÃO deve fechar o card (dmg checado antes de toggle)
    const antesHp = window.eval('charAtivo.companions[0].hp_atual');
    resumo()?.querySelector('[data-cr-dmg="0"][data-v="-1"]')?.click();
    const depoisHp = window.eval('charAtivo.companions[0].hp_atual');
    if (depoisHp !== Math.max(0, antesHp - 1)) erros.push('aliados: botão −1 PV do resumo não ajustou o PV (antes=' + antesHp + ' depois=' + depoisHp + ')');
    if (!corpo() || corpo().hidden) erros.push('aliados: ajustar PV pelo resumo fechou o card sem querer (dmg deveria ter prioridade sobre toggle)');

    // Fechar de novo pra testar o próximo ponto com estado limpo
    resumo()?.click();
    if (!corpo() || !corpo().hidden) erros.push('aliados: clicar de novo no resumo não fechou o card');
  }

  // Adicionar uma criatura em branco → precisa nascer expandida
  try {
    const totalAntes = (window.eval('charAtivo.companions') || []).length;
    window.document.getElementById('btn-add-aliado')?.click();
    const totalDepois = (window.eval('charAtivo.companions') || []).length;
    if (totalDepois !== totalAntes + 1) erros.push('aliados: "+ Adicionar" não criou uma criatura nova');
    else {
      const novoIdx = totalDepois - 1;
      const corpoNovo = window.document.getElementById('criatura-corpo-' + novoIdx);
      if (!corpoNovo || corpoNovo.hidden) erros.push('aliados: criatura recém-adicionada deveria nascer expandida, veio recolhida');
    }
  } catch (e) { erros.push('aliados: adicionar criatura em branco → ' + e.message); }

  console.log(erros.length > antes
    ? '  FALHOU     aliados (ver FALHAS abaixo)'
    : '  aba aliados: recolhido por padrão + resumo com PV/CA/Mov/ND + abrir/fechar + PV rápido sem fechar + nova criatura nasce expandida ok');
}

// Personagem (Fase 9): fusão Identidade+Roleplay com modo leitura × edição
// global (mesmo botão Editar/Travar do header). Travado (padrão) mostra
// cards de leitura; destravado mostra o formulário de sempre com os MESMOS
// name= (a guarda de autosave em salvar.js depende disso continuar igual).
console.log('');
{
  const antes = erros.length;
  try {
    // Garante travado, entra na aba e confere o modo leitura.
    let sc = window.document.createElement('script');
    sc.textContent = 'localStorage.setItem("ficha_unlock", "0"); tabAtiva = "personagem"; render();';
    window.document.head.appendChild(sc);

    if (window.document.body.classList.contains('modo-unlock')) erros.push('personagem: body deveria estar SEM modo-unlock (travado) após localStorage="0"');
    if (window.document.querySelector('.tab-content input[name="nome"]')) erros.push('personagem: modo travado ainda renderizou o <input name="nome"> de edição (deveria ser card de leitura)');
    const grid = window.document.querySelector('.leitura-grid');
    if (!grid) erros.push('personagem: modo travado não renderizou .leitura-grid');
    else if (!new RegExp(PJ.nome).test(grid.textContent)) erros.push('personagem: .leitura-grid não mostra o nome do PJ como texto');
    if (!window.document.querySelector('.roleplay-card')) erros.push('personagem: modo travado não renderizou os cards de roleplay (.roleplay-card)');
    if (window.document.querySelector('.tab-content textarea[name="ideais"]')) erros.push('personagem: modo travado ainda renderizou <textarea name="ideais"> (deveria ser card de leitura)');
    // Campos sempre-interativos (§4: Inspiração não segue o lock geral).
    const inspLocked = window.document.querySelector('input[name="inspiracao"]');
    if (!inspLocked) erros.push('personagem: input de Inspiração não encontrado em modo travado');
    else if (!inspLocked.closest('.no-lock')) erros.push('personagem: Inspiração deveria estar marcada .no-lock (interativa mesmo travada)');
    // Traços raciais e Atributos ficam fora do vai-e-volta leitura/edição (§4).
    if (!window.document.querySelector('textarea[name="tracos_raciais"]')) erros.push('personagem: <textarea name="tracos_raciais"> deveria continuar visível mesmo travado');
    if (!window.document.querySelector('input[name="attr_for"]')) erros.push('personagem: input de atributo (attr_for) deveria continuar visível mesmo travado');

    // Sub-navegação (jog-15): 4 pills, cada uma aponta pra uma seção que
    // existe de verdade, e clicar troca qual pill fica "ativo".
    const pills = Array.from(window.document.querySelectorAll('[data-subnav]'));
    if (pills.length !== 4) erros.push('personagem: sub-navegação deveria ter 4 pills, achou ' + pills.length);
    else {
      for (const p of pills) {
        if (!window.document.getElementById(p.dataset.subnav)) erros.push('personagem: pill de sub-navegação aponta pra seção inexistente (#' + p.dataset.subnav + ')');
      }
      if (!pills[0].classList.contains('ativo')) erros.push('personagem: primeira pill (Identidade) deveria nascer "ativo"');
      pills[1].click();
      if (pills[0].classList.contains('ativo')) erros.push('personagem: clicar na 2ª pill deveria tirar "ativo" da 1ª');
      if (!pills[1].classList.contains('ativo')) erros.push('personagem: clicar na 2ª pill deveria marcá-la "ativo"');
    }

    // Destrava via o MESMO fluxo do botão do header (toggle real via clique,
    // não chamada direta a render()) — cobre o listener de header.js inteiro.
    window.document.getElementById('btn-lock-toggle')?.click();

    if (!window.document.body.classList.contains('modo-unlock')) erros.push('personagem: clicar em Editar não ativou modo-unlock');
    if (window.localStorage.getItem('ficha_unlock') !== '1') erros.push('personagem: clicar em Editar não persistiu "ficha_unlock"="1" no localStorage');
    const nomeInput = window.document.querySelector('.tab-content input[name="nome"]');
    if (!nomeInput) erros.push('personagem: modo destravado não renderizou <input name="nome">');
    else if (nomeInput.value !== PJ.nome) erros.push('personagem: <input name="nome"> destravado veio com valor errado');
    if (!window.document.querySelector('textarea[name="ideais"]')) erros.push('personagem: modo destravado não renderizou <textarea name="ideais">');
    if (window.document.querySelector('.leitura-grid')) erros.push('personagem: modo destravado ainda mostra .leitura-grid (deveria ter sumido)');
    const inspUnlocked = window.document.querySelector('input[name="inspiracao"]');
    if (!inspUnlocked || !inspUnlocked.closest('.no-lock')) erros.push('personagem: Inspiração deveria continuar .no-lock em modo destravado');

    // Multiclasse (jog-4): adicionar Guerreiro nível 4 a um Clérigo nível 9
    // cruza o degrau de bônus de proficiência (9 → 13 = +4 → +5) — confere
    // que valorSalvaguarda (que usa nivelTotalPersonagem) reflete a soma, e
    // que remover devolve tudo exatamente ao que era antes.
    try {
      const salvSabAntes = window.eval('valorSalvaguarda(charAtivo, "sab")');
      if (salvSabAntes !== 9) erros.push('multiclasse: pré-condição errada — salvaguarda de Sabedoria esperada 9 antes de multiclassar, veio ' + salvSabAntes);

      const selClasse = window.document.getElementById('mc-add-classe');
      const inpNivel = window.document.getElementById('mc-add-nivel');
      if (!selClasse || !inpNivel) erros.push('multiclasse: campos de adicionar classe secundária não encontrados');
      else {
        selClasse.value = 'Guerreiro';
        inpNivel.value = '4';
        window.document.getElementById('btn-mc-add')?.click();

        const secundarias = window.eval('charAtivo.classes_secundarias') || [];
        if (secundarias.length !== 1 || secundarias[0].classe !== 'Guerreiro' || secundarias[0].nivel !== 4) {
          erros.push('multiclasse: adicionar não gravou {classe:"Guerreiro",nivel:4} em charAtivo.classes_secundarias — ' + JSON.stringify(secundarias));
        }
        const nivelTotal = window.eval('nivelTotalPersonagem(charAtivo)');
        if (nivelTotal !== 13) erros.push('multiclasse: nível total esperado 9+4=13, veio ' + nivelTotal);
        const p = window.__ultimoUpdatePayload;
        if (!p || !('classes_secundarias' in p)) erros.push('multiclasse: adicionar não persistiu via window.sb.update()');

        const salvSabDepois = window.eval('valorSalvaguarda(charAtivo, "sab")');
        if (salvSabDepois !== 10) erros.push('multiclasse: salvaguarda de Sabedoria deveria subir de 9 pra 10 (bônus prof. 13º nível), veio ' + salvSabDepois);

        const item = window.document.querySelector('#multiclasse-lista .multiclasse-item');
        if (!item || !/Guerreiro/.test(item.textContent) || !/4/.test(item.textContent)) {
          erros.push('multiclasse: item da lista não mostra "Guerreiro"/nível 4 — ' + (item?.textContent || '(nenhum item)'));
        }

        // Remove de novo — tudo volta exatamente ao estado original.
        window.document.querySelector('[data-mc-rm="0"]')?.click();
        const secundariasDepois = window.eval('charAtivo.classes_secundarias') || [];
        if (secundariasDepois.length) erros.push('multiclasse: remover não esvaziou classes_secundarias — ' + JSON.stringify(secundariasDepois));
        const salvSabFinal = window.eval('valorSalvaguarda(charAtivo, "sab")');
        if (salvSabFinal !== 9) erros.push('multiclasse: remover a classe secundária deveria voltar a salvaguarda de Sabedoria pra 9, veio ' + salvSabFinal);
      }
    } catch (e) { erros.push('multiclasse: ' + e.message); }

    // Trava de novo pelo botão (ciclo completo) e devolve o padrão pros
    // blocos seguintes do smoke test (header etc. esperam travado).
    window.document.getElementById('btn-lock-toggle')?.click();
    if (window.document.body.classList.contains('modo-unlock')) erros.push('personagem: clicar em Travar de novo não voltou ao modo travado');
  } catch (e) { erros.push('personagem: ' + e.message); }

  console.log(erros.length > antes
    ? '  FALHOU     personagem (ver FALHAS abaixo)'
    : '  aba personagem: leitura×edição via botão Editar/Travar + Inspiração/traços-raciais/atributos sempre visíveis ok');
}

// Assistente de Criação (jog-9): 4 passos (Identidade → Atributos por
// array padrão → Perícias → Equipamento Inicial) terminando num personagem
// novo de verdade via window.sb.insert(). Usa Humano+Guerreiro+Soldado de
// propósito: o antecedente Soldado já garante Atletismo+Intimidação, que
// TAMBÉM estão na lista de escolha do Guerreiro — isso testa que o wizard
// tira essas 2 da lista de escolha (sem isso o jogador podia "escolher" uma
// perícia que já ia ganhar de graça, e o payload nunca refletia a soma
// certa de raça+classe+antecedente). Roda por ÚLTIMO entre os testes de
// estado porque cria um personagem e troca charAtivo/chars — restaura tudo
// ao original no final pra não interferir no teste de header logo abaixo.
console.log('');
{
  const antes = erros.length;
  const charsAntes = window.eval('chars.slice()');
  const charAtivoAntes = window.eval('charAtivo');
  // salvar.js chama init() no fim do próprio carregamento, que faz
  // `usuario = await window.Auth.requerLogin(...)` (stub resolve pra null) —
  // essa atribuição assíncrona só se resolve num microtask mais adiante,
  // sobrescrevendo o `usuario = {id:"u"}` da fixture. Nenhum teste anterior
  // dereferenciava usuario.id, então isso nunca apareceu — reafirma aqui
  // porque é o primeiro (criarPersonagemComWizard usa usuario.id).
  window.eval('usuario = { id: "u" };');
  // jsdom não dispara 'change' sozinho a partir de .click()/.checked de forma
  // confiável em checkbox/radio — mesmo padrão já usado no resto do arquivo:
  // marca o estado à mão e dispara o evento manualmente.
  const marcar = (el, checked) => { el.checked = checked; el.dispatchEvent(new window.Event('change', { bubbles: true })); };
  const selecionar = (el, valor) => { el.value = valor; el.dispatchEvent(new window.Event('change', { bubbles: true })); };
  try {
    const { fechar } = window.abrirWizardCriacao();
    const overlay = window.document.querySelector('.wizard-overlay');
    if (!overlay) erros.push('wizard: modal não abriu (.wizard-overlay não encontrado)');
    else {
      // Passo 1 — Identidade: TODOS os campos são obrigatórios agora.
      const nomeInp = overlay.querySelector('#wz-nome');
      const racaSel = overlay.querySelector('#wz-raca');
      const classeSel = overlay.querySelector('#wz-classe');
      const origemSel = overlay.querySelector('#wz-origem');
      const alinhamentoSel = overlay.querySelector('#wz-alinhamento');
      if (!nomeInp || !racaSel || !classeSel || !origemSel || !alinhamentoSel) erros.push('wizard: campos do Passo 1 não encontrados');
      else {
        const btnProximo = overlay.querySelector('#wizard-proximo');
        classeSel.value = 'Guerreiro';
        classeSel.dispatchEvent(new window.Event('change', { bubbles: true }));
        if (btnProximo.disabled === false) erros.push('wizard: "Próximo" não deveria habilitar só com classe preenchida (faltam nome/raça/origem/alinhamento)');
        nomeInp.value = 'Thalindra Testválida';
        nomeInp.dispatchEvent(new window.Event('input', { bubbles: true }));
        selecionar(racaSel, 'Humano');
        selecionar(origemSel, 'Soldado');
        selecionar(alinhamentoSel, 'Leal e Bom');
        if (btnProximo.disabled) erros.push('wizard: "Próximo" deveria estar habilitado com todos os campos do Passo 1 preenchidos');
        btnProximo.click();

        // Passo 2 — Atributos (Array Padrão): atribui 15/14/13/12/10/8 —
        // confere que valores já usados somem das outras opções (bijeção).
        const ordemAtributos = ['for', 'dex', 'con', 'int', 'sab', 'car'];
        const arrayPadrao = [15, 14, 13, 12, 10, 8];
        const btnProximo2 = overlay.querySelector('#wizard-proximo');
        if (btnProximo2.disabled === false) erros.push('wizard: "Próximo" não deveria habilitar antes de atribuir os 6 atributos');
        ordemAtributos.forEach((k, i) => {
          const sel = overlay.querySelector(`[data-wz-attr="${k}"]`);
          selecionar(sel, String(arrayPadrao[i]));
        });
        const selDex = overlay.querySelector('[data-wz-attr="dex"]');
        const valoresRestantesEmDex = Array.from(selDex.querySelectorAll('option')).map(o => o.value).filter(Boolean);
        if (valoresRestantesEmDex.includes('15')) erros.push('wizard: valor 15 (já usado em Força) não deveria continuar disponível em Destreza');
        if (btnProximo2.disabled) erros.push('wizard: "Próximo" deveria estar habilitado com os 6 atributos atribuídos');
        btnProximo2.click();

        // Passo 3 — Perícias: Guerreiro tem 8 opções na lista de classe, mas
        // Soldado já garante Atletismo+Intimidação de graça — essas 2 saem
        // do pool de escolha (6 restantes), sem reduzir as 2 escolhas.
        const checks = Array.from(overlay.querySelectorAll('[data-wz-pericia]'));
        if (checks.length !== 6) erros.push('wizard: pool de perícias deveria vir com 6 opções (8 do Guerreiro − 2 já garantidas pelo Soldado), veio ' + checks.length);
        if (checks.some(c => c.dataset.wzPericia === 'atletismo' || c.dataset.wzPericia === 'intimidacao')) {
          erros.push('wizard: Atletismo/Intimidação não deveriam aparecer pra escolher — já vêm fixas do antecedente Soldado');
        }
        marcar(checks[0], true);
        const checksAoVivo1 = Array.from(overlay.querySelectorAll('[data-wz-pericia]'));
        marcar(checksAoVivo1.find(c => c.dataset.wzPericia === checks[1].dataset.wzPericia), true);
        const btnProximo3 = overlay.querySelector('#wizard-proximo');
        if (btnProximo3.disabled) erros.push('wizard: "Próximo" continua desabilitado com 2/2 perícias escolhidas');
        btnProximo3.click();

        // Passo 4 — Equipamento Inicial: antecedente (Soldado) + classe
        // (Guerreiro). "Criar Personagem" deve continuar desabilitado até
        // toda escolha (ferramenta + grupos de equipamento) ser feita.
        const btnCriar = overlay.querySelector('#wizard-criar');
        if (!btnCriar.disabled) erros.push('wizard: "Criar Personagem" não deveria habilitar antes de preencher o equipamento');

        // Soldado: 1 kit/jogo à escolha.
        selecionar(overlay.querySelector('[data-slot-key="ferr:0"]'), 'Jogo de Dados');

        // Guerreiro, grupo 0 (Armadura) — ambas as opções já vêm fixas
        // (sem sub-escolha), só precisa marcar o radio.
        marcar(overlay.querySelector('[data-grupo="0"][data-opcao="0"]'), true);

        // Grupo 1 (Arma principal) — opção 0 tem uma sub-escolha de arma
        // marcial. Precisa re-renderizar antes de achar o <select> que só
        // aparece depois do radio marcado (mesmo padrão de "nós trocam" já
        // usado no resto deste teste).
        marcar(overlay.querySelector('[data-grupo="1"][data-opcao="0"]'), true);
        selecionar(overlay.querySelector('[data-slot-key="1:0:0"]'), 'Espada Longa');

        // Grupos 2 (Arma secundária) e 3 (Pacote) — ambas as opções são fixas.
        marcar(overlay.querySelector('[data-grupo="2"][data-opcao="0"]'), true);
        marcar(overlay.querySelector('[data-grupo="3"][data-opcao="0"]'), true);

        if (btnCriar.disabled) erros.push('wizard: "Criar Personagem" continua desabilitado depois de preencher toda escolha de equipamento');

        window.__ultimoInsertPayload = null;
        btnCriar.click();
        await Promise.resolve().then(() => {}).then(() => {});

        if (window.document.querySelector('.wizard-overlay')) erros.push('wizard: modal não fechou após criar o personagem');
        const ins = window.__ultimoInsertPayload;
        if (!ins) erros.push('wizard: "Criar Personagem" não chamou window.sb.insert()');
        else {
          if (ins.nome !== 'Thalindra Testválida') erros.push('wizard: nome não foi pro payload — ' + ins.nome);
          if (ins.classe !== 'Guerreiro') erros.push('wizard: classe não foi pro payload — ' + ins.classe);
          if (ins.origem !== 'Soldado') erros.push('wizard: origem (antecedente) não foi pro payload — ' + ins.origem);
          if (ins.alinhamento !== 'Leal e Bom') erros.push('wizard: alinhamento não foi pro payload — ' + ins.alinhamento);
          if (ins.nivel !== 1) erros.push('wizard: nível deveria ser 1, veio ' + ins.nivel);
          if (ins.atributos?.for !== 15) erros.push('wizard: atributos.for deveria ser 15, veio ' + ins.atributos?.for);
          if (ins.dado_vida_tipo !== 10) erros.push('wizard: Guerreiro usa d10, veio dado_vida_tipo=' + ins.dado_vida_tipo);
          if (ins.hp_max !== ins.hp_atual || ins.hp_max < 1) erros.push('wizard: hp_max/hp_atual não vieram consistentes — ' + JSON.stringify({hp_max: ins.hp_max, hp_atual: ins.hp_atual}));
          if (!ins.salvaguardas?.for || !ins.salvaguardas?.con) erros.push('wizard: salvaguardas de Guerreiro (FOR/CON) não vieram proficientes — ' + JSON.stringify(ins.salvaguardas));
          // 2 escolhidas + Atletismo/Intimidação fixas do antecedente = 4.
          const periciasEscolhidas = Object.keys(ins.pericias || {});
          if (periciasEscolhidas.length !== 4) erros.push('wizard: payload deveria ter 4 perícias (2 escolhidas + 2 fixas do antecedente), veio ' + JSON.stringify(ins.pericias));
          if (!ins.pericias?.atletismo?.prof || !ins.pericias?.intimidacao?.prof) erros.push('wizard: perícias fixas do antecedente Soldado (Atletismo/Intimidação) não vieram no payload — ' + JSON.stringify(ins.pericias));
          if (!Array.isArray(ins.ferramentas) || !ins.ferramentas.includes('Jogo de Dados')) erros.push('wizard: proficiência de ferramenta escolhida (Jogo de Dados) não veio no payload — ' + JSON.stringify(ins.ferramentas));
          if (ins.inventario?.moedas?.po !== 10) erros.push('wizard: ouro inicial do antecedente Soldado deveria ser 10 po, veio ' + JSON.stringify(ins.inventario?.moedas));
          const nomesArmas = (ins.inventario?.armas || []).map(a => a.nome);
          if (!nomesArmas.includes('Espada Longa')) erros.push('wizard: arma marcial escolhida (Espada Longa) não veio no inventário — ' + JSON.stringify(nomesArmas));
          const nomesArmaduras = (ins.inventario?.armaduras || []).map(a => a.nome);
          if (!nomesArmaduras.includes('Cota de Malha')) erros.push('wizard: armadura escolhida (Cota de Malha) não veio no inventário — ' + JSON.stringify(nomesArmaduras));
        }
        if (window.eval('charAtivo.nome') !== 'Thalindra Testválida') erros.push('wizard: charAtivo não foi trocado pro personagem recém-criado');
      }
    }
  } catch (e) { erros.push('wizard: ' + e.message); }

  // Restaura o estado global pros testes seguintes (header/nav). chars/charAtivo
  // são `let` no escopo do script da jsdom — não viram propriedade de
  // `window`, só dá pra mexer neles via window.eval (mesmo padrão do resto
  // do arquivo).
  window.__charsRestaurar = charsAntes;
  window.__charAtivoRestaurar = charAtivoAntes;
  window.eval('chars = window.__charsRestaurar; charAtivo = window.__charAtivoRestaurar;');
  window.document.querySelector('.wizard-overlay')?.remove();

  console.log(erros.length > antes
    ? '  FALHOU     assistente de criação (ver FALHAS abaixo)'
    : '  assistente de criação: identidade obrigatória + array padrão + perícias sem duplicar raça/antecedente + equipamento inicial + insert() ok');
}

// Exportar Ficha em PDF (exportar_pdf.js): preenche o modelo REAL de
// docs/fichas/*.pdf (via o fetch mock acima, que serve o arquivo de verdade
// do disco) com a fixture Lilith Goldengrove (Clérigo 9, Domínio da Morte)
// e reabre o PDF gerado com PDFLib pra conferir campo por campo — não basta
// "não quebrou": um nome de campo errado silenciosamente não preenche nada,
// então o teste precisa reabrir o resultado, não só rodar a função.
console.log('');
{
  const antes = erros.length;
  // Testes anteriores (ex.: Gastar Dado de Vida) editam #ficha-form e cada
  // render() re-liga um autosave debounce de 800ms (listeners.js) NOVO sem
  // cancelar o anterior (a chave do Map é a própria closure da função, que
  // muda a cada render) — o timer antigo aponta pro <form> antigo (já fora
  // do DOM) e, se disparar durante QUALQUER await daqui pra frente, chama
  // salvar() nesse form desatualizado e sobrescreve charAtivo com valor
  // velho (Object.assign em salvar.js). Zera os timers pendentes antes de
  // montar a fixture, senão o PDF pode sair com PV/CA velhos de um teste
  // completamente diferente.
  window.eval('if (typeof _debounceTimers !== "undefined") { _debounceTimers.forEach(t => clearTimeout(t)); _debounceTimers.clear(); }');
  window.eval('charAtivo = ' + JSON.stringify(PJ) + ';');
  window.__magiasFavoritasTeste = ['Bênção', 'Arma Espiritual', 'Augúrio']; // nivel 1, 2, 2(ritual) — testa ordenação por nível
  window.__ultimoBlobPDF = null;
  try {
    await window.exportarFichaPDF();
    const blob = window.__ultimoBlobPDF;
    if (!blob) erros.push('exportar pdf: URL.createObjectURL não foi chamado — exportarFichaPDF() não gerou/baixou nada');
    else {
      // Sem envolver em `new Uint8Array(...)` daqui de fora: isso criaria
      // um typed array do realm do NODE (não da jsdom window), e pdf-lib
      // faz `instanceof` internamente — passa o ArrayBuffer puro (já é do
      // realm certo, veio de window.Blob.arrayBuffer()), que também é um
      // tipo aceito por PDFDocument.load().
      const bytes = await blob.arrayBuffer();
      const doc = await window.PDFLib.PDFDocument.load(bytes);
      const form = doc.getForm();
      const texto = nome => { try { return form.getTextField(nome).getText() || ''; } catch { return undefined; } };
      const marcado = nome => { try { return form.getCheckBox(nome).isChecked(); } catch { return undefined; } };

      // Identidade + atributos + salvaguardas + perícias
      if (texto('Front_Character Name') !== 'Lilith Goldengrove') erros.push('exportar pdf: Front_Character Name veio "' + texto('Front_Character Name') + '"');
      if (texto('Front_Race') !== 'Humano') erros.push('exportar pdf: Front_Race veio "' + texto('Front_Race') + '"');
      if (texto('Front_Background') !== 'Acólito') erros.push('exportar pdf: Front_Background veio "' + texto('Front_Background') + '"');
      if (texto('Front_Level') !== '9') erros.push('exportar pdf: Front_Level veio "' + texto('Front_Level') + '"');
      if (texto('Front_Archetype') !== 'Domínio da Morte') erros.push('exportar pdf: Front_Archetype veio "' + texto('Front_Archetype') + '"');
      if (texto('Front_Wis Score') !== '20') erros.push('exportar pdf: Front_Wis Score veio "' + texto('Front_Wis Score') + '" (esperava 20)');
      if (texto('Front_Wis Mod') !== '+5') erros.push('exportar pdf: Front_Wis Mod veio "' + texto('Front_Wis Mod') + '" (esperava +5)');
      if (marcado('Front_Save Wis') !== true) erros.push('exportar pdf: Front_Save Wis deveria vir marcado (proficiente)');
      if (texto('Front_Wis Save Throw') !== '+9') erros.push('exportar pdf: Front_Wis Save Throw veio "' + texto('Front_Wis Save Throw') + '" (esperava +9)');
      if (texto('Front_Cha Save Throw') !== '+5') erros.push('exportar pdf: Front_Cha Save Throw veio "' + texto('Front_Cha Save Throw') + '" (esperava +5, salvaguarda com bônus manual +1)');
      if (marcado('Front_Proficiency Religion') !== true) erros.push('exportar pdf: Front_Proficiency Religion deveria vir marcado');
      if (texto('Front_Skill Religion') !== '+7') erros.push('exportar pdf: Front_Skill Religion veio "' + texto('Front_Skill Religion') + '" (esperava +7 — INT +1, prof +4, bônus manual +2)');
      if (texto('Front_Passive Perception') !== '23') erros.push('exportar pdf: Front_Passive Perception veio "' + texto('Front_Passive Perception') + '" (esperava 23 — perícia com expertise)');

      // Combate
      if (texto('Front_AC') !== '18') erros.push('exportar pdf: Front_AC veio "' + texto('Front_AC') + '"');
      if (texto('Front_Max HP') !== '67' || texto('Front_Current HP') !== '42' || texto('Front_Temp HP') !== '5') {
        erros.push('exportar pdf: PV não veio consistente — ' + JSON.stringify({ max: texto('Front_Max HP'), atual: texto('Front_Current HP'), temp: texto('Front_Temp HP') }));
      }
      if (texto('Front_Weapon Name 1') !== 'Maça') erros.push('exportar pdf: Front_Weapon Name 1 veio "' + texto('Front_Weapon Name 1') + '"');

      // Página 2
      if (texto('Back_Personality Traits') !== 'Idolatro um herói.') erros.push('exportar pdf: Back_Personality Traits não veio da ficha');
      if (texto('Back_CP') !== '8' || texto('Back_SP') !== '3' || texto('Back_GP') !== '120') {
        erros.push('exportar pdf: moedas na página 2 vieram erradas — ' + JSON.stringify({ cp: texto('Back_CP'), sp: texto('Back_SP'), gp: texto('Back_GP') }));
      }

      // Habilidade fixa de classe + característica de SUBCLASSE (Domínio da Morte)
      if (!/Destrui..o Inevit.vel/.test(texto('Front_Domain Feature 6') || '')) erros.push('exportar pdf: Front_Domain Feature 6 deveria citar "Destruição Inevitável", veio "' + texto('Front_Domain Feature 6') + '"');
      if (texto('Front_Domain Feature 17')) erros.push('exportar pdf: Front_Domain Feature 17 (nível 17) não deveria vir preenchido pra um PJ de nível 9');
      const chDivDominio = texto('Front_Channel Divinity Domain') || '';
      if (!chDivDominio.startsWith('Toque da Morte:') || chDivDominio.length < 30) erros.push('exportar pdf: Front_Channel Divinity Domain veio "' + chDivDominio + '" (esperava "Toque da Morte: <descrição completa>", não só o nome nem a versão base de Expulsar Mortos-Vivos)');

      // O texto por si só não prova que RENDERIZA inteiro (getText() devolve
      // a string mesmo que a caixa a corte visualmente) — recalcula com a
      // MESMA lógica de medição (window.medirLinhas/tamanhoQueCabe, expostas
      // por serem function declaration de topo num script clássico) usando
      // o tamanho de fonte que ficou gravado no campo, e confere se aquele
      // texto INTEIRO cabe na altura real da caixa. Pega tanto "estourou
      // porque ficou grande demais" (bug original) quanto "cortou porque o
      // tamanho fixo era grande demais pro texto comprido" (regressão que
      // um 8pt fixo introduziria).
      const fonteMedida = form.getDefaultFont();
      const conferirCabeDeVerdade = (nomeCampo, textoEsperado) => {
        const campo = form.getTextField(nomeCampo);
        const da = campo.acroField.getDefaultAppearance() || '';
        const tamanho = parseFloat((da.match(/([\d.]+)\s+Tf/) || [])[1] || '0');
        const rect = campo.acroField.getWidgets()[0].getRectangle();
        if (!tamanho) { erros.push(`exportar pdf: ${nomeCampo} não tem tamanho de fonte definido (DA="${da}")`); return; }
        const linhas = window.medirLinhas(fonteMedida, textoEsperado, tamanho, rect.width - 8);
        const alturaPrecisa = linhas.length * tamanho * 1.25;
        if (alturaPrecisa > rect.height - 8) {
          erros.push(`exportar pdf: ${nomeCampo} não cabe de verdade na caixa — ${linhas.length} linhas a ${tamanho}pt (~${alturaPrecisa.toFixed(0)}pt de altura) numa caixa de ${rect.height.toFixed(0)}pt`);
        }
      };
      conferirCabeDeVerdade('Front_Domain Feature 1', texto('Front_Domain Feature 1'));
      conferirCabeDeVerdade('Front_Channel Divinity Domain', chDivDominio);
      conferirCabeDeVerdade('Front_Racial Traits', texto('Front_Racial Traits'));

      // Conjuração: DC/ataque + lista ordenada por nível (Favoritas = spell_lists)
      if (texto('Front_Cantrips Known') !== '4') erros.push('exportar pdf: Front_Cantrips Known veio "' + texto('Front_Cantrips Known') + '"');
      if (texto('Front_Spell DC') !== '17') erros.push('exportar pdf: Front_Spell DC veio "' + texto('Front_Spell DC') + '"');
      if (texto('Front_Spell Atk') !== '+9') erros.push('exportar pdf: Front_Spell Atk veio "' + texto('Front_Spell Atk') + '"');
      if (texto('Front_Spell Level 1') !== '1' || texto('Front_Spell Name 1') !== 'Bênção') erros.push('exportar pdf: linha 1 da lista de magias deveria ser Bênção (nível 1), veio ' + JSON.stringify({ nivel: texto('Front_Spell Level 1'), nome: texto('Front_Spell Name 1') }));
      if (texto('Front_Spell Level 2') !== '2' || texto('Front_Spell Name 2') !== 'Arma Espiritual') erros.push('exportar pdf: linha 2 deveria ser Arma Espiritual (nível 2), veio ' + JSON.stringify({ nivel: texto('Front_Spell Level 2'), nome: texto('Front_Spell Name 2') }));
      if (texto('Front_Spell Name 3') !== 'Augúrio' || marcado('Front_Spell Ritual 3') !== true) erros.push('exportar pdf: linha 3 deveria ser Augúrio com Ritual marcado — ' + JSON.stringify({ nome: texto('Front_Spell Name 3'), ritual: marcado('Front_Spell Ritual 3') }));
    }

    // Com mais de 1 personagem, trocar de PJ (mesmo caminho do <select> do
    // header — atribui charAtivo direto) e exportar de novo tem que gerar o
    // PDF do PJ ATUAL, não sempre o primeiro. Usa um 2º PJ de outra classe
    // (Guerreiro) pra também confirmar que troca o MODELO de PDF certo.
    window.__magiasFavoritasTeste = null;
    const PJ2 = { ...PJ, id: 'z', nome: 'Aventureiro Dois', classe: 'Guerreiro', subclasse: '', nivel: 5,
      atributos: { for: 18, dex: 12, con: 14, int: 10, sab: 10, car: 8 },
      salvaguardas: { for: true, con: true }, pericias: { atletismo: { prof: true } },
      dado_vida_tipo: 10, dado_vida_atual: 5,
      inventario: { moedas: { po: 5, pp: 0, pe: 0, pc: 0, pl: 0 }, armas: [], armaduras: [], itens: [] } };
    window.eval('chars.push(' + JSON.stringify(PJ2) + '); charAtivo = chars.find(c => c.id === "z");');
    window.__ultimoBlobPDF = null;
    await window.exportarFichaPDF();
    if (!window.__ultimoBlobPDF) erros.push('exportar pdf (2º personagem): não gerou nada após trocar de PJ');
    else {
      const bytes2 = await window.__ultimoBlobPDF.arrayBuffer();
      const doc2 = await window.PDFLib.PDFDocument.load(bytes2);
      const nome2 = (() => { try { return doc2.getForm().getTextField('Front_Character Name').getText(); } catch { return undefined; } })();
      if (nome2 !== 'Aventureiro Dois') erros.push('exportar pdf (2º personagem): depois de trocar de PJ, Front_Character Name veio "' + nome2 + '" (esperava "Aventureiro Dois" — exportou o PJ errado)');
    }

    // Diálogo de opções (jog-18): desmarcar "Pontos de Vida" e "Recursos
    // usados" tem que deixar esses campos em BRANCO no PDF (pro jogador
    // preencher na mesa), sem afetar o resto (identidade, atributos,
    // perícias etc. continuam vindo preenchidos igual). Bardo pra também
    // cobrir Front_Inspiration Used/Total (CAMPOS_RECURSO).
    const PJ3 = { ...PJ, id: 'w', nome: 'Bardo de Teste', classe: 'Bardo', subclasse: '', nivel: 4,
      hp_atual: 20, hp_max: 28, hp_temp: 2, dado_vida_atual: 3, inspiracao: 1,
      recursos_usados: { inspiracao_bardica: 1 },
      atributos: { for: 8, dex: 14, con: 12, sab: 10, int: 10, car: 16 },
      salvaguardas: { dex: true, car: true }, pericias: { persuasao: { prof: true } },
      inventario: { moedas: { po: 0, pp: 0, pe: 0, pc: 0, pl: 0 }, armas: [], armaduras: [], itens: [] } };
    window.eval('chars.push(' + JSON.stringify(PJ3) + '); charAtivo = chars.find(c => c.id === "w");');
    window.__ultimoBlobPDF = null;
    await window.exportarFichaPDF({ pv: false, recursos: false });
    if (!window.__ultimoBlobPDF) erros.push('exportar pdf (opções desmarcadas): não gerou nada');
    else {
      const bytes3 = await window.__ultimoBlobPDF.arrayBuffer();
      const form3 = (await window.PDFLib.PDFDocument.load(bytes3)).getForm();
      const t3 = nome => { try { return form3.getTextField(nome).getText() || ''; } catch { return undefined; } };
      if (t3('Front_Character Name') !== 'Bardo de Teste') erros.push('exportar pdf (opções desmarcadas): identidade não devia ser afetada, Front_Character Name veio "' + t3('Front_Character Name') + '"');
      if (t3('Front_Max HP') || t3('Front_Current HP') || t3('Front_Temp HP') || t3('Front_Used Hit Dice')) {
        erros.push('exportar pdf (opções desmarcadas): PV/Dado de Vida deveriam vir em branco com pv:false — ' + JSON.stringify({ max: t3('Front_Max HP'), atual: t3('Front_Current HP'), temp: t3('Front_Temp HP'), dvUsado: t3('Front_Used Hit Dice') }));
      }
      if (t3('Front_Inspiration')) erros.push('exportar pdf (opções desmarcadas): Inspiração deveria vir em branco com recursos:false, veio "' + t3('Front_Inspiration') + '"');
      if (t3('Front_Inspiration Used')) erros.push('exportar pdf (opções desmarcadas): Front_Inspiration Used (recurso Inspiração Bárdica) deveria vir em branco com recursos:false, veio "' + t3('Front_Inspiration Used') + '"');
      if (!t3('Front_Inspiration Total')) erros.push('exportar pdf (opções desmarcadas): Front_Inspiration Total NÃO devia ser afetado por recursos:false (só o "usado" é sessão) — veio em branco');
    }

    // Confirma que, sem passar opções (chamada direta, como o teste principal
    // já fez lá em cima), o padrão continua sendo preencher tudo — ninguém
    // que já usava exportarFichaPDF() direto deveria ver menos coisa agora.
    window.eval('charAtivo = chars.find(c => c.id === "w");');
    window.__ultimoBlobPDF = null;
    await window.exportarFichaPDF();
    if (window.__ultimoBlobPDF) {
      const bytesPadrao = await window.__ultimoBlobPDF.arrayBuffer();
      const formPadrao = (await window.PDFLib.PDFDocument.load(bytesPadrao)).getForm();
      const hpPadrao = (() => { try { return formPadrao.getTextField('Front_Max HP').getText(); } catch { return ''; } })();
      if (hpPadrao !== '28') erros.push('exportar pdf: chamada sem opções (padrão) deveria preencher PV normalmente, Front_Max HP veio "' + hpPadrao + '"');
    }
  } catch (e) { erros.push('exportar pdf: ' + e.message); }
  window.__magiasFavoritasTeste = null;

  console.log(erros.length > antes
    ? '  FALHOU     exportar ficha em pdf (ver FALHAS abaixo)'
    : '  exportar ficha em pdf: modelo real da classe + identidade/atributos/perícias/combate/página 2 + característica de subclasse + lista de magias ordenada ok');
}

// Realtime — onUpdateExterno() (nucleo.js): o guard de eco só deve ignorar
// o PRÓPRIO save desta aba (mesmo updated_by + salvou há pouco), não
// QUALQUER update na janela de 3s — senão um update de verdade do Mestre
// que chegasse perto de qualquer autosave do jogador (comuníssimo: o
// autosave dispara a cada ~800ms de digitação) era descartado sem mais,
// e o próximo autosave do jogador reescrevia por cima com o dado velho.
console.log('');
{
  const antes = erros.length;
  try {
    window.eval('_ultimoSaveLocal = Date.now();'); // "acabei de salvar algo" há poucos ms
    const base = window.eval('JSON.parse(JSON.stringify(charAtivo))');
    base.pericias = { ...(base.pericias || {}), percepcao: { prof: true, bonus: 5 } };

    // Update de OUTRA pessoa (Mestre) chegando na mesma janela de 3s —
    // não pode ser descartado.
    window.eval('window.document.activeElement && window.document.activeElement.blur && window.document.activeElement.blur();');
    window.__eventoExternoTeste = { ...base, updated_by: 'mestre-outro-id' };
    window.eval('onUpdateExterno(window.__eventoExternoTeste)');
    const bonusAplicado = window.eval('charAtivo.pericias?.percepcao?.bonus');
    if (bonusAplicado !== 5) erros.push(`realtime: update do Mestre dentro da janela de 3s do echo-guard foi descartado (esperava bonus=5, veio ${bonusAplicado})`);

    // Update com o MESMO updated_by desta aba, na mesma janela — esse sim
    // deve ser ignorado (eco do próprio save).
    window.eval('_ultimoSaveLocal = Date.now();');
    const base2 = window.eval('JSON.parse(JSON.stringify(charAtivo))');
    base2.pericias = { ...(base2.pericias || {}), percepcao: { prof: true, bonus: 999 } };
    window.__eventoEcoTeste = { ...base2, updated_by: 'u' }; // 'u' == usuario.id da fixture
    window.eval('onUpdateExterno(window.__eventoEcoTeste)');
    const bonusAposEco = window.eval('charAtivo.pericias?.percepcao?.bonus');
    if (bonusAposEco === 999) erros.push('realtime: eco do PRÓPRIO save (mesmo updated_by) deveria ter sido ignorado, mas foi aplicado');
  } catch (e) { erros.push('realtime: onUpdateExterno → ' + e.message); }
  console.log(erros.length > antes
    ? '  FALHOU     realtime: guard de eco (ver FALHAS abaixo)'
    : '  realtime: update do Mestre não é descartado por echo-guard + eco do próprio save continua ignorado ok');
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

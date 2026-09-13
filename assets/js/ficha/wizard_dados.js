// assets/js/ficha/wizard_dados.js
// Dados de regras do PHB 5e usados SÓ pelo Assistente de Criação de
// Personagem (wizard_criacao.js): antecedentes (com perícias/ferramentas/
// idiomas/equipamento fixos), perícias concedidas por raça, equipamento
// inicial por classe e o array padrão de atributos. Carrega depois de
// nucleo.js (usa PERICIAS) e depois de phb_catalogo.js (usa window.PHB
// pra resolver nome → estatísticas de arma/armadura/item/ferramenta).

// PHB, "Variante: Array Padrão" (cap. 1) — 6 valores fixos, um por
// atributo, à escolha do jogador (bônus racial é somado depois, na ficha).
const ARRAY_PADRAO = [15, 14, 13, 12, 10, 8];

// Perícias concedidas por RAÇA (fixas ou de escolha livre) — PHB cap. 2.
// Chave = nome exato de RACAS (nucleo.js). Raças sem entrada aqui não
// concedem perícia por traço racial no PHB básico.
const PERICIAS_POR_RACA = {
  'Elfo':      { fixas: ['percepcao'] },               // Sentidos Aguçados
  'Meio-Elfo': { escolhas: 2 },                        // Versatilidade em Perícia (qualquer 2)
  'Meio-Orc':  { fixas: ['intimidacao'] },              // Ameaçador
};

// Idiomas do PHB (Comum já é concedido a todos por padrão — não entra
// aqui como opção, só os que um antecedente concede "à sua escolha").
const IDIOMAS_PHB = [
  'Anão', 'Élfico', 'Gigante', 'Gnomo', 'Goblin', 'Halfling', 'Orc',
  'Abissal', 'Celestial', 'Dracônico', 'Infernal', 'Primordial', 'Silvestre', 'Subcomum',
];

// Subconjuntos de itens do catálogo (assets/js/phb_catalogo.js) usados como
// opções de escolha (ex.: "um foco arcano à sua escolha").
const FOCOS_ARCANOS = ['Foco Arcano (bastão)', 'Foco Arcano (cajado)', 'Foco Arcano (cristal)', 'Foco Arcano (orbe)', 'Foco Arcano (varinha)'];
const FOCOS_DRUIDICOS = ['Foco Druídico (azevinho)', 'Foco Druídico (cajado totêmico)', 'Foco Druídico (visco)'];
const SIMBOLOS_SAGRADOS = ['Símbolo Sagrado (amuleto)', 'Símbolo Sagrado (emblema)', 'Símbolo Sagrado (relicário)'];

// ─── Esquema de "slot" de equipamento ───────────────────────────────
// Cada slot descreve UM item a resolver. Formatos possíveis:
//   { tabela:'ARMAS', nome:'Adaga' }                         → item fixo
//   { tabela:'ARMAS', categorias:['Simples corpo-a-corpo'] } → escolha por categoria do catálogo
//   { tabela:'ITENS', opcoes:[...nomes] }                    → escolha entre nomes explícitos
//   { custom:'Um texto livre de sabor', qtd:1 }              → item de sabor (sem stats), não precisa catálogo
// `tabela` ∈ 'ARMAS'|'ARMADURAS'|'ITENS'|'FERRAMENTAS'. `qtd` opcional (padrão 1).
function slotPrecisaEscolha(slot) {
  return !!(slot.categorias || slot.opcoes);
}
function opcoesDoSlot(slot) {
  if (slot.opcoes) return slot.opcoes;
  if (slot.categorias) {
    const tab = (window.PHB && window.PHB[slot.tabela]) || [];
    return tab.filter(x => slot.categorias.includes(x.categoria)).map(x => x.nome);
  }
  return [];
}
function resolverItemCatalogo(tabela, nome) {
  const tab = (window.PHB && window.PHB[tabela]) || [];
  return tab.find(x => x.nome === nome) || { nome };
}

// ─── Antecedentes (Backgrounds) do PHB 5e ───────────────────────────
// pericias: sempre 2, fixas (o antecedente do PHB nunca dá escolha de
// perícia). ferramentas/idiomas: array de slots (fixo) ou {escolhas:N}
// (de escolha livre, sem categoria fixa). equipamento: array de slots.
const BACKGROUNDS_PHB = [
  {
    nome: 'Acólito',
    pericias: ['intuicao', 'religiao'],
    idiomas: { escolhas: 2 },
    ferramentas: [],
    equipamento: [
      { tabela: 'ITENS', opcoes: SIMBOLOS_SAGRADOS },
      { custom: 'Livro de orações ou roda de orações', qtd: 1 },
      { tabela: 'ITENS', nome: 'Incenso (bloco)', qtd: 5 },
      { tabela: 'ITENS', nome: 'Vestes Religiosas' },
      { tabela: 'ITENS', nome: 'Vestes Comuns' },
    ],
    ouro: 15,
  },
  {
    nome: 'Charlatão',
    pericias: ['enganacao', 'prestidigitacao'],
    idiomas: { escolhas: 0 },
    ferramentas: [
      { tabela: 'FERRAMENTAS', nome: 'Kit de Disfarce' },
      { tabela: 'FERRAMENTAS', nome: 'Kit de Falsificação' },
    ],
    equipamento: [
      { tabela: 'ITENS', nome: 'Vestes Finas' },
      { custom: 'Ferramentas de vigarice (dez frascos de líquido colorido, dados viciados, baralho marcado, anel de sinete de duque imaginário)', qtd: 1 },
    ],
    ouro: 15,
  },
  {
    nome: 'Criminoso',
    pericias: ['enganacao', 'furtividade'],
    idiomas: { escolhas: 0 },
    ferramentas: [
      { tabela: 'FERRAMENTAS', categorias: ['Jogo'] },
      { tabela: 'FERRAMENTAS', nome: 'Ferramentas de Ladrão' },
    ],
    equipamento: [
      { custom: 'Pé-de-cabra', qtd: 1 },
      { tabela: 'ITENS', nome: 'Manto com Capuz' },
      { tabela: 'ITENS', nome: 'Vestes Comuns' },
    ],
    ouro: 15,
  },
  {
    nome: 'Artista',
    pericias: ['acrobacia', 'atuacao'],
    idiomas: { escolhas: 0 },
    ferramentas: [
      { tabela: 'FERRAMENTAS', nome: 'Kit de Disfarce' },
      { tabela: 'FERRAMENTAS', categorias: ['Instrumento'] },
    ],
    equipamento: [
      { custom: 'O favor de um admirador (uma carta de amor, uma mecha de cabelo ou um pequeno amuleto)', qtd: 1 },
      { custom: 'Uma fantasia', qtd: 1 },
    ],
    ouro: 15,
  },
  {
    nome: 'Herói do Povo',
    pericias: ['adestrar_animais', 'sobrevivencia'],
    idiomas: { escolhas: 0 },
    ferramentas: [
      { tabela: 'FERRAMENTAS', categorias: ['Artesão'] },
    ],
    equipamento: [
      { custom: 'Uma pá', qtd: 1 },
      { tabela: 'ITENS', nome: 'Panela de Ferro' },
      { tabela: 'ITENS', nome: 'Vestes Comuns' },
    ],
    ouro: 10,
  },
  {
    nome: 'Artesão de Guilda',
    pericias: ['intuicao', 'persuasao'],
    idiomas: { escolhas: 1 },
    ferramentas: [
      { tabela: 'FERRAMENTAS', categorias: ['Artesão'] },
    ],
    equipamento: [
      { custom: 'Uma carta de apresentação da sua guilda', qtd: 1 },
      { tabela: 'ITENS', nome: 'Vestes de Viajante' },
    ],
    ouro: 15,
  },
  {
    nome: 'Eremita',
    pericias: ['medicina', 'religiao'],
    idiomas: { escolhas: 1 },
    ferramentas: [
      { tabela: 'FERRAMENTAS', nome: 'Kit de Erveiro' },
    ],
    equipamento: [
      { custom: 'Um estojo de pergaminhos cheio de anotações de seus estudos ou orações', qtd: 1 },
      { tabela: 'ITENS', nome: 'Cobertor' },
      { tabela: 'ITENS', nome: 'Vestes Comuns' },
    ],
    ouro: 5,
  },
  {
    nome: 'Nobre',
    pericias: ['historia', 'persuasao'],
    idiomas: { escolhas: 1 },
    ferramentas: [
      { tabela: 'FERRAMENTAS', categorias: ['Jogo'] },
    ],
    equipamento: [
      { tabela: 'ITENS', nome: 'Vestes Finas' },
      { custom: 'Um anel de sinete', qtd: 1 },
      { custom: 'Um pergaminho de linhagem', qtd: 1 },
    ],
    ouro: 25,
  },
  {
    nome: 'Forasteiro',
    pericias: ['atletismo', 'sobrevivencia'],
    idiomas: { escolhas: 1 },
    ferramentas: [
      { tabela: 'FERRAMENTAS', categorias: ['Instrumento'] },
    ],
    equipamento: [
      { custom: 'Um bastão', qtd: 1 },
      { tabela: 'ITENS', nome: 'Armadilha de Caça' },
      { custom: 'Um troféu de um animal que você matou', qtd: 1 },
      { tabela: 'ITENS', nome: 'Vestes de Viajante' },
    ],
    ouro: 10,
  },
  {
    nome: 'Sábio',
    pericias: ['arcanismo', 'historia'],
    idiomas: { escolhas: 2 },
    ferramentas: [],
    equipamento: [
      { tabela: 'ITENS', nome: 'Tinta (frasco de 30 ml)' },
      { tabela: 'ITENS', nome: 'Pena' },
      { custom: 'Uma pequena faca', qtd: 1 },
      { custom: 'Uma carta de um colega falecido questionando algo que você ainda não respondeu', qtd: 1 },
      { tabela: 'ITENS', nome: 'Vestes Comuns' },
    ],
    ouro: 10,
  },
  {
    nome: 'Marinheiro',
    pericias: ['atletismo', 'percepcao'],
    idiomas: { escolhas: 0 },
    ferramentas: [
      { tabela: 'FERRAMENTAS', nome: 'Ferramentas de Navegação' },
    ],
    equipamento: [
      { custom: 'Uma cavilha de amarração (uso de clava)', qtd: 1 },
      { custom: '15 metros de corda de seda', qtd: 1 },
      { custom: 'Um amuleto da sorte (pé de coelho ou pedra com um furo no centro)', qtd: 1 },
      { tabela: 'ITENS', nome: 'Vestes Comuns' },
    ],
    ouro: 10,
  },
  {
    nome: 'Soldado',
    pericias: ['atletismo', 'intimidacao'],
    idiomas: { escolhas: 0 },
    ferramentas: [
      { tabela: 'FERRAMENTAS', categorias: ['Jogo'] },
    ],
    equipamento: [
      { custom: 'Uma insígnia de patente', qtd: 1 },
      { custom: 'Um troféu tirado de um inimigo caído', qtd: 1 },
      { tabela: 'ITENS', nome: 'Vestes Comuns' },
    ],
    ouro: 10,
  },
  {
    nome: 'Órfão de Rua',
    pericias: ['prestidigitacao', 'furtividade'],
    idiomas: { escolhas: 0 },
    ferramentas: [
      { tabela: 'FERRAMENTAS', nome: 'Kit de Disfarce' },
      { tabela: 'FERRAMENTAS', nome: 'Ferramentas de Ladrão' },
    ],
    equipamento: [
      { custom: 'Uma pequena faca', qtd: 1 },
      { custom: 'Um mapa da cidade onde você cresceu', qtd: 1 },
      { custom: 'Um pequeno animal de estimação (camundongo)', qtd: 1 },
      { custom: 'Uma lembrança de seus pais', qtd: 1 },
      { tabela: 'ITENS', nome: 'Vestes Comuns' },
    ],
    ouro: 10,
  },
];
function origemPorNome(nome) {
  return BACKGROUNDS_PHB.find(b => b.nome === nome) || null;
}

// ─── Equipamento inicial por CLASSE (PHB cap. 5, "Equipamento Inicial")──
// `escolhas`: cada uma é um "A ou B (ou C)" — o jogador escolhe UM pacote
// de slots. `fixos`: slots que todo personagem da classe recebe, sem
// alternativa (mas ainda podem exigir escolha de categoria, ex. "arma
// simples à sua escolha").
const EQUIPAMENTO_POR_CLASSE = {
  'barbaro': {
    escolhas: [
      { label: 'Arma principal', opcoes: [
        { label: 'Machado Grande', slots: [{ tabela: 'ARMAS', nome: 'Machado Grande' }] },
        { label: 'Arma marcial corpo a corpo à escolha', slots: [{ tabela: 'ARMAS', categorias: ['Marcial corpo-a-corpo'] }] },
      ]},
      { label: 'Armas secundárias', opcoes: [
        { label: 'Duas Machadinhas', slots: [{ tabela: 'ARMAS', nome: 'Machadinha' }, { tabela: 'ARMAS', nome: 'Machadinha' }] },
        { label: 'Arma simples à escolha', slots: [{ tabela: 'ARMAS', categorias: ['Simples corpo-a-corpo', 'Simples distância'] }] },
      ]},
    ],
    fixos: [
      { tabela: 'ITENS', nome: 'Pacote de Explorador' },
      { tabela: 'ARMAS', nome: 'Azagaia', qtd: 4 },
    ],
  },
  'bardo': {
    escolhas: [
      { label: 'Arma', opcoes: [
        { label: 'Rapieira', slots: [{ tabela: 'ARMAS', nome: 'Rapieira' }] },
        { label: 'Espada Longa', slots: [{ tabela: 'ARMAS', nome: 'Espada Longa' }] },
        { label: 'Arma simples à escolha', slots: [{ tabela: 'ARMAS', categorias: ['Simples corpo-a-corpo', 'Simples distância'] }] },
      ]},
      { label: 'Pacote', opcoes: [
        { label: 'Pacote de Diplomata', slots: [{ tabela: 'ITENS', nome: 'Pacote de Diplomata' }] },
        { label: 'Pacote de Artista', slots: [{ tabela: 'ITENS', nome: 'Pacote de Artista' }] },
      ]},
      { label: 'Instrumento musical', opcoes: [
        { label: 'Alaúde', slots: [{ tabela: 'FERRAMENTAS', nome: 'Alaúde' }] },
        { label: 'Outro instrumento à escolha', slots: [{ tabela: 'FERRAMENTAS', categorias: ['Instrumento'] }] },
      ]},
    ],
    fixos: [
      { tabela: 'ARMADURAS', nome: 'Couro' },
      { tabela: 'ARMAS', nome: 'Adaga' },
    ],
  },
  'bruxo': {
    escolhas: [
      { label: 'Arma à distância', opcoes: [
        { label: 'Besta Leve + 20 Virotes', slots: [{ tabela: 'ARMAS', nome: 'Besta Leve' }, { tabela: 'ITENS', nome: 'Virotes de Besta (20)' }] },
        { label: 'Arma simples à escolha', slots: [{ tabela: 'ARMAS', categorias: ['Simples corpo-a-corpo', 'Simples distância'] }] },
      ]},
      { label: 'Foco de conjuração', opcoes: [
        { label: 'Bolsa de Componentes', slots: [{ tabela: 'ITENS', nome: 'Bolsa de Componentes' }] },
        { label: 'Foco Arcano à escolha', slots: [{ tabela: 'ITENS', opcoes: FOCOS_ARCANOS }] },
      ]},
      { label: 'Pacote', opcoes: [
        { label: 'Pacote de Erudito', slots: [{ tabela: 'ITENS', nome: 'Pacote de Erudito' }] },
        { label: 'Pacote de Masmorra', slots: [{ tabela: 'ITENS', nome: 'Pacote de Masmorra' }] },
      ]},
    ],
    fixos: [
      { tabela: 'ARMADURAS', nome: 'Couro' },
      { tabela: 'ARMAS', categorias: ['Simples corpo-a-corpo', 'Simples distância'] },
      { tabela: 'ARMAS', nome: 'Adaga', qtd: 2 },
    ],
  },
  'clerigo': {
    escolhas: [
      { label: 'Arma', opcoes: [
        { label: 'Maça', slots: [{ tabela: 'ARMAS', nome: 'Maça' }] },
        { label: 'Martelo de Guerra (se proficiente)', slots: [{ tabela: 'ARMAS', nome: 'Martelo de Guerra' }] },
      ]},
      { label: 'Armadura', opcoes: [
        { label: 'Cota de Escamas', slots: [{ tabela: 'ARMADURAS', nome: 'Cota de Escamas' }] },
        { label: 'Couro', slots: [{ tabela: 'ARMADURAS', nome: 'Couro' }] },
        { label: 'Cota de Malha (se proficiente)', slots: [{ tabela: 'ARMADURAS', nome: 'Cota de Malha' }] },
      ]},
      { label: 'Arma à distância', opcoes: [
        { label: 'Besta Leve + 20 Virotes', slots: [{ tabela: 'ARMAS', nome: 'Besta Leve' }, { tabela: 'ITENS', nome: 'Virotes de Besta (20)' }] },
        { label: 'Arma simples à escolha', slots: [{ tabela: 'ARMAS', categorias: ['Simples corpo-a-corpo', 'Simples distância'] }] },
      ]},
      { label: 'Pacote', opcoes: [
        { label: 'Pacote de Sacerdote', slots: [{ tabela: 'ITENS', nome: 'Pacote de Sacerdote' }] },
        { label: 'Pacote de Explorador', slots: [{ tabela: 'ITENS', nome: 'Pacote de Explorador' }] },
      ]},
    ],
    fixos: [
      { tabela: 'ARMADURAS', nome: 'Escudo' },
      { tabela: 'ITENS', opcoes: SIMBOLOS_SAGRADOS },
    ],
  },
  'druida': {
    escolhas: [
      { label: 'Defesa', opcoes: [
        { label: 'Escudo de madeira', slots: [{ tabela: 'ARMADURAS', nome: 'Escudo' }] },
        { label: 'Arma simples à escolha', slots: [{ tabela: 'ARMAS', categorias: ['Simples corpo-a-corpo', 'Simples distância'] }] },
      ]},
      { label: 'Arma', opcoes: [
        { label: 'Cimitarra', slots: [{ tabela: 'ARMAS', nome: 'Cimitarra' }] },
        { label: 'Arma simples corpo a corpo à escolha', slots: [{ tabela: 'ARMAS', categorias: ['Simples corpo-a-corpo'] }] },
      ]},
    ],
    fixos: [
      { tabela: 'ARMADURAS', nome: 'Couro' },
      { tabela: 'ITENS', nome: 'Pacote de Explorador' },
      { tabela: 'ITENS', opcoes: FOCOS_DRUIDICOS },
    ],
  },
  'feiticeiro': {
    escolhas: [
      { label: 'Arma à distância', opcoes: [
        { label: 'Besta Leve + 20 Virotes', slots: [{ tabela: 'ARMAS', nome: 'Besta Leve' }, { tabela: 'ITENS', nome: 'Virotes de Besta (20)' }] },
        { label: 'Arma simples à escolha', slots: [{ tabela: 'ARMAS', categorias: ['Simples corpo-a-corpo', 'Simples distância'] }] },
      ]},
      { label: 'Foco de conjuração', opcoes: [
        { label: 'Bolsa de Componentes', slots: [{ tabela: 'ITENS', nome: 'Bolsa de Componentes' }] },
        { label: 'Foco Arcano à escolha', slots: [{ tabela: 'ITENS', opcoes: FOCOS_ARCANOS }] },
      ]},
      { label: 'Pacote', opcoes: [
        { label: 'Pacote de Diplomata', slots: [{ tabela: 'ITENS', nome: 'Pacote de Diplomata' }] },
        { label: 'Pacote de Explorador', slots: [{ tabela: 'ITENS', nome: 'Pacote de Explorador' }] },
      ]},
    ],
    fixos: [
      { tabela: 'ARMAS', nome: 'Adaga', qtd: 2 },
    ],
  },
  'guerreiro': {
    escolhas: [
      { label: 'Armadura', opcoes: [
        { label: 'Cota de Malha', slots: [{ tabela: 'ARMADURAS', nome: 'Cota de Malha' }] },
        { label: 'Couro + Arco Longo + 20 Flechas', slots: [{ tabela: 'ARMADURAS', nome: 'Couro' }, { tabela: 'ARMAS', nome: 'Arco Longo' }, { tabela: 'ITENS', nome: 'Flechas (20)' }] },
      ]},
      { label: 'Arma principal', opcoes: [
        { label: 'Arma marcial à escolha + Escudo', slots: [{ tabela: 'ARMAS', categorias: ['Marcial corpo-a-corpo', 'Marcial distância'] }, { tabela: 'ARMADURAS', nome: 'Escudo' }] },
        { label: 'Duas armas marciais à escolha', slots: [{ tabela: 'ARMAS', categorias: ['Marcial corpo-a-corpo', 'Marcial distância'] }, { tabela: 'ARMAS', categorias: ['Marcial corpo-a-corpo', 'Marcial distância'] }] },
      ]},
      { label: 'Arma secundária', opcoes: [
        { label: 'Besta Leve + 20 Virotes', slots: [{ tabela: 'ARMAS', nome: 'Besta Leve' }, { tabela: 'ITENS', nome: 'Virotes de Besta (20)' }] },
        { label: 'Duas Machadinhas', slots: [{ tabela: 'ARMAS', nome: 'Machadinha' }, { tabela: 'ARMAS', nome: 'Machadinha' }] },
      ]},
      { label: 'Pacote', opcoes: [
        { label: 'Pacote de Masmorra', slots: [{ tabela: 'ITENS', nome: 'Pacote de Masmorra' }] },
        { label: 'Pacote de Explorador', slots: [{ tabela: 'ITENS', nome: 'Pacote de Explorador' }] },
      ]},
    ],
    fixos: [],
  },
  'ladino': {
    escolhas: [
      { label: 'Arma corpo a corpo', opcoes: [
        { label: 'Rapieira', slots: [{ tabela: 'ARMAS', nome: 'Rapieira' }] },
        { label: 'Espada Curta', slots: [{ tabela: 'ARMAS', nome: 'Espada Curta' }] },
      ]},
      { label: 'Arma à distância', opcoes: [
        { label: 'Arco Curto + 20 Flechas', slots: [{ tabela: 'ARMAS', nome: 'Arco Curto' }, { tabela: 'ITENS', nome: 'Flechas (20)' }] },
        { label: 'Espada Curta', slots: [{ tabela: 'ARMAS', nome: 'Espada Curta' }] },
      ]},
      { label: 'Pacote', opcoes: [
        { label: 'Pacote de Saqueador', slots: [{ tabela: 'ITENS', nome: 'Pacote de Saqueador' }] },
        { label: 'Pacote de Masmorra', slots: [{ tabela: 'ITENS', nome: 'Pacote de Masmorra' }] },
        { label: 'Pacote de Explorador', slots: [{ tabela: 'ITENS', nome: 'Pacote de Explorador' }] },
      ]},
    ],
    fixos: [
      { tabela: 'ARMADURAS', nome: 'Couro' },
      { tabela: 'ARMAS', nome: 'Adaga', qtd: 2 },
      { tabela: 'FERRAMENTAS', nome: 'Ferramentas de Ladrão' },
    ],
  },
  'mago': {
    escolhas: [
      { label: 'Arma', opcoes: [
        { label: 'Bordão', slots: [{ tabela: 'ARMAS', nome: 'Bordão' }] },
        { label: 'Adaga', slots: [{ tabela: 'ARMAS', nome: 'Adaga' }] },
      ]},
      { label: 'Foco de conjuração', opcoes: [
        { label: 'Bolsa de Componentes', slots: [{ tabela: 'ITENS', nome: 'Bolsa de Componentes' }] },
        { label: 'Foco Arcano à escolha', slots: [{ tabela: 'ITENS', opcoes: FOCOS_ARCANOS }] },
      ]},
      { label: 'Pacote', opcoes: [
        { label: 'Pacote de Erudito', slots: [{ tabela: 'ITENS', nome: 'Pacote de Erudito' }] },
        { label: 'Pacote de Explorador', slots: [{ tabela: 'ITENS', nome: 'Pacote de Explorador' }] },
      ]},
    ],
    fixos: [
      { custom: 'Livro de Magias', qtd: 1 },
    ],
  },
  'monge': {
    escolhas: [
      { label: 'Arma', opcoes: [
        { label: 'Espada Curta', slots: [{ tabela: 'ARMAS', nome: 'Espada Curta' }] },
        { label: 'Arma simples à escolha', slots: [{ tabela: 'ARMAS', categorias: ['Simples corpo-a-corpo', 'Simples distância'] }] },
      ]},
      { label: 'Pacote', opcoes: [
        { label: 'Pacote de Masmorra', slots: [{ tabela: 'ITENS', nome: 'Pacote de Masmorra' }] },
        { label: 'Pacote de Explorador', slots: [{ tabela: 'ITENS', nome: 'Pacote de Explorador' }] },
      ]},
    ],
    fixos: [
      { tabela: 'ARMAS', nome: 'Dardo', qtd: 10 },
    ],
  },
  'paladino': {
    escolhas: [
      { label: 'Arma principal', opcoes: [
        { label: 'Arma marcial à escolha + Escudo', slots: [{ tabela: 'ARMAS', categorias: ['Marcial corpo-a-corpo', 'Marcial distância'] }, { tabela: 'ARMADURAS', nome: 'Escudo' }] },
        { label: 'Duas armas marciais à escolha', slots: [{ tabela: 'ARMAS', categorias: ['Marcial corpo-a-corpo', 'Marcial distância'] }, { tabela: 'ARMAS', categorias: ['Marcial corpo-a-corpo', 'Marcial distância'] }] },
      ]},
      { label: 'Arma secundária', opcoes: [
        { label: 'Cinco Azagaias', slots: [{ tabela: 'ARMAS', nome: 'Azagaia', qtd: 5 }] },
        { label: 'Arma simples corpo a corpo à escolha', slots: [{ tabela: 'ARMAS', categorias: ['Simples corpo-a-corpo'] }] },
      ]},
      { label: 'Pacote', opcoes: [
        { label: 'Pacote de Sacerdote', slots: [{ tabela: 'ITENS', nome: 'Pacote de Sacerdote' }] },
        { label: 'Pacote de Explorador', slots: [{ tabela: 'ITENS', nome: 'Pacote de Explorador' }] },
      ]},
    ],
    fixos: [
      { tabela: 'ARMADURAS', nome: 'Cota de Malha' },
      { tabela: 'ITENS', opcoes: SIMBOLOS_SAGRADOS },
    ],
  },
  'patrulheiro': {
    escolhas: [
      { label: 'Armadura', opcoes: [
        { label: 'Cota de Escamas', slots: [{ tabela: 'ARMADURAS', nome: 'Cota de Escamas' }] },
        { label: 'Couro', slots: [{ tabela: 'ARMADURAS', nome: 'Couro' }] },
      ]},
      { label: 'Armas', opcoes: [
        { label: 'Duas Espadas Curtas', slots: [{ tabela: 'ARMAS', nome: 'Espada Curta' }, { tabela: 'ARMAS', nome: 'Espada Curta' }] },
        { label: 'Duas armas simples corpo a corpo à escolha', slots: [{ tabela: 'ARMAS', categorias: ['Simples corpo-a-corpo'] }, { tabela: 'ARMAS', categorias: ['Simples corpo-a-corpo'] }] },
      ]},
      { label: 'Pacote', opcoes: [
        { label: 'Pacote de Masmorra', slots: [{ tabela: 'ITENS', nome: 'Pacote de Masmorra' }] },
        { label: 'Pacote de Explorador', slots: [{ tabela: 'ITENS', nome: 'Pacote de Explorador' }] },
      ]},
    ],
    fixos: [
      { tabela: 'ARMAS', nome: 'Arco Longo' },
      { tabela: 'ITENS', nome: 'Flechas (20)' },
    ],
  },
};
function equipamentoDaClasse(classe) {
  return EQUIPAMENTO_POR_CLASSE[chaveDeClasse(classe)] || null;
}

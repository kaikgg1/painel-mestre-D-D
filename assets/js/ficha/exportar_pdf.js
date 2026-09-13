// assets/js/ficha/exportar_pdf.js
// Exportar Ficha em PDF: preenche o modelo OFICIAL de cada classe (docs/fichas/
// *.pdf — são formulários PDF de verdade, com campos nomeados) com os dados
// do personagem ativo, direto no navegador via pdf-lib (assets/vendor/) —
// sem servidor, igual ao resto do app (GitHub Pages).
//
// Os 12 PDFs de classe vêm de 2 "famílias" de layout pro bloco de
// atributos/salvaguardas/perícias (o resto — identidade, combate, página 2 —
// é idêntico nas 12): Bárbaro/Druida/Feiticeiro/Mago usam nomes de campo
// "soltos" em PT-BR (STR, Acrobatics, RB-Atletismo...); as outras 8 usam
// campos "Front_Str Score"/"Front_Skill Athletics" em inglês. Em vez de
// classificar cada classe numa família, cada valor tenta AMBOS os nomes de
// campo — o que não existir naquele PDF simplesmente não faz nada
// (setTexto/setCheck engolem "campo não encontrado" de propósito).
//
// Fora do escopo (documentado aqui pra não parecer esquecimento): dado de
// vida/testes de morte (não rastreados no sistema), itens mágicos+sintonia
// da página 2 (sistema não distingue item mágico de item comum — tudo vira
// texto em "Mochila"), retrato (Back_Character Portrait), inimigo/terreno
// predileto do Patrulheiro (nome livre, não guardado à parte), e
// características de SUBCLASSE — o catálogo (habilidades_classes.json) só
// tem o texto de Domínio da Morte (Clérigo) e Quebrador de Juramento
// (Paladino); pra qualquer outra subclasse os campos "Característica do
// Arquétipo/Domínio/Círculo/..." ficam em branco (melhor em branco do que
// inventar regra errada).

const PDF_POR_CLASSE = {
  'barbaro':     'ficha barbaro.pdf',
  'bardo':       'ficha bardo editavel.pdf',
  'bruxo':       'ficha bruxo.pdf',
  'clerigo':     'ficha Clérigo.pdf',
  'druida':      'ficha druida.pdf',
  'feiticeiro':  'ficha feiticeiro.pdf',
  'guerreiro':   'ficha guerreiro.pdf',
  'ladino':      'ficha ladino.pdf',
  'mago':        'ficha mago.pdf',
  'monge':       'ficha monge.pdf',
  'paladino':    'ficha paladino.pdf',
  'patrulheiro': 'ficha patrulheiro.pdf',
};

// slug (PERICIAS, nucleo.js) -> nomes de campo nas 2 famílias de PDF.
const CAMPO_PERICIA = {
  'acrobacia':          { en: 'Acrobatics',       pt: 'Acrobatics',         rb: 'RB-Acrobacia' },
  'adestrar_animais':   { en: 'Animal Handling',  pt: 'Lidar-com-Animais',  rb: 'RB-Lidar-com-Animais' },
  'arcanismo':           { en: 'Arcana',           pt: 'Arcanismo',         rb: 'RB-Arcanismo' },
  'atletismo':           { en: 'Athletics',        pt: 'Atletismo',         rb: 'RB-Atletismo' },
  'atuacao':             { en: 'Performance',      pt: 'Atuacao',           rb: 'RB-Atuacao' },
  'enganacao':           { en: 'Deception',        pt: 'Blefar',            rb: 'RB-Blefar' },
  'furtividade':         { en: 'Stealth',          pt: 'Furtividade',       rb: 'RB-Furtividade' },
  'historia':            { en: 'History',          pt: 'Historia',          rb: 'RB-Historia' },
  'intimidacao':         { en: 'Intimidation',     pt: 'Intimidacao',       rb: 'RB-Intimidacao' },
  'intuicao':            { en: 'Insight',          pt: 'Intuicao',          rb: 'RB-Intuicao' },
  'investigacao':        { en: 'Investigation',    pt: 'Investigacao',      rb: 'RB-Investigacao' },
  'medicina':            { en: 'Medicine',         pt: 'Medicina',          rb: 'RB-Medicina' },
  'natureza':            { en: 'Nature',           pt: 'Natureza',          rb: 'RB-Natureza' },
  'percepcao':           { en: 'Perception',       pt: 'Percepcao',         rb: 'RB-Percepcao' },
  'persuasao':           { en: 'Persuasion',       pt: 'Persuasao',         rb: 'RB-Persuasao' },
  'prestidigitacao':     { en: 'Sleight of Hand',  pt: 'Prestidigitacao',   rb: 'RB-Prestidigitacao' },
  'religiao':            { en: 'Religion',         pt: 'Religiao',          rb: 'RB-Religiao' },
  'sobrevivencia':       { en: 'Survival',         pt: 'Sobrevivencia',     rb: 'RB-Sobrevivencia' },
};
// atributo (chave, nucleo.js) -> abreviação inglesa (as 2 famílias usam a mesma abreviação, só muda maiúscula/formato)
const ABREV_ATRIBUTO = { for: 'Str', dex: 'Dex', con: 'Con', int: 'Int', sab: 'Wis', car: 'Cha' };

// Proficiências de armadura/arma por classe (PHB 5e, cap. 3) — os PDFs só
// têm checkbox grosso (leve/média/pesada/escudo, simples/marcial), então
// exceções pontuais (ex.: Bardo com besta de mão/espada longa/rapieira/
// espada curta) não têm como ser representadas — fica só a categoria geral.
const PROFICIENCIAS_POR_CLASSE = {
  'barbaro':     { armaduras: { leve: 1, media: 1, pesada: 0, escudos: 1 }, armas: { simples: 1, marciais: 1 } },
  'bardo':       { armaduras: { leve: 1, media: 0, pesada: 0, escudos: 0 }, armas: { simples: 1, marciais: 0 } },
  'bruxo':       { armaduras: { leve: 1, media: 0, pesada: 0, escudos: 0 }, armas: { simples: 1, marciais: 0 } },
  'clerigo':     { armaduras: { leve: 1, media: 1, pesada: 0, escudos: 1 }, armas: { simples: 1, marciais: 0 } },
  'druida':      { armaduras: { leve: 1, media: 1, pesada: 0, escudos: 1 }, armas: { simples: 1, marciais: 0 } },
  'feiticeiro':  { armaduras: { leve: 0, media: 0, pesada: 0, escudos: 0 }, armas: { simples: 1, marciais: 0 } },
  'guerreiro':   { armaduras: { leve: 1, media: 1, pesada: 1, escudos: 1 }, armas: { simples: 1, marciais: 1 } },
  'ladino':      { armaduras: { leve: 1, media: 0, pesada: 0, escudos: 0 }, armas: { simples: 1, marciais: 0 } },
  'mago':        { armaduras: { leve: 0, media: 0, pesada: 0, escudos: 0 }, armas: { simples: 1, marciais: 0 } },
  'monge':       { armaduras: { leve: 0, media: 0, pesada: 0, escudos: 0 }, armas: { simples: 1, marciais: 0 } },
  'paladino':    { armaduras: { leve: 1, media: 1, pesada: 1, escudos: 1 }, armas: { simples: 1, marciais: 1 } },
  'patrulheiro': { armaduras: { leve: 1, media: 1, pesada: 0, escudos: 1 }, armas: { simples: 1, marciais: 1 } },
};

// Campos de "1 texto só" que dá pra preencher direto com a habilidade fixa
// de classe (data/habilidades_classes.json) já filtrada por nível/subclasse
// — sem precisar de uma tabela por classe: cada linha só se aplica (e só
// aparece no PDF) na(s) classe(s) que realmente têm aquele campo.
//   modo 'desc'       -> texto completo da descrição da regra
//   modo 'parenteses' -> só o que está entre parênteses no nome (ex.: "Ataque Furtivo (5d6)" -> "5d6")
//   modo 'nome'       -> nome da habilidade sem o prefixo usado pra achar
//   modo 'nome_desc'  -> nome (sem o prefixo) + ": " + descrição completa
const CAMPOS_HABILIDADE_TEXTO = [
  { campo: 'Front_Fighting Style',        prefixo: 'Estilo de Luta',        modo: 'desc' },
  { campo: 'Front_Action Surge',          prefixo: 'Surto de Ação',         modo: 'desc' },
  { campo: 'Front_Extra Attack',          prefixo: 'Ataque Extra',          modo: 'desc' },
  { campo: 'Front_Indomitable',           prefixo: 'Indomável',             modo: 'desc' },
  { campo: 'Front_Sneak Attack',          prefixo: 'Ataque Furtivo',        modo: 'parenteses' },
  { campo: 'Front_Brutal Critical Die',   prefixo: 'Crítico Brutal',        modo: 'parenteses' },
  { campo: 'Front_Song of Rest',          prefixo: 'Canção do Descanso',    modo: 'parenteses' },
  // apenasSubclasse: a base de Clérigo já tem "Canalizar Divindade: Expulsar
  // Mortos-Vivos" (todo Clérigo); esse campo é especificamente a versão do
  // DOMÍNIO (ex.: "Toque da Morte"), então só vale olhar habilidade marcada
  // com a subclasse do personagem — senão a versão base "vence" no empate
  // de nível e mostra a opção errada.
  { campo: 'Front_Channel Divinity Domain', prefixo: 'Canalizar Divindade:', modo: 'nome_desc', apenasSubclasse: true },
];

// Campos "Usado / Total" que vêm de um recurso rastreado (assets/js/recursos_classe.js)
const CAMPOS_RECURSO = [
  { recurso: 'furia',              usado: 'Front_Rage Used',        total: 'Front_Rage Total' },
  { recurso: 'inspiracao_bardica', usado: 'Front_Inspiration Used', total: 'Front_Inspiration Total' },
  { recurso: 'chi',                usado: 'Front_Ki Used',          total: 'Front_Ki Total' },
  { recurso: 'forma_selvagem',     usado: 'Front_Wild Shape Used',  total: 'Front_Wild Shape Total' },
  { recurso: 'pontos_feiticaria',  usado: 'Front_Sorcery Points Used', total: 'Front_Sorcery Points Total' },
  { recurso: 'cura_maos',          usado: 'Front_Lay on Hands Used',   total: 'Front_Lay on Hands Total' },
  { recurso: 'sentido_divino',     usado: 'Front_Divine Sense Used',   total: 'Front_Divine Sense Total' },
];

// Magias de Domínio (PHB cap. 3): cada Domínio Divino do Clérigo concede um
// par fixo de magias sempre preparadas, ganho nos níveis 1/3/5/7/9 (um nível
// de magia por linha — 1ª a 5ª). É regra fixa, igual pra qualquer Clérigo
// daquele domínio, então preenche as 5 linhas de uma vez, sem depender do
// nível atual do personagem (é referência, igual imprimiria numa ficha em
// branco). Nomes em PT-BR batendo com data/magias_data.json.
const DOMINIO_MAGIAS = {
  'Domínio do Conhecimento': [
    ['Comando', 'Identificação'],
    ['Augúrio', 'Sugestão'],
    ['Dificultar Detecção', 'Falar com os Mortos'],
    ['Olho Arcano', 'Confusão'],
    ['Conhecimento Lendário', 'Vidência'],
  ],
  'Domínio da Vida': [
    ['Bênção', 'Curar Ferimentos'],
    ['Restauração Menor', 'Arma Espiritual'],
    ['Sinal de Esperança', 'Revivificar'],
    ['Proteção contra a Morte', 'Guardião da Fé'],
    ['Curar Ferimentos em Massa', 'Reviver os Mortos'],
  ],
  'Domínio da Luz': [
    ['Mãos Flamejantes', 'Fogo das Fadas'],
    ['Esfera Flamejante', 'Raio Ardente'],
    ['Luz do Dia', 'Bola de Fogo'],
    ['Guardião da Fé', 'Muralha de Fogo'],
    ['Coluna de Chamas', 'Vidência'],
  ],
  'Domínio da Natureza': [
    ['Amizade Animal', 'Falar com Animais'],
    ['Pele de Árvore', 'Crescer Espinhos'],
    ['Ampliar Plantas', 'Muralha de Vento'],
    ['Dominar Besta', 'Vinha Esmagadora'],
    ['Praga de Insetos', 'Teletransporte por Árvores'],
  ],
  'Domínio da Tempestade': [
    ['Névoa Obscurecente', 'Onda Trovejante'],
    ['Lufada de Vento', 'Despedaçar'],
    ['Convocar Relâmpagos', 'Nevasca'],
    ['Controlar a Água', 'Tempestade de Gelo'],
    ['Onda Destrutiva', 'Praga de Insetos'],
  ],
  'Domínio Trapaceiro': [
    ['Enfeitiçar Pessoa', 'Disfarçar-se'],
    ['Reflexos', 'Passos sem Pegadas'],
    ['Piscar', 'Dissipar Magia'],
    ['Porta Dimensional', 'Metamorfose'],
    ['Dominar Pessoa', 'Modificar Memória'],
  ],
  'Domínio da Guerra': [
    ['Auxílio Divino', 'Escudo da Fé'],
    ['Arma Mágica', 'Arma Espiritual'],
    ['Manto do Cruzado', 'Espíritos Guardiões'],
    ['Movimentação Livre', 'Pele de Pedra'],
    ['Coluna de Chamas', 'Imobilizar Monstro'],
  ],
  'Domínio da Morte': [
    ['Vitalidade Falsa', 'Raio Adoecente'],
    ['Cegueira/Surdez', 'Raio do Enfraquecimento'],
    ['Animar Mortos', 'Toque Vampírico'],
    ['Praga', 'Proteção contra a Morte'],
    ['Cúpula Antivida', 'Névoa Mortal'],
  ],
};
const CAMPO_DOMINIO_MAGIAS_POR_LINHA = ['1st', '2nd', '3rd', '4th', '5th'];

// Campos "Característica do Arquétipo/Domínio/Círculo/Tradição/Origem/
// Patrono/Juramento" por nível — só preenchem quando habilidades_classes.json
// tem texto pra ESSA subclasse específica (hoje: Domínio da Morte e
// Quebrador de Juramento); nas demais ficam em branco de propósito.
const CAMPOS_SUBCLASSE_POR_NIVEL = {
  'clerigo':     ['Front_Domain Feature'],
  'paladino':    ['Front_Sacred Oath'],
  'bardo':       ['Front_College Feature'],
  'druida':      ['Front_Circle Feature'],
  'mago':        ['Front_Arcane Tradition'],
  'feiticeiro':  ['Front_Sorcerous Origin'],
  'bruxo':       ['Front_Patron'],
  'ladino':      ['Front_Roguish Archetype'],
  'monge':       ['Front_Monastic Tradition Feature'],
  'patrulheiro': ['Front_Ranger Archetype'],
  'barbaro':     ['Front_Primal Feature'],
  'guerreiro':   ['Front_Martial Archetype'],
};

function pdfDaClasse(classe) { return PDF_POR_CLASSE[chaveDeClasse(classe)] || null; }

// ── Helpers de nível (regras que escalam mas não têm o número no nome da habilidade) ──
function danoFuriaBarbaro(nivel) { return nivel >= 16 ? '+4' : nivel >= 9 ? '+3' : '+2'; }
function cdMaximoFormaSelvagem(nivel) {
  if (nivel >= 8) return 'CR 1 (com voo)';
  if (nivel >= 4) return 'CR 1/2 (sem voo)';
  return 'CR 1/4 (sem voo/natação)';
}
function dadoArtesMarciaisMonge(nivel) {
  if (nivel >= 17) return '1d10';
  if (nivel >= 11) return '1d8';
  if (nivel >= 5) return '1d6';
  return '1d4';
}

function extrairParenteses(nome) {
  const m = /\(([^)]+)\)\s*$/.exec(nome || '');
  return m ? m[1] : '';
}
function melhorPorPrefixo(habs, prefixo) {
  const cand = habs.filter(h => h.nome && h.nome.startsWith(prefixo));
  if (!cand.length) return null;
  cand.sort((a, b) => b.nivel - a.nivel);
  return cand[0];
}

// ── pdf-lib: preencher por nome de campo sem quebrar se o campo não existir ──
// Todo campo de texto nesses PDFs vem com tamanho de fonte AUTOMÁTICO (0 Tf
// no /DA) — funciona bem pros campos numéricos curtos (PV, CA, atributos:
// pdf-lib acerta o tamanho e ainda fica com aquele efeito "número grande e
// chamativo" que o próprio molde pretendia). Mas quebra feio em campos
// pensados pra texto corrido (traços raciais, mochila, características de
// classe...): com pouco texto numa caixa alta, o auto-tamanho às vezes
// escolhe uma fonte gigante que estoura a caixa (viu isso ao vivo: "Toque
// da Morte" ocupando a caixa inteira). Um tamanho FIXO pros campos de texto
// livre resolvia isso, mas trocava o problema de lado: texto realmente
// longo (2 características de domínio juntas, por exemplo) num tamanho
// fixo grande demais pra ele ficava cortado pela caixa. Por isso
// `tamanhoFonte: 'auto'` mede de verdade (largura/altura reais do campo) e
// escolhe o MAIOR tamanho que cabe inteiro — os campos numéricos continuam
// com o auto nativo do pdf-lib (tamanhoFonte omitido), que funciona bem
// pra eles.
//
// A 1ª versão disto tinha uma simulação de quebra de linha própria (conta
// palavra por palavra até estourar a largura) — parecia certa nos testes,
// mas ainda cortava texto longo na prática (ex.: 2 características de
// Clérigo juntas: "Proficiência Adicional... | Ceifador..." cortava no
// meio da 2ª frase). Causa: o pdf-lib usa uma altura de linha própria
// (1.2 × font.heightAtSize(tamanho), NÃO tamanho×1.25 como eu supunha) —
// então "quantas linhas cabem" dava um resultado ligeiramente diferente do
// que o pdf-lib ia realmente desenhar, e a caixa (que recorta o que passa
// da borda) cortava a sobra. Em vez de tentar re-simular a lógica do
// pdf-lib de novo (e arriscar errar de outro jeito), agora chama
// PDFLib.layoutMultilineText — a MESMA função que o pdf-lib usa por dentro
// quando você chama campo.setText() — então "quantas linhas isso vira" é
// sempre exatamente o que vai ser desenhado, não uma aproximação.
let _fonteParaMedir = null;
function tamanhoQueCabe(font, texto, largura, altura) {
  const { layoutMultilineText, TextAlignment } = window.PDFLib;
  const PAD = 4;
  const larguraUtil = Math.max(10, largura - PAD * 2);
  const alturaUtil = Math.max(8, altura - PAD * 2);
  const bounds = { x: 0, y: 0, width: larguraUtil, height: alturaUtil };
  for (let tam = 10; tam >= 4; tam -= 0.5) {
    const r = layoutMultilineText(String(texto), { alignment: TextAlignment.Left, fontSize: tam, font, bounds });
    if (r.lines.length * r.lineHeight <= alturaUtil) return tam;
  }
  return 4;
}
function setTexto(idx, nomes, valor, tamanhoFonte) {
  if (valor === null || valor === undefined || valor === '') return;
  for (const nome of (Array.isArray(nomes) ? nomes : [nomes])) {
    const campo = idx.get(nome);
    if (campo && typeof campo.setText === 'function') {
      try {
        if (tamanhoFonte === 'auto' && _fonteParaMedir) {
          const rect = campo.acroField.getWidgets()[0]?.getRectangle();
          if (rect) campo.setFontSize(tamanhoQueCabe(_fonteParaMedir, String(valor), rect.width, rect.height));
        } else if (tamanhoFonte && typeof campo.setFontSize === 'function') {
          campo.setFontSize(tamanhoFonte);
        }
        campo.setText(String(valor));
      } catch (e) { /* campo com fonte incompatível — ignora só esse */ }
    }
  }
}
// Diferente de setTexto (que IGNORA valor vazio de propósito, pra nunca
// apagar o que o molde já trouxe por padrão — ex.: os campos de atributo
// numérico têm um "-5" de exemplo do autor do PDF), limparTexto é usado
// quando o jogador desmarcou explicitamente uma opção do diálogo de
// exportação: aí o vazio É a intenção, então precisa forçar mesmo.
function limparTexto(idx, nomes) {
  for (const nome of (Array.isArray(nomes) ? nomes : [nomes])) {
    const campo = idx.get(nome);
    if (campo && typeof campo.setText === 'function') {
      try { campo.setText(''); } catch (e) {}
    }
  }
}
function setCheck(idx, nomes, marcado) {
  for (const nome of (Array.isArray(nomes) ? nomes : [nomes])) {
    const campo = idx.get(nome);
    if (campo && typeof campo.check === 'function') {
      try { marcado ? campo.check() : campo.uncheck(); } catch (e) {}
    }
  }
}

function habilidadesDoPersonagem(HAB, chave, c) {
  const lista = (HAB && HAB[chave]) || [];
  const nivel = +c.nivel || 1;
  return lista.filter(h => h.nivel <= nivel && (!h.subclasse || h.subclasse === c.subclasse));
}

// ── Blocos de preenchimento ──────────────────────────────────────────
function preencherIdentidade(idx, c, opcoes) {
  setTexto(idx, ['Front_Character Name', 'Back_Character Name'], c.nome);
  setTexto(idx, 'Front_Race', c.raca);
  setTexto(idx, 'Front_Background', c.origem);
  setTexto(idx, 'Back_Background', c.origem, 'auto');
  setTexto(idx, 'Front_Alignment', c.alinhamento);
  setTexto(idx, 'Front_XP', c.xp);
  setTexto(idx, 'Front_Level', c.nivel || 1);
  setTexto(idx, 'Front_Archetype', c.subclasse);
  const nivelTotal = nivelTotalPersonagem(c);
  setTexto(idx, ['Front_Proficiency', 'ProfBonus'], fmtMod(bonusProf(nivelTotal)));
  setTexto(idx, ['Front_Passive Perception', 'Passive'], 10 + valorPericia(c, 'percepcao', 'sab'));
  setTexto(idx, 'Front_Passive Insight', 10 + valorPericia(c, 'intuicao', 'sab'));
  if (opcoes.recursos) setTexto(idx, ['Front_Inspiration', 'Inspiration'], (+c.inspiracao || 0) > 0 ? String(+c.inspiracao) : '');
  else limparTexto(idx, ['Front_Inspiration', 'Inspiration']);
  setTexto(idx, 'Front_Racial Traits', c.tracos_raciais, 'auto');
  setTexto(idx, 'Front_Languages', (c.idiomas || ['Comum']).join(', '), 'auto');
  setTexto(idx, 'Front_Tools', (c.ferramentas || []).join(', '), 'auto');

  const profs = PROFICIENCIAS_POR_CLASSE[chaveDeClasse(c.classe)];
  if (profs) {
    setCheck(idx, 'Front_Light Armour', !!profs.armaduras.leve);
    setCheck(idx, 'Front_Medium Armour', !!profs.armaduras.media);
    setCheck(idx, 'Front_Heavy Armour', !!profs.armaduras.pesada);
    setCheck(idx, 'Front_Shields', !!profs.armaduras.escudos);
    setCheck(idx, 'Front_Simple Weapons', !!profs.armas.simples);
    setCheck(idx, 'Front_Martial Weapons', !!profs.armas.marciais);
  }
}

function preencherAtributosSalvPericias(idx, c) {
  for (const [k, ] of ATRIBUTOS) {
    const score = c.atributos?.[k];
    if (score == null) continue;
    const en = ABREV_ATRIBUTO[k];
    setTexto(idx, [`Front_${en} Score`, en.toUpperCase()], score);
    setTexto(idx, [`Front_${en} Mod`, `${en.toUpperCase()}mod`], fmtMod(mod(score)));
    setCheck(idx, [`Front_Save ${en}`, `RB-${en.toUpperCase()}-R`], salvProf(c.salvaguardas, k));
    setTexto(idx, [`Front_${en} Save Throw`, `Res-${en.toUpperCase()}`], fmtMod(valorSalvaguarda(c, k)));
  }
  for (const [slug, , atrKey] of PERICIAS) {
    const campo = CAMPO_PERICIA[slug];
    if (!campo) continue;
    const p = (c.pericias || {})[slug] || {};
    setCheck(idx, `Front_Proficiency ${campo.en}`, !!p.prof);
    setCheck(idx, `Front_Expertise ${campo.en}`, !!p.exp);
    setCheck(idx, campo.rb, !!p.prof || !!p.exp);
    setTexto(idx, [`Front_Skill ${campo.en}`, campo.pt], fmtMod(valorPericia(c, slug, atrKey)));
  }
}

function preencherCombate(idx, c, opcoes) {
  setTexto(idx, ['Front_AC', 'AC'], c.ca);
  setTexto(idx, ['Front_Initiative', 'Initiative'], fmtMod(+c.iniciativa_bonus || 0));
  setTexto(idx, ['Front_Speed', 'Speed'], c.deslocamento != null ? `${c.deslocamento}m` : '');
  if (opcoes.pv) {
    setTexto(idx, 'Front_Max HP', c.hp_max);
    setTexto(idx, 'Front_Current HP', c.hp_atual);
    setTexto(idx, 'Front_Temp HP', c.hp_temp || '');
    const totalDV = nivelTotalPersonagem(c);
    const restanteDV = c.dado_vida_atual != null ? +c.dado_vida_atual : totalDV;
    setTexto(idx, 'Front_Total Hit Dice', `${totalDV}d${c.dado_vida_tipo || 8}`);
    setTexto(idx, 'Front_Used Hit Dice', Math.max(0, totalDV - restanteDV));
  } else {
    // Não é só "não escrever" — o molde já vem com valor de exemplo do
    // autor nesses campos (ex.: "16"), então fica visível igual mesmo sem
    // preencher se não limpar de propósito.
    limparTexto(idx, ['Front_Max HP', 'Front_Current HP', 'Front_Temp HP', 'Front_Total Hit Dice', 'Front_Used Hit Dice']);
  }

  const armas = c.inventario?.armas || [];
  armas.forEach((arma, i) => {
    const n = i + 1;
    const calc = window.Ataques ? Ataques.calcular(arma, c.atributos, nivelTotalPersonagem(c)) : null;
    setTexto(idx, `Front_Weapon Name ${n}`, arma.nome);
    if (calc) {
      setTexto(idx, `Front_Weapon Atk Bonus ${n}`, fmtMod(calc.bonusAtaque));
      setTexto(idx, `Front_Weapon Damage ${n}`, calc.danoTexto);
    }
  });
}

function preencherPaginaTras(idx, c) {
  setTexto(idx, 'Back_Personality Traits', c.tracos_pessoais, 'auto');
  setTexto(idx, 'Back_Ideals', c.ideais, 'auto');
  setTexto(idx, 'Back_Bonds', c.vinculos, 'auto');
  setTexto(idx, 'Back_Flaws', c.defeitos, 'auto');
  const extras = [];
  if (c.historia) extras.push('História: ' + c.historia);
  if (c.caracteristicas_adicionais) extras.push(c.caracteristicas_adicionais);
  if (Array.isArray(c.features_personalizadas)) {
    c.features_personalizadas.forEach(f => { if (f?.nome) extras.push(`${f.nome}: ${f.desc || ''}`.trim()); });
  }
  setTexto(idx, 'Back_Additional Features & Traits', extras.join('\n\n'), 'auto');

  const m = c.inventario?.moedas || {};
  setTexto(idx, 'Back_CP', m.pc || '');
  setTexto(idx, 'Back_SP', m.pp || '');
  setTexto(idx, 'Back_EP', m.pe || '');
  setTexto(idx, 'Back_GP', m.po || '');
  setTexto(idx, 'Back_PP', m.pl || '');

  const linhas = [];
  (c.inventario?.armas || []).forEach(a => linhas.push(a.nome));
  (c.inventario?.armaduras || []).forEach(a => linhas.push(a.nome));
  (c.inventario?.itens || []).forEach(it => linhas.push(it.qtd > 1 ? `${it.nome} ×${it.qtd}` : it.nome));
  setTexto(idx, 'Back_Backpack', linhas.join('\n'), 'auto');
}

function preencherHabilidadesFixas(idx, c, HAB, opcoes) {
  const chave = chaveDeClasse(c.classe);
  const habs = habilidadesDoPersonagem(HAB, chave, c);

  for (const def of CAMPOS_HABILIDADE_TEXTO) {
    const pool = def.apenasSubclasse ? habs.filter(h => h.subclasse) : habs;
    const h = melhorPorPrefixo(pool, def.prefixo);
    if (!h) continue;
    if (def.modo === 'desc') setTexto(idx, def.campo, h.desc, 'auto');
    else if (def.modo === 'parenteses') setTexto(idx, def.campo, extrairParenteses(h.nome), 'auto');
    else if (def.modo === 'nome') setTexto(idx, def.campo, h.nome.slice(def.prefixo.length).trim(), 'auto');
    else if (def.modo === 'nome_desc') {
      const nome = h.nome.slice(def.prefixo.length).trim();
      setTexto(idx, def.campo, nome + (h.desc ? ': ' + h.desc : ''), 'auto');
    }
  }

  const recursos = window.RecursosClasse ? RecursosClasse.recursosPara(c, c.atributos) : [];
  for (const def of CAMPOS_RECURSO) {
    const r = recursos.find(x => x.id === def.recurso);
    if (!r) continue;
    if (opcoes.recursos) setTexto(idx, def.usado, RecursosClasse.lerUsado(c.recursos_usados, def.recurso));
    else limparTexto(idx, def.usado);
    setTexto(idx, def.total, r.max);
  }

  if (chave === 'barbaro') setTexto(idx, 'Front_Rage Damage', danoFuriaBarbaro(+c.nivel || 1), 'auto');
  if (chave === 'druida') setTexto(idx, 'Front_Wild Shape Max CR', cdMaximoFormaSelvagem(+c.nivel || 1), 'auto');
  if (chave === 'monge') setTexto(idx, 'Front_Martial Arts Die', dadoArtesMarciaisMonge(+c.nivel || 1), 'auto');

  // Características de subclasse por nível (só existem no catálogo pra
  // Domínio da Morte / Quebrador de Juramento — nas demais fica em branco).
  // Um mesmo nível pode ter mais de uma característica (ex.: Clérigo nível
  // 1 tem "Proficiência Adicional" E "Ceifador") — agrupa por nível antes
  // de preencher, senão a 2ª sobrescreve a 1ª no mesmo campo.
  const prefixosCampo = CAMPOS_SUBCLASSE_POR_NIVEL[chave] || [];
  if (prefixosCampo.length && c.subclasse) {
    const porNivel = new Map();
    habs.filter(h => h.subclasse === c.subclasse).forEach(h => {
      const texto = h.nome + (h.desc ? ': ' + h.desc : '');
      porNivel.set(h.nivel, [...(porNivel.get(h.nivel) || []), texto]);
    });
    porNivel.forEach((textos, nivel) => {
      for (const prefixoCampo of prefixosCampo) setTexto(idx, `${prefixoCampo} ${nivel}`, textos.join(' | '), 'auto');
    });
  }

  // Catch-all: habilidades desbloqueadas que não caíram em nenhum campo
  // específico viram um resumo em "Additional Combat Features" (Guerreiro/
  // Bárbaro/Monge têm esse campo; nas outras classes o setTexto só ignora).
  const prefixosUsados = CAMPOS_HABILIDADE_TEXTO.map(d => d.prefixo);
  const sobrando = habs.filter(h =>
    !prefixosUsados.some(p => h.nome.startsWith(p)) &&
    !/^Aumento de Pontuação de Atributo/.test(h.nome) &&
    !h.subclasse
  );
  const resumo = sobrando.map(h => `${h.nome}: ${h.desc}`).join('\n');
  setTexto(idx, 'Front_Additional Combat Features', resumo, 'auto');
}

async function preencherConjuracao(idx, c, opcoes) {
  const chave = chaveDeClasse(c.classe);
  setTexto(idx, ['Front_Cantrips Known'], c.truques_conhecidos || '');
  setTexto(idx, ['Front_Spells Known'], c.magias_conhecidas || '');
  setTexto(idx, ['Front_Spell DC', 'SpellSaveDC'], c.cd_resistencia != null ? c.cd_resistencia : '');
  setTexto(idx, ['Front_Spell Atk', 'SpellAtkBonus'], c.bonus_atq_magia != null ? fmtMod(c.bonus_atq_magia) : '');

  // Clérigo: tabela "Magias de Domínio" (fixa por subclasse, ver DOMINIO_MAGIAS acima).
  if (chave === 'clerigo' && c.subclasse && DOMINIO_MAGIAS[c.subclasse]) {
    DOMINIO_MAGIAS[c.subclasse].forEach((par, i) => {
      setTexto(idx, `Front_Domain Spells ${CAMPO_DOMINIO_MAGIAS_POR_LINHA[i]}`, par.join(', '), 'auto');
    });
  }

  // Bruxo (Magia de Pacto): pool único de espaços, todos do maior nível
  // disponível — diferente da grade de checkboxes por nível dos outros
  // conjuradores, por isso usa campos próprios (Front_Spell Slots *).
  if (chave === 'bruxo' && window.SlotsPHB) {
    const slotsClasse = SlotsPHB.porClasse(c.classe, c.nivel || 1, c.subclasse) || {};
    let nivelSlot = 0;
    for (let n = 9; n >= 1; n--) { if (slotsClasse[n] > 0) { nivelSlot = n; break; } }
    if (nivelSlot > 0) {
      setTexto(idx, 'Front_Spell Slots Level', nivelSlot);
      setTexto(idx, 'Front_Spell Slots Total', slotsClasse[nivelSlot]);
      if (opcoes.recursos) setTexto(idx, 'Front_Spell Slots Used', (c.slots_magia?.[nivelSlot]?.atual) || 0);
      else limparTexto(idx, 'Front_Spell Slots Used');
    }
  }

  // Lista de magias: "Favoritas" (spell_lists) é a lista de conhecidas/
  // preparadas do PJ (mesma fonte que a aba Magias usa) — cruza com o
  // catálogo (magias_data.json) pra saber nível/ritual de cada uma.
  const nomes = Array.from(await carregarFavoritasDoBanco(c.id));
  if (!nomes.length) return;
  const catalogo = await carregarMagiasCache();
  const porNome = new Map((catalogo || []).map(m => [m.nome, m]));
  const resolvidas = nomes
    .map(nome => ({ nome, dados: porNome.get(nome) }))
    .sort((a, b) => (a.dados?.nivel ?? 0) - (b.dados?.nivel ?? 0) || a.nome.localeCompare(b.nome, 'pt'));

  const ehPreparador = idx.has('Front_Spell Prepared 1'); // hoje só o Mago tem esse campo
  resolvidas.slice(0, 32).forEach((m, i) => {
    const n = i + 1;
    const nivelMagia = m.dados?.nivel ?? 0;
    setTexto(idx, `Front_Spell Level ${n}`, nivelMagia === 0 ? 'T' : String(nivelMagia));
    setTexto(idx, `Front_Spell Name ${n}`, m.nome);
    setCheck(idx, `Front_Spell Ritual ${n}`, !!m.dados?.ritual);
    if (ehPreparador) setCheck(idx, `Front_Spell Prepared ${n}`, true);
  });

  // "Magias Favoritas" — mini cartão de referência rápida (Nome/Alcance/
  // Tempo de Conjuração/Resistência) que ficava em branco antes: são só
  // 2 a 6 linhas dependendo da classe, cabe o topo da mesma lista já
  // ordenada acima. "Resistência" é o CD de resistência do PERSONAGEM —
  // no 5e a CD é sempre a mesma não importa a magia, não é um dado por
  // magia que o catálogo tenha. "Efeito" fica de fora: a caixa é de 1
  // linha só, e a descrição de uma magia não cabe resumida sem arriscar
  // mostrar um resumo errado/enganoso.
  resolvidas.slice(0, 6).forEach((m, i) => {
    const n = i + 1;
    setTexto(idx, `Front_Spell Attack Name ${n}`, m.nome);
    setTexto(idx, `Front_Spell Range ${n}`, m.dados?.alcance || '');
    setTexto(idx, `Front_Spell Casting Time ${n}`, m.dados?.tempoCast || '');
    setTexto(idx, `Front_Spell Save ${n}`, c.cd_resistencia != null ? c.cd_resistencia : '');
    setCheck(idx, `Front_Spell Concentration ${n}`, !!m.dados?.concentracao);
  });
}

async function preencherFicha(idx, c, form, opcoes) {
  _fonteParaMedir = form.getDefaultFont();
  const HAB = await carregarHabilidadesClasses();
  preencherIdentidade(idx, c, opcoes);
  preencherAtributosSalvPericias(idx, c);
  preencherCombate(idx, c, opcoes);
  preencherPaginaTras(idx, c);
  if (HAB) preencherHabilidadesFixas(idx, c, HAB, opcoes);
  if (classeUsaMagia(c)) await preencherConjuracao(idx, c, opcoes);
}

function baixarArquivoPDF(bytes, nomeArquivo) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function nomeArquivoExportPDF(c) {
  const base = `${c.nome || 'Personagem'} - ${c.classe || 'Ficha'} Nv${c.nivel || 1}`;
  return base.replace(/[\\/:*?"<>|]/g, '_') + '.pdf';
}

// pdf-lib (assets/vendor/pdf-lib.min.js) tem ~525KB minificado — maior que
// TODOS os módulos da ficha somados. Carregar isso em toda visita à ficha
// (a maioria nunca clica em "Exportar PDF") deixava o carregamento da
// página inteira mais lento à toa. Só busca o script na hora H, e só uma
// vez por sessão (chamadas repetidas reusam a mesma promise).
let _promessaPDFLib = null;
function carregarPDFLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (!_promessaPDFLib) {
    _promessaPDFLib = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = '../assets/vendor/pdf-lib.min.js';
      el.onload = () => resolve(window.PDFLib);
      el.onerror = () => reject(new Error('falha ao carregar pdf-lib.min.js'));
      document.head.appendChild(el);
    });
  }
  return _promessaPDFLib;
}

// true enquanto uma exportação está em andamento — clicar de novo (ou
// trocar de personagem e clicar de novo) antes dela terminar não deve
// disparar uma 2ª exportação concorrente, que poderia terminar ANTES da
// primeira e fazer parecer que "exportou o personagem errado".
let _exportandoPDF = false;
// opcoes: { pv, recursos } — omitido/undefined = preenche tudo (chamada
// direta, ex.: testes). O diálogo (abrirDialogoExportarPDF) é quem
// normalmente passa isso, deixando o jogador desmarcar o que prefere
// preencher na mesa em vez de já vir pronto.
async function exportarFichaPDF(opcoes) {
  const opts = { pv: true, recursos: true, ...opcoes };
  if (_exportandoPDF) { toast('Já tem uma exportação em andamento — espera terminar.'); return; }
  const c = charAtivo;
  if (!c) return;
  const arquivo = pdfDaClasse(c.classe);
  if (!arquivo) { toast(`Sem modelo de PDF pra "${c.classe || 'essa classe'}" ainda — defina a classe na aba Personagem.`); return; }

  _exportandoPDF = true;
  toast('Gerando PDF…', 'salvar');
  try {
    await carregarPDFLib();
    const resp = await fetch('../docs/fichas/' + encodeURIComponent(arquivo));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const bytes = await resp.arrayBuffer();
    const { PDFDocument } = window.PDFLib;
    const pdfDoc = await PDFDocument.load(bytes);
    const form = pdfDoc.getForm();
    const idx = new Map(form.getFields().map(f => [f.getName(), f]));

    await preencherFicha(idx, c, form, opts);

    const outBytes = await pdfDoc.save();
    baixarArquivoPDF(outBytes, nomeArquivoExportPDF(c));
    toast(`✓ ${c.nome} exportado em PDF`, 'salvar');
  } catch (e) {
    console.error('[exportar pdf]', e);
    toast('Erro ao exportar PDF: ' + e.message);
  } finally {
    _exportandoPDF = false;
  }
}

// Diálogo antes de gerar o PDF: deixa o jogador desmarcar o que prefere
// preencher à mão na mesa em vez de já vir pronto — PV muda toda sessão
// (às vezes a cada rodada), então imprimir um valor que já vai estar
// errado no primeiro combate não ajuda ninguém. Tudo marcado por padrão
// (mesmo comportamento de antes de existir esse diálogo).
function abrirDialogoExportarPDF() {
  const { overlay, card, fechar } = UI.abrirModal({
    tituloHtml: `${ico('brilho')} Exportar Ficha em PDF`,
    corpoHtml: `
      <p class="ajuda-mini">O resto (identidade, atributos, perícias, equipamento, magias conhecidas) sempre vai preenchido — só isso aqui muda toda sessão, então dá pra deixar em branco pra preencher na mesa.</p>
      <label class="editor-check" style="margin-bottom:10px">
        <input type="checkbox" id="exp-opt-pv" checked> Pontos de Vida e Dado de Vida
      </label>
      <label class="editor-check">
        <input type="checkbox" id="exp-opt-recursos" checked> Recursos e Inspiração já usados (Ki, Fúria, Cura pelas Mãos, Canalizar Divindade, Magia de Pacto do Bruxo...)
      </label>
      <div class="modal-acoes" style="margin-top:18px">
        <button type="button" class="btn" id="exp-opt-cancelar">Cancelar</button>
        <button type="button" class="btn primary" id="exp-opt-confirmar">✓ Gerar PDF</button>
      </div>
    `,
  });
  card.querySelector('#exp-opt-cancelar').addEventListener('click', fechar);
  card.querySelector('#exp-opt-confirmar').addEventListener('click', () => {
    const pv = card.querySelector('#exp-opt-pv').checked;
    const recursos = card.querySelector('#exp-opt-recursos').checked;
    fechar();
    exportarFichaPDF({ pv, recursos });
  });
}

// scripts/extrair_habilidades_classes.js
// Parseia LivroDoJogador.md e extrai habilidades fixas de cada classe por nível.
// Saída: data/habilidades_classes.json
const fs = require('fs');
const path = require('path');

const MD_PATH  = path.join(__dirname, '..', 'docs', 'LivroDoJogador.md');
const OUT_PATH = path.join(__dirname, '..', 'data', 'habilidades_classes.json');

if (!fs.existsSync(MD_PATH)) {
  console.error('❌ docs/LivroDoJogador.md não encontrado. Rode scripts/extrair_pdf.js e scripts/formatar_phb.js primeiro.');
  process.exit(1);
}

const md = fs.readFileSync(MD_PATH, 'utf8');

const CLASSES = [
  'BÁRBARO','BARDO','BRUXO','CLÉRIGO','DRUIDA','FEITICEIRO',
  'GUERREIRO','LADINO','MAGO','MONGE','PALADINO','PATRULHEIRO',
];

// Headings de meta-seção pra ignorar (não são features)
const IGNORAR_HEADINGS = new Set([
  'CARACTERÍSTICAS DE CLASSE',
  'PONTOS DE VIDA',
  'PROFICIÊNCIAS',
  'EQUIPAMENTO',
  'INCREMENTO NO VALOR DE HABILIDADE',
  'CRIANDO UM BÁRBARO','CRIANDO UM BARDO','CRIANDO UM BRUXO','CRIANDO UM CLÉRIGO',
  'CRIANDO UM DRUIDA','CRIANDO UM FEITICEIRO','CRIANDO UM GUERREIRO',
  'CRIANDO UM LADINO','CRIANDO UM MAGO','CRIANDO UM MONGE',
  'CRIANDO UM PALADINO','CRIANDO UM PATRULHEIRO',
  'CRIAÇÃO RÁPIDA',
]);

// Texto antes de "## NOME DA SUBCLASSE / CAMINHO / ESCOLA" etc.
// Esses headings começam blocos de subclasses
const PADROES_FIM_CLASSE_BASE = [
  /^## (CAMINHO|COLÉGIO|CONTRATO|DOMÍNIO|CÍRCULO|ORIGEM|ARQU[ÉE]TIPO|TRADIÇÃO|JURAMENTO|TRADIÇÕES|ESCOLA DE|PATRONO)/i,
];

function extrairNivel(texto) {
  // Procura "no X° nível", "a partir do X° nível", "começando no X° nível"
  // ou "quando você atinge o X° nível"
  const re = /(?:no|a partir do|come[çc]ando no|quando voc[êe] atinge o)\s+(\d+)\s*[°ºo]\s+n[íi]vel/i;
  const m = texto.match(re);
  if (m) return parseInt(m[1]);
  // Procura "X° nível" no início do parágrafo
  const m2 = texto.match(/^\s*(\d+)\s*[°ºo]\s+n[íi]vel/i);
  if (m2) return parseInt(m2[1]);
  // Padrão: se mencionar "1° nível" também é nível 1 (mas o usual é não mencionar)
  return 1;  // default: ganha no nível 1
}

function parseClasseBlock(blockMd) {
  // Quebra o bloco em seções por heading `## XYZ`
  const linhas = blockMd.split('\n');
  const features = [];
  let curHeading = null;
  let curTexto = [];

  function fechar() {
    if (!curHeading) return;
    const h = curHeading.trim();
    if (IGNORAR_HEADINGS.has(h.toUpperCase())) { curHeading = null; curTexto = []; return; }
    const texto = curTexto.join(' ').replace(/\s+/g, ' ').trim();
    const nivel = extrairNivel(texto);
    features.push({
      nivel,
      nome: h,
      descricao: texto.slice(0, 400) + (texto.length > 400 ? '…' : ''),
    });
    curHeading = null;
    curTexto = [];
  }

  for (const linha of linhas) {
    const h = linha.match(/^## (.+?)\s*$/);
    if (h) {
      fechar();
      curHeading = h[1];
    } else {
      if (curHeading) curTexto.push(linha);
    }
  }
  fechar();
  return features;
}

function extrairClasse(nome) {
  // Acha onde começa a classe (## NOME) e onde começa a próxima classe
  const startRe = new RegExp(`^## ${nome.replace(/Á/g, '[ÁA]').replace(/É/g, '[ÉE]').replace(/Í/g, '[ÍI]').replace(/Ó/g, '[ÓO]').replace(/Ú/g, '[ÚU]').replace(/Ê/g, '[ÊE]')}\\s*$`, 'm');
  const startMatch = md.match(startRe);
  if (!startMatch) { console.warn('  ⚠ Não achei classe', nome); return null; }
  const startIdx = startMatch.index;

  // Próxima classe (ou subclasse) ou capítulo
  let endIdx = md.length;
  for (const outra of CLASSES) {
    if (outra === nome) continue;
    const re = new RegExp(`^## ${outra.replace(/Á/g, '[ÁA]').replace(/É/g, '[ÉE]').replace(/Í/g, '[ÍI]').replace(/Ó/g, '[ÓO]').replace(/Ú/g, '[ÚU]').replace(/Ê/g, '[ÊE]')}\\s*$`, 'm');
    const m = md.slice(startIdx + 10).match(re);
    if (m) {
      const idx = startIdx + 10 + m.index;
      if (idx < endIdx) endIdx = idx;
    }
  }

  // Pega só até começar a primeira subclasse (Caminho/Domínio/...)
  const bloco = md.slice(startIdx, endIdx);
  let blocoBase = bloco;
  for (const re of PADROES_FIM_CLASSE_BASE) {
    const linhas = bloco.split('\n');
    let fim = -1;
    for (let i = 0; i < linhas.length; i++) {
      if (re.test(linhas[i])) { fim = i; break; }
    }
    if (fim > 0) {
      const candidato = linhas.slice(0, fim).join('\n');
      if (candidato.length < blocoBase.length) blocoBase = candidato;
    }
  }

  return parseClasseBlock(blocoBase);
}

// ─── Executa ─────────────────────────────────────────────────────────
const resultado = {};
for (const classe of CLASSES) {
  console.log(`\n${classe}`);
  const features = extrairClasse(classe);
  if (!features) continue;
  // Ordena por nível
  features.sort((a, b) => a.nivel - b.nivel || a.nome.localeCompare(b.nome, 'pt'));
  const chave = classe.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  resultado[chave] = features;
  // Mostra resumo
  features.slice(0, 6).forEach(f => console.log(`  N${f.nivel}: ${f.nome}`));
  if (features.length > 6) console.log(`  ... +${features.length - 6}`);
}

fs.writeFileSync(OUT_PATH, JSON.stringify(resultado, null, 2), 'utf8');
console.log(`\n✓ ${path.relative(process.cwd(), OUT_PATH)} gerado: ${Object.keys(resultado).length} classes, ${Object.values(resultado).reduce((s, f) => s + f.length, 0)} habilidades`);

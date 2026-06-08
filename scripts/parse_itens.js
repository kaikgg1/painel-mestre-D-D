// scripts/parse_itens.js
// Extrai os itens mágicos do Guia do Mestre (docs/Mestre.txt) → data/itens_data.json
// Formato de uma entrada no texto:
//   NOME DO ITEM            (linha em MAIÚSCULAS)
//   Tipo, raridade (requer sintonização ...)
//   Descrição (várias linhas até a próxima entrada)
// Uso: node scripts/parse_itens.js
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'docs', 'Mestre.txt');
const OUT = path.join(__dirname, '..', 'data', 'itens_data.json');

const linhas = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);

const RARIDADE = /(raridade vari[áa]vel|muito rar[ao]|incomum|comum|rar[ao]|lend[áa]ri[ao]|artefato)/i;
// linha de "tipo, raridade" — começa com um tipo de item e contém raridade
const LINHA_TIPO = new RegExp(
  '^[A-Za-zÀ-ú][A-Za-zÀ-ú \\-\\/\\(\\)\\+]*,\\s*' + RARIDADE.source, 'i'
);

function ehNome(l) {
  const t = l.trim();
  if (t.length < 3 || t.length > 60) return false;
  if (!/[A-ZÀ-Ú]/.test(t)) return false;
  // todo em maiúsculas (ignorando dígitos/pontuação), e sem terminar em número (evita tabelas)
  if (t !== t.toUpperCase()) return false;
  if (/\d/.test(t)) return false;
  if (/^(CAPÍTULO|TABELA|APÊNDICE|PARTE)\b/.test(t)) return false;
  return true;
}

function limpar(txt) {
  return txt
    .replace(/\s*={5,}.*?={5,}\s*/g, ' ')      // marcadores de página
    .replace(/\s*\[Pág\.[^\]]*\]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const itens = [];
const vistos = new Set();

for (let i = 0; i < linhas.length - 1; i++) {
  if (!ehNome(linhas[i])) continue;
  // próxima linha não-vazia precisa ser "Tipo, raridade"
  let j = i + 1;
  while (j < linhas.length && !linhas[j].trim()) j++;
  if (j >= linhas.length) continue;
  const linhaTipo = linhas[j].trim();
  if (!LINHA_TIPO.test(linhaTipo)) continue;

  const nome = linhas[i].trim();
  const rarM = linhaTipo.match(RARIDADE);
  let raridade = rarM ? rarM[1].toLowerCase() : '';
  // normaliza gênero/variações p/ forma canônica
  if (/^rar/.test(raridade)) raridade = 'raro';
  else if (/^muito rar/.test(raridade)) raridade = 'muito raro';
  else if (/^lend/.test(raridade)) raridade = 'lendário';
  else if (/raridade vari/.test(raridade)) raridade = 'variável';
  const tipo = linhaTipo.split(',')[0].trim();
  const sintonia = /requer sintoniza/i.test(linhaTipo);
  const sintoniaDet = (linhaTipo.match(/requer sintoniza[çc][ãa]o([^)]*)/i) || [, ''])[1].trim();

  // descrição: da linha após a de tipo até o próximo nome de item (ou ~40 linhas)
  let desc = [];
  let k = j + 1, voltas = 0;
  while (k < linhas.length && voltas < 60) {
    const l = linhas[k];
    // próximo item começa?
    if (ehNome(l)) {
      let n = k + 1; while (n < linhas.length && !linhas[n].trim()) n++;
      if (n < linhas.length && LINHA_TIPO.test(linhas[n].trim())) break;
    }
    desc.push(l);
    k++; voltas++;
  }
  const descricao = limpar(desc.join(' '));
  if (descricao.length < 15) continue;          // provavelmente falso positivo

  const chave = nome.toLowerCase();
  if (vistos.has(chave)) continue;
  vistos.add(chave);

  itens.push({
    nome,
    tipo,
    raridade: raridade,
    sintonia,
    sintonia_detalhe: sintoniaDet,
    descricao: descricao.slice(0, 2000),
  });
}

// ordena por raridade depois nome
const ordemRar = { 'comum': 0, 'incomum': 1, 'variável': 1, 'raro': 2, 'muito raro': 3, 'lendário': 4, 'artefato': 5 };
itens.sort((a, b) => (ordemRar[a.raridade] ?? 9) - (ordemRar[b.raridade] ?? 9) || a.nome.localeCompare(b.nome, 'pt'));

fs.writeFileSync(OUT, JSON.stringify(itens), 'utf8');
console.log('OK itens_data.json gerado');
console.log('  Itens:', itens.length, '·', (fs.statSync(OUT).size / 1024).toFixed(0), 'KB');
const porRar = {};
itens.forEach(i => porRar[i.raridade] = (porRar[i.raridade] || 0) + 1);
console.log('  Por raridade:', JSON.stringify(porRar));
console.log('  Amostra:', itens.slice(0, 6).map(i => `${i.nome} (${i.tipo}, ${i.raridade})`).join(' | '));

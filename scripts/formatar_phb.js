// formatar_phb.js — Pós-processa docs/LivroDoJogador.txt → docs/LivroDoJogador.md
// Uso: node scripts/formatar_phb.js
// Pré-requisito: node scripts/extrair_pdf.js (gerou o .txt)
const fs = require('fs');
const path = require('path');

const arg = process.argv[2] || 'LivroDoJogador.txt';
const TXT_PATH = path.join(__dirname, '..', 'docs', arg);
const MD_PATH  = TXT_PATH.replace(/\.txt$/i, '.md');

if (!fs.existsSync(TXT_PATH)) {
  console.error(`❌ Arquivo não encontrado: ${TXT_PATH}`);
  console.error('   Rode primeiro: node scripts/extrair_pdf.js');
  process.exit(1);
}

const raw = fs.readFileSync(TXT_PATH, 'utf8');

// ── 1. Quebra por página ─────────────────────────────────────────────────────
const PAGE_MARK = /==========\s*\[Pág\.\s*(\d+)\/(\d+)\]\s*==========/g;
const pages = [];
let m, lastIdx = 0, lastNum = null, lastTotal = null;
while ((m = PAGE_MARK.exec(raw))) {
  if (lastNum !== null) {
    pages.push({ num: lastNum, total: lastTotal, text: raw.slice(lastIdx, m.index) });
  }
  lastNum   = +m[1];
  lastTotal = +m[2];
  lastIdx   = m.index + m[0].length;
}
if (lastNum !== null) pages.push({ num: lastNum, total: lastTotal, text: raw.slice(lastIdx) });

// ── 2. Limpeza por página ────────────────────────────────────────────────────
function isHeading(line) {
  const t = line.trim();
  if (t.length < 3 || t.length > 60) return false;
  if (!/^[A-ZÁÉÍÓÚÀÂÊÎÔÃÕÜÇÑ]/.test(t)) return false;
  // Só MAIÚSCULAS, números, espaços, hífens e pontuação leve
  if (!/^[A-ZÁÉÍÓÚÀÂÊÎÔÃÕÜÇÑ0-9\s\-'/.,()°ª]+$/.test(t)) return false;
  // Pelo menos uma letra
  if (!/[A-ZÁÉÍÓÚÀÂÊÎÔÃÕÜÇÑ]/.test(t)) return false;
  // Evita números soltos
  if (/^\d+$/.test(t)) return false;
  return true;
}

function formatPage(page) {
  const out = [];
  const lines = page.text.split('\n')
    .map(l => l.replace(/\s+$/, '')) // tira trailing whitespace
    .map(l => l.replace(/^\s+(?=\S)/, '')); // normaliza indentação só de espaços

  // Junta palavras quebradas: "para-" "lisar" → "paralisar"
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i];
    const nxt = lines[i + 1];
    if (/[a-záéíóúâêôãõç]-$/i.test(cur) && /^[a-záéíóúâêôãõç]/i.test(nxt)) {
      lines[i] = cur.slice(0, -1) + nxt.replace(/^(\S+)/, '$1');
      lines[i + 1] = nxt.replace(/^\S+\s?/, '');
    }
  }

  // Consolida linhas em parágrafos: blocos separados por linhas vazias
  let prevBlank = true;
  for (let raw of lines) {
    const l = raw.trim();
    if (!l) {
      if (!prevBlank) out.push('');
      prevBlank = true;
      continue;
    }
    if (isHeading(l)) {
      // Heading: garante linha em branco antes/depois
      if (out.length && out[out.length - 1] !== '') out.push('');
      // Title-case suave para legibilidade
      out.push(`## ${l}`);
      out.push('');
      prevBlank = true;
      continue;
    }
    out.push(l);
    prevBlank = false;
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ── 3. Monta saída ───────────────────────────────────────────────────────────
const total = pages.length;
const nomeBase = path.basename(TXT_PATH, '.txt');
const titulo = nomeBase.replace(/([A-Z])/g, ' $1').replace(/^\s/, '') + ' — D&D 5e';
const lines = [
  `# ${titulo}`,
  '',
  `> Extração textual de \`${nomeBase}.pdf\`.`,
  `> ${total} páginas processadas. Cabeçalhos em CAPS no original viram \`## Título\`.`,
  '',
  '> ⚠️ Conteúdo protegido por direitos autorais — uso pessoal, não distribuir.',
  '',
  '---',
  ''
];

let conteudoPaginas = 0, vaziasPaginas = 0;
for (const p of pages) {
  const formatted = formatPage(p);
  if (!formatted) { vaziasPaginas++; continue; }
  conteudoPaginas++;
  lines.push(`<!-- Pág. ${p.num}/${p.total} -->`);
  lines.push('');
  lines.push(formatted);
  lines.push('');
  lines.push('---');
  lines.push('');
}

fs.writeFileSync(MD_PATH, lines.join('\n'), 'utf8');
const sizeKB = (fs.statSync(MD_PATH).size / 1024).toFixed(0);
console.log(`✓ Formatação concluída`);
console.log(`  Páginas com conteúdo: ${conteudoPaginas}/${total} (${vaziasPaginas} vazias puladas)`);
console.log(`  Tamanho: ${sizeKB} KB`);
console.log(`  Saída:   ${path.relative(process.cwd(), MD_PATH)}`);

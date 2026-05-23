// extrair_pdf.js — Extrai texto do docs/LivroDoJogador.pdf para docs/LivroDoJogador.txt
// Uso: node scripts/extrair_pdf.js
// Pré-requisito: npm install
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const PDF_PATH = path.join(__dirname, '..', 'docs', 'LivroDoJogador.pdf');
const TXT_PATH = path.join(__dirname, '..', 'docs', 'LivroDoJogador.txt');

if (!fs.existsSync(PDF_PATH)) {
  console.error(`❌ PDF não encontrado: ${PDF_PATH}`);
  console.error('   Coloque o LivroDoJogador.pdf em docs/ e tente de novo.');
  process.exit(1);
}

const pdfBuffer = fs.readFileSync(PDF_PATH);

// Renderiza cada página com marcador "[Pág. N]" para facilitar referência
const pageTexts = [];
function renderPage(pageData) {
  const opts = { normalizeWhitespace: false, disableCombineTextItems: false };
  return pageData.getTextContent(opts).then(textContent => {
    let lastY = null;
    let text = '';
    for (const item of textContent.items) {
      if (lastY !== null && Math.abs(lastY - item.transform[5]) > 1) text += '\n';
      text += item.str;
      lastY = item.transform[5];
    }
    pageTexts.push(text);
    return text;
  });
}

pdfParse(pdfBuffer, { pagerender: renderPage }).then(data => {
  const total = pageTexts.length;
  const out = pageTexts.map((t, i) => `\n\n========== [Pág. ${i + 1}/${total}] ==========\n\n${t}`).join('');

  fs.writeFileSync(TXT_PATH, out, 'utf8');
  const sizeKB = (fs.statSync(TXT_PATH).size / 1024).toFixed(0);
  console.log(`✓ Extração concluída`);
  console.log(`  Páginas: ${total}`);
  console.log(`  Tamanho: ${sizeKB} KB`);
  console.log(`  Saída:   ${path.relative(process.cwd(), TXT_PATH)}`);
}).catch(err => {
  console.error('❌ Erro ao processar PDF:', err.message);
  process.exit(1);
});

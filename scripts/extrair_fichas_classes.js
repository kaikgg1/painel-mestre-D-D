// Extrai texto de cada PDF "ficha XXX.pdf" pra docs/fichas_txt/
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const DOCS = path.join(__dirname, '..', 'docs');
const OUT  = path.join(DOCS, 'fichas_txt');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const arquivos = fs.readdirSync(DOCS).filter(f => /^ficha .+\.pdf$/i.test(f));
  console.log('Encontrados', arquivos.length, 'PDFs');
  for (const arq of arquivos) {
    const data = await pdfParse(fs.readFileSync(path.join(DOCS, arq)));
    const safe = arq.toLowerCase().replace(/\s+/g,'_').replace(/\.pdf$/,'.txt');
    fs.writeFileSync(path.join(OUT, safe), data.text, 'utf8');
    console.log(`  ✓ ${arq} → ${safe} (${(data.text.length/1024).toFixed(0)} KB)`);
  }
  console.log('Pronto');
})();

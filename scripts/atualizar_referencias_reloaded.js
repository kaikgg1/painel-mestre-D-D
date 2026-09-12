// scripts/atualizar_referencias_reloaded.js
// Depois de scripts/reprocessar_reloaded.js (perf-2), atualiza todas as
// referências img/*.png|jpg em paineis/reloaded/*.html pra apontar pro
// .webp gerado — só troca a extensão, então URL-encoding de espaços etc.
// no nome do arquivo continua igual.
const fs = require('fs');
const path = require('path');

const DIR_HTML = path.join(__dirname, '..', 'paineis', 'reloaded');
const REGEX = /(img\/[^"'\s)]+)\.(png|jpe?g)(?=["'\s)])/gi;

const arquivos = fs.readdirSync(DIR_HTML).filter(f => f.endsWith('.html'));
let totalTrocas = 0;
for (const nome of arquivos) {
  const caminho = path.join(DIR_HTML, nome);
  const html = fs.readFileSync(caminho, 'utf8');
  let trocas = 0;
  const novo = html.replace(REGEX, (match, base) => { trocas++; return base + '.webp'; });
  if (trocas > 0) {
    fs.writeFileSync(caminho, novo);
    console.log(nome + ':', trocas, 'referências atualizadas');
    totalTrocas += trocas;
  }
}
console.log('\nTotal:', totalTrocas, 'referências trocadas em', arquivos.filter(a => true).length, 'arquivos verificados');

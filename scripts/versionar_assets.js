// scripts/versionar_assets.js
// Cache busting: acrescenta ?v=<hash do conteúdo> em todo <script src> e
// <link href> local que aponta pra .js/.css nas páginas HTML.
//
// Por quê: o GitHub Pages manda os arquivos com cache de ~10 min. Depois de um
// deploy, o navegador do jogador podia pegar o HTML novo com o JS antigo (ou o
// contrário) e a página quebrava até o cache expirar. Com o hash na URL, um
// arquivo alterado vira uma URL nova, e o que não mudou continua em cache.
//
// Também versiona strings 'arquivo.js' dentro de JS quando o caminho resolve
// a partir da pasta do próprio JS (ex.: paineis/reloaded/busca.js carregando
// busca-indice.js, que é regenerado pelo gerar_indice_reloaded.js).
//
// Uso:
//   npm run versionar              → atualiza os ?v= que mudaram
//   npm run versionar -- --verificar  → só confere; sai com erro se algo está desatualizado
//
// O hook .githooks/pre-commit roda o --verificar antes de cada commit.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const VERIFICAR = process.argv.includes('--verificar');

const rastreados = execSync('git ls-files -- "*.html" "*.js"', { cwd: RAIZ, encoding: 'utf8' })
  .split('\n').filter(f => f && !f.startsWith('scripts/') && !f.startsWith('node_modules/'));

const hashes = {};
function hashDe(arq) {
  if (!hashes[arq]) hashes[arq] = crypto.createHash('md5').update(fs.readFileSync(arq)).digest('hex').slice(0, 8);
  return hashes[arq];
}
function local(url) {
  return !/^(https?:)?\/\//.test(url) && !url.startsWith('data:');
}

const alterados = new Set();
function processar(rel, regex) {
  const arq = path.join(RAIZ, rel);
  const dir = path.dirname(arq);
  const antes = fs.readFileSync(arq, 'utf8');
  const depois = antes.replace(regex, (m, pre, url, _v, pos) => {
    if (!local(url)) return m;
    const alvo = path.resolve(dir, url);
    if (alvo === arq || !fs.existsSync(alvo)) return m;
    return pre + url + '?v=' + hashDe(alvo) + pos;
  });
  if (depois === antes) return false;
  alterados.add(rel);
  if (!VERIFICAR) { fs.writeFileSync(arq, depois); delete hashes[arq]; }
  return true;
}

// 1º os JS (o hash deles muda se ganharem ?v=), depois o HTML que aponta pra eles.
// Um JS pode apontar pra outro JS, então repete até estabilizar.
const JS = rastreados.filter(f => f.endsWith('.js') && !f.includes('/vendor/'));
for (let volta = 0; ; volta++) {
  let mudou = false;
  for (const rel of JS) mudou = processar(rel, /(['"])([\w./-]+\.(?:js|css))(\?v=[0-9a-f]+)?(['"])/g) || mudou;
  if (!mudou || VERIFICAR) break;
  if (volta === 5) { console.error('✖ referências circulares entre JS: as versões não estabilizam'); process.exit(1); }
}
for (const rel of rastreados.filter(f => f.endsWith('.html'))) {
  processar(rel, /(<(?:script|link)\b[^>]*?\b(?:src|href)=")([^"?#]+\.(?:js|css))(\?v=[0-9a-f]+)?(")/g);
}

if (VERIFICAR) {
  if (alterados.size) {
    const lista = [...alterados];
    console.error('✖ ?v= desatualizado em ' + lista.length + ' arquivo(s): ' + lista.slice(0, 8).join(', ') + (lista.length > 8 ? ', …' : ''));
    console.error('  Rode: npm run versionar   (e adicione os arquivos ao commit)');
    process.exit(1);
  }
  console.log('✔ versões dos assets em dia');
} else {
  console.log(alterados.size ? '✔ ' + alterados.size + ' arquivo(s) atualizados' : '✔ nada a atualizar');
}

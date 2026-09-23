// scripts/gerar_indice_reloaded.js
// Gera o índice que a busca da lateral usa. As páginas do guia são estáticas
// (sem gerador), então este script lê os .html prontos e extrai o texto de
// dentro de <main class="article">, quebrado por seção (cada h1..h4 com id
// vira uma entrada com âncora própria).
//
// Sai em dois arquivos, ambos carregados sob demanda (só quando alguém usa a
// busca) e em paralelo:
//   busca-indice.js  títulos + cabeçalhos (leve, responde no primeiro toque)
//   busca-texto.js   o corpo de cada seção, alinhado por índice com o de cima
//
// Rode de novo sempre que editar/adicionar páginas:
//   node scripts/gerar_indice_reloaded.js
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'paineis', 'reloaded');
const SAIDA = path.join(DIR, 'busca-indice.js');
const SAIDA_TEXTO = path.join(DIR, 'busca-texto.js');

const ENTIDADES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', times: '×', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', eacute: 'é', ccedil: 'ç', aacute: 'á', oacute: 'ó',
};

function decodificar(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (todo, cod) => {
    if (cod[0] === '#') {
      const num = cod[1] === 'x' || cod[1] === 'X'
        ? parseInt(cod.slice(2), 16) : parseInt(cod.slice(1), 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : todo;
    }
    return ENTIDADES[cod] !== undefined ? ENTIDADES[cod] : todo;
  });
}

function texto(html) {
  return decodificar(
    html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

// ---- grupo (capítulo/ato) de cada página, tirado da árvore da lateral ----
function mapaDeGrupos(htmlIndice) {
  const grupos = {};
  const re = /<details>\s*<summary>[\s\S]*?<\/span>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g;
  let m;
  while ((m = re.exec(htmlIndice))) {
    const grupo = texto(m[1]);
    const links = m[2].match(/href="([^"]+\.html)"/g) || [];
    links.forEach(l => { grupos[l.slice(6, -1)] = grupo; });
  }
  return grupos;
}

const arquivos = fs.readdirSync(DIR)
  .filter(f => f.endsWith('.html') && f !== 'index.html')
  .sort();

const grupos = mapaDeGrupos(fs.readFileSync(path.join(DIR, 'index.html'), 'utf8'));
const paginas = [];
let totalSecoes = 0;

for (const nome of arquivos) {
  const html = fs.readFileSync(path.join(DIR, nome), 'utf8');
  const main = html.match(/<main class="article"[^>]*>([\s\S]*?)<\/main>/);
  if (!main) { console.log('sem <main>, pulando:', nome); continue; }

  const tituloEl = html.match(/<h1 class="page-title"[^>]*>([\s\S]*?)<\/h1>/)
    || html.match(/<div class="page-title"[^>]*>([\s\S]*?)<\/div>/);
  const titulo = tituloEl ? texto(tituloEl[1])
    : texto((html.match(/<title>([\s\S]*?)<\/title>/) || [, nome])[1]).split('—')[0].trim();

  const corpo = main[1];
  // quebra por cabeçalho: cada pedaço vira uma seção com sua própria âncora
  const re = /<h([1-4])\b([^>]*)>([\s\S]*?)<\/h\1>/g;
  const cortes = [];
  let m;
  while ((m = re.exec(corpo))) {
    const id = (m[2].match(/id="([^"]*)"/) || [, ''])[1];
    cortes.push({ pos: m.index, fim: re.lastIndex, id, h: texto(m[3]), n: +m[1] });
  }

  const secoes = [];
  // k = posição do cabeçalho entre os h1..h4 da página, na ordem do documento.
  // Serve de âncora pras seções sem id (statblocks, por exemplo): a busca acha
  // o mesmo elemento no DOM contando na mesma ordem.
  const push = (h, id, bruto, n, k) => {
    const t = texto(bruto);
    if (!t && !h) return;
    secoes.push({ h: h || '', i: id || '', n: n || 0, k: k, x: t });
  };

  if (!cortes.length) {
    push('', '', corpo, 0, -1);
  } else {
    const intro = texto(corpo.slice(0, cortes[0].pos));
    if (intro) push('', '', corpo.slice(0, cortes[0].pos), 0, -1);
    cortes.forEach((c, k) => {
      const ate = k + 1 < cortes.length ? cortes[k + 1].pos : corpo.length;
      push(c.h, c.id, corpo.slice(c.fim, ate), c.n, k);
    });
  }

  totalSecoes += secoes.length;
  paginas.push({ u: nome, t: titulo, g: grupos[nome] || '', s: secoes });
}

// separa corpo (pesado) de cabeçalhos (leve): o leve chega primeiro e já deixa
// a busca responder; o texto entra na mesma estrutura quando terminar de carregar.
const textos = paginas.map(p => p.s.map(sec => sec.x));
const leve = JSON.stringify({
  paginas: paginas.map(p => ({
    u: p.u, t: p.t, g: p.g,
    s: p.s.map(sec => ({ h: sec.h, i: sec.i, n: sec.n, k: sec.k })),
  })),
});
const pesado = JSON.stringify(textos);

const aviso = '// Gerado por scripts/gerar_indice_reloaded.js — não edite à mão.\n';
fs.writeFileSync(SAIDA, aviso + 'window.RELOADED_BUSCA = ' + leve + ';\n', 'utf8');
fs.writeFileSync(SAIDA_TEXTO, aviso + 'window.RELOADED_BUSCA_TEXTO = ' + pesado + ';\n', 'utf8');

const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log(
  paginas.length + ' páginas, ' + totalSecoes + ' seções → ' +
  'busca-indice.js (' + kb(leve.length) + ') + busca-texto.js (' + kb(pesado.length) + ')'
);

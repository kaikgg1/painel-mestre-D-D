// scripts/parse_itens.js
// Extrai os itens mágicos do Guia do Mestre (docs/livros/Mestre.md) → data/itens_data.json
// Uso: npm run parse-itens
//
// Formato de uma entrada no .md (texto do PDF, quebrado nas linhas do livro):
//   ## NOME DO ITEM
//   Tipo, raridade (requer sintonização ...)      ← pode quebrar em 2 linhas
//   Descrição…
//
// O que este parser trata (cada item corresponde a um defeito que já existiu):
// - Título ou linha de tipo quebrados em duas linhas ("ESPADA DECEPADORA" /
//   "Arma (…), muito" + "rara (…)"): antes o item não era reconhecido e a
//   descrição dele era colada no item anterior.
// - Erros de OCR do livro: "muito ara", "MARAVILLHAS".
// - Seções do capítulo que não são itens ("Itens Mágicos Inteligentes",
//   "Artefatos"): encerram o item anterior em vez de virar parte dele.
// - Tabelas que a diagramação jogou no meio de outro item (ex.: a tabela do
//   Baralho das Ilusões no meio do Baralho das Surpresas): voltam pro dono.
// - Parágrafos (o PDF só tem quebra de linha): reconstruídos pela linha curta
//   terminada em pontuação.
//
// Marcação na `descricao` (renderizada por Compendio e DetalhesCatalogo):
//   parágrafos separados por linha em branco; linhas de tabela por "\n";
//   **negrito** (subtítulos e aberturas tipo "Maldição.") e *itálico* (magias).
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'docs', 'livros', 'Mestre.md');
const OUT = path.join(__dirname, '..', 'data', 'itens_data.json');
const MAGIAS = path.join(__dirname, '..', 'data', 'magias_data.json');

// Faixa do capítulo de itens (do primeiro item do A–Z até "Outras Recompensas").
const INICIO = '## ADAGA DE ENVENENAMENTO';
const FIM = '## OUTRAS RECOMPENSAS';

// Títulos de seção do capítulo — não são itens nem pertencem ao item anterior.
const SECOES = new Set(['ITENS MÁGICOS INTELIGENTES', 'ARTEFATOS']);
const ATRIBUTOS = new Set(['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR']);
const NOME_FIX = { 'VARINHA DAS MARAVILLHAS': 'VARINHA DAS MARAVILHAS' };

const TIPO = /^(Arma|Armadura|Anel|Bast[ãa]o|Cajado|Varinha|Po[çc][ãa]o|Pergaminho|Item maravilhoso|Escudo|Muni[çc][ãa]o)\b[^,]{0,90},/i;
const LARGURA_CURTA = 47;   // linha do livro bem menor que a coluna (~55-60 chars)

const todas = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
const ini = todas.findIndex(l => l.trim() === INICIO);
const fim = todas.findIndex((l, i) => i > ini && l.trim() === FIM);
if (ini < 0 || fim < 0) throw new Error('não achei a faixa do capítulo de itens em ' + SRC);

// Remove artefatos de página: separador, comentário "Pág.", número da página.
const L = todas.slice(ini, fim)
  .map(l => l.replace(/\s+$/, ''))
  .filter(l => l.trim() && l.trim() !== '---' && !/^<!--.*-->$/.test(l.trim()) && !/^\d{1,3}$/.test(l.trim()));

const ehTitulo = l => l.startsWith('## ');
const tituloDe = l => l.slice(3).trim();

// Linha de tipo pode continuar na próxima ("…, muito" / "rara (requer…)",
// "…ou muito rara" / "(+3)").
function lerTipo(i) {
  let t = L[i].trim(), j = i;
  const abreParenteses = () => /^\([^)]{0,60}\)/.test(L[j + 1].trim()) && L[j + 1].trim().length <= 60;
  while (j + 1 < L.length && !ehTitulo(L[j + 1]) &&
         (/[,(]$|\b(muito|ou|e)$|\(requer sintoniza[^)]*$/.test(t) ||
          (t.lastIndexOf('(') > t.lastIndexOf(')')) || abreParenteses())) {
    t += ' ' + L[++j].trim();
  }
  return { texto: t, fim: j };
}

function raridadeDe(tipo) {
  const t = tipo.toLowerCase();
  // várias raridades na mesma linha ("incomum (+1), raro (+2) ou muito raro (+3)")
  const achadas = (t.match(/muito\s+a?ra|lend[áa]ri|artefato|incomum|\bcomum|\brar[ao]/g) || [])
    .map(r => r.startsWith('muito') ? 'muito raro' : r);
  if (new Set(achadas).size > 1) return 'variável';
  if (/muito\s+a?ra/.test(t)) return 'muito raro';
  if (/raridade (vari|depende)/.test(t)) return 'variável';
  if (/lend[áa]ri/.test(t)) return 'lendário';
  if (/artefato/.test(t)) return 'artefato';
  if (/incomum/.test(t)) return 'incomum';
  if (/\bcomum/.test(t)) return 'comum';
  if (/\brar[ao]/.test(t)) return 'raro';
  return '';
}

// ── 1ª passada: separa itens e seus blocos de linhas ────────────────────
const itens = [];
let atual = null;       // item que recebe o texto corrido
let dono = null;        // quem recebe a tabela em andamento (pode ser outro item)
let emSecao = false;    // texto de seção do capítulo: descartado
let tabela = false;
let ultimaFisica = '';  // última linha (como está no livro) lida dentro de uma tabela
let retomar = null;     // parágrafo interrompido por um quadro, sendo completado

for (let i = 0; i < L.length; i++) {
  let l = L[i];
  // título que o conversor do PDF não marcou com "##" (os que têm dígito:
  // "ARMA +1, +2 OU +3"): linha toda em maiúsculas seguida da linha de tipo.
  if (!ehTitulo(l) && l.length <= 60 && /[A-ZÀ-Ú]{3}/.test(l) && l === l.toUpperCase() &&
      i + 1 < L.length && TIPO.test(L[i + 1])) {
    l = '## ' + l.trim();
  }
  if (ehTitulo(l)) {
    let nome = tituloDe(l);
    // título quebrado em 2 linhas: "## AMULETO … E" + "## LOCALIZAÇÃO" + tipo
    if (i + 2 < L.length && ehTitulo(L[i + 1]) && !TIPO.test(L[i + 1]) && TIPO.test(L[i + 2]) && !TIPO.test(L[i + 1].slice(3))) {
      nome += ' ' + tituloDe(L[i + 1]); i++;
    }
    if (i + 1 < L.length && TIPO.test(L[i + 1])) {
      const { texto, fim: j } = lerTipo(i + 1);
      nome = NOME_FIX[nome] || nome;
      atual = dono = { nome, tipoLinha: texto, blocos: [] };
      itens.push(atual);
      emSecao = false; tabela = false; retomar = null;
      i = j;
      continue;
    }
    if (SECOES.has(nome)) { emSecao = true; atual = dono = null; continue; }
    if (emSecao || !atual) continue;
    if (ATRIBUTOS.has(nome)) {   // bloco de estatísticas de criatura: "FOR" / "16 (+3)"
      const v = (i + 1 < L.length && !ehTitulo(L[i + 1])) ? L[++i].trim() : '';
      const alvo = dono || atual;
      const ult = alvo.blocos[alvo.blocos.length - 1];
      const par = `${nome} ${v}`;
      if (ult && ult.tipo === 'atrib') ult.linhas.push(par); else alvo.blocos.push({ tipo: 'atrib', linhas: [par] });
      continue;
    }
    // subtítulo: se nomeia outro item (tabela fora do lugar), a tabela vai pra ele
    const outro = itens.find(x => x !== atual && nome.includes(x.nome));
    dono = outro || atual;
    dono.blocos.push({ tipo: 'sub', texto: nome });
    tabela = true; retomar = null;
    continue;
  }
  if (emSecao || !atual) continue;

  const t = l.trim();
  if (tabela && /^[a-zà-ú]/.test(t)) {
    // Quadro diagramado no meio de uma frase ("…reverter a forma de" [ficha da
    // Mosca Gigante] "estátua. Se você…"): a minúscula completa a frase do item.
    const ut = [...atual.blocos].reverse().find(b => b.tipo === 'txt');
    if (ut && !/[.!?:)]$/.test(ut.linhas[ut.linhas.length - 1])) {
      tabela = false; dono = atual; retomar = ut;
    }
  }
  if (retomar) {
    retomar.linhas.push(t);
    if (/[.!?:]$/.test(t) && t.length < LARGURA_CURTA) retomar = null;
    continue;
  }
  if (tabela) {
    const ult = dono.blocos[dono.blocos.length - 1];
    const emTab = ult && ult.tipo === 'tab';
    // Continua a linha anterior da tabela: começa minúscula, ou a linha física
    // anterior encheu a coluna sem fechar a frase ("…enviado para o Plano" /
    // "Etéreo. O objeto…").
    const continua = emTab && !/^\d/.test(t) &&
      (/^[a-zà-ú(]/.test(t) || (ultimaFisica.length >= LARGURA_CURTA && !/[.!?:)]$/.test(ultimaFisica)));
    // A tabela só acaba quando volta um trecho de texto corrido: esta linha e
    // a próxima com largura de coluna (uma linha de tabela longa sozinha não basta).
    const prox = i + 1 < L.length && !ehTitulo(L[i + 1]) ? L[i + 1].trim() : '';
    const corrido = !/^\d/.test(t) && t.length >= LARGURA_CURTA && prox.length >= LARGURA_CURTA - 7 && !/^\d/.test(prox);
    if (continua || !corrido) {
      if (continua) ult.linhas[ult.linhas.length - 1] += ' ' + t;
      else if (emTab) ult.linhas.push(t);
      else dono.blocos.push({ tipo: 'tab', linhas: [t] });
      ultimaFisica = t;
      continue;
    }
    tabela = false; dono = atual;   // voltou o texto corrido: é do item atual
  }
  const ult = atual.blocos[atual.blocos.length - 1];
  if (ult && ult.tipo === 'txt') ult.linhas.push(t); else atual.blocos.push({ tipo: 'txt', linhas: [t] });
}

// ── 2ª passada: texto final com parágrafos e marcação ───────────────────
const nomesMagias = (() => {
  try {
    const m = JSON.parse(fs.readFileSync(MAGIAS, 'utf8'));
    const lista = Array.isArray(m) ? m : Object.values(m).find(Array.isArray) || [];
    return lista.map(x => x.nome.toLowerCase()).sort((a, b) => b.length - a.length);
  } catch { return []; }
})();
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RE_MAGIA = nomesMagias.length
  ? new RegExp(`(\\b(?:magias?|conjur(?:ar|a|ando|ado|ada|á-la|á-lo)|lan[çc]ar)\\s+)(${nomesMagias.map(esc).join('|')})(?![\\wà-ú])`, 'gi')
  : null;

// "Maldição. Esta espada…" → abertura em negrito. Curta, sem verbo de frase comum.
const RE_ABERTURA = /^([A-ZÀ-Ú][^.!?:]{1,45}?)\.\s+(?=[A-ZÀ-Ú(])/;
function abertura(p) {
  const m = p.match(RE_ABERTURA);
  if (!m) return p;
  const palavras = m[1].trim().split(/\s+/);
  if (palavras.length > 5) return p;
  if (/^(Você|Ele|Ela|Eles|Elas|Isso|Este|Esta|Esse|Essa|Se|Quando|Enquanto|Seu|Sua)$/.test(palavras[0])) return p;
  // artigo só em nome curto ("As parcas.", "O Vácuo." — cartas do Baralho das Surpresas)
  if (/^(O|A|Os|As|Um|Uma)$/.test(palavras[0]) && palavras.length > 3) return p;
  return `**${m[1].trim()}.** ` + p.slice(m[0].length);
}

function paragrafos(linhas) {
  const ps = [];
  let p = '';
  linhas.forEach((l, k) => {
    // hifenização de fim de linha: "desa-" + "parecer"
    p = p ? (/[a-zà-ú]-$/.test(p) && /^[a-zà-ú]/.test(l) ? p.slice(0, -1) + l : p + ' ' + l) : l;
    const fimParagrafo = /[.!?:]["”)]?$/.test(l) && l.length < LARGURA_CURTA;
    if (fimParagrafo || k === linhas.length - 1) { ps.push(p); p = ''; }
  });
  return ps;
}

function montar(item) {
  const partes = [];
  for (const b of item.blocos) {
    if (b.tipo === 'sub') partes.push(`**${b.texto.charAt(0) + b.texto.slice(1).toLowerCase()}**`);
    else if (b.tipo === 'tab') partes.push(b.linhas.join('\n'));
    else if (b.tipo === 'atrib') partes.push(b.linhas.join(' · '));
    else partes.push(...paragrafos(b.linhas).map(abertura));
  }
  let texto = partes.join('\n\n');
  if (RE_MAGIA) texto = texto.replace(RE_MAGIA, (_, pre, magia) => `${pre}*${magia}*`);
  return texto.replace(/[ \t]+/g, ' ').trim();
}

// Imagens: associação manual feita sobre as pranchas do livro (commit cb06d0e).
// Preservada por nome — itens novos ficam sem imagem até alguém conferir a prancha.
const imagens = {};
try { for (const it of JSON.parse(fs.readFileSync(OUT, 'utf8'))) if (it.imagem) imagens[NOME_FIX[it.nome] || it.nome] = it.imagem; } catch {}

const vistos = new Set();
const saida = [];
for (const it of itens) {
  if (vistos.has(it.nome)) continue;
  vistos.add(it.nome);
  const tipoLinha = it.tipoLinha.replace(/\s+/g, ' ');
  const descricao = montar(it);
  if (descricao.length < 15) continue;
  const obj = {
    nome: it.nome,
    tipo: tipoLinha.match(/^(?:[^,(]|\([^)]*\))*/)[0].trim(),   // até a 1ª vírgula fora de parênteses
    raridade: raridadeDe(tipoLinha),
    sintonia: /requer sintoniza/i.test(tipoLinha),
    sintonia_detalhe: (tipoLinha.match(/requer sintoniza[çc][ãa]o([^)]*)/i) || [, ''])[1].trim(),
    linha_tipo: tipoLinha.replace(/muito ara\b/, 'muito rara'),   // como está no livro (subtítulo da ficha)
    descricao,
  };
  if (imagens[it.nome]) obj.imagem = imagens[it.nome];
  saida.push(obj);
}

const ordemRar = { 'comum': 0, 'incomum': 1, 'variável': 1, 'raro': 2, 'muito raro': 3, 'lendário': 4, 'artefato': 5 };
saida.sort((a, b) => (ordemRar[a.raridade] ?? 9) - (ordemRar[b.raridade] ?? 9) || a.nome.localeCompare(b.nome, 'pt'));

fs.writeFileSync(OUT, JSON.stringify(saida), 'utf8');
const porRar = {};
saida.forEach(i => porRar[i.raridade] = (porRar[i.raridade] || 0) + 1);
console.log('OK itens_data.json gerado');
console.log('  Itens:', saida.length, '·', (fs.statSync(OUT).size / 1024).toFixed(0), 'KB', '· com imagem:', saida.filter(i => i.imagem).length);
console.log('  Por raridade:', JSON.stringify(porRar));

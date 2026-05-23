// Parser magias.md → magias_data.json
const fs = require('fs');

const lines = fs.readFileSync('magias.md', 'utf8')
  .split('\n').map(l => l.replace(/\r$/, '').trim());

// ── Helpers ───────────────────────────────────────────────────────────────────
const CLASSE_MAP = {
  'BARDO':'Bardo','BRUXO':'Bruxo','CLÉRIGO':'Clérigo','DRUIDA':'Druida',
  'FEITICEIRO':'Feiticeiro','MAGO':'Mago','PALADINO':'Paladino','PATRULHEIRO':'Patrulheiro'
};
const ESCOLA_PREFIX = [
  ['abjura','Abjuração'],['conjura','Conjuração'],['adivinha','Adivinhação'],
  ['encantamento','Encantamento'],['evoca','Evocação'],['ilus','Ilusão'],
  ['necro','Necromancia'],['transmuta','Transmutação']
];
function capEscola(s) {
  const low = (s||'').toLowerCase();
  for (const [k,v] of ESCOLA_PREFIX) if (low.startsWith(k)) return v;
  return s;
}

// Artigos/preposições que ficam minúsculas no título (exceto posição 0)
const LOWER_WORDS = new Set([
  'de','da','do','das','dos','na','no','nas','nos','e','ou',
  'a','o','as','os','com','em','por','para','ao','à','às',
  'um','uma','sem','contra','entre','sobre','mas','se','que','nem'
]);

function normName(capsLine) {
  // Trata "/" como separador de palavra adicional
  return capsLine.split(' ').map((word, wi) => {
    if (!word) return word;
    if (word.includes('/')) {
      return word.split('/').map((part, pi) => {
        if (!part) return part;
        const pl = part.toLowerCase();
        if ((wi > 0 || pi > 0) && LOWER_WORDS.has(pl)) return pl;
        return pl[0].toUpperCase() + pl.slice(1);
      }).join('/');
    }
    const wl = word.toLowerCase();
    if (wi > 0 && LOWER_WORDS.has(wl)) return wl;
    return wl[0].toUpperCase() + wl.slice(1);
  }).join(' ');
}

function isCapsName(l) {
  return /^[A-ZÁÉÍÓÚÀÂÊÎÔÃÕÜÇÑ][A-ZÁÉÍÓÚÀÂÊÎÔÃÕÜÇÑ\s\/\-']{2,}$/.test(l) && !/\d/.test(l);
}

// Correções de nomes que ficam errados por quebra de página ou erro de grafia
const NAME_FIXES = {
  'Adagas':                 'Nuvem de Adagas',
  'Incendiária':            'Nuvem Incendiária',
  'Infligir Ferimentos':    'Infringir Ferimentos',  // sinônimo no livro
};

// ── 1. Classes por magia ──────────────────────────────────────────────────────
const spellClasses = {}; // nome (como está no livro) → Set<classe>
const descStart = lines.findIndex(l => l === 'DESCRIÇÕES DAS MAGIAS');
let curClasse = null;

for (let i = 0; i < descStart; i++) {
  const l = lines[i];
  if (!l) continue;
  const cm = l.match(/^MAGIAS DE (.+)$/);
  if (cm) { curClasse = CLASSE_MAP[cm[1]] || null; continue; }
  if (/^TRUQUES|^\d[°º]\s*NÍVEL/i.test(l) || /^\d{1,3}$/.test(l)) continue;
  if (!curClasse) continue;

  const sm = l.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  let nome = null;
  if (sm) {
    nome = sm[1].trim();
  } else if (!l.startsWith('(') && lines[i+1]?.startsWith('(')) {
    nome = l.trim();
  }
  if (nome) {
    if (!spellClasses[nome]) spellClasses[nome] = new Set();
    spellClasses[nome].add(curClasse);
  }
}

// ── 2. Parse de descrições ────────────────────────────────────────────────────
function parseHeader(line) {
  const l = (line || '').toLowerCase();
  const ritual = l.includes('ritual');
  if (l.startsWith('truque')) {
    const m = l.match(/truque de ([a-záéíóúàâêîôãõüçñ]+)/);
    return { nivel: 0, escola: capEscola(m?.[1] || ''), ritual };
  }
  const m = l.match(/(\d)[°º]\s+n[íi]vel de ([a-záéíóúàâêîôãõüçñ]+)/);
  if (m) return { nivel: +m[1], escola: capEscola(m[2]), ritual };
  return null;
}

function stripLabel(line, label) {
  return line.replace(new RegExp(`^${label}\\s*:\\s*`, 'i'), '').trim();
}

const magias = [];
const body = lines.slice(descStart + 2);
let i = 0;

while (i < body.length) {
  const l = body[i];
  if (!l || !isCapsName(l)) { i++; continue; }

  let nomeRaw  = l;
  let nomeNorm = normName(l);
  i++;

  // Pula linhas vazias/página até achar cabeçalho de nível
  while (i < body.length && (!body[i] || /^\d{1,3}$/.test(body[i]))) i++;
  if (i >= body.length) break;

  const header = parseHeader(body[i]);
  if (!header) continue;
  const { nivel, escola, ritual } = header;
  i++;

  // Aplica correções de nome
  if (NAME_FIXES[nomeNorm]) nomeNorm = NAME_FIXES[nomeNorm];

  let tempoCast = '', alcance = '', componentes = '', material = '', duracao = '';
  let concentracao = false;
  const descParts = [], maiorParts = [];
  let phase = 'campos'; // → 'desc' → 'maior'

  function readComps() {
    let raw = stripLabel(body[i], 'Componentes'); i++;
    // Material pode ter parênteses em múltiplas linhas
    let depth = (raw.match(/\(/g)||[]).length - (raw.match(/\)/g)||[]).length;
    while (depth > 0 && i < body.length) {
      const nx = body[i];
      if (!nx || isCapsName(nx)) break;
      raw += ' ' + nx; i++;
      depth += (nx.match(/\(/g)||[]).length - (nx.match(/\)/g)||[]).length;
    }
    const mp = raw.match(/^([^(]+)\s*\((.+)\)\s*$/s);
    if (mp) { componentes = mp[1].trim(); material = mp[2].trim(); }
    else componentes = raw.trim();
  }

  while (i < body.length) {
    const fl = body[i];
    if (fl && isCapsName(fl)) break;
    if (fl && /^\d{1,3}$/.test(fl)) { i++; continue; }

    if (phase === 'campos') {
      if (!fl) { i++; continue; }
      if (/^Tempo de Conjuração\s*:/i.test(fl)) { tempoCast = stripLabel(fl, 'Tempo de Conjuração'); i++; continue; }
      if (/^Alcance\s*:/i.test(fl))              { alcance   = stripLabel(fl, 'Alcance');              i++; continue; }
      if (/^Componentes\s*:/i.test(fl))          { readComps(); continue; }
      if (/^Duração\s*:/i.test(fl)) {
        duracao = stripLabel(fl, 'Duração');
        concentracao = /concentra[çc][aã]o/i.test(duracao);
        i++;
        if (tempoCast && alcance && componentes && duracao) phase = 'desc';
        continue;
      }
      i++; // campo não reconhecido antes de ter todos → pula
    } else if (phase === 'desc') {
      if (/^Em Níveis Superiores\s*[.:]/i.test(fl)) {
        const rest = fl.replace(/^Em Níveis Superiores\s*[.:]\s*/i, '').trim();
        if (rest) maiorParts.push(rest);
        phase = 'maior'; i++; continue;
      }
      descParts.push(fl ?? ''); i++;
    } else {
      if (!fl) { i++; continue; }
      maiorParts.push(fl); i++;
    }
  }

  function joinParts(parts) {
    const paras = []; let cur = [];
    for (const p of parts) {
      if (p === '') { if (cur.length) { paras.push(cur.join(' ')); cur = []; } }
      else cur.push(p);
    }
    if (cur.length) paras.push(cur.join(' '));
    return paras.join('\n\n').trim();
  }

  if (!tempoCast && !nivel) continue;

  // Busca classes: tenta o nome normalizado, depois o raw (CAPS) como fallback
  // Também tenta variantes sem acento para casos como "Continua" vs "Contínua"
  function findClasses(n) {
    if (spellClasses[n]) return spellClasses[n];
    // Tenta sem acento
    const sem = n.normalize('NFD').replace(/[̀-ͯ]/g,'');
    for (const [k,v] of Object.entries(spellClasses)) {
      const ks = k.normalize('NFD').replace(/[̀-ͯ]/g,'');
      if (ks.toLowerCase() === sem.toLowerCase()) return v;
    }
    return null;
  }

  const classSet = findClasses(nomeNorm) || findClasses(nomeRaw) || new Set();
  const classes = Array.from(classSet);

  magias.push({
    nome: nomeNorm, nivel, escola, ritual, concentracao, classes,
    tempoCast, alcance, componentes, material,
    duracao: duracao.trim(),
    descricao: joinParts(descParts),
    maiorNivel: joinParts(maiorParts)
  });
}

// ── Relatório ──────────────────────────────────────────────────────────────────
console.log(`✓ Magias: ${magias.length}`);
console.log(`  Sem desc:   ${magias.filter(m=>!m.descricao).length}`);
console.log(`  Sem classe: ${magias.filter(m=>!m.classes.length).map(m=>m.nome).join(', ')}`);
console.log(`  Sem escola: ${magias.filter(m=>!m.escola).length}`);

const json = JSON.stringify(magias);
console.log(`  JSON: ${(json.length/1024).toFixed(0)} KB`);
fs.writeFileSync('magias_data.json', json, 'utf8');
console.log('magias_data.json gerado!');

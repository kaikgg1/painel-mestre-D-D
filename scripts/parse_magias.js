// parse_magias.js — Parser do magias.md (markdown estruturado) → magias_data.json
// Uso: node scripts/parse_magias.js
const fs = require('fs');
const path = require('path');

const MD_PATH   = path.join(__dirname, '..', 'data', 'magias.md');
const JSON_PATH = path.join(__dirname, '..', 'data', 'magias_data.json');

const raw = fs.readFileSync(MD_PATH, 'utf8').split('\n').map(l => l.replace(/\r$/, ''));

// ── Helpers ──────────────────────────────────────────────────────────────────
function stripBold(s) {
  return (s || '').replace(/\*\*/g, '').replace(/\*/g, '').trim();
}

function parseNivelEscola(line) {
  // Aceita "**Truque de Evocação**" ou "**2º Nível de Adivinhação** *(ritual)*"
  const clean = stripBold(line);
  const ritual = /\(ritual\)/i.test(line);

  let m = clean.match(/^Truque de (.+?)(?:\s*\(ritual\))?$/i);
  if (m) return { nivel: 0, escola: m[1].trim(), ritual };

  m = clean.match(/^(\d)\s*[ºo°]\s*N[íi]vel de (.+?)(?:\s*\(ritual\))?$/i);
  if (m) return { nivel: +m[1], escola: m[2].trim(), ritual };

  return null;
}

function parseField(line, label) {
  const re = new RegExp(`^[-*]\\s*\\*\\*${label}\\s*:\\s*\\*\\*\\s*(.+)$`, 'i');
  const m = line.match(re);
  return m ? m[1].trim() : null;
}

function splitComponentes(raw) {
  // "V, S, M (uma pitada de pó)" → comp="V, S, M", material="uma pitada de pó"
  const m = (raw || '').match(/^([^(]+?)\s*(?:\(([\s\S]+)\))?\s*$/);
  if (!m) return { comp: raw || '', material: '' };
  return { comp: (m[1] || '').trim(), material: (m[2] || '').trim() };
}

function joinParas(lines) {
  const paras = []; let cur = [];
  for (const ln of lines) {
    if (!ln.trim()) { if (cur.length) { paras.push(cur.join(' ').trim()); cur = []; } }
    else cur.push(ln.trim());
  }
  if (cur.length) paras.push(cur.join(' ').trim());
  return paras.join('\n\n').trim();
}

// ── Parse ────────────────────────────────────────────────────────────────────
const descStart = raw.findIndex(l => /^##\s+Descrições das Magias\s*$/i.test(l));
if (descStart < 0) {
  console.error('❌ Seção "Descrições das Magias" não encontrada');
  process.exit(1);
}

const magias = [];
let i = descStart + 1;

while (i < raw.length) {
  const hMatch = raw[i].match(/^###\s+(.+?)\s*$/);
  if (!hMatch) { i++; continue; }

  const nome = hMatch[1].trim();
  i++;

  while (i < raw.length && !raw[i].trim()) i++;
  if (i >= raw.length) break;

  const header = parseNivelEscola(raw[i]);
  if (!header) {
    console.warn(`⚠ Cabeçalho não reconhecido para "${nome}": ${raw[i]}`);
    continue;
  }
  const { nivel, escola, ritual } = header;
  i++;

  let tempoCast = '', alcance = '', componentes = '', material = '', duracao = '';
  const classes = [];
  while (i < raw.length) {
    const l = raw[i];
    if (!l.trim()) { i++; continue; }
    if (!/^[-*]\s/.test(l)) break;

    const tc = parseField(l, 'Tempo de Conjuração'); if (tc) { tempoCast = tc; i++; continue; }
    const al = parseField(l, 'Alcance');             if (al) { alcance   = al; i++; continue; }
    const cp = parseField(l, 'Componentes');         if (cp) {
      const sp = splitComponentes(cp);
      componentes = sp.comp; material = sp.material;
      i++; continue;
    }
    const du = parseField(l, 'Duração');             if (du) { duracao = du; i++; continue; }
    const cl = parseField(l, 'Classes');             if (cl) {
      cl.split(',').map(c => c.trim()).filter(Boolean).forEach(c => classes.push(c));
      i++; continue;
    }
    i++;
  }

  const concentracao = /concentra[çc][aã]o/i.test(duracao);

  const descParts = [];
  const maiorParts = [];
  let fase = 'desc';
  while (i < raw.length) {
    const l = raw[i];
    if (/^---\s*$/.test(l)) { i++; break; }
    if (/^###?\s+/.test(l)) break;

    if (fase === 'desc') {
      const mn = l.match(/^\*\*Em N[íi]veis Superiores\.\*\*\s*(.*)$/i);
      if (mn) {
        if (mn[1]) maiorParts.push(mn[1]);
        fase = 'maior'; i++; continue;
      }
      descParts.push(l); i++;
    } else {
      maiorParts.push(l); i++;
    }
  }

  magias.push({
    nome, nivel, escola, ritual, concentracao, classes,
    tempoCast, alcance, componentes, material, duracao,
    descricao: joinParas(descParts),
    maiorNivel: joinParas(maiorParts)
  });
}

// ── Relatório ────────────────────────────────────────────────────────────────
console.log(`✓ Magias: ${magias.length}`);
const semDesc   = magias.filter(m => !m.descricao);
const semClasse = magias.filter(m => !m.classes.length);
const semEscola = magias.filter(m => !m.escola);
if (semDesc.length)   console.log(`  Sem desc:   ${semDesc.map(m => m.nome).join(', ')}`);
if (semClasse.length) console.log(`  Sem classe: ${semClasse.map(m => m.nome).join(', ')}`);
if (semEscola.length) console.log(`  Sem escola: ${semEscola.map(m => m.nome).join(', ')}`);

const json = JSON.stringify(magias);
console.log(`  JSON: ${(json.length / 1024).toFixed(0)} KB`);
fs.writeFileSync(JSON_PATH, json, 'utf8');
console.log(`✓ ${path.relative(process.cwd(), JSON_PATH)} gerado`);

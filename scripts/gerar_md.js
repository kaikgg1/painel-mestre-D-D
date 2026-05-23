// gerar_md.js — Gera magias.md formatado a partir de magias_data.json
// Uso: node scripts/gerar_md.js
const fs = require('fs');
const path = require('path');

const magias = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'magias_data.json'), 'utf8'));

const NIVEL_LABEL = ['Truques', '1º Nível', '2º Nível', '3º Nível', '4º Nível', '5º Nível', '6º Nível', '7º Nível', '8º Nível', '9º Nível'];
const CLASSES_ORDEM = ['Bardo', 'Bruxo', 'Clérigo', 'Druida', 'Feiticeiro', 'Mago', 'Paladino', 'Patrulheiro'];

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
          .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const out = [];

// ── Cabeçalho ────────────────────────────────────────────────────────────────
out.push('# Grimório de Magias — D&D 5e');
out.push('');
out.push('> Fonte: *Livro do Jogador* (Edição Brasileira, Galápagos Jogos).');
out.push(`> Total: **${magias.length} magias** organizadas por classe e em ordem alfabética.`);
out.push('');
out.push('## Índice');
out.push('');
out.push('1. [Magias por Classe](#magias-por-classe)');
CLASSES_ORDEM.forEach(c => out.push(`   - [${c}](#${slug(c)})`));
out.push('2. [Descrições das Magias](#descricoes-das-magias)');
out.push('');
out.push('---');
out.push('');

// ── 1. Magias por classe ─────────────────────────────────────────────────────
out.push('## Magias por Classe');
out.push('');

for (const classe of CLASSES_ORDEM) {
  const doClasse = magias.filter(m => m.classes.includes(classe));
  if (!doClasse.length) continue;

  out.push(`### ${classe}`);
  out.push('');
  out.push(`*${doClasse.length} magias*`);
  out.push('');

  for (let nivel = 0; nivel <= 9; nivel++) {
    const doNivel = doClasse.filter(m => m.nivel === nivel)
                            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
    if (!doNivel.length) continue;

    out.push(`#### ${NIVEL_LABEL[nivel]}`);
    out.push('');
    for (const m of doNivel) {
      const tags = [];
      if (m.ritual) tags.push('Ritual');
      if (m.concentracao) tags.push('Concentração');
      const sufixo = tags.length ? ` *(${tags.join(', ')})*` : '';
      out.push(`- **${m.nome}** — ${m.escola}${sufixo}`);
    }
    out.push('');
  }
  out.push('---');
  out.push('');
}

// ── 2. Descrições ────────────────────────────────────────────────────────────
out.push('## Descrições das Magias');
out.push('');

const ordenadas = [...magias].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

for (const m of ordenadas) {
  const nivelStr = m.nivel === 0 ? `Truque de ${m.escola}` : `${m.nivel}º Nível de ${m.escola}`;

  out.push(`### ${m.nome}`);
  out.push('');
  out.push(`**${nivelStr}**${m.ritual ? ' *(ritual)*' : ''}`);
  out.push('');
  out.push(`- **Tempo de Conjuração:** ${m.tempoCast}`);
  out.push(`- **Alcance:** ${m.alcance}`);
  const compStr = m.componentes + (m.material ? ` (${m.material})` : '');
  out.push(`- **Componentes:** ${compStr}`);
  out.push(`- **Duração:** ${m.duracao}`);
  out.push(`- **Classes:** ${m.classes.join(', ')}`);
  out.push('');
  out.push(m.descricao);
  out.push('');
  if (m.maiorNivel) {
    out.push(`**Em Níveis Superiores.** ${m.maiorNivel}`);
    out.push('');
  }
  out.push('---');
  out.push('');
}

fs.writeFileSync(path.join(__dirname, '..', 'data', 'magias.md'), out.join('\n'), 'utf8');
console.log(`✓ magias.md gerado: ${out.length} linhas, ${magias.length} magias`);

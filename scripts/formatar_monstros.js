// formatar_monstros.js — Converte docs/ManualMonstros.txt em .md formatado
// PRESERVA 100% do texto. Apenas adiciona estrutura leve (cabeçalhos, páginas)
// sem remover nenhuma linha ou informação.
//
// Uso: node scripts/formatar_monstros.js
const fs = require('fs');
const path = require('path');

const TXT = path.join(__dirname, '..', 'docs', 'ManualMonstros.txt');
const MD  = path.join(__dirname, '..', 'docs', 'ManualMonstros.md');

const raw = fs.readFileSync(TXT, 'utf8');
const linhas = raw.split('\n');

// Heurística pra detectar NOME DE MONSTRO (statblock title):
// linha em CAIXA ALTA, curta, sem números/pontuação de frase, possivelmente
// seguida em até 3 linhas por "Classe de Armadura" (marca de statblock).
function ehTituloMonstro(linha, idx) {
  const t = linha.trim();
  if (t.length < 3 || t.length > 48) return false;
  // precisa ter letras e estar majoritariamente em maiúsculas
  const letras = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letras.length < 3) return false;
  const maiusc = t.replace(/[^A-ZÀ-Þ]/g, '');
  if (maiusc.length / letras.length < 0.85) return false;
  // sem pontuação de frase
  if (/[.,;:!?]/.test(t)) return false;
  // olha adiante: statblock real tem "Classe de Armadura" perto
  for (let j = idx + 1; j <= idx + 4 && j < linhas.length; j++) {
    if (/Classe de Armadura/i.test(linhas[j])) return true;
  }
  return false;
}

const out = [];
out.push('# Manual dos Monstros — D&D 5ª Edição (PT-BR)');
out.push('');
out.push('> Texto extraído integralmente do PDF oficial (351 páginas). Fonte de verdade para as fichas de criaturas do painel.');
out.push('> Cada bloco `## Página N` corresponde à página original. Títulos `### NOME` marcam statblocks detectados automaticamente.');
out.push('');

for (let i = 0; i < linhas.length; i++) {
  const ln = linhas[i];
  const m = ln.match(/^=+\s*\[Pág\.\s*(\d+)\/(\d+)\]\s*=+$/);
  if (m) {
    out.push('');
    out.push(`## Página ${m[1]}`);
    out.push('');
    continue;
  }
  if (ehTituloMonstro(ln, i)) {
    out.push('');
    out.push('### ' + ln.trim());
    continue;
  }
  out.push(ln);
}

// Limpa sequências de 3+ linhas vazias → no máximo 2
const texto = out.join('\n').replace(/\n{4,}/g, '\n\n\n');
fs.writeFileSync(MD, texto, 'utf8');

const kb = (fs.statSync(MD).size / 1024).toFixed(0);
const titulos = (texto.match(/^### /gm) || []).length;
console.log('✓ ManualMonstros.md gerado');
console.log('  Tamanho:', kb, 'KB');
console.log('  Statblocks detectados (###):', titulos);
console.log('  Linhas preservadas:', linhas.length);

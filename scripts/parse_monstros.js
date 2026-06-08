// parse_monstros.js — Lê docs/ManualMonstros.txt e gera data/monstros_data.json
// com todos os statblocks estruturados, pra alimentar o buscador de criaturas.
// Uso: node scripts/parse_monstros.js
const fs = require('fs');
const path = require('path');

const TXT = path.join(__dirname, '..', 'docs', 'ManualMonstros.txt');
const OUT = path.join(__dirname, '..', 'data', 'monstros_data.json');

const ATRMAP = { 'FOR':'for', 'DES':'dex', 'CON':'con', 'INT':'int', 'SAB':'sab', 'CAR':'car' };

// Limpa: remove marcadores de página e linhas que são só número de página.
const linhas = fs.readFileSync(TXT, 'utf8').split('\n')
  .map(l => l.replace(/\r$/, '').replace(/[ \t]+$/, ''))
  .filter(l => !/^=+\s*\[Pag\.|^=+\s*\[Pág\./i.test(l.trim()))
  .filter(l => !/^\s*\d{1,3}\s*$/.test(l));

function ehTitulo(t) {
  t = t.trim();
  if (t.length < 2 || t.length > 50) return false;
  if (/^(A[ÇC][ÕO]ES|REA[ÇC][ÕO]ES|CLASSE DE ARMADURA|VARIANTE)/i.test(t)) return false;  // seções, não monstros
  const letras = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letras.length < 2) return false;
  const maiusc = t.replace(/[^A-ZÀ-Þ]/g, '');
  if (maiusc.length / letras.length < 0.8) return false;
  if (/[.;:!?]/.test(t)) return false;
  return true;
}
function ehTipo(t) {
  return /,/.test(t) && /(Mi[úu]d[oa]|Pequen[oa]|M[ée]di[oa]|Grande|Enorme|Colossal|Min[úu]scul[oa])/i.test(t);
}

// Acha índices de "Classe de Armadura"
const blocos = [];
for (let i = 0; i < linhas.length; i++) {
  if (/^Classe de Armadura/i.test(linhas[i].trim())) blocos.push(i);
}

function acharNomeETipo(caIdx) {
  let j = caIdx - 1;
  while (j >= 0 && !linhas[j].trim()) j--;
  let tipo = '';
  if (j >= 0 && ehTipo(linhas[j])) { tipo = linhas[j].trim(); j--; }
  let nome = '', k = j, voltas = 0;
  while (k >= 0 && voltas < 6) {
    const t = linhas[k].trim();
    if (t && ehTitulo(t)) { nome = t; break; }
    if (t && !tipo && ehTipo(t)) { tipo = t; }
    k--; voltas++;
  }
  return { nome, tipo };
}

// Índice onde o statblock COMEÇA (linha do nome), pra recortar o bloco anterior
// sem incluir o nome/tipo do próximo monstro.
function inicioBloco(caIdx) {
  let j = caIdx - 1;
  while (j >= 0 && !linhas[j].trim()) j--;
  let tipoIdx = -1;
  if (j >= 0 && ehTipo(linhas[j])) { tipoIdx = j; j--; }
  let k = j, voltas = 0;
  while (k >= 0 && voltas < 6) {
    if (linhas[k].trim() && ehTitulo(linhas[k])) return k;  // linha do nome
    k--; voltas++;
  }
  return tipoIdx >= 0 ? tipoIdx : caIdx;
}

function pegarCampo(arr, regex) {
  for (const l of arr) { const m = l.match(regex); if (m) return m[1].trim(); }
  return '';
}

// Divide bloco de texto em [{nome,desc}] pelo padrão "Título. descrição"
const SEP = '', NL = '';
function dividirEmItens(texto) {
  if (!texto) return [];
  const marcado = texto.replace(
    /(^|\.\s)([A-ZÀ-Þ][\wÀ-ÿ'’-]*(?:\s(?:[A-ZÀ-Þ][\wÀ-ÿ'’-]*|de|da|do|dos|das|e|com|à|a|o|na|no))*(?:\s*\([^)]{0,40}\))?)\.\s/g,
    (full, pre, titulo) => `${pre}${SEP}${titulo}${NL} `
  );
  const partes = marcado.split(SEP).map(s => s.trim()).filter(Boolean);
  const itens = [];
  for (const p of partes) {
    const nlPos = p.indexOf(NL);
    if (nlPos >= 0) {
      const nome = p.slice(0, nlPos).trim();
      const desc = p.slice(nlPos + 1).trim();
      if (nome) itens.push({ nome, desc });
    } else {
      const limpo = p.split(NL).join('').trim();
      if (limpo) itens.push({ nome: '—', desc: limpo });
    }
  }
  return itens;
}

function parseBloco(caIdx, nextCaIdx) {
  const fim = nextCaIdx ?? linhas.length;
  const trecho = linhas.slice(caIdx, fim);
  const { nome, tipo } = acharNomeETipo(caIdx);
  if (!nome) return null;

  // \s* (não \s+) — OCR às vezes cola "Vida13", "Armadura12" sem espaço.
  const caM = (trecho[0] || '').match(/Classe de Armadura\s*(\d+)\s*(.*)$/i);
  const ca = caM ? +caM[1] : 10;
  const caExtra = caM && caM[2] ? caM[2].trim() : '';

  const pvLine = pegarCampo(trecho, /^Pontos de Vida\s*(.+)$/i);
  const pvNum = (pvLine.match(/(\d+)/) || [])[1];
  const hp = pvNum ? +pvNum : 1;
  // Fórmula de dados de vida, ex.: "11d8 + 44"
  const pvDadosM = pvLine.match(/\(([^)]+)\)/);
  const pvDados = pvDadosM ? pvDadosM[1].replace(/\s+/g, ' ').trim() : '';

  const desloc = pegarCampo(trecho, /^Deslocamento\s*(.+)$/i);

  // Atributos: aceita valor na mesma linha ("FOR 10 (+0)" / "FOR10(+0)")
  // OU na próxima linha (formato em coluna). Tolerante a OCR.
  const atributos = { for:10, dex:10, con:10, int:10, sab:10, car:10 };
  for (let i = 0; i < trecho.length; i++) {
    const t = trecho[i].trim();
    const mlab = t.match(/^(FOR|DES|CON|INT|SAB|CAR)\b\s*(\d+)?/i);
    if (!mlab) continue;
    const key = ATRMAP[mlab[1].toUpperCase()];
    if (mlab[2]) { atributos[key] = +mlab[2]; continue; }   // valor colado/na mesma linha
    for (let n = i + 1; n < Math.min(i + 3, trecho.length); n++) {
      const mm = trecho[n].match(/^\s*(\d+)\s*[(（]/);          // "10 (+0)"
      if (mm) { atributos[key] = +mm[1]; break; }
    }
  }

  const resistencias = pegarCampo(trecho, /^Resist[êe]ncia a Dano\s*(.+)$/i);
  const vulnerab     = pegarCampo(trecho, /^Vulnerabilidade a Dano\s*(.+)$/i);
  const imunDano     = pegarCampo(trecho, /^Imunidade a Dano\s*(.+)$/i);
  const imunCond     = pegarCampo(trecho, /^Imunidade a Condi[çc][ãa]o\s*(.+)$/i);
  const imunidades = [imunDano && ('Dano: ' + imunDano), imunCond && ('Condições: ' + imunCond)].filter(Boolean).join(' · ');
  const sentidos     = pegarCampo(trecho, /^Sentidos\s*(.+)$/i);
  const idiomas      = pegarCampo(trecho, /^Idiomas\s*(.+)$/i);
  const pericias     = pegarCampo(trecho, /^Per[íi]cias\s*(.+)$/i);
  const salvaguardas = pegarCampo(trecho, /^Testes de Resist[êe]ncia\s*(.+)$/i) || pegarCampo(trecho, /^Salvaguardas\s*(.+)$/i);
  const ndLine       = pegarCampo(trecho, /^N[íi]vel de Desafio\s*(.+)$/i);

  const ndPos       = trecho.findIndex(l => /^N[íi]vel de Desafio/i.test(l.trim()));
  const acoesPos    = trecho.findIndex(l => /^A[ÇC][ÕO]ES\s*$/i.test(l.trim()));
  const reacoesPos  = trecho.findIndex(l => /^REA[ÇC][ÕO]ES\s*$/i.test(l.trim()));
  const lendariasPos= trecho.findIndex(l => /^A[ÇC][ÕO]ES LEND[ÁA]RIAS\s*$/i.test(l.trim()));

  function blocoTexto(ini, fimB) {
    if (ini < 0) return '';
    const end = (fimB == null || fimB < 0) ? trecho.length : fimB;
    return trecho.slice(ini, end).join(' ').replace(/\s+/g, ' ').trim();
  }

  const fimTracos = [acoesPos, reacoesPos, lendariasPos].filter(x => x > ndPos).sort((a,b)=>a-b)[0];
  const tracosTexto = ndPos >= 0 ? blocoTexto(ndPos + 1, fimTracos) : '';
  const fimAcoes = [reacoesPos, lendariasPos].filter(x => x > acoesPos).sort((a,b)=>a-b)[0];
  const acoesTexto = acoesPos >= 0 ? blocoTexto(acoesPos + 1, fimAcoes) : '';
  const reacoesTexto = reacoesPos >= 0 ? blocoTexto(reacoesPos + 1, lendariasPos > reacoesPos ? lendariasPos : null) : '';

  let tracos = dividirEmItens(tracosTexto);
  let acoes = dividirEmItens(acoesTexto);
  const reacoes = dividirEmItens(reacoesTexto);
  if (reacoes.length) acoes = acoes.concat(reacoes.map(r => ({ nome: '(Reação) ' + r.nome, desc: r.desc })));
  if (!tracos.length && tracosTexto) tracos = [{ nome: 'Traços', desc: tracosTexto }];
  if (!acoes.length && acoesTexto) acoes = [{ nome: 'Ações', desc: acoesTexto }];

  return {
    nome, tipo, ca, ca_extra: caExtra,
    hp_max: hp, hp_atual: hp, pv_dados: pvDados, deslocamento: desloc,
    atributos, resistencias, vulnerabilidades: vulnerab,
    imunidades, sentidos, idiomas, pericias, salvaguardas,
    nd: ndLine, tracos, acoes,
  };
}

const monstros = [];
const vistos = new Set();
for (let b = 0; b < blocos.length; b++) {
  // fim do bloco atual = início do próximo statblock (exclui nome/tipo do próximo)
  const fim = b + 1 < blocos.length ? inicioBloco(blocos[b + 1]) : null;
  const obj = parseBloco(blocos[b], fim);
  if (!obj || !obj.nome) continue;
  const chave = obj.nome.toLowerCase();
  if (vistos.has(chave)) continue;
  vistos.add(chave);
  monstros.push(obj);
}

monstros.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
fs.writeFileSync(OUT, JSON.stringify(monstros), 'utf8');

const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log('OK monstros_data.json gerado');
console.log('  Monstros:', monstros.length);
console.log('  Tamanho:', kb, 'KB');
['Golem de Carne','Corvo','Lobo','Tarrasque','Aboleto'].forEach(n => {
  const m = monstros.find(x => x.nome.toLowerCase() === n.toLowerCase());
  if (m) console.log(`  OK ${m.nome}: CA ${m.ca}, PV ${m.hp_max}, ND ${m.nd||'?'}, ${m.tracos.length}T/${m.acoes.length}A, atrs FOR${m.atributos.for}`);
  else console.log(`  -- nao achou: ${n}`);
});

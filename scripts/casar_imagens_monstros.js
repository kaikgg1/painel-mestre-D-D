// casar_imagens_monstros.js
// Casa as imagens da Monster Gallery (assets/img/monstros/pag_NNN.jpg) com os
// monstros do bestiário (data/monstros_data.json) e grava o campo `imagem`.
// Uso: node scripts/casar_imagens_monstros.js
const fs = require('fs');
const path = require('path');

const BEST = path.join(__dirname, '..', 'data', 'monstros_data.json');
const LIDOS = path.join(__dirname, '..', 'data', 'galeria_nomes.txt');

const norm = s => (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'')
  .toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();

// Nome EN (da galeria) → termo(s) PT que aparecem no bestiário (Manual 5e)
const MAP = {
  'aboleth':['aboleto','abolete'],
  'basilisk':['basilisco'], 'bear':['urso marrom','urso negro','urso'],
  'beetle':['besouro'], 'behemoth':[], 'beholder':['observador'],
  'boar':['javali'], 'bulette':['bulette'], 'cambion':['cambiao','cambion'],
  'carrion crawler':['verme da carnica'], 'chimera':['quimera'],
  'chuul':['chuul'], 'colossus':[], 'crocodile':['crocodilo'],
  'cyclops':['ciclope'], 'death knight':['cavaleiro da morte'],
  'demon':['demonio'], 'devil':['diabo'], 'displacer beast':['besta deslocadora'],
  'doppelganger':['doppelganger','metamorfo'], 'dracolich':['dragao lich','dracolich'],
  'dragon black':['dragao negro'], 'dragon blue':['dragao azul'],
  'dragon green':['dragao verde'], 'dragon red':['dragao vermelho'],
  'dragon white':['dragao branco'],
  'drider':['drider'], 'drow':['drow','elfo negro'], 'dryad':['driade'],
  'dwarf':['anao'], 'efreet':['efrite','ifrite','efreeti'], 'elemental':['elemental'],
  'elf':['elfo'], 'ettercap':['ettercap'], 'ettin':['ettin'],
  'fire giant':['gigante do fogo'], 'flameskull':['cranio flamejante','caveira flamejante'],
  'gargoyle':['gargula'], 'ghost':['fantasma'], 'ghoul':['carnical','ghoul'],
  'giant storm':['gigante das tempestades'], 'giant':['gigante'],
  'githyanki':['githyanki'], 'githzerai':['githzerai'], 'gnoll':['gnoll'],
  'gnome':['gnomo'], 'goblin bugbear':['bugbear','urso goblin'],
  'goblin hobgoblin':['hobgoblin'], 'goblin':['goblin'], 'golems':['golem'], 'golem':['golem'],
  'gorgon':['gorgona'], 'grell':['grell'], 'grick':['grick'], 'griffon':['grifo'],
  'grimlock':['grimlock'], 'hag night hag':['bruxa noturna'], 'hag':['bruxa','megera'],
  'halfling':['halfling'], 'harpy':['harpia'], 'helmed horror':['horror encouracado','armadura animada'],
  'homunculus':['homunculo'], 'hook horror':['horror de gancho'], 'horse':['cavalo'],
  'hell hound':['cao infernal'], 'hydra':['hidra'], 'hyena':['hiena'],
  'iron cobra':['cobra de ferro'], 'kobold':['kobold'], 'kuo toa':['kuo-toa','kuo toa'],
  'lamia':['lamia'], 'lich':['lich'], 'lizardfolk':['povo lagarto','homem lagarto'],
  'wererat':['ratazana','licantropo rato'], 'werewolf':['lobisomem'],
  'manticore':['manticora'], 'medusa':['medusa'], 'mind flayer':['devorador de mentes','mind flayer'],
  'minotaur':['minotauro'], 'mummy':['mumia'], 'naga':['naga'],
  'nightmare':['pesadelo'], 'ogre':['ogro'], 'oni':['oni','ogro mago'],
  'orc':['orc','orque'], 'otyugh':['otyugh'], 'owlbear':['coruja urso','urso coruja','owlbear'],
  'panther':['pantera'], 'pit fiend':['diabo das fossas'], 'purple worm':['verme purpura'],
  'rakshasa':['rakshasa'], 'dire rat':['rato gigante','ratazana gigante'], 'roc':['roc'],
  'roper':['roper'], 'salamander':['salamandra'], 'satyr':['satiro'],
  'scorpions':['escorpiao'], 'shadar kai':['shadar-kai','shadar kai'],
  'shambling mound':['monte tropecante','monturo'], 'skeleton':['esqueleto'],
  'slaad':['slaad'], 'snake':['cobra','serpente'], 'specter':['espectro'],
  'sphinx':['esfinge'], 'spider':['aranha'], 'tarrasque':['tarrasca','tarrasque'],
  'tiefling':['tiefling'], 'treant':['ent','treant'], 'troglodyte':['troglodita'],
  'troll':['troll'], 'umber hulk':['umber hulk','bruto pardo'], 'unicorn':['unicornio'],
  'vampire':['vampiro'], 'wight':['wight','carcaca'], 'wolf':['lobo'],
  'worg':['worg'], 'wraith':['assombracao','wraith'], 'wyvern':['wyvern'],
  'yuan ti':['yuan-ti','yuan ti'], 'zombie':['zumbi'],
};

// Lê lidos.txt → {pagina: nomeEN}
const lidos = {};
fs.readFileSync(LIDOS,'utf8').split('\n').forEach(l => {
  const m = l.match(/^(\d+)=(.+)$/);
  if (m && m[2].trim() !== '?') lidos[+m[1]] = m[2].trim();
});

const best = JSON.parse(fs.readFileSync(BEST,'utf8'));

// Resolve termos PT de uma imagem (nome EN). Tira parênteses, normaliza.
function termosDe(nomeEN) {
  let base = norm(nomeEN.replace(/\d+/g,'').replace(/\(.*?\)/g,' '));
  // chave do MAP por correspondência de prefixo (ex.: "dragon black")
  // tenta o nome completo + variações com a cor/qualificador
  const dentroParens = (nomeEN.match(/\(([^)]+)\)/)||[])[1] || '';
  const combo = norm((base + ' ' + dentroParens)).trim();
  // procura chave no MAP
  for (const chave of Object.keys(MAP)) {
    if (combo === chave || base === chave || combo.startsWith(chave) || base.startsWith(chave) || combo.includes(chave)) {
      return { termos: MAP[chave].length ? MAP[chave] : [chave], chave };
    }
  }
  return { termos: base ? [base] : [], chave: base };
}

// Score entre termo PT e nome de monstro PT (normalizado)
function score(termo, nomeMon) {
  const t = norm(termo), n = norm(nomeMon);
  if (!t || !n) return 0;
  if (n === t) return 100;
  const palavras = n.split(' ');
  if (palavras[0] === t) return 85;             // primeira palavra exata (ex.: "dragao ..." começa com a cor? não)
  if (n.startsWith(t + ' ')) return 80;
  if (palavras.includes(t)) return 70;
  if (n.includes(t)) return 55;
  return 0;
}

// Para cada monstro, acha a melhor imagem
const atribuicoes = {};   // nomeMonstro -> {pagina, score, en}
for (const [pgStr, en] of Object.entries(lidos)) {
  const pg = +pgStr;
  const { termos } = termosDe(en);
  if (!termos.length) continue;
  for (const mon of best) {
    let melhor = 0;
    for (const termo of termos) melhor = Math.max(melhor, score(termo, mon.nome));
    if (melhor < 55) continue;
    const atual = atribuicoes[mon.nome];
    // desempate: maior score; em empate, página menor (imagem mais "principal")
    if (!atual || melhor > atual.score) atribuicoes[mon.nome] = { pagina: pg, score: melhor, en };
  }
}

// Aplica no bestiário
let comImg = 0;
for (const mon of best) {
  const a = atribuicoes[mon.nome];
  if (a) { mon.imagem = '../assets/img/monstros/pag_%s.jpg'.replace('%s', String(a.pagina).padStart(3,'0')); comImg++; }
  else delete mon.imagem;
}

fs.writeFileSync(BEST, JSON.stringify(best), 'utf8');
console.log('Monstros com imagem:', comImg, '/', best.length);
console.log('');
console.log('=== Amostra de casamentos ===');
['GOLEM DE CARNE','OBSERVADOR','DRAGÃO VERMELHO ADULTO','LOBO','TROLL','ZUMBI','ESQUELETO','GÁRGULA','MÚMIA','TARRASCA','BEHOLDER','VAMPIRO','LICH','GRIFO','MEDUSA','MINOTAURO','OGRO','HARPIA','CORVO','AARAKOCRA'].forEach(n=>{
  const m=best.find(x=>x.nome===n);
  if(m) console.log('  '+(m.imagem?'✓':'✗'), n, '→', m.imagem? m.imagem.split('/').pop() : '(sem imagem)');
});

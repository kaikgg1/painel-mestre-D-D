// scripts/recortar_itens.js
// Recorta a ilustração de cada item mágico das pranchas do Guia do Mestre.
// Uso: npm run recortar-itens
//
// As pranchas (assets/img/itens/dmg_pNNN.jpeg) mostram vários itens juntos,
// cada um com a legenda rasterizada na arte. data/itens_recortes.json guarda,
// por prancha, a caixa [x0, y0, x1, y1] (pixels da prancha) de cada item —
// marcada lendo as legendas e conferida recorte a recorte, não por heurística.
//
// Saída:
//   assets/img/itens/recortes/<slug>.webp   (lado maior ≤ 480 px)
//   data/itens_data.json → `imagem` = recorte, `prancha` = página inteira
//   (a ficha do item mostra o recorte e abre a prancha ao clicar)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RAIZ = path.join(__dirname, '..');
const MAPA = path.join(RAIZ, 'data', 'itens_recortes.json');
const ITENS = path.join(RAIZ, 'data', 'itens_data.json');
const PRANCHAS = path.join(RAIZ, 'assets', 'img', 'itens');
const SAIDA = path.join(PRANCHAS, 'recortes');
const URL_BASE = '../assets/img/itens/';   // relativo a paineis/ (como o resto do JSON)
const LADO_MAX = 480;

const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

(async () => {
  const mapa = JSON.parse(fs.readFileSync(MAPA, 'utf8'));
  const itens = JSON.parse(fs.readFileSync(ITENS, 'utf8'));
  const porNome = new Map(itens.map(i => [i.nome, i]));
  fs.mkdirSync(SAIDA, { recursive: true });

  const gerados = new Set();
  const avisos = [];
  for (const { prancha, itens: caixas } of mapa) {
    const arq = path.join(PRANCHAS, prancha);
    const { width, height } = await sharp(arq).metadata();
    // Item com várias variantes desenhadas (Penas de Quaal, estatuetas…): a caixa
    // marcada "principal" vence; as outras ficam no mapa como registro.
    const ordenadas = [...caixas].sort((a, b) => (b.principal ? 1 : 0) - (a.principal ? 1 : 0));
    for (const { nome, box } of ordenadas) {
      if (!nome) continue;                       // legenda sem item correspondente no catálogo
      const item = porNome.get(nome);
      if (!item) { avisos.push(`${prancha}: "${nome}" não existe em itens_data.json`); continue; }
      const nomeArq = slug(nome) + '.webp';
      if (gerados.has(nomeArq)) continue;        // mesmo item em 2 pranchas: fica a 1ª
      const [x0, y0, x1, y1] = box.map(Math.round);
      const left = Math.max(0, x0), top = Math.max(0, y0);
      const w = Math.min(width, x1) - left, h = Math.min(height, y1) - top;
      if (w < 8 || h < 8) { avisos.push(`${prancha}: caixa inválida para ${nome}`); continue; }
      await sharp(arq).extract({ left, top, width: w, height: h })
        .resize({ width: LADO_MAX, height: LADO_MAX, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84 })
        .toFile(path.join(SAIDA, nomeArq));
      gerados.add(nomeArq);
      item.imagem = URL_BASE + 'recortes/' + nomeArq;
      item.prancha = URL_BASE + prancha;
    }
  }

  // Item que não está em nenhuma prancha do mapa fica sem imagem (antes podia
  // apontar pra uma prancha onde ele nem aparece).
  for (const it of itens) {
    if (!it.imagem || !it.imagem.includes('/recortes/') || !gerados.has(path.basename(it.imagem))) {
      delete it.imagem; delete it.prancha;
    }
  }
  // Recortes órfãos (item renomeado/removido do mapa)
  for (const f of fs.readdirSync(SAIDA)) if (!gerados.has(f)) fs.unlinkSync(path.join(SAIDA, f));

  fs.writeFileSync(ITENS, JSON.stringify(itens), 'utf8');
  const kb = fs.readdirSync(SAIDA).reduce((s, f) => s + fs.statSync(path.join(SAIDA, f)).size, 0) / 1024;
  console.log(`✔ ${gerados.size} recortes (${kb.toFixed(0)} KB) · ${itens.filter(i => i.imagem).length}/${itens.length} itens com imagem`);
  avisos.forEach(a => console.warn('⚠', a));
})();

// scripts/reprocessar_monstros.js
// Reprocessa assets/img/monstros/*.jpg (perf-3 da auditoria): redimensiona
// o lado maior pra no máximo MAX_DIM e recomprime em mozjpeg qualidade Q.
//
// MAX_DIM=1200 (não 400-500px como a estimativa inicial da auditoria
// supunha) porque paineis/bestiario.html tem lightbox de zoom
// (assets/js/lightbox.js, max-height:82vh — até ~1200px de altura numa
// tela grande); 140 dos 261 arquivos já passavam de 800px de lado, alguns
// chegando a 2160px, bem acima do que qualquer uso real (card de 42px,
// modal de 78px, ou o proprio zoom) precisa.
//
// Uso: node scripts/reprocessar_monstros.js [--aplicar]
// Sem --aplicar, só mostra o relatório de economia (dry-run).
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'assets', 'img', 'monstros');
const MAX_DIM = 1200;
const QUALIDADE = 82;
const aplicar = process.argv.includes('--aplicar');

(async () => {
  const arquivos = fs.readdirSync(DIR).filter(f => /\.jpe?g$/i.test(f));
  let antesTotal = 0, depoisTotal = 0, tocados = 0;

  for (const nome of arquivos) {
    const caminho = path.join(DIR, nome);
    const antes = fs.statSync(caminho).size;
    antesTotal += antes;

    const meta = await sharp(caminho).metadata();
    const maiorLado = Math.max(meta.width, meta.height);
    const precisaRedimensionar = maiorLado > MAX_DIM;

    const buffer = await sharp(caminho)
      .rotate() // aplica orientação EXIF antes de qualquer coisa, depois descarta os metadados
      .resize(precisaRedimensionar ? { width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true } : undefined)
      .toColorspace('srgb')
      .jpeg({ quality: QUALIDADE, mozjpeg: true })
      .toBuffer();

    depoisTotal += buffer.length;
    if (buffer.length < antes) tocados++;

    if (aplicar && buffer.length < antes) {
      // Escreve num arquivo temporário e renomeia por cima — no Windows,
      // sobrescrever direto o arquivo que o sharp acabou de ler pode
      // colidir com o handle que o libvips ainda não liberou.
      const tmp = caminho + '.tmp';
      fs.writeFileSync(tmp, buffer);
      fs.renameSync(tmp, caminho);
    }
  }

  const economiaMB = (antesTotal - depoisTotal) / 1024 / 1024;
  console.log(`${arquivos.length} arquivos | antes: ${(antesTotal/1024/1024).toFixed(1)}MB | depois: ${(depoisTotal/1024/1024).toFixed(1)}MB | economia: ${economiaMB.toFixed(1)}MB (${(100*economiaMB/(antesTotal/1024/1024)).toFixed(0)}%)`);
  console.log(aplicar ? `✓ ${tocados} arquivos reescritos.` : `Dry-run — rode com --aplicar pra gravar de verdade (${tocados} arquivos ficariam menores).`);
})();

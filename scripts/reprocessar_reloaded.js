// scripts/reprocessar_reloaded.js
// Reprocessa paineis/reloaded/img/*.{png,jpg} (perf-2 da auditoria):
// redimensiona (lado maior até MAX_DIM) e converte pra WebP qualidade Q —
// 110 dos 125 arquivos têm canal alpha (recortes de personagem), então
// WebP (não JPEG) preserva a transparência.
//
// NÃO mexe no histórico git (combinado com o usuário) — só gera os novos
// .webp ao lado dos originais. Os .png/.jpg antigos continuam no disco
// (sem uso depois que as páginas passarem a referenciar o .webp); rodar
// scripts/parar_de_rastrear_reloaded.js depois pra tirar eles do índice
// git e deixar de commitá-los daqui pra frente.
//
// Uso: node scripts/reprocessar_reloaded.js [--aplicar]
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'paineis', 'reloaded', 'img');
const MAX_DIM = 1600;
const QUALIDADE = 80;
const aplicar = process.argv.includes('--aplicar');

(async () => {
  const arquivos = fs.readdirSync(DIR).filter(f => /\.(png|jpe?g)$/i.test(f));
  let antesTotal = 0, depoisTotal = 0, gerados = 0, falhas = 0;

  for (const nome of arquivos) {
    const caminho = path.join(DIR, nome);
    const saida = path.join(DIR, nome.replace(/\.(png|jpe?g)$/i, '.webp'));
    const antes = fs.statSync(caminho).size;
    antesTotal += antes;

    try {
      const meta = await sharp(caminho).metadata();
      const maiorLado = Math.max(meta.width, meta.height);
      const buffer = await sharp(caminho)
        .rotate()
        .resize(maiorLado > MAX_DIM ? { width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true } : undefined)
        .toColorspace('srgb')
        .webp({ quality: QUALIDADE })
        .toBuffer();
      depoisTotal += buffer.length;
      gerados++;
      if (aplicar) {
        const tmp = saida + '.tmp';
        fs.writeFileSync(tmp, buffer);
        fs.renameSync(tmp, saida);
      }
    } catch (e) {
      console.log('FALHOU:', nome, '→', e.message);
      falhas++;
    }
  }

  const economiaMB = (antesTotal - depoisTotal) / 1024 / 1024;
  console.log(`${arquivos.length} arquivos (${falhas} falhas) | antes: ${(antesTotal/1024/1024).toFixed(0)}MB | depois (.webp): ${(depoisTotal/1024/1024).toFixed(0)}MB | economia: ${economiaMB.toFixed(0)}MB (${(100*economiaMB/(antesTotal/1024/1024)).toFixed(0)}%)`);
  console.log(aplicar ? `✓ ${gerados} arquivos .webp gravados ao lado dos originais.` : 'Dry-run — rode com --aplicar pra gravar de verdade.');
})();

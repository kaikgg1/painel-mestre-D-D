// assets/js/ficha/aba_roleplay.js
// Aba Roleplay: inspiração, retrato (upload no bucket "retratos"), traços,
// ideais, vínculos, defeitos, história e notas.

function renderRoleplay(c) {
  const imgUrl = c.imagem_url || '';
  const insp = +c.inspiracao || 0;
  return `
    <h3>Inspiração</h3>
    <div class="insp-wrap">
      <button type="button" class="insp-btn" id="insp-menos" aria-label="Diminuir inspiração">−</button>
      <div class="insp-display">
        <span class="insp-icone">${ico('inspiracao')}</span>
        <input type="text" inputmode="numeric" name="inspiracao" id="insp-input" value="${insp}" data-validar="int" data-min="0">
      </div>
      <button type="button" class="insp-btn" id="insp-mais" aria-label="Aumentar inspiração">+</button>
    </div>
    <p style="color:var(--text-dim);font-style:italic;font-size:12px;text-align:center;margin-bottom:14px">
      Quantas inspirações você tem disponíveis (gaste 1 antes de uma jogada pra ganhar vantagem).
    </p>

    <h3>Retrato do Personagem</h3>
    <div class="retrato-wrap">
      <div class="retrato-preview" id="retrato-preview">
        ${imgUrl ? `<img src="${escape(imgUrl)}" alt="Retrato de ${escape(c.nome||'')}" data-lb data-lb-nome="${escape(c.nome||'Retrato')}" title="Clique para ampliar" onerror="this.outerHTML='<div class=\\'retrato-placeholder\\' style=\\'color:#c9847a\\'>⚠ não carregou</div>'">` :
        `<div class="retrato-placeholder">${ico('retrato')}<br><span>Sem imagem</span></div>`}
      </div>
      <div class="retrato-controles">
        <div class="campo">
          <label for="input-arquivo" class="btn-upload" id="lbl-upload">
            ${ico('arquivo')} Escolher imagem
          </label>
          <input type="file" id="input-arquivo" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none">
          <input name="imagem_url" type="hidden" id="input-imagem" value="${escape(imgUrl)}">
          <span class="ajuda">PNG, JPEG, WebP ou GIF · até 3 MB</span>
          <span class="upload-status" id="upload-status"></span>
        </div>
        ${imgUrl ? `<button type="button" class="btn danger" id="btn-remover-img" style="align-self:flex-start;margin-top:8px">${ico('lixeira')} Remover imagem</button>` : ''}
      </div>
    </div>

    <h3 style="margin-top:14px">Roleplay e História</h3>
    <div class="grid-2">
      <div class="campo"><label>Traços de Personalidade</label>
        <textarea name="tracos_pessoais">${escape(c.tracos_pessoais||'')}</textarea></div>
      <div class="campo"><label>Ideais</label>
        <textarea name="ideais">${escape(c.ideais||'')}</textarea></div>
      <div class="campo"><label>Vínculos</label>
        <textarea name="vinculos">${escape(c.vinculos||'')}</textarea></div>
      <div class="campo"><label>Defeitos</label>
        <textarea name="defeitos">${escape(c.defeitos||'')}</textarea></div>
    </div>
    <h3>História e Notas</h3>
    <div class="campo" style="margin-bottom:12px"><label>História</label>
      <textarea name="historia" style="min-height:100px">${escape(c.historia||'')}</textarea></div>
    <div class="campo"><label>Notas</label>
      <textarea name="notas" style="min-height:70px">${escape(c.notas||'')}</textarea></div>
  `;
}

// Aplica/remove modo bloqueado nos campos do Roleplay (exceto Inspiração e Retrato)

// assets/js/ficha/aba_roleplay.js
// Bloco de roleplay da aba Personagem (Fase 9 — chamado por renderPersonagem()
// em render.js, que cuida do bloco de Identidade). Inspiração, retrato
// (upload no bucket "retratos"), história e notas continuam SEMPRE como
// estão hoje (§16: "Manter"); traços de personalidade/ideais/vínculos/
// defeitos alternam entre card de leitura e textarea conforme o modo
// Editar/Travar global (estaDesbloqueado(), nucleo.js), igual ao bloco de
// Identidade.

function renderRoleplayBloco(c) {
  const imgUrl = c.imagem_url || '';
  const insp = +c.inspiracao || 0;
  return `
    <h3>Inspiração</h3>
    <div class="insp-wrap">
      <button type="button" class="insp-btn no-lock" id="insp-menos" aria-label="Diminuir inspiração">−</button>
      <div class="insp-display">
        <span class="insp-icone">${ico('inspiracao')}</span>
        <input type="text" inputmode="numeric" name="inspiracao" id="insp-input" value="${insp}" data-validar="int" data-min="0" class="no-lock">
      </div>
      <button type="button" class="insp-btn no-lock" id="insp-mais" aria-label="Aumentar inspiração">+</button>
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

    ${estaDesbloqueado() ? renderTracosEdicao(c) : renderTracosLeitura(c)}

    <h3>História e Notas</h3>
    <div class="campo" style="margin-bottom:12px"><label>História</label>
      <textarea name="historia" style="min-height:100px">${escape(c.historia||'')}</textarea></div>
    <div class="campo"><label>Notas</label>
      <textarea name="notas" style="min-height:70px">${escape(c.notas||'')}</textarea></div>
  `;
}

// §16: "transformar em cards de leitura... somente ao editar viram textarea"
const TRACOS_CAMPOS = [
  ['tracos_pessoais', 'Traços de Personalidade'],
  ['ideais', 'Ideais'],
  ['vinculos', 'Vínculos'],
  ['defeitos', 'Defeitos'],
];

function renderTracosLeitura(c) {
  return `
    <h3 style="margin-top:14px">Roleplay e História</h3>
    <div class="grid-2 roleplay-cards">
      ${TRACOS_CAMPOS.map(([campo, label]) => `
        <div class="roleplay-card">
          <div class="roleplay-card-head">${escape(label)}</div>
          <p class="roleplay-card-texto">${c[campo] ? '“' + escape(c[campo]) + '”' : '<span class="leitura-vazio">Nada definido ainda.</span>'}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTracosEdicao(c) {
  return `
    <h3 style="margin-top:14px">Roleplay e História</h3>
    <div class="grid-2">
      ${TRACOS_CAMPOS.map(([campo, label]) => `
        <div class="campo"><label>${escape(label)}</label>
          <textarea name="${campo}">${escape(c[campo]||'')}</textarea></div>
      `).join('')}
    </div>
  `;
}

// assets/js/confirmar.js
// Modal customizado tematicamente coerente — substitui window.confirm().
//
// API: await Confirmar.perguntar({titulo, mensagem, confirmar, cancelar, danger})
//   → boolean (true = OK, false = cancelado)
//
// Exemplo:
//   if (await Confirmar.perguntar({
//     titulo: 'Aplicar Descanso Longo?',
//     mensagem: 'PV máximo, slots cheios, recursos resetados…',
//     confirmar: 'Descansar',
//     danger: false
//   })) { /* aplicar */ }

(function () {
  let _injetado = false;

  // Usa os tokens compartilhados (assets/css/tokens.css) com fallback pro
  // valor Strahd — hoje esse modal só é usado no painel do Mestre
  // (painel_barovia_dnd5e.html), mas fica pronto pra tema geral também
  // se algum dia for reaproveitado numa página fora da campanha.
  const CSS = `
  .cf-overlay {
    position: fixed; inset: 0; z-index: 9000;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    opacity: 0; pointer-events: none;
    transition: opacity 0.15s ease-out;
  }
  .cf-overlay.open { opacity: 1; pointer-events: auto; }
  .cf-modal {
    background: linear-gradient(160deg, var(--surface-raised, #211012) 0%, var(--surface, #180b0d) 100%);
    border: 1px solid var(--border, #5f171b);
    border-radius: 8px;
    max-width: 460px; width: 100%;
    padding: 22px 24px 20px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.7);
    font-family: var(--font-body, Georgia, serif);
    color: var(--text, #ddd0bc);
    transform: scale(0.95) translateY(8px);
    transition: transform 0.18s ease-out;
    position: relative;
  }
  .cf-overlay.open .cf-modal { transform: scale(1) translateY(0); }
  .cf-modal::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(to right, transparent, var(--gold, #a8232b), transparent);
  }
  .cf-modal.danger::before {
    background: linear-gradient(to right, transparent, var(--danger, #861820), transparent);
  }
  .cf-titulo {
    font-family: var(--font-heading-deco, var(--font-heading, serif));
    font-size: 18px; font-weight: 700;
    color: var(--gold, #a8232b); letter-spacing: 1px;
    margin-bottom: 10px;
  }
  .cf-modal.danger .cf-titulo { color: var(--danger, #861820); }
  .cf-msg {
    font-size: 14px; line-height: 1.55;
    color: var(--text, #ddd0bc);
    margin-bottom: 20px;
    white-space: pre-wrap;
  }
  .cf-acoes {
    display: flex; gap: 10px; justify-content: flex-end;
    flex-wrap: wrap;
  }
  .cf-btn {
    padding: 9px 16px;
    font-family: var(--font-heading, serif); font-size: 12px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase;
    border-radius: 5px; cursor: pointer;
    min-height: 42px; min-width: 100px;
    transition: all 0.15s;
  }
  .cf-btn-cancel {
    background: transparent; border: 1px solid var(--text-muted, #89776d); color: var(--text, #ddd0bc);
  }
  .cf-btn-cancel:hover {
    border-color: var(--gold, #a8232b); color: var(--gold-light, #d14242);
    background: color-mix(in srgb, var(--gold, #a8232b) 10%, transparent);
  }
  .cf-btn-ok {
    background: linear-gradient(180deg, var(--gold-light, #d14242), var(--gold, #a8232b));
    border: 1px solid var(--gold, #a8232b); color: var(--bg, #070506);
  }
  .cf-btn-ok:hover { filter: brightness(1.1); }
  .cf-modal.danger .cf-btn-ok {
    background: linear-gradient(180deg, var(--danger, #861820), color-mix(in srgb, var(--danger, #861820) 70%, black));
    border-color: var(--danger, #861820); color: var(--text, #ddd0bc);
  }
  .cf-modal.danger .cf-btn-ok:hover { filter: brightness(1.15); }
  @media (max-width: 480px) {
    .cf-modal { padding: 18px; }
    .cf-titulo { font-size: 16px; }
    .cf-acoes { flex-direction: column-reverse; }
    .cf-btn { width: 100%; min-width: 0; }
  }
  `;

  function montar() {
    if (_injetado) return;
    _injetado = true;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'cf-overlay';
    overlay.id = 'cf-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="cf-modal" id="cf-modal" aria-labelledby="cf-titulo">
        <div class="cf-titulo" id="cf-titulo"></div>
        <div class="cf-msg" id="cf-msg"></div>
        <div class="cf-acoes">
          <button type="button" class="cf-btn cf-btn-cancel" id="cf-cancel"></button>
          <button type="button" class="cf-btn cf-btn-ok" id="cf-ok"></button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  async function perguntar({ titulo = 'Confirmar', mensagem = '', confirmar = 'Confirmar', cancelar = 'Cancelar', danger = false } = {}) {
    montar();
    const ov = document.getElementById('cf-overlay');
    const modal = document.getElementById('cf-modal');
    document.getElementById('cf-titulo').textContent = titulo;
    document.getElementById('cf-msg').textContent = mensagem;
    document.getElementById('cf-ok').textContent = confirmar;
    document.getElementById('cf-cancel').textContent = cancelar;
    modal.classList.toggle('danger', !!danger);

    const okBtn = document.getElementById('cf-ok');
    const cancelBtn = document.getElementById('cf-cancel');

    return new Promise(resolve => {
      let resolvido = false;
      function fechar(valor) {
        if (resolvido) return;
        resolvido = true;
        ov.classList.remove('open');
        ov.setAttribute('aria-hidden', 'true');
        document.removeEventListener('keydown', onKey);
        resolve(valor);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); fechar(false); }
        else if (e.key === 'Enter' && !e.target.matches('textarea, input[type="text"]')) { e.preventDefault(); fechar(true); }
      }

      okBtn.onclick = () => fechar(true);
      cancelBtn.onclick = () => fechar(false);
      ov.onclick = e => { if (e.target === ov) fechar(false); };
      document.addEventListener('keydown', onKey);

      ov.classList.add('open');
      ov.setAttribute('aria-hidden', 'false');
      setTimeout(() => cancelBtn.focus(), 60);  // default focus em Cancelar (mais seguro)
    });
  }

  window.Confirmar = { perguntar };
})();

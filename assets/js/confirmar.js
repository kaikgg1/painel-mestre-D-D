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

  const CSS = `
  .cf-overlay {
    position: fixed; inset: 0; z-index: 9000;
    background: rgba(0,0,0,0.82);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    opacity: 0; pointer-events: none;
    transition: opacity 0.15s ease-out;
  }
  .cf-overlay.open { opacity: 1; pointer-events: auto; }
  .cf-modal {
    background: linear-gradient(160deg, #1f1416 0%, #160c10 100%);
    border: 2px solid #8B6914;
    border-radius: 8px;
    max-width: 460px; width: 100%;
    padding: 22px 24px 20px;
    box-shadow: 0 0 0 1px #8b1d1d inset, 0 24px 60px rgba(0,0,0,0.85);
    font-family: 'EB Garamond', Georgia, serif;
    color: #d4c5a0;
    transform: scale(0.95) translateY(8px);
    transition: transform 0.18s ease-out;
    position: relative;
  }
  .cf-overlay.open .cf-modal { transform: scale(1) translateY(0); }
  .cf-modal::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(to right, transparent, #b88a2c, transparent);
  }
  .cf-modal.danger::before {
    background: linear-gradient(to right, transparent, #c4302b, transparent);
  }
  .cf-titulo {
    font-family: 'Cinzel Decorative', serif;
    font-size: 18px; font-weight: 700;
    color: #b88a2c; letter-spacing: 1px;
    margin-bottom: 10px;
  }
  .cf-modal.danger .cf-titulo { color: #c4302b; }
  .cf-msg {
    font-size: 14px; line-height: 1.55;
    color: #d4c5a0;
    margin-bottom: 20px;
    white-space: pre-wrap;
  }
  .cf-acoes {
    display: flex; gap: 10px; justify-content: flex-end;
    flex-wrap: wrap;
  }
  .cf-btn {
    padding: 9px 16px;
    font-family: 'Cinzel', serif; font-size: 12px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase;
    border-radius: 5px; cursor: pointer;
    min-height: 42px; min-width: 100px;
    transition: all 0.15s;
  }
  .cf-btn-cancel {
    background: transparent; border: 1px solid #8c7d5e; color: #d4c5a0;
  }
  .cf-btn-cancel:hover { border-color: #b88a2c; color: #d4a843; background: rgba(184,138,44,0.08); }
  .cf-btn-ok {
    background: linear-gradient(180deg, #b88a2c, #6a4f0e);
    border: 1px solid #d4a843; color: #1a1014;
  }
  .cf-btn-ok:hover { background: linear-gradient(180deg, #d4a843, #b88a2c); }
  .cf-modal.danger .cf-btn-ok {
    background: linear-gradient(180deg, #8b1a1a, #5a0e0e);
    border-color: #c4302b; color: #f4d878;
  }
  .cf-modal.danger .cf-btn-ok:hover {
    background: linear-gradient(180deg, #c4302b, #8b1a1a);
    color: #fff;
  }
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

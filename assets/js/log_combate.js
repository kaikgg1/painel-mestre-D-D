// assets/js/log_combate.js
// Log leve de eventos de combate (mst-9) — derivado das ações de HP/
// condição que já existem (dano/cura, condição ativada/removida), sem
// exigir que o Mestre digite nada. Um FAB com badge de "não lidos" abre um
// painel com as últimas 30 entradas, mais recente primeiro.
//
// Self-contained como confirmar.js/rolador.js/iniciativa.js. Não persiste
// (reseta ao recarregar a página) — é uma ferramenta de sessão, não um
// histórico permanente.
//
// API: LogCombate.registrar(texto)
window.LogCombate = (function () {
  const MAX = 30;
  let _eventos = [];
  let _naoLidos = 0;

  const CSS = `
  .lc-fab {
    position: fixed; left: 18px; bottom: 18px; z-index: 8500;
    width: 48px; height: 48px; border-radius: 50%;
    background: linear-gradient(160deg, var(--surface-raised, #211012), var(--surface, #180b0d));
    border: 2px solid var(--gold, #a8232b);
    color: var(--gold, #a8232b);
    font-size: 20px; line-height: 1; cursor: pointer;
    box-shadow: 0 6px 18px rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.15s; position: relative;
  }
  .lc-fab:hover { transform: scale(1.08); }
  .lc-badge {
    position: absolute; top: -4px; right: -4px;
    min-width: 18px; height: 18px; border-radius: 9px;
    background: var(--danger, #861820); color: #fff;
    font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center;
    padding: 0 4px; display: none;
  }
  .lc-badge.show { display: flex; }
  .lc-painel {
    position: fixed; left: 18px; bottom: 76px; z-index: 8500;
    width: 280px; max-width: calc(100vw - 36px); max-height: 340px;
    background: linear-gradient(160deg, var(--surface-raised, #211012) 0%, var(--surface, #180b0d) 100%);
    border: 1px solid var(--border, #5f171b);
    border-radius: 10px;
    padding: 12px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    font-family: var(--font-body, Georgia, serif);
    color: var(--text, #ddd0bc);
    opacity: 0; transform: translateY(8px) scale(0.97); pointer-events: none;
    transition: opacity 0.15s, transform 0.15s;
    display: flex; flex-direction: column;
  }
  .lc-painel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
  .lc-titulo {
    font-family: var(--font-heading, serif); font-size: 12px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase; color: var(--gold, #a8232b);
    margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;
  }
  .lc-limpar, .lc-fechar { background: none; border: none; color: var(--text-muted, #89776d); cursor: pointer; font-size: 11px; }
  .lc-fechar { font-size: 16px; }
  .lc-lista { overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .lc-item { font-size: 11.5px; line-height: 1.4; padding: 4px 6px; border-radius: 4px; background: rgba(0,0,0,0.2); }
  .lc-item .lc-hora { color: var(--text-muted, #89776d); margin-right: 6px; font-size: 10px; }
  .lc-vazio { font-size: 11px; color: var(--text-muted, #89776d); font-style: italic; text-align: center; padding: 12px 0; }
  @media (max-width: 480px) { .lc-painel { left: 10px; width: auto; right: 10px; } .lc-fab { left: 12px; bottom: 12px; } }
  `;

  let _montado = false;
  function montar() {
    if (_montado) return;
    _montado = true;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'lc-fab';
    fab.id = 'lc-fab';
    fab.setAttribute('aria-label', 'Abrir log de combate');
    fab.innerHTML = '📜<span class="lc-badge" id="lc-badge">0</span>';
    document.body.appendChild(fab);

    const painel = document.createElement('div');
    painel.className = 'lc-painel';
    painel.id = 'lc-painel';
    painel.innerHTML = `
      <div class="lc-titulo">Log de Combate
        <span>
          <button type="button" class="lc-limpar" id="lc-limpar">limpar</button>
          <button type="button" class="lc-fechar" id="lc-fechar" aria-label="Fechar">✕</button>
        </span>
      </div>
      <div class="lc-lista" id="lc-lista"></div>
    `;
    document.body.appendChild(painel);

    fab.addEventListener('click', () => (painel.classList.contains('open') ? fechar() : abrir()));
    document.getElementById('lc-fechar').addEventListener('click', fechar);
    document.getElementById('lc-limpar').addEventListener('click', limpar);
    document.addEventListener('click', e => {
      if (painel.classList.contains('open') && !painel.contains(e.target) && e.target !== fab && !fab.contains(e.target)) fechar();
    });
  }

  function atualizarLista() {
    const lista = document.getElementById('lc-lista');
    if (!lista) return;
    lista.innerHTML = _eventos.length
      ? _eventos.map(e => `<div class="lc-item"><span class="lc-hora">${e.hora}</span>${e.texto}</div>`).join('')
      : `<div class="lc-vazio">Nenhum evento ainda — dano/cura e condições aparecem aqui.</div>`;
  }
  function atualizarBadge() {
    const badge = document.getElementById('lc-badge');
    if (!badge) return;
    badge.textContent = _naoLidos > 9 ? '9+' : String(_naoLidos);
    badge.classList.toggle('show', _naoLidos > 0);
  }

  function registrar(texto) {
    montar();
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    _eventos.unshift({ texto, hora });
    _eventos = _eventos.slice(0, MAX);
    if (!document.getElementById('lc-painel')?.classList.contains('open')) _naoLidos++;
    atualizarLista();
    atualizarBadge();
  }
  function limpar() { _eventos = []; _naoLidos = 0; atualizarLista(); atualizarBadge(); }
  function abrir() { montar(); document.getElementById('lc-painel').classList.add('open'); _naoLidos = 0; atualizarBadge(); }
  function fechar() { if (_montado) document.getElementById('lc-painel').classList.remove('open'); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();

  return { registrar, limpar, abrir, fechar };
})();

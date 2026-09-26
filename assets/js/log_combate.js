// assets/js/log_combate.js
// Widget de log (FAB + painel) — nasceu só pra combate (mst-9: dano/cura e
// condições, empurrados pelos painéis do Mestre), e junto com
// assets/js/log_alteracoes.js passou a mostrar TODA alteração de ficha de
// jogador, dizendo quem mudou (Mestre ou o próprio jogador, pelo login
// dele) — ver sql/029_log_alteracoes_ficha.sql. Este arquivo continua sendo
// só o WIDGET (renderizar a lista, FAB com badge, abrir/fechar); ele não
// sabe de onde vêm as entradas.
//
// Duas origens diferentes empurram texto aqui pelo mesmo registrar():
//   - vilao_combate.js chama direto (client-side, ao vivo, sem persistir —
//     vilão não é uma linha de characters, não tem o que logar no banco).
//   - log_alteracoes.js assina character_changes (Realtime + carga inicial
//     das últimas linhas) e traduz cada uma pra texto antes de chamar aqui.
//
// Self-contained como confirmar.js/rolador.js/iniciativa.js quanto ao FAB
// em si — mas o CONTEÚDO de character_changes é persistente (ver
// log_alteracoes.js); só a LISTA na tela (até 30 itens) é que reseta ao
// recarregar, porque log_alteracoes.js recarrega a partir do banco no boot.
//
// API: LogCombate.registrar(texto, quandoISO?)  — quandoISO é opcional,
// pra carregar uma linha histórica com a hora real dela em vez de "agora".
//
// O FAB é ARRASTÁVEL (mst-13: "deixe ele dinâmico na página, não precisa
// ficar fixado no final da página") — a posição é lembrada por aba/aparelho
// (localStorage, conveniência por quem vê; nunca sincronizada — mesmo
// motivo de ficha_unlock em nucleo.js) e o painel abre virado pro lado que
// tiver espaço, nunca fora da tela, não importa pra onde o FAB foi solto.
window.LogCombate = (function () {
  const MAX = 30;
  const POS_KEY = 'lc_fab_pos';
  let _eventos = [];
  let _naoLidos = 0;

  const CSS = `
  .lc-fab {
    position: fixed; z-index: 8500;
    width: 48px; height: 48px; border-radius: 50%;
    background: linear-gradient(160deg, var(--surface-raised, #211012), var(--surface, #180b0d));
    border: 2px solid var(--gold, #a8232b);
    color: var(--gold, #a8232b);
    font-size: 20px; line-height: 1; cursor: grab;
    box-shadow: 0 6px 18px rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.15s; touch-action: none; user-select: none;
  }
  .lc-fab:hover { transform: scale(1.08); }
  .lc-fab.arrastando { cursor: grabbing; transition: none; }
  .lc-badge {
    position: absolute; top: -4px; right: -4px;
    min-width: 18px; height: 18px; border-radius: 9px;
    background: var(--danger, #861820); color: #fff;
    font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center;
    padding: 0 4px; display: none;
  }
  .lc-badge.show { display: flex; }
  .lc-painel {
    position: fixed; z-index: 8500;
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
  .lc-limpar, .lc-fechar {
    background: none; border: none; color: var(--text-muted, #89776d); cursor: pointer;
    font-size: 11px; position: relative;
  }
  .lc-fechar { font-size: 16px; }
  /* "limpar"/✕ são texto pequeno de propósito (o título não pode competir
     com a lista) — halo por pseudo-elemento fecha os 44px sem crescer a
     letra. Assimétrico: os dois ficam lado a lado dentro de <span>, um halo
     simétrico grande faria as áreas se sobreporem. */
  .lc-limpar::before, .lc-fechar::before { content: ''; position: absolute; inset: -14px -6px; }
  .lc-lista { overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .lc-item { font-size: 11.5px; line-height: 1.4; padding: 4px 6px; border-radius: 4px; background: rgba(0,0,0,0.2); }
  .lc-item .lc-hora { color: var(--text-muted, #89776d); margin-right: 6px; font-size: 10px; }
  .lc-vazio { font-size: 11px; color: var(--text-muted, #89776d); font-style: italic; text-align: center; padding: 12px 0; }
  @media (max-width: 480px) { .lc-painel { width: auto; max-width: calc(100vw - 24px); } }
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
    fab.setAttribute('aria-label', 'Abrir log (arraste pra mover)');
    fab.innerHTML = '📜<span class="lc-badge" id="lc-badge">0</span>';
    document.body.appendChild(fab);

    const painel = document.createElement('div');
    painel.className = 'lc-painel';
    painel.id = 'lc-painel';
    painel.innerHTML = `
      <div class="lc-titulo">Log
        <span>
          <button type="button" class="lc-limpar" id="lc-limpar">limpar</button>
          <button type="button" class="lc-fechar" id="lc-fechar" aria-label="Fechar">✕</button>
        </span>
      </div>
      <div class="lc-lista" id="lc-lista"></div>
    `;
    document.body.appendChild(painel);

    fab.addEventListener('click', () => {
      if (fab.dataset.arrastou === '1') { delete fab.dataset.arrastou; return; }  // clique no fim de um arrasto: não abre
      painel.classList.contains('open') ? fechar() : abrir();
    });
    document.getElementById('lc-fechar').addEventListener('click', fechar);
    document.getElementById('lc-limpar').addEventListener('click', limpar);
    document.addEventListener('click', e => {
      if (painel.classList.contains('open') && !painel.contains(e.target) && e.target !== fab && !fab.contains(e.target)) fechar();
    });

    posicionarFabInicial(fab);
    ligarArraste(fab, painel);
    window.addEventListener('resize', () => manterNaTela(fab));
  }

  // ── Posição do FAB: lembrada por aba/aparelho, nunca fora da tela ──
  function lerPosSalva() {
    try { return JSON.parse(localStorage.getItem(POS_KEY) || 'null'); } catch { return null; }
  }
  function salvarPos(x, y) {
    try { localStorage.setItem(POS_KEY, JSON.stringify({ x, y })); } catch {}
  }
  function posicionarFabInicial(fab) {
    const salva = lerPosSalva();
    // Sem posição salva: onde o widget sempre esteve (canto inferior
    // esquerdo), só que em coordenadas absolutas — daqui em diante o FAB é
    // posicionado por left/top, não mais por left/bottom fixos no CSS.
    const x = salva ? salva.x : 18;
    const y = salva ? salva.y : window.innerHeight - 66;
    fab.style.left = x + 'px';
    fab.style.top = y + 'px';
    manterNaTela(fab);
  }
  // Redimensionou a janela (girou o celular, por ex.) — sem isto o FAB podia
  // ficar preso fora da área visível, sem jeito de arrastar de volta.
  function manterNaTela(fab) {
    const r = fab.getBoundingClientRect();
    const x = Math.min(Math.max(0, r.left), window.innerWidth - r.width);
    const y = Math.min(Math.max(0, r.top), window.innerHeight - r.height);
    fab.style.left = x + 'px';
    fab.style.top = y + 'px';
  }

  // Pointer Events cobrem mouse e toque num só listener. LIMIAR de 6px:
  // sem isso todo clique vira um micro-arrasto e o clique de abrir o painel
  // nunca dispara (pointerup sempre acontece 1px fora de onde começou).
  function ligarArraste(fab, painel) {
    const LIMIAR = 6;
    let ativo = false, moveu = false, offX = 0, offY = 0;
    fab.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      ativo = true; moveu = false;
      const r = fab.getBoundingClientRect();
      offX = e.clientX - r.left; offY = e.clientY - r.top;
      fab.setPointerCapture(e.pointerId);
    });
    fab.addEventListener('pointermove', e => {
      if (!ativo) return;
      const dx = e.clientX - offX - fab.getBoundingClientRect().left;
      const dy = e.clientY - offY - fab.getBoundingClientRect().top;
      if (!moveu && Math.hypot(dx, dy) < LIMIAR) return;
      moveu = true;
      fab.classList.add('arrastando');
      const x = Math.min(Math.max(0, e.clientX - offX), window.innerWidth - fab.offsetWidth);
      const y = Math.min(Math.max(0, e.clientY - offY), window.innerHeight - fab.offsetHeight);
      fab.style.left = x + 'px';
      fab.style.top = y + 'px';
      if (painel.classList.contains('open')) posicionarPainel(fab, painel);
    });
    const soltar = e => {
      if (!ativo) return;
      ativo = false;
      fab.classList.remove('arrastando');
      if (moveu) {
        fab.dataset.arrastou = '1';  // o listener de 'click' que segue vai ignorar esta interação
        const r = fab.getBoundingClientRect();
        salvarPos(r.left, r.top);
      }
    };
    fab.addEventListener('pointerup', soltar);
    fab.addEventListener('pointercancel', soltar);
  }

  // Abre pro lado que tiver espaço (o FAB pode estar em qualquer canto da
  // tela agora, não só embaixo à esquerda) — nunca deixa o painel vazar
  // pra fora da viewport.
  function posicionarPainel(fab, painel) {
    const r = fab.getBoundingClientRect();
    const LARGURA = painel.offsetWidth || 280, ALTURA = painel.offsetHeight || 340, GAP = 8;
    const coubeEmbaixo = r.bottom + GAP + ALTURA <= window.innerHeight;
    const top = coubeEmbaixo ? r.bottom + GAP : Math.max(GAP, r.top - GAP - ALTURA);
    const coubeDireita = r.left + LARGURA <= window.innerWidth - GAP;
    const left = coubeDireita ? r.left : Math.max(GAP, r.right - LARGURA);
    painel.style.top = top + 'px';
    painel.style.left = left + 'px';
  }

  function atualizarLista() {
    const lista = document.getElementById('lc-lista');
    if (!lista) return;
    lista.innerHTML = _eventos.length
      ? _eventos.map(e => `<div class="lc-item"><span class="lc-hora">${e.hora}</span>${e.texto}</div>`).join('')
      : `<div class="lc-vazio">Nenhum evento ainda — alterações na ficha (Mestre ou jogador) aparecem aqui.</div>`;
  }
  function atualizarBadge() {
    const badge = document.getElementById('lc-badge');
    if (!badge) return;
    badge.textContent = _naoLidos > 9 ? '9+' : String(_naoLidos);
    badge.classList.toggle('show', _naoLidos > 0);
  }

  // quandoISO: timestamp real de uma linha histórica (log_alteracoes.js
  // carregando o que já estava no banco antes desta página abrir). Sem
  // isso, toda entrada carregada de uma vez apareceria com a hora atual —
  // enganoso pra algo que aconteceu há uma hora ou ontem.
  //
  // isNovo=false: não soma no badge de "não lidos". A carga inicial do
  // histórico (log_alteracoes.js, ao montar a página) não é uma notificação
  // — sem isso o badge nasceria em "9+" toda vez que a página abrisse, só
  // por reconstruir o que já era conhecido.
  function registrar(texto, quandoISO, isNovo = true) {
    montar();
    const quando = quandoISO ? new Date(quandoISO) : new Date();
    const hora = quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    _eventos.unshift({ texto, hora, quando: quando.getTime() });
    _eventos.sort((a, b) => b.quando - a.quando);
    _eventos = _eventos.slice(0, MAX);
    if (isNovo && !document.getElementById('lc-painel')?.classList.contains('open')) _naoLidos++;
    atualizarLista();
    atualizarBadge();
  }
  function limpar() { _eventos = []; _naoLidos = 0; atualizarLista(); atualizarBadge(); }
  // Esc fecha o painel, como em rolador.js/iniciativa.js/loot_xp.js. O listener
  // só fica registrado enquanto o painel está aberto (referência estável, então
  // add/remove repetidos não acumulam handlers).
  function onEsc(e) { if (e.key === 'Escape') fechar(); }

  function abrir() {
    montar();
    const fab = document.getElementById('lc-fab');
    const painel = document.getElementById('lc-painel');
    posicionarPainel(fab, painel);
    painel.classList.add('open');
    _naoLidos = 0;
    atualizarBadge();
    document.addEventListener('keydown', onEsc);
  }
  function fechar() {
    document.removeEventListener('keydown', onEsc);
    if (_montado) document.getElementById('lc-painel').classList.remove('open');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();

  return { registrar, limpar, abrir, fechar };
})();

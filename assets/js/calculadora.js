// assets/js/calculadora.js
// FAB (botão flutuante) de calculadora — irmã do rolador de dados
// (assets/js/rolador.js), no MESMO formato: FAB redondo + painel que abre
// por cima, self-contained, injeta o próprio CSS/DOM. Fica ao LADO do dado
// (mesma borda inferior, uma largura de FAB + espaço à esquerda dele) —
// pedido explícito: "adicione uma calculadora do lado do ícone do rolador
// de dado... no mesmo formato".
//
// Útil pra somar dano de vários dados de uma vez, dividir loot, converter
// moeda — contas rápidas de mesa que hoje exigiam sair do painel.
//
// Calculadora de 4 operações "como uma calculadora física" (acumulador +
// operador pendente), não um parser de expressão — mais simples, sem
// nenhuma ambiguidade de precedência pra explicar, e sem eval().
//
// API: Calculadora.abrir() / Calculadora.fechar()
(function () {
  const CSS = `
  .calc-fab {
    position: fixed; right: 78px; bottom: 18px; z-index: 8500;
    width: 52px; height: 52px; border-radius: 50%;
    background: linear-gradient(160deg, var(--surface-raised, #211012) 0%, var(--surface, #180b0d) 100%);
    border: 2px solid var(--gold, #a8232b);
    color: var(--gold, #a8232b);
    font-size: 21px; line-height: 1; cursor: pointer;
    box-shadow: 0 6px 18px rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.15s;
  }
  .calc-fab:hover { transform: scale(1.08); }
  .calc-painel {
    position: fixed; right: 78px; bottom: 80px; z-index: 8500;
    width: 240px; max-width: calc(100vw - 96px);
    background: linear-gradient(160deg, var(--surface-raised, #211012) 0%, var(--surface, #180b0d) 100%);
    border: 1px solid var(--border, #5f171b);
    border-radius: 10px;
    padding: 14px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    font-family: var(--font-body, Georgia, serif);
    color: var(--text, #ddd0bc);
    opacity: 0; transform: translateY(8px) scale(0.97); pointer-events: none;
    transition: opacity 0.15s, transform 0.15s;
  }
  .calc-painel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
  .calc-titulo {
    font-family: var(--font-heading, serif); font-size: 12px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase; color: var(--gold, #a8232b);
    margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;
  }
  .calc-fechar { background: none; border: none; color: var(--text-muted, #89776d); cursor: pointer; font-size: 16px; line-height: 1; padding: 2px; }
  .calc-visor {
    text-align: right; padding: 10px 10px; margin-bottom: 10px;
    background: rgba(0,0,0,0.3); border-radius: 6px; border: 1px solid var(--border, #5f171b);
    overflow: hidden;
  }
  .calc-visor-op { font-size: 11px; color: var(--text-muted, #89776d); min-height: 14px; }
  .calc-visor-num {
    font-size: 26px; font-weight: 700; color: var(--gold-light, #d14242);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .calc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .calc-btn {
    padding: 12px 0; font-size: 15px; font-weight: 700;
    background: rgba(0,0,0,0.25); border: 1px solid var(--border, #5f171b); border-radius: 6px;
    color: var(--text, #ddd0bc); cursor: pointer; transition: all 0.12s;
  }
  .calc-btn:hover { border-color: var(--gold, #a8232b); color: var(--gold-light, #d14242); }
  .calc-btn.calc-op { background: rgba(168,35,43,0.15); color: var(--gold-light, #d14242); }
  .calc-btn.calc-igual {
    background: var(--gold, #a8232b); border-color: var(--gold, #a8232b); color: var(--bg, #070506);
    grid-column: span 2;
  }
  .calc-btn.calc-limpar { color: var(--erro, #d14242); }
  @media (max-width: 480px) {
    .calc-painel { right: 10px; left: 10px; width: auto; max-width: none; }
    .calc-fab { right: 74px; bottom: 12px; }
    /* Mesmo padrão de rolador.js: alvo de toque de 44px no celular. */
    .calc-btn { min-height: 44px; }
    .calc-fechar { position: relative; }
    .calc-fechar::after { content: ''; position: absolute; inset: -12px -10px; }
  }
  `;

  // ── Estado: acumulador + operador pendente, como uma calculadora física ──
  let visor = '0';        // o que está sendo digitado agora
  let acumulado = null;   // resultado parcial (null = nada acumulado ainda)
  let operador = null;    // '+' '-' '×' '÷' pendente, ou null
  let reiniciarProximo = false;  // true logo após operador/igual: o próximo dígito começa um número novo

  function aplicar(a, op, b) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? NaN : a / b;
      default: return b;
    }
  }
  // Corta a "sujeira" de ponto flutuante (0.1+0.2 → 0.30000000000000004) sem
  // virar notação científica pra números grandes de dano/loot.
  function formatar(n) {
    if (!Number.isFinite(n)) return 'Erro';
    const arred = Math.round(n * 1e9) / 1e9;
    return String(arred);
  }

  function digitar(d) {
    if (reiniciarProximo) { visor = d === '.' ? '0.' : d; reiniciarProximo = false; }
    else if (visor === '0' && d !== '.') visor = d;
    else if (d === '.' && visor.includes('.')) return;
    else visor += d;
    atualizarTela();
  }
  function escolherOperador(op) {
    const atual = parseFloat(visor);
    if (operador && !reiniciarProximo) acumulado = aplicar(acumulado, operador, atual);
    else acumulado = atual;
    operador = op;
    reiniciarProximo = true;
    atualizarTela();
  }
  function igual() {
    if (operador === null) return;
    const resultado = aplicar(acumulado, operador, parseFloat(visor));
    visor = formatar(resultado);
    acumulado = null; operador = null; reiniciarProximo = true;
    atualizarTela();
  }
  function limpar() { visor = '0'; acumulado = null; operador = null; reiniciarProximo = false; atualizarTela(); }
  function apagar() {
    if (reiniciarProximo) return;  // ⌫ logo após um operador não faz sentido
    visor = visor.length > 1 ? visor.slice(0, -1) : '0';
    atualizarTela();
  }
  function negar() { if (visor !== '0') { visor = visor.startsWith('-') ? visor.slice(1) : '-' + visor; atualizarTela(); } }
  function porcento() {
    const atual = parseFloat(visor);
    visor = formatar(operador && acumulado !== null ? acumulado * (atual / 100) : atual / 100);
    atualizarTela();
  }

  function atualizarTela() {
    const linhaOp = document.getElementById('calc-op-linha');
    const linhaNum = document.getElementById('calc-num-linha');
    if (!linhaNum) return;
    linhaOp.textContent = operador && acumulado !== null ? `${formatar(acumulado)} ${operador}` : '';
    linhaNum.textContent = visor;
  }

  const TECLAS = [
    { t: 'C', cls: 'calc-limpar', fn: limpar }, { t: '⌫', fn: apagar },
    { t: '%', fn: porcento }, { t: '÷', cls: 'calc-op', fn: () => escolherOperador('÷') },
    { t: '7', fn: () => digitar('7') }, { t: '8', fn: () => digitar('8') },
    { t: '9', fn: () => digitar('9') }, { t: '×', cls: 'calc-op', fn: () => escolherOperador('×') },
    { t: '4', fn: () => digitar('4') }, { t: '5', fn: () => digitar('5') },
    { t: '6', fn: () => digitar('6') }, { t: '-', cls: 'calc-op', fn: () => escolherOperador('-') },
    { t: '1', fn: () => digitar('1') }, { t: '2', fn: () => digitar('2') },
    { t: '3', fn: () => digitar('3') }, { t: '+', cls: 'calc-op', fn: () => escolherOperador('+') },
    { t: '±', fn: negar }, { t: '0', fn: () => digitar('0') },
    { t: ',', fn: () => digitar('.') }, { t: '=', cls: 'calc-igual', fn: igual },
  ];

  let _montado = false;
  function montar() {
    if (_montado) return;
    _montado = true;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'calc-fab';
    fab.id = 'calc-fab';
    fab.setAttribute('aria-label', 'Abrir calculadora');
    fab.setAttribute('aria-haspopup', 'true');
    fab.setAttribute('aria-expanded', 'false');
    fab.textContent = '🧮';
    document.body.appendChild(fab);

    const painel = document.createElement('div');
    painel.className = 'calc-painel';
    painel.id = 'calc-painel';
    painel.setAttribute('role', 'dialog');
    painel.setAttribute('aria-label', 'Calculadora');
    painel.innerHTML = `
      <div class="calc-titulo">Calculadora <button type="button" class="calc-fechar" id="calc-fechar" aria-label="Fechar">✕</button></div>
      <div class="calc-visor">
        <div class="calc-visor-op" id="calc-op-linha"></div>
        <div class="calc-visor-num" id="calc-num-linha">0</div>
      </div>
      <div class="calc-grid">
        ${TECLAS.map((k, i) => `<button type="button" class="calc-btn ${k.cls || ''}" data-calc-i="${i}">${k.t}</button>`).join('')}
      </div>
    `;
    document.body.appendChild(painel);

    fab.addEventListener('click', () => (painel.classList.contains('open') ? fechar() : abrir()));
    document.getElementById('calc-fechar').addEventListener('click', fechar);
    painel.querySelectorAll('[data-calc-i]').forEach(btn => {
      btn.addEventListener('click', () => TECLAS[+btn.dataset.calcI].fn());
    });
    // Teclado físico funciona com o painel aberto — número, operadores,
    // Enter (=), Backspace, Escape (fecha) e Esc já é tratado abaixo.
    document.addEventListener('keydown', e => {
      if (!painel.classList.contains('open')) return;
      if (/^[0-9]$/.test(e.key)) { digitar(e.key); return; }
      if (e.key === '.' || e.key === ',') { digitar('.'); return; }
      if (e.key === '+') { escolherOperador('+'); return; }
      if (e.key === '-') { escolherOperador('-'); return; }
      if (e.key === '*') { escolherOperador('×'); return; }
      if (e.key === '/') { e.preventDefault(); escolherOperador('÷'); return; }
      if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); igual(); return; }
      if (e.key === 'Backspace') { apagar(); return; }
      if (e.key === 'Escape') { fechar(); return; }
      if (e.key.toLowerCase() === 'c') { limpar(); return; }
    });
    document.addEventListener('click', e => {
      if (painel.classList.contains('open') && !painel.contains(e.target) && e.target !== fab) fechar();
    });
  }

  function abrir() {
    montar();
    document.getElementById('calc-painel').classList.add('open');
    document.getElementById('calc-fab').setAttribute('aria-expanded', 'true');
  }
  function fechar() {
    if (!_montado) return;
    document.getElementById('calc-painel').classList.remove('open');
    document.getElementById('calc-fab').setAttribute('aria-expanded', 'false');
  }

  // Auto-monta o FAB ao carregar — mesmo padrão de rolador.js: um botão
  // sempre disponível na tela, não algo que precisa ser "aberto" por outro
  // código pra existir.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montar);
  } else {
    montar();
  }

  window.Calculadora = { abrir, fechar };
})();

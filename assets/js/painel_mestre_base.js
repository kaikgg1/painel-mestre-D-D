// assets/js/painel_mestre_base.js
// Funções/constantes que existiam coladas, idênticas (só formatação
// divergia), em painel_mestre_dnd5e.html E painel_barovia_dnd5e.html —
// um só lugar agora (mst-12). Continuam expostas como globais soltos (não
// window.PainelMestreBase.X) de propósito: são chamadas assim (escapeHtml(x),
// toast(x), CONDICOES etc.) em dezenas de lugares nos dois arquivos, e
// namespacing exigiria reescrever cada call site à toa.
//
// NÃO inclui criarPersonagem()/CAMPANHA/PERSONAGENS_INICIAIS — esses
// genuinamente divergem entre os dois painéis (barovia tem campos extras
// como atributos/deslocamento que painel_mestre ainda não usa na criação
// local), então continuam próprios de cada arquivo.

const CONDICOES = [
  'Agarrado', 'Amedrontado', 'Atordoado', 'Caído', 'Cego', 'Enfeitiçado',
  'Envenenado', 'Impedido', 'Incapacitado', 'Inconsciente', 'Invisível',
  'Paralisado', 'Petrificado', 'Surdo'
];

const NIVEIS_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// ─── Anti-eco: marca saves locais pra ignorar o próprio realtime echo ───
const _ecoLocal = new Map();
function marcarEcoLocal(id) {
  if (!id) return;
  _ecoLocal.set(id, Date.now());
  setTimeout(() => _ecoLocal.delete(id), 3000);
}
function ehEcoLocal(id) {
  const t = _ecoLocal.get(id);
  return t && (Date.now() - t < 2500);
}

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

// Falha de autosave (DBSync.salvarCampo) hoje só ia pro console — o Mestre
// achava que tinha salvo e não tinha. Avisa na tela.
window.addEventListener('dbsync:erro', () => toast('⚠ Falha ao salvar — verifique sua conexão'));

// Aplica "=N" (define), "+N"/"-N" (soma/subtrai) ou "N" (define) num valor
// atual — usado pelos inputs numéricos dos cards (PV, CA etc.) pra permitir
// tanto digitar o valor final quanto uma variação rápida.
function aplicarMatematica(valorAtual, entrada) {
  const txt = String(entrada).trim();
  if (txt === '') return valorAtual;
  if (txt.startsWith('=')) {
    const n = parseInt(txt.slice(1));
    return isNaN(n) ? valorAtual : n;
  }
  if (txt.startsWith('+')) {
    const n = parseInt(txt.slice(1));
    return isNaN(n) ? valorAtual : valorAtual + n;
  }
  if (txt.startsWith('-') && txt.length > 1) {
    const n = parseInt(txt.slice(1));
    return isNaN(n) ? valorAtual : valorAtual - n;
  }
  const n = parseInt(txt);
  return isNaN(n) ? valorAtual : n;
}

// Escape HTML básico
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

// Input numérico reutilizável (PV/CA/Nível/etc.): Enter ou perder foco
// aplica aplicarMatematica() no valor digitado.
function inputNumerico(valor, callback, classes = '', min = null) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'stat-input ' + classes;
  input.value = valor;
  input.dataset.valor = valor;

  const aplicar = () => {
    const atual = parseInt(input.dataset.valor) || 0;
    let novo = aplicarMatematica(atual, input.value);
    if (min !== null) novo = Math.max(min, novo);
    input.value = novo;
    input.dataset.valor = novo;
    callback(novo);
  };

  input.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); aplicar(); input.blur(); }
  };
  input.onblur = aplicar;
  input.onfocus = () => input.select();
  return input;
}

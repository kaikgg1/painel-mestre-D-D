// assets/js/regras_base.js
// Fórmulas centrais do PHB 5e reusadas em vários módulos (ficha, painéis,
// grimório, compêndio). Fonte única — evita que um ajuste de regra precise
// ser replicado manualmente em 4+ arquivos diferentes.
//
// Script clássico (sem type="module"): carregar via <script src> ANTES de
// qualquer módulo que use window.Regras (nucleo.js, ataques.js,
// recursos_classe.js, compendio.js).
//
// Também mora aqui o escape de HTML — não é uma "regra do PHB", mas sofria do
// mesmo problema: 3 implementações quase idênticas (nucleo.js, master_notes.js,
// compendio.js) e uma delas (compendio.js) esquecia de escapar aspas simples.
//
// API:
//   Regras.mod(valorAtributo)   → modificador (ex.: 14 → 2, 8 → -1)
//   Regras.bonusProf(nivel)     → bônus de proficiência (ex.: 5 → 3)
//   Regras.fmtMod(numero)       → string com sinal (ex.: 2 → "+2", -1 → "-1")
//   Regras.escapeHtml(texto)    → texto seguro pra jogar dentro de innerHTML

(function () {
  const mod = v => Math.floor(((+v || 10) - 10) / 2);
  const bonusProf = nv => Math.floor(((+nv || 1) - 1) / 4) + 2;
  const fmtMod = m => (m >= 0 ? '+' : '') + m;
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  // Rola 1d20 (+ bônus), com suporte a vantagem/desvantagem (PHB): rola 2d20
  // e usa o maior (vantagem) ou o menor (desvantagem). modo: 'normal' (padrão),
  // 'vantagem' ou 'desvantagem'. Usado tanto por Ataques quanto pelos botões
  // de rolar perícia/salvaguarda (aba_combate.js).
  function rolarD20(bonus, modo) {
    const d1 = 1 + Math.floor(Math.random() * 20);
    let usado = d1, d2 = null;
    if (modo === 'vantagem' || modo === 'desvantagem') {
      d2 = 1 + Math.floor(Math.random() * 20);
      usado = modo === 'vantagem' ? Math.max(d1, d2) : Math.min(d1, d2);
    }
    const b = +bonus || 0;
    const total = usado + b;
    const dados = d2 !== null ? `${d1}/${d2}→${usado}` : `${usado}`;
    return {
      total, usado, d1, d2, bonus: b,
      texto: `${dados}${fmtMod(b)} = ${total}`,
      critico: usado === 20,
      falhaCritica: usado === 1,
    };
  }

  window.Regras = { mod, bonusProf, fmtMod, escapeHtml, rolarD20 };
})();

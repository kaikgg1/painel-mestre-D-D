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

  window.Regras = { mod, bonusProf, fmtMod, escapeHtml };
})();

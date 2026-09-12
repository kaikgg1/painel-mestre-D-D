// assets/js/vilao_atividade.js
// Registro leve de "quais fichas de vilão foram tocadas recentemente" —
// mst-13/mst-15 da auditoria: um atalho no índice (paineis/vilao/index.html)
// pros vilões que o Mestre já está usando na sessão atual, sem precisar
// rolar/buscar a lista inteira de novo toda vez que troca de aba.
//
// Puramente local (localStorage, por navegador/dispositivo — não sincroniza
// entre Mestre e jogadores, nem entre aparelhos do próprio Mestre). Cada
// ficha de vilão chama registrar() no seu próprio saveState(); o índice lê
// via listar().
//
// API: VilaoAtividade.registrar(slug, nome) / VilaoAtividade.listar()
window.VilaoAtividade = (function () {
  const CHAVE = 'vilao_atividade_recente';
  const MAX = 12;

  function registrar(slug, nome) {
    if (!slug) return;
    try {
      let lista = JSON.parse(localStorage.getItem(CHAVE) || '[]');
      if (!Array.isArray(lista)) lista = [];
      lista = lista.filter(x => x.slug !== slug);
      lista.unshift({ slug, nome: nome || slug, ts: Date.now() });
      localStorage.setItem(CHAVE, JSON.stringify(lista.slice(0, MAX)));
    } catch { /* localStorage indisponível (modo privado etc.) — sem atalho, sem quebrar nada */ }
  }

  function listar() {
    try {
      const lista = JSON.parse(localStorage.getItem(CHAVE) || '[]');
      return Array.isArray(lista) ? lista : [];
    } catch { return []; }
  }

  return { registrar, listar };
})();

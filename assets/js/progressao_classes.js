// assets/js/progressao_classes.js
// Em que nível cada classe faz cada ESCOLHA (PHB Galápagos, tabelas de
// classe) — usado pelo assistente de subida de nível. O que a classe GANHA
// de habilidade vem do catálogo data/habilidades_classes.json; aqui só o
// que exige decisão do jogador.
//
// API:
//   ProgressaoPHB.nivelSubclasse(classe)          → 1 | 2 | 3
//   ProgressaoPHB.escolhasDoNivel(c, N)          → ['subclasse','asi', ...]

(function () {
  const chave = c => (c || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const NIVEL_SUBCLASSE = { clerigo: 1, feiticeiro: 1, bruxo: 1, druida: 2, mago: 2 };
  const ASI_PADRAO = [4, 8, 12, 16, 19];
  const ASI_POR_CLASSE = {
    guerreiro: [4, 6, 8, 12, 14, 16, 19],
    ladino: [4, 8, 10, 12, 16, 19],
  };

  function nivelSubclasse(classe) { return NIVEL_SUBCLASSE[chave(classe)] || 3; }
  function niveisASI(classe) { return ASI_POR_CLASSE[chave(classe)] || ASI_PADRAO; }

  // c = personagem (classe, subclasse); N = nível sendo processado.
  function escolhasDoNivel(c, N) {
    const passos = [];
    if (!c || !c.classe) return passos;
    if (!c.subclasse && N >= nivelSubclasse(c.classe)) passos.push('subclasse');
    if (niveisASI(c.classe).includes(N)) passos.push('asi');
    return passos;
  }

  window.ProgressaoPHB = { chave, nivelSubclasse, niveisASI, escolhasDoNivel };
})();

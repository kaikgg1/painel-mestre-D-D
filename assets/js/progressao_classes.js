// assets/js/progressao_classes.js
// Em que nível cada classe faz cada ESCOLHA (PHB Galápagos, tabelas de
// classe) — usado pelo assistente de subida de nível. O que a classe GANHA
// de habilidade vem de data/habilidades_classes.json; as quantidades de
// truques/magias/invocações vêm de data/progressao_magias.json (passado
// como `prog`); aqui só a regra de "quando escolhe o quê".
//
// API:
//   ProgressaoPHB.nivelSubclasse(classe)            → 1 | 2 | 3
//   ProgressaoPHB.escolhasDoNivel(c, N, prog)      → ['subclasse','asi', ...]
//   ProgressaoPHB.ganhoMagias(c, N, prog)          → {truques, magias, arcana, lista, escolas, escolaLivre, segredos}
//   ProgressaoPHB.qtdExpertise(c, N) / qtdInvocacoes(c, N, prog) / qtdMetamagias(N)

(function () {
  const chave = c => (c || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const NIVEL_SUBCLASSE = { clerigo: 1, feiticeiro: 1, bruxo: 1, druida: 2, mago: 2 };
  const ASI_PADRAO = [4, 8, 12, 16, 19];
  const ASI_POR_CLASSE = {
    guerreiro: [4, 6, 8, 12, 14, 16, 19],
    ladino: [4, 8, 10, 12, 16, 19],
  };
  const EXPERTISE = { ladino: [1, 6], bardo: [3, 10] };
  const ESTILO = { guerreiro: [1], paladino: [2], patrulheiro: [2] };
  const METAMAGIA = [3, 10, 17];
  // Conjuração de subclasse (1/3 conjurador) — chave em progressao_magias.json.
  const SUB_CONJURADORA = { 'Cavaleiro Místico': 'cavaleiro_mistico', 'Trapaceiro Arcano': 'trapaceiro_arcano' };

  function nivelSubclasse(classe) { return NIVEL_SUBCLASSE[chave(classe)] || 3; }
  function niveisASI(classe) { return ASI_POR_CLASSE[chave(classe)] || ASI_PADRAO; }
  const em = (arr, N) => (Array.isArray(arr) && N >= 1 ? +arr[Math.min(20, N) - 1] || 0 : 0);
  const delta = (arr, N) => Math.max(0, em(arr, N) - em(arr, N - 1));

  function qtdMetamagias(N) { return METAMAGIA.includes(N) ? (N === 3 ? 2 : 1) : 0; }
  function qtdExpertise(c, N) { return (EXPERTISE[chave(c.classe)] || []).includes(N) ? 2 : 0; }
  function qtdInvocacoes(c, N, prog) { return chave(c.classe) === 'bruxo' ? delta(prog?.bruxo?.invocacoes, N) : 0; }

  // Quantos truques/magias o personagem aprende AO CHEGAR no nível N.
  function ganhoMagias(c, N, prog) {
    const k = chave(c.classe);
    const out = { truques: 0, magias: 0, arcana: 0, lista: c.classe, escolas: null, escolaLivre: false, segredos: 0 };
    if (!prog) return out;
    const subK = SUB_CONJURADORA[c.subclasse];
    if (subK && prog[subK]) {
      const t = prog[subK];
      out.truques = delta(t.truques, N);
      out.magias = delta(t.conhecidas, N);
      out.lista = 'Mago';
      out.escolas = t.escolas;
      out.escolaLivre = (t.niveisEscolaLivre || []).includes(N);
      return out;
    }
    const t = prog[k];
    if (!t) return out;
    out.truques = delta(t.truques, N);
    if (t.conhecidas) out.magias = delta(t.conhecidas, N);
    if (k === 'mago' && N >= 2) out.magias = +t.grimorioPorNivel || 2;
    if (k === 'bruxo' && t.arcanaMistica && t.arcanaMistica[N]) out.arcana = +t.arcanaMistica[N];
    if (k === 'bardo' && prog.bardo_segredos_magicos?.niveis?.includes(N)) out.segredos = +prog.bardo_segredos_magicos.magiasPorNivel || 2;
    return out;
  }

  // c = personagem (classe, subclasse efetiva); N = nível sendo processado.
  function escolhasDoNivel(c, N, prog) {
    const passos = [];
    if (!c || !c.classe) return passos;
    const k = chave(c.classe);
    if (!c.subclasse && N >= nivelSubclasse(c.classe)) passos.push('subclasse');
    if (niveisASI(c.classe).includes(N)) passos.push('asi');
    if ((ESTILO[k] || []).includes(N) || (c.subclasse === 'Campeão' && N === 10)) passos.push('estilo');
    if (qtdExpertise(c, N)) passos.push('expertise');
    if (k === 'feiticeiro' && qtdMetamagias(N)) passos.push('metamagia');
    if (k === 'bruxo' && N === 3) passos.push('pacto');
    if (qtdInvocacoes(c, N, prog)) passos.push('invocacoes');
    const g = ganhoMagias(c, N, prog);
    if (g.truques || g.magias || g.arcana) passos.push('magias');
    return passos;
  }

  // Texto curto do que foi escolhido num nível (histórico no card do Mestre).
  // r = nivel_escolhas.historico[N], gravado por assets/js/ficha/subida_nivel.js.
  function resumoRegistro(r) {
    if (!r) return '';
    const partes = [];
    if (r.subclasse) partes.push(r.subclasse);
    if (r.asi) partes.push(Object.entries(r.asi).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(', '));
    if (r.talento) partes.push('Talento ' + r.talento.nome + (r.talento.atributo ? ` (+1 ${r.talento.atributo.toUpperCase()})` : ''));
    if (r.estilo) partes.push('Estilo ' + r.estilo);
    if (r.expertise) partes.push('Especialização: ' + r.expertise.join(', '));
    if (r.metamagias) partes.push('Metamágica: ' + r.metamagias.join(', '));
    if (r.pacto) partes.push(r.pacto);
    if (r.invocacoes) partes.push('Invocações: ' + r.invocacoes.join(', '));
    if (r.truques) partes.push('Truques: ' + r.truques.join(', '));
    if (r.magias) partes.push('Magias: ' + r.magias.join(', '));
    if (r.arcana) partes.push('Arcana Mística: ' + r.arcana.join(', '));
    return partes.join(' · ');
  }

  window.ProgressaoPHB = {
    chave, nivelSubclasse, niveisASI, escolhasDoNivel, ganhoMagias,
    qtdMetamagias, qtdExpertise, qtdInvocacoes, resumoRegistro,
  };
})();

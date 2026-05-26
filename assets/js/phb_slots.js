// assets/js/phb_slots.js
// Tabela de espaços de magia por classe e nível (PHB 5e).
// Expõe window.SlotsPHB = { porClasse(classe, nivel) } → { 1: max, 2: max, ... }
// Bruxo usa Pact Magic (todos do mesmo nível, recuperam em descanso curto).

(function () {
  // Linha 0 = nível 1, ... 19 = nível 20.
  // Índice 0 do array interno = slot de 1° nível, ..., 8 = 9° nível.
  const FULL = [
    [2,0,0,0,0,0,0,0,0],  // 1
    [3,0,0,0,0,0,0,0,0],  // 2
    [4,2,0,0,0,0,0,0,0],  // 3
    [4,3,0,0,0,0,0,0,0],  // 4
    [4,3,2,0,0,0,0,0,0],  // 5
    [4,3,3,0,0,0,0,0,0],  // 6
    [4,3,3,1,0,0,0,0,0],  // 7
    [4,3,3,2,0,0,0,0,0],  // 8
    [4,3,3,3,1,0,0,0,0],  // 9
    [4,3,3,3,2,0,0,0,0],  // 10
    [4,3,3,3,2,1,0,0,0],  // 11
    [4,3,3,3,2,1,0,0,0],  // 12
    [4,3,3,3,2,1,1,0,0],  // 13
    [4,3,3,3,2,1,1,0,0],  // 14
    [4,3,3,3,2,1,1,1,0],  // 15
    [4,3,3,3,2,1,1,1,0],  // 16
    [4,3,3,3,2,1,1,1,1],  // 17
    [4,3,3,3,3,1,1,1,1],  // 18
    [4,3,3,3,3,2,1,1,1],  // 19
    [4,3,3,3,3,2,2,1,1],  // 20
  ];

  const HALF = [
    [0,0,0,0,0,0,0,0,0],  // 1 — sem magia
    [2,0,0,0,0,0,0,0,0],  // 2
    [3,0,0,0,0,0,0,0,0],  // 3
    [3,0,0,0,0,0,0,0,0],  // 4
    [4,2,0,0,0,0,0,0,0],  // 5
    [4,2,0,0,0,0,0,0,0],  // 6
    [4,3,0,0,0,0,0,0,0],  // 7
    [4,3,0,0,0,0,0,0,0],  // 8
    [4,3,2,0,0,0,0,0,0],  // 9
    [4,3,2,0,0,0,0,0,0],  // 10
    [4,3,3,0,0,0,0,0,0],  // 11
    [4,3,3,0,0,0,0,0,0],  // 12
    [4,3,3,1,0,0,0,0,0],  // 13
    [4,3,3,1,0,0,0,0,0],  // 14
    [4,3,3,2,0,0,0,0,0],  // 15
    [4,3,3,2,0,0,0,0,0],  // 16
    [4,3,3,3,1,0,0,0,0],  // 17
    [4,3,3,3,1,0,0,0,0],  // 18
    [4,3,3,3,2,0,0,0,0],  // 19
    [4,3,3,3,2,0,0,0,0],  // 20
  ];

  // 1/3 caster (Cavaleiro Místico / Trapaceiro Arcano) — PHB
  const ONETHIRD = [
    [0,0,0,0,0,0,0,0,0],  // 1
    [0,0,0,0,0,0,0,0,0],  // 2
    [2,0,0,0,0,0,0,0,0],  // 3
    [3,0,0,0,0,0,0,0,0],  // 4
    [3,0,0,0,0,0,0,0,0],  // 5
    [3,0,0,0,0,0,0,0,0],  // 6
    [4,2,0,0,0,0,0,0,0],  // 7
    [4,2,0,0,0,0,0,0,0],  // 8
    [4,2,0,0,0,0,0,0,0],  // 9
    [4,3,0,0,0,0,0,0,0],  // 10
    [4,3,0,0,0,0,0,0,0],  // 11
    [4,3,0,0,0,0,0,0,0],  // 12
    [4,3,2,0,0,0,0,0,0],  // 13
    [4,3,2,0,0,0,0,0,0],  // 14
    [4,3,2,0,0,0,0,0,0],  // 15
    [4,3,3,0,0,0,0,0,0],  // 16
    [4,3,3,0,0,0,0,0,0],  // 17
    [4,3,3,0,0,0,0,0,0],  // 18
    [4,3,3,1,0,0,0,0,0],  // 19
    [4,3,3,1,0,0,0,0,0],  // 20
  ];

  // Bruxo (Pact Magic): { qtd: quantidade, nivel: nível do slot }
  const BRUXO = [
    { qtd:1, nivel:1 },  // 1
    { qtd:2, nivel:1 },  // 2
    { qtd:2, nivel:2 },  // 3
    { qtd:2, nivel:2 },  // 4
    { qtd:2, nivel:3 },  // 5
    { qtd:2, nivel:3 },  // 6
    { qtd:2, nivel:4 },  // 7
    { qtd:2, nivel:4 },  // 8
    { qtd:2, nivel:5 },  // 9
    { qtd:2, nivel:5 },  // 10
    { qtd:3, nivel:5 },  // 11
    { qtd:3, nivel:5 },  // 12
    { qtd:3, nivel:5 },  // 13
    { qtd:3, nivel:5 },  // 14
    { qtd:3, nivel:5 },  // 15
    { qtd:3, nivel:5 },  // 16
    { qtd:4, nivel:5 },  // 17
    { qtd:4, nivel:5 },  // 18
    { qtd:4, nivel:5 },  // 19
    { qtd:4, nivel:5 },  // 20
  ];

  // Mapeamento de classe → tipo de tabela
  const TIPO = {
    'bardo':       'full', 'clerigo':     'full', 'druida':      'full',
    'feiticeiro':  'full', 'mago':        'full',
    'paladino':    'half', 'patrulheiro': 'half',
    'bruxo':       'pact',
    // Não-casters por padrão; subclasses 1/3-caster são detectadas via subclasse
    'barbaro': null, 'guerreiro': null, 'ladino': null, 'monge': null,
  };

  // Subclasses 1/3-caster (PHB) — usam tabela ONETHIRD
  const SUB_ONETHIRD = new Set([
    'Cavaleiro Místico',  // Guerreiro
    'Trapaceiro Arcano',  // Ladino
  ]);

  function chave(classe) {
    return (classe || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  // Retorna { 1: max, 2: max, ..., 9: max } com os valores fixos da classe/subclasse.
  // Para não-conjuradores, retorna null.
  function porClasse(classe, nivel, subclasse) {
    const k = chave(classe);
    const tipo = TIPO[k];
    const lvl = Math.max(1, Math.min(20, +nivel || 1));
    if (tipo === 'full') {
      const row = FULL[lvl - 1];
      const out = {};
      for (let i = 0; i < 9; i++) out[i + 1] = row[i];
      return out;
    }
    if (tipo === 'half') {
      const row = HALF[lvl - 1];
      const out = {};
      for (let i = 0; i < 9; i++) out[i + 1] = row[i];
      return out;
    }
    if (tipo === 'pact') {
      // Bruxo: tudo no MESMO nível
      const { qtd, nivel: nv } = BRUXO[lvl - 1];
      const out = {};
      for (let i = 1; i <= 9; i++) out[i] = (i === nv) ? qtd : 0;
      return out;
    }
    // 1/3 caster por subclasse (Cavaleiro Místico, Trapaceiro Arcano)
    if (subclasse && SUB_ONETHIRD.has(subclasse)) {
      const row = ONETHIRD[lvl - 1];
      const out = {};
      for (let i = 0; i < 9; i++) out[i + 1] = row[i];
      return out;
    }
    return null;  // sem slots
  }

  function tipoDaClasse(classe, subclasse) {
    const t = TIPO[chave(classe)];
    if (t) return t;
    if (subclasse && SUB_ONETHIRD.has(subclasse)) return 'third';
    return null;
  }

  window.SlotsPHB = { porClasse, tipoDaClasse };
})();

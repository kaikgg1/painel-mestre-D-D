// assets/js/exaustao_regras.js
// Regras de Exaustão do PHB (D&D 5e, 2014) — efeitos cumulativos por nível.
// Usado tanto no painel do Mestre (painel_barovia_dnd5e.html) quanto na
// ficha do jogador (ficha.html), lendo o mesmo campo `exaustao` já
// sincronizado via Supabase — garante que os efeitos batam nos dois lados.
(function () {
  // Cada nível soma os efeitos dos níveis anteriores (regra oficial: cumulativo).
  const NIVEIS = {
    1: { desvantagemTestes: true, texto: 'Desvantagem em testes de habilidade' },
    2: { velocidadeMult: 0.5, texto: 'Deslocamento reduzido à metade' },
    3: { desvantagemAtaquesSalvaguardas: true, texto: 'Desvantagem em ataques e testes de resistência' },
    4: { hpMaxMult: 0.5, texto: 'PV máximo reduzido à metade' },
    5: { velocidadeZero: true, texto: 'Deslocamento reduzido a 0' },
    6: { morto: true, texto: 'Morte' },
  };

  /** Efeitos cumulativos ativos num dado nível de exaustão (0 a 6). */
  function efeitos(nivel) {
    const n = Math.max(0, Math.min(6, Math.round(+nivel || 0)));
    const out = {
      nivel: n,
      desvantagemTestes: false,
      velocidadeMult: 1,
      desvantagemAtaquesSalvaguardas: false,
      hpMaxMult: 1,
      velocidadeZero: false,
      morto: false,
      resumo: [],
    };
    for (let i = 1; i <= n; i++) {
      const e = NIVEIS[i];
      if (e.desvantagemTestes) out.desvantagemTestes = true;
      if (e.velocidadeMult) out.velocidadeMult = e.velocidadeMult;
      if (e.desvantagemAtaquesSalvaguardas) out.desvantagemAtaquesSalvaguardas = true;
      if (e.hpMaxMult) out.hpMaxMult = e.hpMaxMult;
      if (e.velocidadeZero) out.velocidadeZero = true;
      if (e.morto) out.morto = true;
      out.resumo.push(e.texto);
    }
    return out;
  }

  /** Deslocamento efetivo (metros), já considerando os efeitos de exaustão. */
  function velocidadeEfetiva(base, nivel) {
    const e = efeitos(nivel);
    const b = +base || 0;
    if (e.velocidadeZero) return 0;
    return Math.floor(b * e.velocidadeMult);
  }

  /** PV máximo efetivo, já considerando os efeitos de exaustão (não altera o valor salvo). */
  function hpMaxEfetivo(base, nivel) {
    const e = efeitos(nivel);
    const b = +base || 0;
    return Math.max(0, Math.floor(b * e.hpMaxMult));
  }

  window.ExaustaoRegras = { efeitos, velocidadeEfetiva, hpMaxEfetivo, NIVEIS };
})();

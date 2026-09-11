// assets/js/ataques.js
// Calculadora de ataque/dano a partir de uma arma do inventário (PHB 5e).
// Puramente derivada — não lê nem grava nada no banco, não precisa de
// migration. Usada pela aba Resumo da ficha (assets/js/ficha/aba_resumo.js)
// pra responder rápido "quais ataques posso usar" sem o jogador ter que
// somar nada na mão.
//
// Regra assumida (documentada, não escondida): toda arma no inventário é
// tratada como PROFICIENTE por padrão — a maioria dos jogadores só guarda
// armas que sabe usar, e as exceções de classe/subclasse (ex.: Domínio da
// Guerra dá arma marcial+armadura pesada ao Clérigo) formam uma tabela de
// proficiências que esta ficha ainda não modela. Por isso o valor aqui é
// sempre um PALPITE — a interface deixa isso explícito, não é gravado em
// lugar nenhum, e ganha edição de verdade quando o inventário for refeito
// (Fase 7/8 do redesign).
//
// API:
//   Ataques.calcular(arma, atributos, nivel) -> {
//     atrKey, modAtr, bonusProf, bonusAtaque, danoBonus, danoTexto,
//     distancia, finesse
//   }
//   Ataques.rolar(arma, atributos, nivel) -> { ataqueTexto, danoTexto, ataqueTotal, danoTotal }

(function () {
  // Fórmulas centrais em assets/js/regras_base.js (carregar antes deste arquivo).
  const { mod, bonusProf, fmtMod } = window.Regras;

  function ehDistancia(arma) {
    return /dist[âa]ncia/i.test(arma?.categoria || '');
  }
  function temAcuidade(arma) {
    return /acuidade/i.test(arma?.propriedades || '');
  }

  function calcular(arma, atributos, nivel) {
    const atrs = atributos || {};
    const distancia = ehDistancia(arma);
    const finesse = temAcuidade(arma);
    let atrKey;
    if (distancia) atrKey = 'dex';
    else if (finesse) atrKey = mod(atrs.dex) > mod(atrs.for) ? 'dex' : 'for';
    else atrKey = 'for';

    const modAtr = mod(atrs[atrKey] ?? 10);
    const bp = bonusProf(nivel);           // proficiência assumida (ver nota acima)
    const bonusAtaque = modAtr + bp;
    const danoBonus = modAtr;              // dano soma só o mod do atributo, não a proficiência

    const dadoBase = String(arma?.dano || '').trim();
    const temDado = /^\d+d\d+/.test(dadoBase);
    const danoTexto = !dadoBase || dadoBase === '—'
      ? '—'
      : temDado
        ? dadoBase + (danoBonus ? fmtMod(danoBonus) : '')
        : dadoBase; // ex.: Zarabatana ("1") — dano fixo, não some com o mod

    return { atrKey, modAtr, bonusProf: bp, bonusAtaque, danoBonus, danoTexto, distancia, finesse };
  }

  // Rola de verdade (pro botão "🎲 Atacar" do Resumo) — 1d20 + bônus de ataque
  // (com vantagem/desvantagem opcional, ver Regras.rolarD20), e se acertar, o
  // dado de dano + bônus. Usa Math.random (mesmo padrão de rolarDadosVida em
  // aba_aliados.js — sem servidor de dados, é só pra mesa).
  function rolarDado(qtd, faces) {
    let total = 0;
    for (let i = 0; i < qtd; i++) total += 1 + Math.floor(Math.random() * faces);
    return total;
  }
  function rolar(arma, atributos, nivel, modo) {
    const calc = calcular(arma, atributos, nivel);
    const d20r = window.Regras.rolarD20(calc.bonusAtaque, modo);

    const m = String(arma?.dano || '').match(/^(\d+)d(\d+)/);
    let danoTotal = null, danoRolado = '—';
    if (m) {
      const base = rolarDado(+m[1], +m[2]);
      danoTotal = Math.max(1, base + calc.danoBonus);
      danoRolado = `${base}${calc.danoBonus ? fmtMod(calc.danoBonus) : ''} = ${danoTotal}`;
    }
    return {
      ataqueTexto: `d20${fmtMod(calc.bonusAtaque)} = ${d20r.total}`,
      ataqueTotal: d20r.total,
      danoTexto: danoRolado,
      danoTotal,
      critico: d20r.critico,
      falhaCritica: d20r.falhaCritica,
    };
  }

  window.Ataques = { calcular, rolar, ehDistancia, temAcuidade };
})();

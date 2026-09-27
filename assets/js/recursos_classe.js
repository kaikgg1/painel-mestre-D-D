// assets/js/recursos_classe.js
// Recursos de classe rastreáveis (trackers que escalam com nível/atributo) —
// fonte única usada tanto pela ficha do jogador (aba Combate) quanto pelo
// painel do Mestre, pra os dois mostrarem exatamente os mesmos recursos
// com o mesmo `max` calculado a partir de classe+nível+atributos.
//
// API:
//   RecursosClasse.recursosPara(personagem, atributos) -> [{id,nome,icone,max,periodo,dica,step?}, ...]
//   RecursosClasse.lerUsado(recursos_usados, id)        -> number (usados até agora)
//   RecursosClasse.gravarUsado(recursos_usados, id, n)  -> muta o objeto in-place, preservando formato
//   RecursosClasse.gravarRecursosUsados(characterId, patchLocal) -> Promise<void>
//     Grava patchLocal em characters.recursos_usados COM MERGE, direto no
//     banco (RPC mesclar_recurso_usado — sql/031), num único round-trip:
//     minhas chaves vencem, chaves que só existem no banco (outro cliente
//     adicionou) são preservadas. Ver comentário completo na implementação,
//     mais abaixo — e por que isto substituiu um "lê, mescla local, grava"
//     de 2 round-trips (ficava lento: "delay muito grande" ao marcar/
//     desmarcar um recurso).
(function () {
  const ico = (chave) => (window.Icones ? window.Icones.html(chave) : '');
  // Fórmula central em assets/js/regras_base.js (carregar antes deste arquivo).
  const mod = window.Regras.mod;
  const _max1 = v => Math.max(1, v);

  function chaveDeClasse(classe) {
    return (classe || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  const RECURSOS_POR_CLASSE = {
    barbaro: (nv) => [
      { id: 'furia', nome: 'Fúria', icone: ico('fogo'),
        max: nv >= 20 ? 99 : nv >= 17 ? 6 : nv >= 12 ? 5 : nv >= 6 ? 4 : nv >= 3 ? 3 : 2,
        periodo: 'descanso longo',
        dica: (nv >= 20 ? 'Ilimitada · ' : '') + 'Ação bônus · Dano de fúria: ' + (nv >= 16 ? '+4' : nv >= 9 ? '+3' : '+2') }
    ],
    bardo: (nv, a) => [
      { id: 'inspiracao_bardica', nome: 'Inspiração Bárdica', icone: ico('musica'),
        max: _max1(mod(a.car)),
        periodo: nv >= 5 ? 'descanso curto' : 'descanso longo',
        dica: 'Dado: ' + (nv >= 15 ? 'd12' : nv >= 10 ? 'd10' : nv >= 5 ? 'd8' : 'd6') + ' · Ação bônus' }
    ],
    bruxo: (nv) => {
      const r = [];
      const slotsPacto = nv >= 17 ? 4 : nv >= 11 ? 3 : nv >= 2 ? 2 : 1;
      const nivelSlot = nv >= 9 ? 5 : nv >= 7 ? 4 : nv >= 5 ? 3 : nv >= 3 ? 2 : 1;
      r.push({ id: 'magias_pacto', nome: 'Magias do Pacto', icone: ico('adivinhacao'),
        max: slotsPacto, periodo: 'descanso curto',
        dica: `Slots de nível ${nivelSlot}` });
      if (nv >= 11) r.push({ id: 'arcano_6', nome: 'Arcano Místico 6°', icone: '◆', max: 1, periodo: 'descanso longo' });
      if (nv >= 13) r.push({ id: 'arcano_7', nome: 'Arcano Místico 7°', icone: '◆', max: 1, periodo: 'descanso longo' });
      if (nv >= 15) r.push({ id: 'arcano_8', nome: 'Arcano Místico 8°', icone: '◆', max: 1, periodo: 'descanso longo' });
      if (nv >= 17) r.push({ id: 'arcano_9', nome: 'Arcano Místico 9°', icone: '◆', max: 1, periodo: 'descanso longo' });
      return r;
    },
    clerigo: (nv) => {
      if (nv < 2) return [];  // Canalizar Divindade começa no nível 2
      return [
        { id: 'canalizar_divindade', nome: 'Canalizar Divindade', icone: ico('brilho'),
          max: nv >= 18 ? 3 : nv >= 6 ? 2 : 1, periodo: 'descanso curto',
          dica: 'Expulsar Mortos-Vivos + opção do domínio' }
      ];
    },
    druida: (nv) => {
      if (nv < 2) return [];  // Forma Selvagem começa no nível 2
      return [
        { id: 'forma_selvagem', nome: 'Forma Selvagem', icone: ico('lobo'),
          max: nv >= 20 ? 99 : 2, periodo: 'descanso curto',
          dica: nv >= 20 ? 'Ilimitada (Arquidruida)' : `CR ${nv >= 8 ? '1' : nv >= 4 ? '1/2' : '1/4'}` }
      ];
    },
    feiticeiro: (nv) => {
      if (nv < 2) return [];  // Pontos de Feitiçaria começam no nível 2
      return [
        { id: 'pontos_feiticaria', nome: 'Pontos de Feitiçaria', icone: ico('brilho'),
          max: nv, periodo: 'descanso longo',
          dica: 'Converte ⇄ slots · Custos: slot 1°=2pt, 2°=3, 3°=5, 4°=6, 5°=7' }
      ];
    },
    guerreiro: (nv) => {
      const r = [
        { id: 'retomar_folego', nome: 'Retomar o Fôlego', icone: ico('folego'), max: 1, periodo: 'descanso curto',
          dica: `Cura 1d10 + ${nv} PV (ação bônus)` },
      ];
      if (nv >= 2) r.push({ id: 'surto_acao', nome: 'Surto de Ação', icone: ico('raio'),
        max: nv >= 17 ? 2 : 1, periodo: 'descanso curto', dica: 'Ação adicional no turno' });
      if (nv >= 9) r.push({ id: 'indomavel', nome: 'Indomável', icone: ico('escudo'),
        max: nv >= 17 ? 3 : nv >= 13 ? 2 : 1, periodo: 'descanso longo',
        dica: 'Re-rola teste de resistência falhado' });
      return r;
    },
    ladino: (nv) => [
      { id: 'golpe_sorte', nome: 'Golpe de Sorte', icone: ico('sorte'), max: 1, periodo: 'descanso curto',
        dica: 'Falha → sucesso (ou sucesso inimigo → falha)', visivel: nv >= 20 }
    ].filter(r => r.visivel !== false),
    mago: (nv) => [
      { id: 'recuperacao_arcana', nome: 'Recuperação Arcana', icone: ico('adivinhacao'),
        max: 1, periodo: 'descanso longo',
        dica: `Recupera slots: soma ≤ ${Math.ceil(nv / 2)}, nenhum acima do 5°` }
    ],
    monge: (nv) => {
      if (nv < 2) return [];
      return [
        { id: 'chi', nome: 'Pontos de Chi', icone: '☯', max: nv, periodo: 'descanso curto',
          dica: 'Rajada de Golpes (1) · Defesa Paciente (1) · Passo do Vento (1) · Golpe Atordoante (1)' }
      ];
    },
    paladino: (nv, a) => {
      const r = [
        { id: 'cura_maos', nome: 'Cura pelas Mãos', icone: ico('cura'), max: nv * 5, periodo: 'descanso longo',
          dica: 'Pool de PV · Distribua como quiser entre toques', step: 1 },
        { id: 'sentido_divino', nome: 'Sentido Divino', icone: ico('olho'),
          max: 1 + Math.max(0, mod(a.car)), periodo: 'descanso longo',
          dica: 'Detecta celestiais/mortos-vivos/corruptos em 18m' },
      ];
      if (nv >= 3) r.push({ id: 'canalizar_divindade', nome: 'Canalizar Divindade', icone: ico('brilho'),
        max: 1, periodo: 'descanso curto', dica: 'Opções do juramento · CD = CD das magias de paladino' });
      if (nv >= 14) r.push({ id: 'toque_purificador', nome: 'Toque Purificador', icone: ico('brilho'),
        max: _max1(mod(a.car)), periodo: 'descanso longo', dica: 'Termina 1 efeito mágico' });
      return r;
    },
    patrulheiro: (nv) => {
      // Patrulheiro PHB tem poucos slots rastreáveis fora dos slots de magia
      return [];
    },
  };

  // Metamágica do Feiticeiro (PHB Galápagos, cap. 3). custo = pontos de
  // feitiçaria; 'nivel' = custo igual ao nível da magia (Duplicada, mín. 1).
  const METAMAGIAS = [
    { id: 'acelerada', nome: 'Magia Acelerada', custo: 2,
      desc: 'Magia com tempo de conjuração de 1 ação passa a ser 1 ação bônus.' },
    { id: 'aumentada', nome: 'Magia Aumentada', custo: 3,
      desc: 'Um alvo tem desvantagem no primeiro teste de resistência contra a magia.' },
    { id: 'cuidadosa', nome: 'Magia Cuidadosa', custo: 1,
      desc: 'Até mod. de Carisma criaturas (mín. 1) passam automaticamente no teste de resistência da magia.' },
    { id: 'distante', nome: 'Magia Distante', custo: 1,
      desc: 'Dobra o alcance (1,5 m ou mais); magia de toque passa a ter 9 m.' },
    { id: 'duplicada', nome: 'Magia Duplicada', custo: 'nivel',
      desc: 'Magia de alvo único (não pessoal) ganha um segundo alvo. Custo = nível da magia (truque = 1).' },
    { id: 'estendida', nome: 'Magia Estendida', custo: 1,
      desc: 'Dobra a duração de magia de 1 minuto ou mais (máx. 24 horas).' },
    { id: 'potencializada', nome: 'Magia Potencializada', custo: 1,
      desc: 'Rola de novo até mod. de Carisma dados de dano (mín. 1). Combina com outra Metamágica.' },
    { id: 'sutil', nome: 'Magia Sutil', custo: 1,
      desc: 'Conjura sem componentes verbais nem somáticos.' },
  ];
  function metamagiasPermitidas(nv) { return nv >= 17 ? 4 : nv >= 10 ? 3 : nv >= 3 ? 2 : 0; }

  // Fonte de Magia (PHB): pontos → espaço (até o 5°) e espaço → pontos.
  // slots = {nivel:{max,atual}} com atual = GASTOS. Mutam slots/rec e
  // devolvem null no sucesso ou a mensagem do porquê não deu.
  // Espaço criado sem nenhum gasto pra recuperar vira max+1 e fica anotado
  // em rec.slots_extras — o livro diz que ele some no descanso longo
  // (limparSlotsExtras).
  const CUSTO_SLOT_DE_PONTOS = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 };
  function criarSlotComPontos(slots, rec, lvl, maxPontos) {
    const custo = CUSTO_SLOT_DE_PONTOS[lvl];
    if (!custo) return 'Só dá pra criar espaços até o 5° nível';
    const usados = lerUsado(rec, 'pontos_feiticaria');
    if (maxPontos - usados < custo) return `Precisa de ${custo} pontos de feitiçaria`;
    const s = slots[lvl] || (slots[lvl] = { max: 0, atual: 0 });
    if ((+s.atual || 0) > 0) {
      s.atual = +s.atual - 1;
    } else {
      s.max = (+s.max || 0) + 1;
      const ex = rec.slots_extras && typeof rec.slots_extras === 'object' ? rec.slots_extras : {};
      ex[lvl] = (+ex[lvl] || 0) + 1;
      rec.slots_extras = ex;
    }
    gravarUsado(rec, 'pontos_feiticaria', usados + custo);
    return null;
  }
  function quebrarSlotEmPontos(slots, rec, lvl) {
    const s = slots[lvl];
    if (!s || (+s.max || 0) - (+s.atual || 0) <= 0) return 'Sem espaço livre desse nível';
    const usados = lerUsado(rec, 'pontos_feiticaria');
    if (usados <= 0) return 'Pontos de feitiçaria já estão no máximo';
    s.atual = (+s.atual || 0) + 1;
    gravarUsado(rec, 'pontos_feiticaria', Math.max(0, usados - lvl));
    return null;
  }
  function limparSlotsExtras(slots, rec) {
    const ex = rec && rec.slots_extras;
    if (!ex || typeof ex !== 'object') return;
    for (const [lvl, n] of Object.entries(ex)) {
      const s = slots && slots[lvl];
      if (s) s.max = Math.max(0, (+s.max || 0) - (+n || 0));
    }
    rec.slots_extras = {};
  }

  // Soma characters.atributos_bonus (ajuste do Mestre, migration 032) por
  // cima do valor base — mesmo padrão do bônus de perícia/salvaguarda.
  // Compartilhado pela ficha do jogador E pelos painéis do Mestre (nenhum
  // dos dois deve calcular Pontos de Feitiçaria/CD/etc a partir só do valor
  // base se houver um ajuste do Mestre no atributo).
  function atributosEfetivos(c) {
    const base = c?.atributos || {};
    const bonus = c?.atributos_bonus || {};
    const chaves = new Set([...Object.keys(base), ...Object.keys(bonus)]);
    const out = {};
    chaves.forEach(k => { out[k] = (+base[k] || 10) + (+bonus[k] || 0); });
    return out;
  }

  // A aba Habilidades da ficha cria contadores a partir do texto do catálogo
  // (slug do nome: "canalizar_divindade_2_descanso", "surto_de_acao_1_uso"…).
  // Quando a habilidade é a mesma de um recurso deste catálogo, o contador
  // oficial é o do catálogo — os de texto duplicavam a linha no painel.
  const MAPA_HABILIDADE_RECURSO = [
    [/^canalizar_divindade(_\d+_descanso)?$/, 'canalizar_divindade'],
    [/^surto_de_acao(_\d+_usos?)?$/, 'surto_acao'],
    [/^indomavel(_\d+_usos?)?$/, 'indomavel'],
    [/^arcanos?_misticos?_(\d)_nivel$/, m => 'arcano_' + m[1]],
    [/^inspiracao_bardica(_d\d+)?$/, 'inspiracao_bardica'],
    [/^retomar_o_folego$/, 'retomar_folego'],
    [/^golpe_de_sorte$/, 'golpe_sorte'],
  ];
  function idCatalogoDeHabilidade(c, slug) {
    if (!c || !slug) return null;
    let id = slug;
    for (const [re, alvo] of MAPA_HABILIDADE_RECURSO) {
      const m = slug.match(re);
      if (m) { id = typeof alvo === 'function' ? alvo(m) : alvo; break; }
    }
    return recursosPara(c).some(r => r.id === id && r.max > 0) ? id : null;
  }
  function chaveCobertaPeloCatalogo(c, chave) {
    const id = idCatalogoDeHabilidade(c, chave);
    return !!id && id !== chave;
  }

  function recursosPara(c, atrs) {
    if (!c) return [];
    const chave = chaveDeClasse(c.classe);
    const fn = RECURSOS_POR_CLASSE[chave];
    if (!fn) return [];
    const nv = +c.nivel || 1;
    try { return fn(nv, atrs || atributosEfetivos(c)); }
    catch { return []; }
  }

  // Lê quantos usos já foram gastos, aceitando tanto o formato numérico simples
  // (usado por esses trackers) quanto o formato {max,atual} (usado pelas
  // features auto-detectadas na aba Habilidades) — mesma tabela, chaves diferentes.
  function lerUsado(rec, id) {
    const v = (rec || {})[id];
    if (typeof v === 'number') return v;
    if (v && typeof v.atual === 'number') return v.atual;
    return 0;
  }
  function gravarUsado(rec, id, novoUsado) {
    const v = rec[id];
    if (v && typeof v === 'object' && 'atual' in v) {
      rec[id] = { ...v, atual: novoUsado };
    } else {
      rec[id] = novoUsado;
    }
  }

  // recursos_usados é gravado como o objeto INTEIRO, de 3 lugares diferentes
  // que não conversam entre si (a ficha do jogador, o painel do Mestre —
  // painel_mestre_inline.js e painel_barovia_inline.js — cada um com sua
  // própria cópia em memória). Sem merge, quem gravasse por último apagava
  // qualquer chave que só existisse na cópia do OUTRO: era assim que os
  // "Recursos de Classe" da Lilith sumiam — bastava o Mestre marcar UM
  // recurso no painel dele (com uma cópia mais antiga, carregada antes da
  // jogadora ter usado várias habilidades) pra sobrescrever o campo inteiro
  // e apagar as outras 7 que só existiam no banco.
  //
  // A primeira versão disto fazia SELECT (lê o banco) + merge local +
  // UPDATE — 2 round-trips em série, por CLIQUE. Handling isso na hora que
  // dispara o UPDATE seria mais rápido, mas ainda deixaria uma janela entre
  // ler e escrever; a RPC abaixo faz o merge DENTRO do próprio UPDATE
  // (jsonb || jsonb, atômico no Postgres) — 1 round-trip, sem janela de
  // corrida nenhuma, mais rápido que a versão anterior E mais correto.
  async function gravarRecursosUsados(characterId, patchLocal) {
    if (!window.sb || !characterId) return;
    const { error } = await window.sb.rpc('mesclar_recurso_usado', {
      p_character_id: characterId, p_patch: patchLocal || {},
    });
    if (error) throw error;
  }

  window.RecursosClasse = {
    recursosPara, lerUsado, gravarUsado, gravarRecursosUsados, RECURSOS_POR_CLASSE, atributosEfetivos,
    METAMAGIAS, metamagiasPermitidas, CUSTO_SLOT_DE_PONTOS,
    criarSlotComPontos, quebrarSlotEmPontos, limparSlotsExtras,
    idCatalogoDeHabilidade, chaveCobertaPeloCatalogo,
  };
})();

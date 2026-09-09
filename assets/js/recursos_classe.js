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
(function () {
  const ico = (chave) => (window.Icones ? window.Icones.html(chave) : '');
  const mod = v => Math.floor(((+v || 10) - 10) / 2);
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
      if (nv >= 14) r.push({ id: 'toque_purificador', nome: 'Toque Purificador', icone: ico('brilho'),
        max: _max1(mod(a.car)), periodo: 'descanso longo', dica: 'Termina 1 efeito mágico' });
      return r;
    },
    patrulheiro: (nv) => {
      // Patrulheiro PHB tem poucos slots rastreáveis fora dos slots de magia
      return [];
    },
  };

  function recursosPara(c, atrs) {
    if (!c) return [];
    const chave = chaveDeClasse(c.classe);
    const fn = RECURSOS_POR_CLASSE[chave];
    if (!fn) return [];
    const nv = +c.nivel || 1;
    try { return fn(nv, atrs || c.atributos || {}); }
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

  window.RecursosClasse = { recursosPara, lerUsado, gravarUsado, RECURSOS_POR_CLASSE };
})();

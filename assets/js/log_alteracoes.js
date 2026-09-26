// assets/js/log_alteracoes.js
// Traduz linhas de public.character_changes (gravadas pelo trigger em
// sql/029_log_alteracoes_ficha.sql) pra texto e empurra no widget de
// assets/js/log_combate.js. É a ponte entre banco e tela — não desenha nada
// sozinho.
//
// Por que um trigger no banco em vez de cada tela chamar LogCombate.registrar
// como o painel do Mestre fazia antes (só pra PV/condição): characters é
// gravado por uns 10 arquivos diferentes (dbsync.js dos painéis, salvar.js/
// recursos.js/aba_habilidades.js/aba_aliados.js/nucleo.js da ficha) — cada
// um lembrando de logar por conta própria significa reimplementar a mesma
// lógica em todo save novo, pra sempre, e sempre dá pra esquecer um. Um
// trigger pega TODA gravação, não importa por onde veio, e usa auth.uid()
// de verdade — exatamente "identifique quando foi o Mestre ou o jogador
// pelo login dele".
//
// Duas entradas, chamadas uma vez cada, na inicialização da página:
//
//   LogAlteracoes.iniciarMestre(obterPersonagem)
//     Painéis do Mestre. Vê TODOS os personagens (RLS de character_changes
//     já resolve isso — mesma regra de characters: dono ou Mestre).
//     obterPersonagem(id) → {nome, jogador} | null — os painéis já mantêm
//     isso em estado.personagens; quando não acha (PJ fora da campanha
//     ativa), busca no banco e guarda em cache local.
//
//   LogAlteracoes.iniciarJogador(userId)
//     Ficha do jogador. Só os PJs dele. O filtro do Realtime é por
//     user_id (não character_id) de propósito: user_id é o MESMO em toda
//     linha de qualquer personagem seu, então uma assinatura só cobre
//     trocar de personagem sem precisar reconectar o canal — mesmo padrão
//     de escutarMudancasExternas() em assets/js/ficha/nucleo.js.
//
// Ambas devolvem uma função unsubscribe(); nenhuma delas monta o FAB (isso
// é log_combate.js, chamado indiretamente via LogCombate.registrar).
window.LogAlteracoes = (function () {
  const CARGA_INICIAL = 20;

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // row: {por_mestre, rotulo, valor_antes, valor_depois, ...}
  // opts.nomePersonagem: só no contexto do Mestre (várias fichas na tela).
  // opts.nomeJogador: nome de exibição de quem editou, quando NÃO foi o Mestre.
  // opts.comoJogador: true quando é a PRÓPRIA ficha do jogador vendo o log —
  //   troca "<nome> alterou" por "Você alterou" (mais direto que repetir o
  //   próprio nome de volta pra quem está lendo).
  function formatarLinha(row, opts = {}) {
    const ator = row.por_mestre
      ? '👑 Mestre'
      : '👤 ' + escapeHtml(opts.comoJogador ? 'Você' : (opts.nomeJogador || 'Jogador'));
    const temValor = row.valor_antes !== null || row.valor_depois !== null;
    const mudanca = temValor
      ? `<strong>${escapeHtml(row.rotulo)}</strong>: ${escapeHtml(row.valor_antes ?? '—')} → ${escapeHtml(row.valor_depois ?? '—')}`
      : `<strong>${escapeHtml(row.rotulo)}</strong> alterado`;
    return opts.nomePersonagem
      ? `${ator} alterou <em>${escapeHtml(opts.nomePersonagem)}</em>: ${mudanca}`
      : `${ator} alterou: ${mudanca}`;
  }

  function iniciarMestre(obterPersonagem) {
    if (!window.sb || !window.LogCombate) return () => {};
    const cacheRemoto = new Map();   // id → {nome} | null, pra PJ que não está no estado local (inativo)

    async function resolverNome(characterId) {
      const local = typeof obterPersonagem === 'function' ? obterPersonagem(characterId) : null;
      if (local?.nome) return local.nome;
      if (cacheRemoto.has(characterId)) return cacheRemoto.get(characterId);
      const { data } = await window.sb.from('characters').select('nome').eq('id', characterId).maybeSingle();
      const nome = data?.nome || null;
      cacheRemoto.set(characterId, nome);
      return nome;
    }

    (async () => {
      const { data, error } = await window.sb.from('character_changes')
        .select('*').order('criado_em', { ascending: false }).limit(CARGA_INICIAL);
      if (error) { console.warn('[LogAlteracoes] carga inicial (Mestre):', error.message); return; }
      for (const row of (data || []).slice().reverse()) {
        const nomePersonagem = await resolverNome(row.character_id);
        window.LogCombate.registrar(formatarLinha(row, { nomePersonagem }), row.criado_em, false);
      }
    })();

    const canal = window.sb.channel('log-alteracoes-mestre')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'character_changes' },
        async payload => {
          const row = payload.new;
          const nomePersonagem = await resolverNome(row.character_id);
          window.LogCombate.registrar(formatarLinha(row, { nomePersonagem }), row.criado_em, true);
        })
      .subscribe();

    return () => { try { canal.unsubscribe(); } catch {} };
  }

  function iniciarJogador(userId) {
    if (!window.sb || !window.LogCombate || !userId) return () => {};

    (async () => {
      const { data, error } = await window.sb.from('character_changes')
        .select('*').eq('user_id', userId).order('criado_em', { ascending: false }).limit(CARGA_INICIAL);
      if (error) { console.warn('[LogAlteracoes] carga inicial (jogador):', error.message); return; }
      for (const row of (data || []).slice().reverse())
        window.LogCombate.registrar(formatarLinha(row, { comoJogador: true }), row.criado_em, false);
    })();

    const canal = window.sb.channel('log-alteracoes-jogador-' + userId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'character_changes', filter: `user_id=eq.${userId}` },
        payload => window.LogCombate.registrar(formatarLinha(payload.new, { comoJogador: true }), payload.new.criado_em, true))
      .subscribe();

    return () => { try { canal.unsubscribe(); } catch {} };
  }

  return { iniciarMestre, iniciarJogador };
})();

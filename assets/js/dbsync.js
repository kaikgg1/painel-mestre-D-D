// assets/js/dbsync.js
// Sincronização dos cards de personagem com o banco (Supabase) + Realtime.
// Depende de: window.sb, window.Auth.
//
// API:
//   await DBSync.init({ campanha, onChange })
//     - campanha: string (ex: 'mestre' | 'barovia')
//     - onChange({tipo:'load'|'insert'|'update'|'delete', char?, id?})
//   DBSync.listar()                              → array de characters
//   await DBSync.criar({nome, ...})              → character novo
//   DBSync.salvarCampo(id, campos)               → debounced UPDATE
//   await DBSync.deletar(id)                     → DELETE
//   DBSync.desconectar()                         → unsubscribe realtime
//
// Mapeamento UI → DB:
//   jogador         → ignorado (use profiles)
//   nome            → nome
//   raca            → raca
//   classe          → classe
//   nivel           → nivel
//   hpAtual         → hp_atual
//   hpMax           → hp_max
//   ca              → ca
//   inspiracao      → inspiracao
//   exaustao        → exaustao
//   sucessos        → morte_sucessos
//   falhas          → morte_falhas
//   slots           → slots_magia  (jsonb)
//   magias          → magias_preparadas
//   condicoes       → condicoes (text[])

(function () {
  const DEBOUNCE_MS = 400;

  let cache = new Map();        // id → row
  let listeners = null;         // canal realtime
  let onChangeCb = null;
  let campanhaAtual = null;
  let usuarioAtual = null;
  let ehMestre = false;
  let apenasAtivos = false;     // se true, só carrega/exibe is_active=true
  const pendingUpdates = new Map();  // id → {campos: {...}, timer}

  // ─── Mapeamento UI ↔ DB ───────────────────────────────────────────
  const UI_TO_DB = {
    jogador: null,  // não vai pro banco (usa nome do profile)
    nome: 'nome',
    raca: 'raca',
    classe: 'classe',
    nivel: 'nivel',
    hpAtual: 'hp_atual',
    hpMax: 'hp_max',
    ca: 'ca',
    inspiracao: 'inspiracao',
    exaustao: 'exaustao',
    sucessos: 'morte_sucessos',
    falhas: 'morte_falhas',
    slots: 'slots_magia',
    magias: 'magias_preparadas',
    condicoes: 'condicoes',
    isActive: 'is_active',
  };

  function uiToDb(uiObj) {
    const out = {};
    for (const k of Object.keys(uiObj)) {
      const col = UI_TO_DB[k];
      if (col) out[col] = uiObj[k];
    }
    return out;
  }

  function dbToUi(row) {
    return {
      id: row.id,
      user_id: row.user_id,
      jogador: row._jogador_nome || '',
      nome: row.nome || '',
      raca: row.raca || '',
      classe: row.classe || '',
      nivel: row.nivel ?? 1,
      hpAtual: row.hp_atual ?? 0,
      hpMax: row.hp_max ?? 0,
      ca: row.ca ?? 10,
      inspiracao: !!row.inspiracao,
      exaustao: row.exaustao ?? 0,
      sucessos: row.morte_sucessos ?? 0,
      falhas: row.morte_falhas ?? 0,
      slots: row.slots_magia || {},
      magias: row.magias_preparadas || '',
      condicoes: row.condicoes || [],
      isActive: !!row.is_active,
    };
  }

  // ─── Init ─────────────────────────────────────────────────────────
  // opts: { campanha?, onChange, apenasAtivos? }
  async function init(opts) {
    onChangeCb = opts.onChange || (() => {});
    campanhaAtual = opts.campanha || null;
    apenasAtivos = !!opts.apenasAtivos;
    usuarioAtual = await window.Auth.getUser();
    if (!usuarioAtual) throw new Error('Usuário não autenticado');
    ehMestre = await window.Auth.ehMestre();

    await carregar();
    iniciarRealtime();
    setupRefetchOnFocus();
    return { ehMestre, usuario: usuarioAtual };
  }

  async function carregar() {
    // RLS já filtra por user_id (ou tudo se mestre)
    let q = window.sb.from('characters').select('*');
    if (campanhaAtual) q = q.eq('campanha', campanhaAtual);
    // Filtro de ativos: mostra is_active=true OR os próprios do usuário
    // (assim o Mestre vê ativos dos jogadores + seus próprios NPCs)
    if (apenasAtivos) {
      q = q.or(`is_active.eq.true,user_id.eq.${usuarioAtual.id}`);
    }
    q = q.order('created_at', { ascending: true });

    const { data, error } = await q;
    if (error) { console.error('[dbsync] carregar:', error); return; }

    // Busca nomes dos donos (profiles) para "jogador"
    const userIds = [...new Set(data.map(c => c.user_id))];
    let nomes = new Map();
    if (userIds.length) {
      const { data: profs } = await window.sb.from('profiles').select('id, nome').in('id', userIds);
      nomes = new Map((profs || []).map(p => [p.id, p.nome]));
    }

    cache.clear();
    for (const row of data) {
      row._jogador_nome = nomes.get(row.user_id) || '';
      cache.set(row.id, row);
    }
    onChangeCb({ tipo: 'load' });
  }

  // Refetch quando o user volta pra aba (corrige se realtime tiver perdido evento)
  function setupRefetchOnFocus() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') carregar();
    });
    window.addEventListener('online', () => carregar());
  }

  // ─── Realtime ────────────────────────────────────────────────────
  function iniciarRealtime() {
    if (listeners) listeners.unsubscribe();
    const filtro = campanhaAtual ? { event: '*', schema: 'public', table: 'characters', filter: `campanha=eq.${campanhaAtual}` }
                                 : { event: '*', schema: 'public', table: 'characters' };
    listeners = window.sb.channel('chars-' + (campanhaAtual || 'all'))
      .on('postgres_changes', filtro, payload => handleRealtime(payload))
      .subscribe();
  }

  // Critério "visível": is_active OR é meu (mesmo lógica de carregar)
  function ehVisivel(row) {
    if (!apenasAtivos) return true;
    return row.is_active || row.user_id === usuarioAtual.id;
  }

  async function handleRealtime(payload) {
    const { eventType, new: novo, old } = payload;
    if (eventType === 'INSERT') {
      if (!ehVisivel(novo)) return;
      const { data: prof } = await window.sb.from('profiles').select('nome').eq('id', novo.user_id).maybeSingle();
      novo._jogador_nome = prof?.nome || '';
      cache.set(novo.id, novo);
      onChangeCb({ tipo: 'insert', char: dbToUi(novo) });
    } else if (eventType === 'UPDATE') {
      const antigo = cache.get(novo.id);
      const visAgora = ehVisivel(novo);
      // Transições de visibilidade
      if (antigo && !visAgora) {
        cache.delete(novo.id);
        onChangeCb({ tipo: 'delete', id: novo.id });
        return;
      }
      if (!antigo && visAgora) {
        const { data: prof } = await window.sb.from('profiles').select('nome').eq('id', novo.user_id).maybeSingle();
        novo._jogador_nome = prof?.nome || '';
        cache.set(novo.id, novo);
        onChangeCb({ tipo: 'insert', char: dbToUi(novo) });
        return;
      }
      if (!visAgora) return;  // continua invisível
      // Update normal (ambos visíveis)
      novo._jogador_nome = antigo?._jogador_nome || '';
      cache.set(novo.id, novo);
      onChangeCb({ tipo: 'update', char: dbToUi(novo) });
    } else if (eventType === 'DELETE') {
      cache.delete(old.id);
      onChangeCb({ tipo: 'delete', id: old.id });
    }
  }

  // ─── Listar / Criar / Atualizar / Deletar ────────────────────────
  function listar() {
    return [...cache.values()].map(dbToUi);
  }

  async function criar(uiPayload) {
    const dbPayload = uiToDb(uiPayload);
    dbPayload.user_id = usuarioAtual.id;
    if (campanhaAtual) dbPayload.campanha = campanhaAtual;
    if (!dbPayload.nome) dbPayload.nome = 'Novo Personagem';

    const { data, error } = await window.sb
      .from('characters').insert(dbPayload).select('*').single();
    if (error) { console.error('[dbsync] criar:', error); throw error; }

    const { data: prof } = await window.sb.from('profiles').select('nome').eq('id', data.user_id).maybeSingle();
    data._jogador_nome = prof?.nome || '';
    cache.set(data.id, data);
    return dbToUi(data);
  }

  function salvarCampo(id, uiCampos) {
    const dbCampos = uiToDb(uiCampos);
    if (!Object.keys(dbCampos).length) return;

    let p = pendingUpdates.get(id);
    if (!p) { p = { campos: {}, timer: null }; pendingUpdates.set(id, p); }
    Object.assign(p.campos, dbCampos);

    if (p.timer) clearTimeout(p.timer);
    p.timer = setTimeout(async () => {
      const campos = p.campos; pendingUpdates.delete(id);
      const { data, error } = await window.sb
        .from('characters').update(campos).eq('id', id).select('*').maybeSingle();
      if (error) console.warn('[dbsync] salvarCampo:', error);
      else if (data) {
        const antigo = cache.get(id);
        data._jogador_nome = antigo?._jogador_nome || '';
        cache.set(id, data);
      }
    }, DEBOUNCE_MS);
  }

  async function deletar(id) {
    const { error } = await window.sb.from('characters').delete().eq('id', id);
    if (error) { console.error('[dbsync] deletar:', error); throw error; }
    cache.delete(id);
  }

  function desconectar() {
    if (listeners) listeners.unsubscribe();
    listeners = null;
  }

  // Marca um PJ como ativo (o trigger no banco desativa os outros do mesmo user)
  async function setAtivo(id, ativo = true) {
    const { error } = await window.sb
      .from('characters').update({ is_active: !!ativo }).eq('id', id);
    if (error) throw error;
  }

  window.DBSync = { init, listar, criar, salvarCampo, deletar, desconectar, setAtivo };
})();

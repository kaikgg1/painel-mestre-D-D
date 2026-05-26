// assets/js/master_state.js
// Sync de estado livre do Mestre (vilões, trackers, etc.) via Supabase.
// Faz fallback graceful para localStorage se não houver login (ou erro de rede).
//
// API:
//   await MasterState.carregar(chave) → dados (objeto) ou null
//   await MasterState.salvar(chave, dados) → bool
//   MasterState.iniciarRealtime(chave, callback) → unsubscribe()
//   MasterState.salvarDebounced(chave, dados, ms=600)
//
// Dependências: window.sb, window.Auth.

(function () {
  const FALLBACK_PREFIX = 'master_state:';
  const debounceTimers = new Map();

  function localGet(chave) {
    try { return JSON.parse(localStorage.getItem(FALLBACK_PREFIX + chave) || 'null'); }
    catch { return null; }
  }
  function localSet(chave, dados) {
    try { localStorage.setItem(FALLBACK_PREFIX + chave, JSON.stringify(dados)); } catch {}
  }

  async function carregar(chave) {
    if (!window.sb || !window.Auth) return localGet(chave);
    const user = await window.Auth.getUser();
    if (!user) return localGet(chave);

    const { data, error } = await window.sb
      .from('master_state')
      .select('dados')
      .eq('user_id', user.id)
      .eq('chave', chave)
      .maybeSingle();

    if (error) {
      console.warn('[MasterState] carregar:', error.message);
      return localGet(chave);
    }
    // Mantém local atualizado como fallback
    if (data?.dados) localSet(chave, data.dados);
    return data?.dados || localGet(chave);
  }

  async function salvar(chave, dados) {
    localSet(chave, dados);  // sempre salva local primeiro
    if (!window.sb || !window.Auth) return false;
    const user = await window.Auth.getUser();
    if (!user) return false;

    const { error } = await window.sb
      .from('master_state')
      .upsert({ user_id: user.id, chave, dados }, { onConflict: 'user_id,chave' });

    if (error) { console.warn('[MasterState] salvar:', error.message); return false; }
    return true;
  }

  function salvarDebounced(chave, dados, ms = 600) {
    if (debounceTimers.has(chave)) clearTimeout(debounceTimers.get(chave));
    debounceTimers.set(chave, setTimeout(() => {
      salvar(chave, dados);
      debounceTimers.delete(chave);
    }, ms));
  }

  function iniciarRealtime(chave, callback) {
    if (!window.sb || !window.Auth) return () => {};
    let canal = null;
    (async () => {
      const user = await window.Auth.getUser();
      if (!user) return;
      canal = window.sb.channel('ms-' + chave)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'master_state',
          filter: `user_id=eq.${user.id}`
        }, payload => {
          if (payload.new?.chave === chave) callback(payload.new.dados);
        })
        .subscribe();
    })();
    return () => { if (canal) canal.unsubscribe(); };
  }

  window.MasterState = { carregar, salvar, salvarDebounced, iniciarRealtime };
})();

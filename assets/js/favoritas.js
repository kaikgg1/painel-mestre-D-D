// assets/js/favoritas.js
// Favoritas de magia — 100% Supabase. Sem fallback localStorage.
// Cada usuário tem uma lista "Favoritas" vinculada ao seu personagem mais antigo.
// Realtime: o cache é atualizado se outra aba/dispositivo alterar.
//
// API:
//   await Fav.carregar()          → Set<string> com nomes das magias favoritas
//   await Fav.alternar(nome)      → bool: novo estado
//   Fav.tem(nome)                 → bool (síncrono, cache)
//   Fav.tamanho()                 → int (síncrono, cache)
//
// Depende de: window.sb (Supabase) e window.Auth (login obrigatório).

(function () {
  const LISTA_NOME = 'Favoritas';

  let cache = new Set();
  let personagemId = null;
  let listaId = null;
  let usuarioId = null;
  let channel = null;

  // Cria personagem "default" se o user não tiver nenhum
  async function garantirPersonagem(userId) {
    const { data: chars } = await window.sb
      .from('characters')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1);
    if (chars && chars.length) return chars[0].id;

    const { data: novo, error } = await window.sb
      .from('characters')
      .insert({ user_id: userId, nome: 'Personagem Padrão' })
      .select('id')
      .single();
    if (error) { console.error('[Fav] criar personagem:', error); return null; }
    return novo.id;
  }

  // Cria a lista "Favoritas" se não existir
  async function garantirLista(charId, userId) {
    const { data: existente } = await window.sb
      .from('spell_lists')
      .select('id, spell_names')
      .eq('character_id', charId)
      .eq('nome', LISTA_NOME)
      .maybeSingle();
    if (existente) return existente;

    const { data: nova, error } = await window.sb
      .from('spell_lists')
      .insert({ character_id: charId, user_id: userId, nome: LISTA_NOME, spell_names: [] })
      .select('id, spell_names')
      .single();
    if (error) { console.error('[Fav] criar lista:', error); return null; }
    return nova;
  }

  // Inicializa: requer usuário logado
  async function carregar() {
    if (!window.sb || !window.Auth) return new Set();
    const user = await window.Auth.getUser();
    if (!user) return new Set();  // sem login = sem favoritas
    usuarioId = user.id;

    personagemId = await garantirPersonagem(user.id);
    if (!personagemId) return new Set();

    const lista = await garantirLista(personagemId, user.id);
    listaId = lista?.id || null;
    cache = new Set(lista?.spell_names || []);

    // Realtime: ouve mudanças nesta lista específica
    iniciarRealtime();
    return cache;
  }

  function iniciarRealtime() {
    if (channel) channel.unsubscribe();
    if (!listaId) return;
    channel = window.sb.channel('fav-' + listaId)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'spell_lists', filter: `id=eq.${listaId}` },
        payload => {
          cache = new Set(payload.new.spell_names || []);
          // dispara evento custom para o front re-renderizar contadores etc.
          window.dispatchEvent(new CustomEvent('fav:atualizadas', { detail: { tamanho: cache.size }}));
        })
      .subscribe();
  }

  async function alternar(nome) {
    if (!listaId) await carregar();
    if (!listaId) return false;

    const tinha = cache.has(nome);
    if (tinha) cache.delete(nome); else cache.add(nome);

    const { error } = await window.sb
      .from('spell_lists')
      .update({ spell_names: [...cache] })
      .eq('id', listaId);
    if (error) {
      console.warn('[Fav] erro ao salvar — desfazendo:', error.message);
      if (tinha) cache.add(nome); else cache.delete(nome);
      return tinha;
    }
    return !tinha;
  }

  function tem(nome) { return cache.has(nome); }
  function tamanho() { return cache.size; }

  window.Fav = { carregar, alternar, tem, tamanho };
})();

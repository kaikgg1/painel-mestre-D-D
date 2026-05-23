// assets/js/favoritas.js
// Wrapper de favoritas: tenta usar Supabase (se logado); fallback para localStorage.
// Mantém compatibilidade com o código antigo do grimório.
//
// API:
//   await Fav.carregar()             → Set<string> com nomes das magias favoritas
//   await Fav.alternar(nome)         → bool: novo estado
//   Fav.tem(nome)                    → bool (síncrono, usa cache)
//   Fav.tamanho()                    → int (síncrono, usa cache)
//   await Fav.sincronizarLocal()     → joga favoritas do localStorage pro banco
//
// Depende de: window.sb (Supabase) e window.Auth.

(function () {
  const LS_KEY = 'grimorio-favoritas-v1';
  const LISTA_NOME = 'Favoritas';

  let cache = new Set();
  let personagemId = null;
  let modo = 'local';   // 'local' | 'banco'

  // ─── localStorage helpers ─────────────────────────────────────────
  function lerLocal() {
    try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]')); }
    catch { return new Set(); }
  }
  function salvarLocal(set) {
    try { localStorage.setItem(LS_KEY, JSON.stringify([...set])); } catch {}
  }

  // ─── Banco: garante "personagem padrão" e lista "Favoritas" ──────
  async function garantirPersonagemPadrao(user) {
    // Pega o personagem mais antigo do usuário, ou cria um "Personagem Padrão"
    let { data: chars } = await window.sb
      .from('characters')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1);

    if (chars && chars.length) return chars[0].id;

    const { data: novo, error } = await window.sb
      .from('characters')
      .insert({ user_id: user.id, nome: 'Personagem Padrão' })
      .select('id')
      .single();
    if (error) { console.warn('[Fav] falha ao criar personagem padrão:', error); return null; }
    return novo.id;
  }

  async function garantirListaFavoritas(charId, userId) {
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
    if (error) { console.warn('[Fav] falha ao criar lista de favoritas:', error); return null; }
    return nova;
  }

  // ─── Carregar (decide modo) ───────────────────────────────────────
  async function carregar() {
    const user = window.Auth ? await window.Auth.getUser() : null;

    if (!user || !window.sb) {
      modo = 'local';
      cache = lerLocal();
      return cache;
    }

    modo = 'banco';
    personagemId = await garantirPersonagemPadrao(user);
    if (!personagemId) {
      // fallback se algo deu errado
      cache = lerLocal();
      return cache;
    }
    const lista = await garantirListaFavoritas(personagemId, user.id);
    cache = new Set(lista?.spell_names || []);

    // primeira vez logando? sincroniza favoritas locais
    const locais = lerLocal();
    if (locais.size && cache.size === 0) {
      await sincronizarLocal(locais);
      cache = new Set([...locais]);
    }
    return cache;
  }

  // ─── Alternar ─────────────────────────────────────────────────────
  async function alternar(nome) {
    const tinha = cache.has(nome);
    if (tinha) cache.delete(nome);
    else cache.add(nome);

    if (modo === 'local') {
      salvarLocal(cache);
    } else if (modo === 'banco' && personagemId) {
      const user = await window.Auth.getUser();
      const { error } = await window.sb
        .from('spell_lists')
        .update({ spell_names: [...cache] })
        .eq('character_id', personagemId)
        .eq('nome', LISTA_NOME)
        .eq('user_id', user.id);
      if (error) {
        console.warn('[Fav] erro ao salvar no banco — desfazendo:', error);
        if (tinha) cache.add(nome); else cache.delete(nome);
        return tinha;
      }
    }
    return !tinha;
  }

  // ─── Sincronização inicial ────────────────────────────────────────
  async function sincronizarLocal(locais) {
    if (!personagemId || !locais.size) return;
    const user = await window.Auth.getUser();
    await window.sb
      .from('spell_lists')
      .update({ spell_names: [...locais] })
      .eq('character_id', personagemId)
      .eq('nome', LISTA_NOME)
      .eq('user_id', user.id);
  }

  // ─── Síncronos (usam cache) ───────────────────────────────────────
  function tem(nome)    { return cache.has(nome); }
  function tamanho()    { return cache.size; }
  function modoAtual()  { return modo; }

  window.Fav = { carregar, alternar, tem, tamanho, modoAtual, sincronizarLocal };
})();

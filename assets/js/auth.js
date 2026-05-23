// assets/js/auth.js
// Helpers de autenticação. Depende de window.sb (assets/js/supabase.js).
//
// API:
//   await Auth.getUser()                  → user ou null
//   await Auth.getProfile()               → {id, nome} ou null
//   await Auth.entrarPorNome(nome)        → {ok:true, user} | {ok:false, erro}
//   await Auth.sair()                     → void
//   Auth.requerLogin('login.html')        → redirect se não logado
//   Auth.renderHeader('#auth-slot')       → insere "Olá, Sabrina123 [Sair]" ou "[Entrar]"

(function () {
  const SENHA_PADRAO = 'mesa-dnd-5e';   // mesma do seed (003_seed_jogadores.sql)
  const DOMINIO     = '@mesa.local';

  const JOGADORES = [
    { nome: 'Sabrina123', email: 'sabrina123' + DOMINIO },
    { nome: 'Derik123',   email: 'derik123'   + DOMINIO },
    { nome: 'Felipe123',  email: 'felipe123'  + DOMINIO },
  ];

  function emailDoNome(nome) {
    return (nome || '').trim().toLowerCase() + DOMINIO;
  }

  async function getUser() {
    if (!window.sb) return null;
    const { data } = await window.sb.auth.getUser();
    return data?.user || null;
  }

  async function getProfile() {
    const u = await getUser();
    if (!u) return null;
    const { data } = await window.sb.from('profiles').select('id, nome').eq('id', u.id).maybeSingle();
    return data || { id: u.id, nome: u.user_metadata?.nome || u.email };
  }

  async function entrarPorNome(nome) {
    const email = emailDoNome(nome);
    const { data, error } = await window.sb.auth.signInWithPassword({ email, password: SENHA_PADRAO });
    if (error) return { ok: false, erro: error.message };
    return { ok: true, user: data.user };
  }

  async function sair() {
    if (!window.sb) return;
    await window.sb.auth.signOut();
  }

  function requerLogin(loginPath) {
    // chama síncrono: faz redirect se em ~300ms não houver sessão
    setTimeout(async () => {
      const u = await getUser();
      if (!u) window.location.href = loginPath || 'login.html';
    }, 50);
  }

  async function renderHeader(selector) {
    const slot = document.querySelector(selector);
    if (!slot) return;
    const profile = await getProfile();
    const ehPainel = location.pathname.includes('/paineis/');
    const loginUrl = ehPainel ? 'login.html' : 'paineis/login.html';

    if (profile) {
      slot.innerHTML = `
        <span class="auth-nome" aria-label="Logado como ${profile.nome}">👤 ${profile.nome}</span>
        <button type="button" class="auth-btn" id="auth-sair-btn">Sair</button>`;
      document.getElementById('auth-sair-btn').addEventListener('click', async () => {
        await sair();
        location.reload();
      });
    } else {
      slot.innerHTML = `<a href="${loginUrl}" class="auth-btn">Entrar</a>`;
    }
  }

  window.Auth = { getUser, getProfile, entrarPorNome, sair, requerLogin, renderHeader, JOGADORES };
})();

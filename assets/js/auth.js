// assets/js/auth.js
// Helpers de autenticação. Depende de window.sb (assets/js/supabase.js).
//
// API:
//   await Auth.getUser()                  → user ou null
//   await Auth.getProfile()               → {id, nome} ou null
//   await Auth.entrarPorNome(nome)        → {ok:true, user} | {ok:false, erro}
//   await Auth.sair()                     → void
//   Auth.requerLogin('login.html')        → redirect se não logado
//   Auth.renderHeader('#auth-slot')       → insere "[ícone] Sabrina [Sair]" ou "[Entrar]"

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

  async function ehMestre() {
    const u = await getUser();
    return !!(u && u.email === 'mestre123@mesa.local');
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

  // requerLogin(): redireciona pro login se NÃO autenticado.
  // Usar SEMPRE no início do <script> da página protegida.
  // Retorna uma Promise<user|null> — null se redirecionou.
  async function requerLogin(loginPath) {
    const u = await getUser();
    if (u) return u;
    const from = encodeURIComponent(location.pathname + location.search);
    const url = (loginPath || 'login.html') + '?from=' + from;
    location.replace(url);
    return null;
  }

  async function renderHeader(selector) {
    const slot = document.querySelector(selector);
    if (!slot) return;
    const profile = await getProfile();
    const ehPainel = location.pathname.includes('/paineis/');
    const loginUrl = ehPainel ? 'login.html' : 'paineis/login.html';

    if (profile) {
      const mestre = await ehMestre();
      // Ícone vetorial (assets/js/icones.js); some se a página não carregou o módulo.
      const icon = window.Icones ? window.Icones.html(mestre ? 'mestre' : 'jogador') : '';
      const tag  = mestre ? ' <span style="color:var(--gold-bright);font-size:9px;letter-spacing:1.5px">MESTRE</span>' : '';
      slot.innerHTML = `
        <span class="auth-nome" aria-label="Logado como ${profile.nome}">${icon} ${profile.nome}${tag}</span>
        <button type="button" class="auth-btn" id="auth-sair-btn">Sair</button>`;
      document.getElementById('auth-sair-btn').addEventListener('click', async () => {
        await sair();
        location.reload();
      });
    } else {
      slot.innerHTML = `<a href="${loginUrl}" class="auth-btn">Entrar</a>`;
    }
  }

  window.Auth = { getUser, getProfile, ehMestre, entrarPorNome, sair, requerLogin, renderHeader, JOGADORES };
})();

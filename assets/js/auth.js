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
    { nome: 'Sabrina123',   email: 'sabrina123'   + DOMINIO },
    { nome: 'Derik123',     email: 'derik123'     + DOMINIO },
    { nome: 'Felipe123',    email: 'felipe123'    + DOMINIO },
    { nome: 'Guilherme123', email: 'guilherme123' + DOMINIO },
  ];

  function emailDoNome(nome) {
    return (nome || '').trim().toLowerCase() + DOMINIO;
  }

  // Prazo máximo pra qualquer chamada de auth. Sem ele, servidor fora do ar
  // (ex.: projeto Supabase pausado) deixava a página em branco pra sempre —
  // o SDK fica tentando renovar o token em silêncio e a Promise nunca volta.
  const PRAZO_MS = 8000;
  let _servidorFora = false;

  function comPrazo(promessa) {
    return Promise.race([
      promessa,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), PRAZO_MS)),
    ]);
  }

  function ehErroDeRede(err) {
    if (!err) return false;
    return err.name === 'AuthRetryableFetchError' || err.status === 0
      || /fetch|network|timeout|failed to/i.test(err.message || '');
  }

  // Cache por página: getProfile/ehMestre/renderHeader chamam getUser em
  // sequência, e com o servidor lento cada um esperaria o prazo de novo.
  let _userPromise = null;
  function getUser() {
    if (!window.sb) return Promise.resolve(null);
    if (!_userPromise) {
      _userPromise = comPrazo(window.sb.auth.getUser())
        .then(({ data, error }) => {
          if (ehErroDeRede(error)) _servidorFora = true;
          return data?.user || null;
        })
        .catch(() => { _servidorFora = true; return null; });
    }
    return _userPromise;
  }

  function mostrarAvisoServidor() {
    if (document.getElementById('aviso-servidor')) return;
    const box = document.createElement('div');
    box.id = 'aviso-servidor';
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.72)';
    box.innerHTML = `
      <div style="max-width:420px;text-align:center;padding:28px 24px;border:1px solid var(--gold,#b8913a);border-radius:10px;background:var(--bg-card,#16130e);color:var(--text,#e8dcc4);font-family:var(--font-body,Georgia,serif)">
        <div style="font-family:'Cinzel',serif;color:var(--gold-bright,#d4a84b);font-size:18px;letter-spacing:1.5px;margin-bottom:10px">Servidor indisponível</div>
        <p style="margin:0 0 18px;line-height:1.5">Não foi possível conectar ao banco de dados da mesa. Verifique a internet ou tente de novo em instantes.</p>
        <button type="button" class="auth-btn" style="cursor:pointer">Tentar de novo</button>
      </div>`;
    box.querySelector('button').addEventListener('click', () => location.reload());
    (document.body || document.documentElement).appendChild(box);
  }

  async function getProfile() {
    const u = await getUser();
    if (!u) return null;
    let data = null;
    try { ({ data } = await comPrazo(window.sb.from('profiles').select('id, nome').eq('id', u.id).maybeSingle())); } catch {}
    return data || { id: u.id, nome: u.user_metadata?.nome || u.email };
  }

  async function ehMestre() {
    const u = await getUser();
    return !!(u && u.email === 'mestre123@mesa.local');
  }

  // senha: opcional. Os 4 jogadores usam a senha compartilhada padrão (login
  // por nome, sem digitar nada — conveniência combinada para uma mesa privada
  // de amigos). O Mestre é diferente: tem acesso a tudo (fichas, segredos de
  // campanha), então login.html pede uma senha REAL, digitada, e passa ela
  // aqui — nunca a senha compartilhada. Ver scripts/rotacionar_senha_mestre.js.
  async function entrarPorNome(nome, senha) {
    const email = emailDoNome(nome);
    _userPromise = null;
    try {
      const { data, error } = await comPrazo(window.sb.auth.signInWithPassword({ email, password: senha || SENHA_PADRAO }));
      if (error) return { ok: false, erro: error.message, rede: ehErroDeRede(error) };
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, erro: e.message, rede: true };
    }
  }

  async function sair() {
    if (!window.sb) return;
    _userPromise = null;
    // Mesmo com o servidor fora, a sessão local tem que ser apagada — senão o
    // botão Sair travava e a pessoa continuava "logada" no aparelho.
    try { await comPrazo(window.sb.auth.signOut({ scope: 'local' })); } catch {}
  }

  // requerLogin(): redireciona pro login se NÃO autenticado.
  // Usar SEMPRE no início do <script> da página protegida.
  // Retorna uma Promise<user|null> — null se redirecionou.
  async function requerLogin(loginPath) {
    const u = await getUser();
    if (u) return u;
    // Servidor fora: mandar pro login não adianta (lá também não conecta) —
    // avisa na própria página em vez de deixá-la em branco.
    if (_servidorFora) { mostrarAvisoServidor(); return null; }
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

  window.Auth = { servidorFora: () => _servidorFora, mostrarAvisoServidor, getUser, getProfile, ehMestre, entrarPorNome, sair, requerLogin, renderHeader, JOGADORES };
})();

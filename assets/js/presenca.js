// assets/js/presenca.js
// Presença online da mesa + último login, mostrados embaixo de cada ficha
// no Painel do Mestre.
//
// Como funciona: toda página logada entra no canal Realtime 'presenca-mesa'
// e se anuncia com o próprio user_id (Supabase Presence). Quem está com o
// sistema aberto aparece na lista; quem fechou some sozinho (o Realtime
// derruba a presença quando a aba fecha/perde conexão). Nada disso escreve
// no banco — presence vive só no canal, custo zero de escrita.
//
// O "último login" (mostrado quando a pessoa está offline) vem de
// auth.users.last_sign_in_at, exposto pela function public.listar_ultimo_login()
// (sql/026_ultimo_login.sql) — que só devolve linhas pro Mestre.
//
// API:
//   Presenca.entrar()            → entra no canal (chamado sozinho no load)
//   Presenca.estaOnline(userId)  → boolean
//   Presenca.pintar()            → (re)desenha os badges na tela
//
// Marcação esperada: <span data-presenca-user="<uuid do dono da ficha>"></span>
// Depende de: window.sb, window.Auth.

(function () {
  const CANAL = 'presenca-mesa';
  const CSS = `
  .presenca-badge {
    display: flex; align-items: center; gap: 7px;
    font-family: 'Cinzel', var(--font-heading, serif);
    font-size: 10.5px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;
    color: var(--text-muted, #89776d);
    padding: 8px 12px;
    border-top: 1px solid var(--border-soft, #3d3420);
    background: rgba(0,0,0,0.22);
  }
  .presenca-dot {
    width: 9px; height: 9px; border-radius: 50%; flex: none;
    background: #7a4a4a;
    transition: background .2s, box-shadow .2s;
  }
  .presenca-badge.on { color: #86efac; }
  .presenca-badge.on .presenca-dot {
    background: #4ade80;
    box-shadow: 0 0 7px rgba(74,222,128,0.85);
  }
  .presenca-badge.off .presenca-dot { background: #c0392b; }
  .presenca-quando {
    margin-left: auto; text-transform: none; letter-spacing: .3px;
    font-family: var(--font-body, Georgia, serif); font-style: italic;
    font-size: 11px; color: var(--text-muted, #89776d);
  }
  @media (prefers-reduced-motion: reduce) { .presenca-dot { transition: none; } }
  `;

  let _cssInjetado = false;
  function injetarCSS() {
    if (_cssInjetado) return;
    _cssInjetado = true;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  let _canal = null;
  let _online = new Set();
  let _ultimoLogin = null;      // Promise<Map user_id → ISO> (cache)
  let _timerRelativo = null;
  let _ligouVisibilidade = false;

  function fmtRelativo(iso) {
    if (!iso) return '';
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'agora mesmo';
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    return `há ${d} dia${d > 1 ? 's' : ''}`;
  }

  // Só o Mestre recebe linhas (a function filtra por is_mestre()) — pra
  // jogador o mapa fica vazio e o badge mostra só Online/Offline, sem horário.
  //
  // O cache guarda a PROMISE, não o resultado: render() e rerenderCard()
  // chamam pintar() em sequência, e sem isso cada chamada dispararia um RPC
  // próprio antes do primeiro responder.
  function carregarUltimoLogin(forcar) {
    if (_ultimoLogin && !forcar) return _ultimoLogin;
    _ultimoLogin = window.sb.rpc('listar_ultimo_login')
      .then(({ data, error }) => new Map((error || !data) ? [] : data.map(r => [r.id, r.ultimo_login])))
      .catch(() => new Map());
    return _ultimoLogin;
  }

  async function pintar() {
    const alvos = document.querySelectorAll('[data-presenca-user]');
    if (!alvos.length) return;
    injetarCSS();
    const mapa = await carregarUltimoLogin();
    alvos.forEach(el => {
      const uid = el.dataset.presencaUser;
      const online = !!uid && _online.has(uid);
      const quando = uid ? mapa.get(uid) : null;
      el.className = 'presenca-badge ' + (online ? 'on' : 'off');
      el.innerHTML = online
        ? `<span class="presenca-dot" aria-hidden="true"></span>Online`
        : `<span class="presenca-dot" aria-hidden="true"></span>Offline${quando ? `<span class="presenca-quando">último login ${fmtRelativo(quando)}</span>` : ''}`;
      el.title = online
        ? 'Está com o sistema aberto agora'
        : (quando ? `Último login: ${new Date(quando).toLocaleString('pt-BR')}` : 'Não está com o sistema aberto');
    });
  }

  // Lê o estado do canal e repinta se mudou. É a fonte de verdade local —
  // chamada tanto pelo evento 'sync' quanto pelo timer, porque um evento
  // perdido (socket reconectando, aba em background) deixaria a tela
  // congelada até o F5, que foi exatamente o sintoma relatado.
  function sincronizar({ forcarLogins = false } = {}) {
    if (!_canal) return;
    let estado;
    try { estado = _canal.presenceState(); } catch { return; }
    const agora = new Set(Object.keys(estado || {}));
    const mudou = agora.size !== _online.size || [...agora].some(id => !_online.has(id));
    _online = agora;
    // Quem acabou de entrar tem um last_sign_in_at novo — rebusca em vez de
    // mostrar o horário velho do cache.
    if (mudou || forcarLogins) carregarUltimoLogin(true);
    pintar();
  }

  let _tentativas = 0;
  async function entrar() {
    if (_canal || !window.sb || !window.Auth) return;
    const u = await window.Auth.getUser();
    if (!u) return;

    // presenceState() → { <user_id>: [ {...meta} ] } — a chave é o key
    // configurado aqui, então basta olhar as chaves pra saber quem está on.
    _canal = window.sb.channel(CANAL, { config: { presence: { key: u.id } } });
    _canal.on('presence', { event: 'sync' }, () => sincronizar());
    _canal.on('presence', { event: 'join' }, () => sincronizar());
    _canal.on('presence', { event: 'leave' }, () => sincronizar());

    _canal.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        _tentativas = 0;
        await _canal.track({ em: location.pathname, desde: new Date().toISOString() });
        sincronizar();
        return;
      }
      // Sem isto, uma queda de conexão deixava o painel mostrando todo mundo
      // offline pra sempre (só o F5 resolvia). Recria o canal com backoff.
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        const espera = Math.min(30000, 2000 * Math.pow(2, _tentativas++));
        try { await window.sb.removeChannel(_canal); } catch {}
        _canal = null;
        setTimeout(entrar, espera);
      }
    });

    if (!_timerRelativo) {
      // A cada 30s confere o estado real do canal (barato, é local) e, a cada
      // 2 min, rebusca os horários de login. Também mantém o "há X min" vivo.
      let voltas = 0;
      _timerRelativo = setInterval(() => sincronizar({ forcarLogins: ++voltas % 4 === 0 }), 30000);
    }

    // Voltar pra aba deve mostrar o estado atual na hora, não no próximo tick.
    // Registrado uma vez só — entrar() roda de novo a cada reconexão.
    if (!_ligouVisibilidade) {
      _ligouVisibilidade = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') sincronizar({ forcarLogins: true });
      });
    }
  }

  function estaOnline(userId) { return _online.has(userId); }

  window.Presenca = { entrar, estaOnline, pintar, recarregarLogins: () => carregarUltimoLogin(true).then(pintar) };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', entrar);
  else entrar();
})();

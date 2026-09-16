// assets/js/presenca.js
// Status online/offline de cada conta, mostrado embaixo de cada ficha no
// Painel do Mestre.
//
// ONLINE = a conta está LOGADA, não "tem aba aberta": o Supabase cria uma
// linha em auth.sessions no login e apaga no signOut(), e nesta instância a
// sessão não expira por tempo. Então o jogador entra, fecha o navegador e
// continua verde até clicar em Sair — que é como o Mestre pensa a coisa.
// Quem devolve isso é public.listar_status_contas() (sql/027_status_contas.sql),
// que também traz o último login e só responde pro Mestre.
//
// Em cima disso, o Realtime Presence ('presenca-mesa') serve só pra reagir
// na hora: quando alguém abre o sistema o badge fica verde no mesmo segundo,
// sem esperar o ciclo de 30s que reconsulta as sessões. Presence não escreve
// nada no banco.
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
  let _presentes = new Set();   // com alguma aba aberta AGORA (Realtime Presence)
  let _contas = null;           // Promise<Map user_id → {ultimo_login, sessoes}>
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

  // ONLINE = conta logada (auth.sessions tem linha; o Supabase apaga no
  // signOut()). Não é "está com a aba aberta" — o jogador entra, fecha o
  // navegador e continua logado até clicar em Sair, que é o que o Mestre
  // quer enxergar. Ver sql/027_status_contas.sql.
  //
  // Só o Mestre recebe linhas (a function filtra por is_mestre()) — pra
  // jogador o mapa fica vazio e sobra só a presença via Realtime.
  //
  // O cache guarda a PROMISE, não o resultado: render() e rerenderCard()
  // chamam pintar() em sequência, e sem isso cada chamada dispararia um RPC
  // próprio antes do primeiro responder.
  function carregarContas(forcar) {
    if (_contas && !forcar) return _contas;
    _contas = window.sb.rpc('listar_status_contas')
      .then(({ data, error }) => new Map((error || !data) ? [] : data.map(r => [r.id, r])))
      .catch(() => new Map());
    return _contas;
  }

  async function pintar() {
    const alvos = document.querySelectorAll('[data-presenca-user]');
    if (!alvos.length) return;
    injetarCSS();
    const contas = await carregarContas();
    alvos.forEach(el => {
      const uid = el.dataset.presencaUser;
      const conta = uid ? contas.get(uid) : null;
      // Logado manda; a presença serve pra ficar verde na hora em que o
      // jogador abre o sistema, sem esperar o próximo ciclo de consulta.
      const logado = !!conta && conta.sessoes > 0;
      const presente = !!uid && _presentes.has(uid);
      const online = logado || presente;
      const quando = conta?.ultimo_login;

      el.className = 'presenca-badge ' + (online ? 'on' : 'off');
      el.innerHTML = online
        ? `<span class="presenca-dot" aria-hidden="true"></span>Online`
        : `<span class="presenca-dot" aria-hidden="true"></span>Offline${quando ? `<span class="presenca-quando">último login ${fmtRelativo(quando)}</span>` : ''}`;
      el.title = online
        ? (presente ? 'Logado e com o sistema aberto agora' : 'Logado (não saiu da conta)')
        : (quando ? `Saiu da conta · último login: ${new Date(quando).toLocaleString('pt-BR')}` : 'Não está logado');
    });
  }

  // Relê o estado do canal e repinta. Chamada pelo evento 'sync' E pelo
  // timer, porque um evento perdido (socket reconectando, aba em segundo
  // plano) deixaria a tela congelada até o F5 — que foi o sintoma relatado.
  // `forcarContas` rebusca quem está logado; sem isso um logout só apareceria
  // no próximo ciclo longo.
  function sincronizar({ forcarContas = false } = {}) {
    let mudouPresenca = false;
    if (_canal) {
      let estado;
      try { estado = _canal.presenceState(); } catch { estado = null; }
      if (estado) {
        const agora = new Set(Object.keys(estado));
        mudouPresenca = agora.size !== _presentes.size || [...agora].some(id => !_presentes.has(id));
        _presentes = agora;
      }
    }
    // Alguém abriu/fechou o sistema: é o melhor momento pra reconferir as
    // sessões (pode ter acabado de logar ou de sair).
    if (mudouPresenca || forcarContas) carregarContas(true).then(pintar);
    else pintar();
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
      // A cada 30s reconsulta quem está logado — é o que faz o "saiu da
      // conta" virar vermelho sozinho, sem F5. São 5 linhas de retorno, custo
      // irrelevante. Também mantém o "há X min" envelhecendo certo.
      _timerRelativo = setInterval(() => sincronizar({ forcarContas: true }), 30000);
    }

    // Voltar pra aba deve mostrar o estado atual na hora, não no próximo tick.
    // Registrado uma vez só — entrar() roda de novo a cada reconexão.
    if (!_ligouVisibilidade) {
      _ligouVisibilidade = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') sincronizar({ forcarContas: true });
      });
    }
  }

  function estaOnline(userId) { return _presentes.has(userId); }

  window.Presenca = { entrar, estaOnline, pintar, atualizar: () => sincronizar({ forcarContas: true }) };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', entrar);
  else entrar();
})();

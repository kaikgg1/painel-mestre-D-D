// assets/js/presenca.js
// Status online/offline de cada conta, mostrado embaixo de cada ficha no
// Painel do Mestre.
//
// ONLINE = está logado E deu sinal de vida nos últimos JANELA_ATIVO minutos.
//
// As duas metades existem por um motivo cada:
//   - "logado" (auth.sessions): some na hora em que clica em Sair.
//   - "sinal de vida" (profiles.ultimo_visto, gravado por marcar_visto()):
//     resolve quem NUNCA clica em Sair e só fecha o navegador — sem isso a
//     bolinha ficava verde pra sempre. É o timeout de inatividade que o
//     Supabase só oferece no plano Pro, feito por nós. Ver sql/028_ultimo_visto.sql.
//
// A janela é de 30 min por causa do celular: tela bloqueada derruba a conexão
// do Realtime e pausa o heartbeat, e sem essa folga o jogador sentado na mesa
// apareceria offline entre um turno e outro.
//
// Por cima disso, o Realtime Presence ('presenca-mesa') deixa o badge verde no
// mesmo segundo em que alguém abre o sistema, sem esperar o próximo ciclo.
// Presence não escreve nada no banco.
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
  // Minutos sem sinal de vida até a conta contar como offline. Mexer aqui é
  // suficiente — não precisa de migração no banco.
  const JANELA_ATIVO = 30;
  // De quanto em quanto tempo a página avisa que ainda está aberta. Bem menor
  // que a janela, pra uma recarga de página ou uma falha de rede pontual não
  // derrubar ninguém pra vermelho sem motivo.
  const INTERVALO_HEARTBEAT = 2 * 60 * 1000;
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

  function minutosDesde(iso) {
    if (!iso) return Infinity;
    return (Date.now() - new Date(iso).getTime()) / 60000;
  }

  async function pintar() {
    const alvos = document.querySelectorAll('[data-presenca-user]');
    if (!alvos.length) return;
    injetarCSS();
    const contas = await carregarContas();
    alvos.forEach(el => {
      const uid = el.dataset.presencaUser;
      const conta = uid ? contas.get(uid) : null;
      const logado = !!conta && conta.sessoes > 0;
      const ativo = minutosDesde(conta?.ultimo_visto) <= JANELA_ATIVO;
      const presente = !!uid && _presentes.has(uid);
      // Presence deixa verde na hora em que abre o sistema; o par
      // logado+ativo é o que sustenta o verde depois disso (e o que apaga
      // quando a pessoa fecha tudo e some).
      const online = presente || (logado && ativo);

      // Offline por ter saído da conta é diferente de offline por ter
      // sumido com a aba aberta — o texto reflete cada caso.
      const visto = conta?.ultimo_visto;
      const login = conta?.ultimo_login;
      let detalhe = '';
      if (!online) {
        if (logado && visto) detalhe = `visto ${fmtRelativo(visto)}`;
        else if (login) detalhe = `último login ${fmtRelativo(login)}`;
      }

      el.className = 'presenca-badge ' + (online ? 'on' : 'off');
      el.innerHTML = `<span class="presenca-dot" aria-hidden="true"></span>${online ? 'Online' : 'Offline'}`
        + (detalhe ? `<span class="presenca-quando">${detalhe}</span>` : '');
      el.title = online
        ? (presente ? 'Com o sistema aberto agora' : `Ativo nos últimos ${JANELA_ATIVO} min`)
        : logado
          ? `Continua logado, mas sem sinal há mais de ${JANELA_ATIVO} min${visto ? ` · visto em ${new Date(visto).toLocaleString('pt-BR')}` : ''}`
          : (login ? `Saiu da conta · último login: ${new Date(login).toLocaleString('pt-BR')}` : 'Não está logado');
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

  // Avisa o banco que esta pessoa continua com o sistema aberto. O horário é
  // gravado pelo relógio do servidor dentro de marcar_visto() — nada de
  // confiar no relógio do aparelho, que pode estar errado.
  let _timerHeartbeat = null;
  function marcarVisto() {
    if (!window.sb) return;
    window.sb.rpc('marcar_visto').then(({ error }) => {
      if (error) console.warn('[presenca] marcar_visto:', error.message);
    }).catch(() => {});
  }

  function ligarHeartbeat() {
    if (_timerHeartbeat) return;
    marcarVisto();
    _timerHeartbeat = setInterval(() => {
      // Aba escondida não conta como uso — sem isso, uma aba esquecida
      // aberta a semana toda deixaria a pessoa verde pra sempre, que é
      // exatamente o problema que este heartbeat existe pra resolver.
      if (document.visibilityState === 'visible') marcarVisto();
    }, INTERVALO_HEARTBEAT);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') marcarVisto();
    });
  }

  let _tentativas = 0;
  async function entrar() {
    if (_canal || !window.sb || !window.Auth) return;
    const u = await window.Auth.getUser();
    if (!u) return;
    ligarHeartbeat();

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

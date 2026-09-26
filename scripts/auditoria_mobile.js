// scripts/auditoria_mobile.js
// Auditoria de responsividade: abre TODAS as páginas do projeto num navegador
// de verdade, em largura de celular, e mede duas coisas que só existem depois
// do layout acontecer (nenhum grep acha isso):
//
//   1. Estouro horizontal — scrollWidth > clientWidth. É o bug que corta o
//      texto na direita. Foi assim que apareceu a nota de rodapé com URL crua
//      em ato1-resumo/cap2-lore-de-barovia, que dois meses de CSS cuidadoso
//      não tinham pego. Estouro FALHA a auditoria (exit 1).
//   2. Alvo de toque menor que --touch-target (44px, assets/css/tokens.css).
//      Só avisa, porque tem caso legítimo (lista de navegação densa). Com
//      --estrito, também falha.
//
// A medição roda DENTRO da página, num iframe de largura fixa: é a única
// forma confiável: `--window-size` do headless não corresponde ao viewport
// (renderiza mais largo e corta a captura, dá falso "está tudo bem").
//
// Uso:
//   node scripts/auditoria_mobile.js                 → as páginas públicas
//   node scripts/auditoria_mobile.js --logado        → + ficha e painéis
//   node scripts/auditoria_mobile.js --larguras 390  → só uma largura
//   node scripts/auditoria_mobile.js --estrito       → alvo pequeno também falha
//
// --logado cria uma conta descartável (precisa de SUPABASE_SERVICE_ROLE_KEY
// no .env), mede a ficha aba por aba e os painéis, e apaga a conta no fim,
// inclusive se der erro no meio. Sem isso essas 3 telas ficam de fora: elas
// só montam com sessão.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ALVO_TOQUE = 44;          // --touch-target do tokens.css
// Porta 0 = o SO escolhe uma livre. Porta fixa dava EADDRINUSE quando uma
// execução anterior morria sem liberar o socket, e aí a auditoria seguinte
// nem rodava.
const PORTA = 0;

const args = process.argv.slice(2);
const LOGADO = args.includes('--logado');
const ESTRITO = args.includes('--estrito');
const LARGURAS = (() => {
  const i = args.indexOf('--larguras');
  if (i < 0) return [390, 320];
  return args[i + 1].split(',').map(Number).filter(Boolean);
})();
// --pagina <trecho>: mede só as páginas cujo caminho contém o trecho. Pra
// conferir uma correção sem esperar o site inteiro de novo.
const FILTRO = (() => {
  const i = args.indexOf('--pagina');
  return i < 0 ? null : args[i + 1];
})();

// Estas montam a tela por JS com dados do banco: sem sessão elas só
// redirecionam pro login, então não adianta medir sem --logado.
const PRECISAM_SESSAO = ['paineis/ficha.html', 'paineis/painel_mestre_dnd5e.html',
                         'paineis/painel_barovia_dnd5e.html'];
const ABAS_FICHA = ['resumo','combate','magias','habilidades','equipamento','aliados','personagem'];

// ─── Páginas ────────────────────────────────────────────────────────
function listarPaginas(dir = RAIZ, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listarPaginas(p, acc);
    else if (e.name.endsWith('.html')) acc.push(path.relative(RAIZ, p).split(path.sep).join('/'));
  }
  return acc;
}

// ─── Navegador ──────────────────────────────────────────────────────
function acharNavegador() {
  const pf = process.env['ProgramFiles'], pf86 = process.env['ProgramFiles(x86)'],
        la = process.env['LOCALAPPDATA'];
  const candidatos = [
    pf && pf + '\\Google\\Chrome\\Application\\chrome.exe',
    pf86 && pf86 + '\\Google\\Chrome\\Application\\chrome.exe',
    la && la + '\\Google\\Chrome\\Application\\chrome.exe',
    pf && pf + '\\Microsoft\\Edge\\Application\\msedge.exe',
    pf86 && pf86 + '\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  return candidatos.find(c => { try { return fs.existsSync(c); } catch { return false; } });
}

// ─── Servidor ───────────────────────────────────────────────────────
// Além dos arquivos, dois prefixos virtuais que existem só pra MEDIR — o
// arquivo no disco nunca muda:
//   /__semauth__/  tira o auth.js e o requerLogin (páginas estáticas que
//                  exigem login: as 48 de vilão são HTML pronto)
//   /__mestre__/   injeta um stub que faz Auth.ehMestre() devolver true, pra
//                  renderizar a UI do Mestre. É só no cliente: o RLS do banco
//                  continua valendo igual pra sessão de teste.
const TIPOS = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.webp':'image/webp','.gif':'image/gif','.woff2':'font/woff2','.woff':'font/woff',
  '.ico':'image/x-icon','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8' };
const STUB_MESTRE = `<script>(function p(){if(window.Auth){window.Auth.ehMestre=async()=>true;}else setTimeout(p,5);})();</script>`;

function criarServidor(harness, aoReceber) {
  return http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__resultado') {
      let b = ''; req.on('data', c => b += c);
      req.on('end', () => { try { aoReceber(JSON.parse(b)); } catch {} res.writeHead(204).end(); });
      return;
    }
    let u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/__auditoria__.html') {
      res.writeHead(200, { 'Content-Type': TIPOS['.html'] });
      res.end(harness); return;
    }
    const semAuth = u.startsWith('/__semauth__/'), mestre = u.startsWith('/__mestre__/');
    if (semAuth) u = u.slice('/__semauth__'.length);
    if (mestre) u = u.slice('/__mestre__'.length);
    const f = path.join(RAIZ, u === '/' ? 'index.html' : u);
    if (!path.normalize(f).startsWith(path.normalize(RAIZ))) { res.writeHead(403).end(); return; }
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404).end('404'); return; }
      if (f.endsWith('.html') && (semAuth || mestre)) {
        let s = data.toString('utf8');
        if (semAuth) s = s.replace(/<script[^>]*\/auth\.js"[^>]*><\/script>/g, '')
                          .replace(/Auth\.requerLogin/g, 'void 0 && Auth.requerLogin');
        if (mestre) s = s.replace(/(<script[^>]*\/auth\.js"[^>]*><\/script>)/, '$1' + STUB_MESTRE);
        data = Buffer.from(s, 'utf8');
      }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f).toLowerCase()] || 'application/octet-stream',
                           'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
}

// ─── Harness (roda no navegador) ────────────────────────────────────
function montarHarness(tarefas, cred) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>auditoria</title></head><body>
<pre id="o">iniciando…</pre>
${cred ? '<script src="/assets/vendor/supabase-js-2.45.0.min.js"></script><script src="/assets/js/supabase.js"></script>' : ''}
<script>
const TAREFAS = ${JSON.stringify(tarefas)};
const CRED = ${JSON.stringify(cred)};
const ALVO = ${ALVO_TOQUE};
const o = document.getElementById('o');
const envia = r => fetch('/__resultado', { method: 'POST', body: JSON.stringify(r) });
function sel(el) {
  let s = el.tagName.toLowerCase();
  if (el.id) s += '#' + el.id;
  if (typeof el.className === 'string' && el.className.trim())
    s += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.');
  return s;
}
// Altura efetiva de toque: a caixa do elemento OU o halo invisível que o
// projeto usa (::before/::after com inset negativo) — sem isso, todo pip
// com área ampliada viraria falso positivo.
function alturaToque(el, w) {
  // offsetHeight e nao getBoundingClientRect: o rect ja vem multiplicado pelo
  // transform do ancestral, e o rolador de dados fechado tem scale(.97) — os
  // botoes dele apareciam como 43px quando o CSS diz 44 e o usuario so toca
  // neles com o painel aberto (scale 1).
  let h = el.offsetHeight || el.getBoundingClientRect().height;
  // Halo invisivel: o projeto amplia alvo por pseudo-elemento de duas formas —
  // inset negativo (.hab-pip, .rc-pip) e caixa de tamanho fixo centrada
  // (.slot-pip usa inset:50% + width/height + translate). A altura COMPUTADA
  // do pseudo cobre os dois casos de uma vez.
  for (const pseudo of ['::before', '::after']) {
    const cs = w.getComputedStyle(el, pseudo);
    if (!cs || cs.content === 'none' || cs.position !== 'absolute') continue;
    const ph = parseFloat(cs.height);
    if (Number.isFinite(ph)) h = Math.max(h, ph);
  }
  // Input dentro de <label> : o alvo real e o label inteiro, porque tocar em
  // qualquer ponto dele foca o campo. E exatamente por isso que os chips de
  // CA/Iniciativa e o PV temporario viraram <label> — sem isto o detector
  // continuaria acusando o input de 18px que ele ja deixou de ser.
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) {
    const lab = el.closest('label') ||
                (el.id && el.getRootNode().querySelector('label[for="' + CSS.escape(el.id) + '"]'));
    if (lab) h = Math.max(h, lab.offsetHeight || 0);
  }
  return h;
}
function medir(d, w, rotulo, larg) {
  const cw = d.documentElement.clientWidth;
  const sw = Math.max(d.documentElement.scrollWidth, d.body ? d.body.scrollWidth : 0);
  const culpados = [];
  if (sw > cw + 1) {
    for (const el of d.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const cs = w.getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (r.right > cw + 1) culpados.push(sel(el) + ' dir=' + Math.round(r.right));
      else if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && cs.overflowX === 'visible')
        culpados.push('[conteudo transborda] ' + sel(el) + ' scrollW=' + el.scrollWidth);
      if (culpados.length > 5) break;
    }
  }
  const pequenos = [];
  for (const el of d.querySelectorAll('button, a, input:not([type=hidden]), select, textarea, [role=button]')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    // Link solto no meio de um paragrafo nao e alvo de toque: a propria WCAG
    // 2.5.8 isenta o alvo "inline, numa frase ou bloco de texto". Sem esta
    // isencao, cada link de citacao do guia virava um problema falso — 43
    // telas de ruido escondendo os controles que importam.
    if (el.tagName === 'A' && w.getComputedStyle(el).display === 'inline') continue;
    // Meio pixel de folga: um controle com min-height:44px mede 43.5 quando a
    // borda cai em subpixel, e sem a folga ele apareceria como problema
    // depois de já ter sido corrigido.
    const h = alturaToque(el, w);
    if (h < ALVO - 0.5) pequenos.push(sel(el) + ' ' + Math.round(h) + 'px');
  }
  const unicos = [...new Set(pequenos)];
  return { rotulo, larg, cw, sw, overflow: sw - cw, culpados,
           nPequenos: pequenos.length, pequenos: unicos.slice(0, 6) };
}
async function abrir(url, larg) {
  const f = document.createElement('iframe');
  f.style.cssText = 'width:' + larg + 'px;height:844px;border:0;position:absolute;left:-9999px;top:0';
  document.body.appendChild(f);
  f.src = url;
  await new Promise(r => { let fim = false; const ok = () => { if (!fim) { fim = true; r(); } };
                           f.onload = ok; f.onerror = ok; setTimeout(ok, 20000); });
  await new Promise(r => setTimeout(r, ${LOGADO ? 3000 : 2000}));
  return f;
}
(async () => {
  if (CRED) {
    const { error } = await window.sb.auth.signInWithPassword({ email: CRED[0], password: CRED[1] });
    if (error) { await envia({ fatal: 'login falhou: ' + error.message }); return; }
  }
  for (const t of TAREFAS) {
    let f = await abrir(t.url, t.larg);
    // Caiu no login? Se a página for estática (as 48 de vilão são HTML
    // pronto), dá pra medir o layout dela pelo /__semauth__/. Se nem assim
    // montar, é das que só existem com sessão — aí fica pro --logado.
    try {
      if (f.contentWindow.location.pathname.endsWith('login.html')
          && !t.url.endsWith('login.html') && !t.url.startsWith('/__semauth__/')) {
        f.remove();
        f = await abrir('/__semauth__' + t.url, t.larg);
      }
    } catch {}
    try {
      const d = f.contentDocument, w = f.contentWindow;
      const destino = w.location.pathname;
      if (destino.endsWith('login.html') && !t.url.endsWith('login.html')) {
        await envia({ rotulo: t.rotulo, larg: t.larg, exigeSessao: true });
      } else if (t.abas) {
        for (const aba of t.abas) {
          const btn = d.querySelector('#tabs .tab[data-tab="' + aba + '"]');
          if (!btn) continue;
          btn.click();
          await new Promise(r => setTimeout(r, 800));
          await envia(medir(d, w, t.rotulo + ' / aba ' + aba, t.larg));
        }
      } else {
        await envia(medir(d, w, t.rotulo, t.larg));
      }
    } catch (e) { await envia({ rotulo: t.rotulo, larg: t.larg, erro: String(e && e.message || e) }); }
    f.remove();
    o.textContent = t.larg + 'px — ' + t.rotulo;
  }
  if (CRED) { try { await window.sb.auth.signOut(); } catch {} }
  await envia({ fim: true });
})();
</script></body></html>`;
}

// ─── Conta descartável (--logado) ───────────────────────────────────
const EMAIL_TESTE = 'zz-auditoria-mobile@mesa.local';

async function criarContaTeste() {
  require('dotenv').config({ path: path.join(RAIZ, '.env') });
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error('--logado precisa de SUPABASE_SERVICE_ROLE_KEY no .env');
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL, chave, { auth: { persistSession: false } });
  const senha = require('crypto').randomBytes(18).toString('base64url');

  // Sobra de uma execução que morreu no meio
  const { data: antes } = await sb.auth.admin.listUsers({ perPage: 200 });
  for (const u of (antes?.users || [])) if (u.email === EMAIL_TESTE) await sb.auth.admin.deleteUser(u.id);

  const { data, error } = await sb.auth.admin.createUser({
    email: EMAIL_TESTE, password: senha, email_confirm: true,
    user_metadata: { nome: 'ZZ Auditoria' },
  });
  if (error) throw error;
  const uid = data.user.id;
  await sb.from('profiles').upsert({ id: uid, nome: 'ZZ Auditoria' });

  // Ficha "pior caso" de propósito: nome comprido, inventário cheio, várias
  // condições. Conteúdo curto nunca estoura — uma ficha vazia não testa nada.
  const { data: ch } = await sb.from('characters').insert({
    user_id: uid, nome: 'Zzz Auditoria Mobile Vasilievna Drakonovna',
    raca: 'Meio-Elfo Silvestre', classe: 'Clérigo', subclasse: 'Domínio da Morte',
    nivel: 12, campanha: 'barovia', is_active: true,
    hp_atual: 47, hp_max: 96, hp_temp: 12, ca: 19, iniciativa_bonus: 3, deslocamento: 9,
    exaustao: 3, inspiracao: 2, morte_sucessos: 2, morte_falhas: 1,
    dado_vida_tipo: 8, dado_vida_atual: 7, xp: 100000, cd_resistencia: 17, bonus_atq_magia: 9,
    atributos: { for: 16, dex: 14, con: 18, int: 12, sab: 20, car: 10 },
    slots_magia: Object.fromEntries([1,2,3,4,5,6,7,8,9].map(n => [n, { atual: n % 3, max: Math.max(1, 5 - (n >> 1)) }])),
    condicoes: ['Amedrontado','Envenenado','Impedido','Atordoado','Caído','Enfeitiçado'],
    concentracao: { ativa: true, magia: 'Proteção Contra Energia (Necrótico)' },
    pericias: { percepcao:{prof:true}, religiao:{prof:true,exp:true}, medicina:{prof:true} },
    inventario: {
      moedas: { pc: 1250, pp: 340, pe: 99, po: 18750, pl: 42 },
      armas: [{ nome:'Maça Sagrada do Amanhecer Eterno +2', dano:'1d6+5', tipo:'Concussão' }],
      armaduras: [{ nome:'Cota de Malha Abençoada de Santo André', ca:'16', tipo:'Pesada' }],
      itens: Array.from({ length: 14 }, (_, i) => ({ nome: 'Item de teste bem comprido nº ' + (i+1), qtd: i+1, peso: 1.5 })),
    },
    historia: 'Nasceu em Vallaki. '.repeat(40),
  }).select('id').single();
  await sb.from('spell_lists').insert({ character_id: ch.id, user_id: uid, nome: 'Favoritas',
    spell_names: ['Curar Ferimentos','Palavra Curativa','Banimento','Restauração Maior','Luz'] });
  return { sb, uid, chid: ch.id, cred: [EMAIL_TESTE, senha] };
}

async function apagarContaTeste(ctx) {
  if (!ctx) return;
  const { sb, uid, chid } = ctx;
  await sb.from('spell_lists').delete().eq('character_id', chid);
  await sb.from('characters').delete().eq('id', chid);
  await sb.from('master_state').delete().eq('user_id', uid);
  await sb.from('profiles').delete().eq('id', uid);
  const { error } = await sb.auth.admin.deleteUser(uid);
  if (error) console.error('  ATENÇÃO: não consegui apagar a conta de teste:', error.message);
  else console.log('  conta de teste apagada.');
}

// ─── Execução ───────────────────────────────────────────────────────
(async () => {
  const navegador = acharNavegador();
  if (!navegador) {
    console.error('Nenhum Chrome/Edge/Chromium encontrado — a auditoria precisa de um navegador de verdade.');
    process.exit(2);
  }

  const paginas = listarPaginas()
    .filter(p => !PRECISAM_SESSAO.includes(p))
    .filter(p => !FILTRO || p.includes(FILTRO));
  // Página com requerLogin() e conteúdo estático (as 48 de vilão) já entra
  // pelo /__semauth__/: sem isto ela carrega, cai no login, e o harness tem
  // que carregar tudo de novo — o dobro do tempo em mais da metade do site.
  const exigeLogin = new Set(paginas.filter(p => {
    try { return fs.readFileSync(path.join(RAIZ, p), 'utf8').includes('Auth.requerLogin'); }
    catch { return false; }
  }));
  const tarefas = [];
  for (const larg of LARGURAS) {
    for (const p of paginas)
      tarefas.push({ url: (exigeLogin.has(p) ? '/__semauth__/' : '/') + p, rotulo: p, larg });
    if (LOGADO) {
      const cabe = p => !FILTRO || p.includes(FILTRO);
      if (cabe('paineis/ficha.html'))
        tarefas.push({ url: '/paineis/ficha.html', rotulo: 'paineis/ficha.html', larg, abas: ABAS_FICHA });
      if (cabe('paineis/painel_mestre_dnd5e.html'))
        tarefas.push({ url: '/__mestre__/paineis/painel_mestre_dnd5e.html', rotulo: 'paineis/painel_mestre_dnd5e.html (Mestre)', larg });
      if (cabe('paineis/painel_barovia_dnd5e.html')) {
        tarefas.push({ url: '/__mestre__/paineis/painel_barovia_dnd5e.html', rotulo: 'paineis/painel_barovia_dnd5e.html (Mestre)', larg });
        tarefas.push({ url: '/paineis/painel_barovia_dnd5e.html', rotulo: 'paineis/painel_barovia_dnd5e.html (jogador)', larg });
      }
    }
  }

  let ctx = null, servidor = null, browser = null, perfil = null;
  const resultados = [];
  let terminou = false, fatal = null;

  try {
    if (LOGADO) { console.log('criando conta de teste descartável…'); ctx = await criarContaTeste(); }

    const harness = montarHarness(tarefas, ctx ? ctx.cred : null);
    servidor = criarServidor(harness, r => {
      if (r.fim) { terminou = true; return; }
      if (r.fatal) { fatal = r.fatal; terminou = true; return; }
      resultados.push(r);
      process.stdout.write('\r  medidas: ' + resultados.length + '/' + tarefas.length + '   ');
    });
    await new Promise(r => servidor.listen(PORTA, '127.0.0.1', r));
    const porta = servidor.address().port;

    perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-mobile-'));
    // NÃO bloqueie as fontes do Google aqui. Tentei (90 páginas importam
    // Cinzel/Libre Baskerville e o `load` do iframe espera por elas — dá pra
    // cortar uns 3s por página) e a medição mudou: com a pilha de fallback o
    // a.leaf do Reloaded passou de 28px pra 30px. Se a altura muda, a LARGURA
    // do texto também muda — ou seja, a auditoria passaria a inventar e a
    // esconder estouro. Auditoria que mede outra coisa não serve; a lentidão
    // é o preço de medir a página que o jogador realmente abre.
    browser = spawn(navegador, ['--headless=new', '--disable-gpu', '--no-first-run',
      '--hide-scrollbars', '--user-data-dir=' + perfil, '--window-size=500,900',
      'http://127.0.0.1:' + porta + '/__auditoria__.html'], { stdio: 'ignore' });

    const limite = Date.now() + 1000 * (60 + tarefas.length * 6);
    while (!terminou && Date.now() < limite) await new Promise(r => setTimeout(r, 500));
    process.stdout.write('\n');
    if (!terminou) console.error('  (tempo esgotado — relatando o que deu tempo de medir)');
  } finally {
    if (browser) try { browser.kill(); } catch {}
    if (servidor) try { servidor.close(); } catch {}
    if (perfil) try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {}
    await apagarContaTeste(ctx);   // roda mesmo se deu erro no meio
  }

  if (fatal) { console.error('FALHOU:', fatal); process.exit(2); }

  // ─── Relatório ───
  const estouros = resultados.filter(r => r.overflow > 0);
  const semSessao = resultados.filter(r => r.exigeSessao);
  const erros = resultados.filter(r => r.erro);
  const pequenos = resultados.filter(r => r.nPequenos > 0);

  console.log('\n=== ESTOURO HORIZONTAL ===');
  if (!estouros.length) console.log('  nenhum — nenhuma página rola pro lado.');
  for (const r of estouros)
    console.log(`  ${r.rotulo} @${r.larg}px  +${r.overflow}px  ${r.culpados.join(' | ')}`);

  // Agrupado por SELETOR, não por página: 40 páginas do mesmo template
  // repetem o mesmo controle, e o que orienta a correção é "qual controle",
  // não "quais arquivos".
  console.log(`\n=== ALVOS DE TOQUE < ${ALVO_TOQUE}px (por controle) ===`);
  if (!pequenos.length) console.log('  nenhum.');
  else {
    const porSeletor = new Map();
    for (const r of pequenos) {
      for (const p of r.pequenos) {
        const m = p.match(/^(.*) (\d+)px$/);
        if (!m) continue;
        const e = porSeletor.get(m[1]) || { px: +m[2], telas: new Set() };
        e.px = Math.min(e.px, +m[2]);
        e.telas.add(r.rotulo);
        porSeletor.set(m[1], e);
      }
    }
    [...porSeletor.entries()].sort((a, b) => a[1].px - b[1].px).slice(0, 20)
      .forEach(([s, e]) => console.log(`  ${String(e.px + 'px').padStart(6)}  ${s.padEnd(34)} em ${e.telas.size} tela(s)`));
  }

  if (semSessao.length) {
    const nomes = [...new Set(semSessao.map(r => r.rotulo))];
    console.log('\n=== NÃO MEDIDAS (caíram no login) ===');
    nomes.forEach(n => console.log('  ' + n));
    console.log('  rode com --logado pra medir estas.');
  }
  if (erros.length) {
    console.log('\n=== ERROS ===');
    erros.forEach(r => console.log(`  ${r.rotulo} @${r.larg}px: ${r.erro}`));
  }

  const medidas = resultados.filter(r => r.overflow !== undefined).length;
  console.log(`\n${medidas} medições em ${LARGURAS.join(' e ')}px · ` +
              `${estouros.length} estouro(s) · ${pequenos.length} tela(s) com alvo pequeno`);

  if (estouros.length) { console.log('FALHOU: página estourando na horizontal.'); process.exit(1); }
  if (ESTRITO && pequenos.length) { console.log('FALHOU (--estrito): alvo de toque abaixo do mínimo.'); process.exit(1); }
  console.log('OK');
})().catch(e => { console.error('ERRO:', e.stack || e.message); process.exit(2); });

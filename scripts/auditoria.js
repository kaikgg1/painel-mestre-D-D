// scripts/auditoria.js
// Auditoria end-to-end do sistema: schema, dados, RLS, realtime habilitado,
// e teste de fluxo (login → criar → atualizar → mestre vê).
// Uso: npm run auditoria  (ou node scripts/auditoria.js)
require('dotenv').config();
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY;
const DATABASE_URL  = process.env.DATABASE_URL;

function ok(m)    { console.log('  ✓', m); }
function falha(m) { console.error('  ✗', m); process.exitCode = 1; }
function info(m)  { console.log('  ℹ', m); }

async function auditarSchema(pg) {
  console.log('\n── 1. SCHEMA ──');
  const { rows } = await pg.query(`
    select column_name, data_type from information_schema.columns
    where table_schema='public' and table_name='characters' order by ordinal_position
  `);
  const colunas = new Set(rows.map(r => r.column_name));
  const esperadas = [
    'id','user_id','nome','raca','classe','subclasse','nivel','origem','alinhamento',
    'atributos','hp_max','hp_atual','hp_temp','ca','iniciativa_bonus','deslocamento',
    'dado_vida_tipo','dado_vida_atual','slots_magia','condicoes','exaustao','inspiracao',
    'morte_sucessos','morte_falhas','campanha','magias_preparadas','is_active',
    'inventario','habilidades_classe','xp','idiomas','ferramentas','tracos_raciais',
    'pericias','salvaguardas','truques_conhecidos','magias_conhecidas',
    'cd_resistencia','bonus_atq_magia','caracteristicas_adicionais',
  ];
  const faltando = esperadas.filter(c => !colunas.has(c));
  if (!faltando.length) ok(`characters tem todas as ${esperadas.length} colunas esperadas (${rows.length} total)`);
  else falha(`faltam colunas: ${faltando.join(', ')}`);

  // Verifica que deslocamento é numeric (aceita decimais)
  const desl = rows.find(r => r.column_name === 'deslocamento');
  if (desl?.data_type === 'numeric') ok('deslocamento é numeric (aceita decimais)');
  else falha(`deslocamento é ${desl?.data_type} — deveria ser numeric`);
}

async function auditarRLS(pg) {
  console.log('\n── 2. RLS POLICIES ──');
  const { rows } = await pg.query(`
    select tablename, count(*)::int as n
    from pg_policies where schemaname='public'
    group by tablename order by tablename
  `);
  const esperado = { characters: 4, profiles: 2, spell_lists: 4 };
  let totalOk = true;
  for (const [tab, n] of Object.entries(esperado)) {
    const r = rows.find(x => x.tablename === tab);
    if (r?.n === n) ok(`${tab}: ${n} policies`);
    else { falha(`${tab}: ${r?.n || 0} policies (esperado ${n})`); totalOk = false; }
  }
  // Função is_mestre
  const { rows: fns } = await pg.query(`select proname from pg_proc where proname = 'is_mestre'`);
  if (fns.length) ok('função is_mestre() existe');
  else falha('função is_mestre() não existe');
  return totalOk;
}

async function auditarRealtime(pg) {
  console.log('\n── 3. REALTIME ──');
  const { rows } = await pg.query(`
    select tablename from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
    order by tablename
  `);
  const habs = rows.map(r => r.tablename);
  for (const t of ['characters', 'spell_lists']) {
    if (habs.includes(t)) ok(`${t} está em supabase_realtime`);
    else falha(`${t} NÃO está em supabase_realtime — atualizações em tempo real não vão funcionar`);
  }
}

async function auditarUsuariosEProfiles(pg) {
  console.log('\n── 4. USUÁRIOS E PROFILES ──');
  const { rows: u } = await pg.query(`select email, raw_user_meta_data->>'nome' as nome from auth.users where email like '%@mesa.local' order by email`);
  const esperados = ['Sabrina','Derick','Felipe','Mestre123'];
  for (const n of esperados) {
    if (u.find(x => x.nome === n)) ok(`auth.users tem ${n}`);
    else falha(`auth.users SEM ${n}`);
  }
  const { rows: p } = await pg.query(`select nome from profiles order by nome`);
  const nomesProf = p.map(x => x.nome);
  for (const n of esperados) {
    if (nomesProf.includes(n)) ok(`profiles tem ${n}`);
    else falha(`profiles SEM ${n}`);
  }
}

async function testarFluxoCompleto() {
  console.log('\n── 5. FLUXO E2E (login → CRUD → leitura por outro user) ──');
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false }});

  // Login como Sabrina
  let r = await sb.auth.signInWithPassword({ email: 'sabrina123@mesa.local', password: 'mesa-dnd-5e' });
  if (r.error) { falha('login Sabrina: ' + r.error.message); return; }
  ok('login como Sabrina123');
  const sabId = r.data.user.id;

  // Cria personagem teste
  const nomeTeste = 'AUDITORIA_' + Date.now();
  const { data: novo, error: errN } = await sb.from('characters').insert({
    user_id: sabId, nome: nomeTeste, classe: 'Clérigo', nivel: 5,
    campanha: 'barovia', is_active: false,  // primeiro com inativo
  }).select('*').single();
  if (errN) { falha('insert: ' + errN.message); return; }
  ok(`criou character "${nomeTeste}" (id=${novo.id.slice(0,8)}…)`);

  // Update: ativa
  const { error: errU } = await sb.from('characters').update({ is_active: true, hp_atual: 33 }).eq('id', novo.id);
  if (errU) { falha('update: ' + errU.message); return; }
  ok('updated is_active=true e hp_atual=33');

  // Read próprio
  const { data: lido } = await sb.from('characters').select('*').eq('id', novo.id).single();
  if (lido?.hp_atual === 33 && lido.is_active) ok('Sabrina lê o próprio personagem corretamente');
  else falha(`leitura inconsistente: hp=${lido?.hp_atual} active=${lido?.is_active}`);

  // Testar deletar character não-meu (deve ser bloqueado por RLS)
  const { data: outros } = await sb.from('characters').select('id, user_id').neq('user_id', sabId).limit(1);
  if (outros?.length) {
    const { error: errD } = await sb.from('characters').delete().eq('id', outros[0].id);
    if (errD || (await sb.from('characters').select('id').eq('id', outros[0].id).single()).data) {
      ok('Sabrina NÃO consegue deletar character de outro (RLS funciona)');
    } else {
      falha('RLS FURADO: Sabrina deletou character alheio!');
    }
  }

  await sb.auth.signOut();

  // Login como Mestre
  r = await sb.auth.signInWithPassword({ email: 'mestre123@mesa.local', password: 'mesa-dnd-5e' });
  if (r.error) { falha('login Mestre: ' + r.error.message); return; }
  ok('login como Mestre123');

  // Mestre lê character da Sabrina (RLS deve permitir)
  const { data: lidoM } = await sb.from('characters').select('*').eq('id', novo.id).single();
  if (lidoM?.hp_atual === 33) ok('Mestre vê character da Sabrina (RLS is_mestre funciona)');
  else falha('Mestre NÃO consegue ver character da Sabrina');

  // Mestre edita o character da Sabrina
  const { error: errMU } = await sb.from('characters').update({ hp_atual: 44 }).eq('id', novo.id);
  if (errMU) falha('Mestre não consegue editar: ' + errMU.message);
  else ok('Mestre consegue editar character da Sabrina');

  // Cleanup: Mestre deleta o de teste
  const { error: errDel } = await sb.from('characters').delete().eq('id', novo.id);
  if (errDel) falha('Mestre não conseguiu apagar teste: ' + errDel.message);
  else ok('Mestre apagou character de teste (cleanup)');

  await sb.auth.signOut();
}

async function testarRealtimeReal() {
  console.log('\n── 6. REALTIME (subscribe + INSERT) ──');
  const sb1 = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false }});
  const sb2 = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false }});

  await sb2.auth.signInWithPassword({ email: 'mestre123@mesa.local', password: 'mesa-dnd-5e' });
  await sb1.auth.signInWithPassword({ email: 'sabrina123@mesa.local', password: 'mesa-dnd-5e' });

  let receveu = false;
  let inscrito = false;

  const channel = sb2.channel('audit-test-' + Date.now())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'characters' },
      payload => { receveu = true; info(`evento recebido: ${payload.new.nome}`); })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') inscrito = true;
    });

  // Espera SUBSCRIBED (até 10s)
  const t0 = Date.now();
  while (!inscrito && Date.now() - t0 < 10000) await new Promise(r => setTimeout(r, 200));
  if (!inscrito) { falha('canal não conseguiu subscribe em 10s'); await sb2.removeChannel(channel); return; }
  ok(`canal subscribed em ${Date.now() - t0}ms`);

  // Sabrina cria um character
  const sabId = (await sb1.auth.getUser()).data.user.id;
  const nomeTeste = 'RT_' + Date.now();
  const { data: novo, error: errIns } = await sb1.from('characters').insert({
    user_id: sabId, nome: nomeTeste, campanha: 'barovia', is_active: true,
  }).select('id').single();
  if (errIns) { falha('INSERT falhou: ' + errIns.message); await sb2.removeChannel(channel); return; }

  // Espera evento chegar (até 8s)
  const t1 = Date.now();
  while (!receveu && Date.now() - t1 < 8000) await new Promise(r => setTimeout(r, 200));

  if (receveu) ok(`Mestre recebeu realtime em ${Date.now() - t1}ms`);
  else falha('Mestre NÃO recebeu evento em 8s — realtime pode estar degradado');

  // Cleanup
  await sb1.from('characters').delete().eq('id', novo.id);
  await sb2.removeChannel(channel);
  await sb1.auth.signOut();
  await sb2.auth.signOut();
}

(async () => {
  console.log('═══════════════════════════════════════');
  console.log('  AUDITORIA — Painel do Mestre D&D 5e');
  console.log('═══════════════════════════════════════');

  if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_ANON) {
    console.error('❌ .env não tem SUPABASE_URL, SUPABASE_ANON_KEY e DATABASE_URL');
    process.exit(1);
  }

  const pg = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }});
  await pg.connect();

  try {
    await auditarSchema(pg);
    await auditarRLS(pg);
    await auditarRealtime(pg);
    await auditarUsuariosEProfiles(pg);
    await testarFluxoCompleto();
    await testarRealtimeReal();
  } catch (e) {
    console.error('\n❌ Erro inesperado:', e.message);
    process.exitCode = 1;
  } finally {
    await pg.end();
  }

  console.log('\n═══════════════════════════════════════');
  console.log(process.exitCode ? '  ❌ AUDITORIA TERMINOU COM ERROS' : '  ✅ AUDITORIA OK — tudo funcionando');
  console.log('═══════════════════════════════════════');
})();

// scripts/setup_db.js
// Executa os 3 scripts SQL contra o Postgres do Supabase (via DATABASE_URL no .env).
// Uso: npm run setup-db
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não encontrada no .env');
  process.exit(1);
}

const SCRIPTS = [
  '001_schema.sql',
  '002_rls.sql',
  '003_seed_jogadores.sql',
  '004_extras_e_realtime.sql',
  '005_mestre_e_rls_restrito.sql',
  '006_profiles_seed.sql',
  '007_personagem_ativo_e_decimais.sql',
  '008_ficha_completa.sql',
];

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Conectando ao Postgres…');
    await client.connect();
    console.log('✓ Conectado\n');

    for (const arquivo of SCRIPTS) {
      const sqlPath = path.join(__dirname, '..', 'sql', arquivo);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      process.stdout.write(`Rodando ${arquivo}… `);
      try {
        await client.query(sql);
        console.log('✓');
      } catch (err) {
        console.log('✗');
        console.error('   →', err.message);
        throw err;
      }
    }

    console.log('\n─── Verificação ───');

    const { rows: tabelas } = await client.query(`
      select table_name from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `);
    console.log('Tabelas em public:', tabelas.map(t => t.table_name).join(', ') || '(nenhuma)');

    const { rows: jogadores } = await client.query(`
      select email, raw_user_meta_data->>'nome' as nome
      from auth.users
      where email like '%@mesa.local'
      order by email
    `);
    console.log('Jogadores cadastrados:', jogadores.length);
    jogadores.forEach(j => console.log(`  • ${j.nome} (${j.email})`));

    const { rows: policies } = await client.query(`
      select tablename, count(*) as n
      from pg_policies
      where schemaname = 'public'
      group by tablename
      order by tablename
    `);
    console.log('RLS policies:', policies.map(p => `${p.tablename}=${p.n}`).join(', ') || '(nenhuma)');

    console.log('\n✓ Setup concluído com sucesso');
  } catch (err) {
    console.error('\n❌ Falha:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();

// scripts/rotacionar_senha_mestre.js
// Gera uma senha nova e forte só para a conta do Mestre (mestre123@mesa.local)
// e grava direto no Supabase Auth via DATABASE_URL — nunca fica commitada em
// nenhum arquivo do repositório. Rode de novo sempre que quiser trocar a senha.
//
// Uso: npm run rotacionar-senha-mestre
//
// Contexto: os 4 jogadores compartilham uma senha fixa (login por nome, sem
// digitar nada — conveniência combinada para uma mesa privada de amigos).
// O Mestre é diferente: tem acesso a tudo (fichas, segredos de campanha,
// pode apagar dado de qualquer jogador), então precisa de uma senha própria,
// real, que só quem a está lendo agora conhece.
require('dotenv').config();
const crypto = require('crypto');
const { Client } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não encontrada no .env');
  process.exit(1);
}

function gerarSenha() {
  // 4 grupos de 4 caracteres alfanuméricos (sem símbolos ambíguos tipo 0/O, 1/l/I),
  // fácil de digitar/ler em voz alta na mesa, difícil de adivinhar.
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const grupo = () => Array.from({ length: 4 }, () => alfabeto[crypto.randomInt(alfabeto.length)]).join('');
  return `${grupo()}-${grupo()}-${grupo()}`;
}

(async () => {
  const senha = gerarSenha();
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const { rowCount } = await client.query(
      `update auth.users
         set encrypted_password = crypt($1, gen_salt('bf')),
             updated_at = now()
       where email = 'mestre123@mesa.local'`,
      [senha]
    );
    if (!rowCount) {
      console.error('❌ Conta mestre123@mesa.local não encontrada — rode "npm run setup-db" primeiro.');
      process.exitCode = 1;
      return;
    }
    console.log('✓ Senha do Mestre atualizada.\n');
    console.log('  Nova senha:', senha);
    console.log('\n  Guarde em local seguro (gerenciador de senhas). Ela NÃO fica salva em');
    console.log('  nenhum arquivo do projeto — só existe aqui e no banco.');
  } catch (err) {
    console.error('❌ Falha:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();

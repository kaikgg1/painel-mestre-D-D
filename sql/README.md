# Scripts SQL — Setup do Supabase

Estes scripts criam o schema do banco para o Painel do Mestre.

## Como rodar (escolha um dos dois caminhos)

### Caminho A — Automático (Recomendado)

Requer `.env` na raiz do projeto com `DATABASE_URL` apontando pro Postgres do Supabase.

```bash
npm install
npm run setup-db
```

O script `scripts/setup_db.js` roda os 3 SQLs em ordem e mostra um resumo (tabelas criadas, jogadores cadastrados, policies de RLS).

### Caminho B — Manual via SQL Editor

1. Abra o **SQL Editor** do seu projeto Supabase:
   https://supabase.com/dashboard/project/ehbngkmxwsjxuetjnztz/sql

2. Rode na ordem (um por vez, do mesmo modo: copia, cola, **RUN**):

   | # | Arquivo | O que faz |
   |---|---|---|
   | 1 | [`001_schema.sql`](001_schema.sql) | Cria tabelas `profiles`, `characters`, `spell_lists` + triggers |
   | 2 | [`002_rls.sql`](002_rls.sql) | Habilita Row Level Security e cria policies |
   | 3 | [`003_seed_jogadores.sql`](003_seed_jogadores.sql) | Cria as 3 contas: Sabrina, Derick, Felipe |

3. No final do **003**, deve aparecer um resultado mostrando os 3 jogadores criados.

## Login dos jogadores

Após rodar o seed, os 3 jogadores podem logar com:

| Nome (no front) | Email (interno) | Senha (compartilhada) |
|---|---|---|
| Sabrina | sabrina123@mesa.local | mesa-dnd-5e |
| Derick  | derik123@mesa.local   | mesa-dnd-5e |
| Felipe  | felipe123@mesa.local  | mesa-dnd-5e |

O front-end mostra apenas o dropdown de nomes — a senha é preenchida automaticamente pelo JavaScript.

## Resetar e recomeçar

Se precisar zerar e refazer:

```sql
-- ⚠️ Apaga TUDO: fichas, listas de magias, contas de jogadores
drop table if exists public.spell_lists cascade;
drop table if exists public.characters cascade;
drop table if exists public.profiles cascade;
delete from auth.users where email like '%@mesa.local';
```

Depois rode os 3 scripts de novo, em ordem.

## Adicionar um 4º jogador

Edite `003_seed_jogadores.sql` copiando um dos blocos `if not exists`, troque o email e o nome, e rode só essa parte.

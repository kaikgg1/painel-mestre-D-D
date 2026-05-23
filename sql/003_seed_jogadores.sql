-- ═══════════════════════════════════════════════════════════════════
-- Seed dos 3 jogadores fixos
-- Cria 3 usuários em auth.users com email-fake + senha padrão.
-- O front-end mostra um dropdown com os nomes, e a "senha" é hardcoded
-- no JS (não é segurança real — segurança vem do RLS + projeto privado).
--
-- ⚠️ Rodar APÓS 001_schema.sql e 002_rls.sql
-- ⚠️ Este script usa funções de admin: rodar via SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════════════

-- Senha compartilhada (qualquer string fixa serve — segurança real vem do RLS)
do $$
declare
  v_senha text := 'mesa-dnd-5e';
begin
  -- ── Sabrina123 ──────────────────────────────────────────────────
  if not exists (select 1 from auth.users where email = 'sabrina123@mesa.local') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated',
      'sabrina123@mesa.local',
      crypt(v_senha, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nome":"Sabrina123"}'::jsonb,
      now(), now(), '', '', '', ''
    );
  end if;

  -- ── Derik123 ────────────────────────────────────────────────────
  if not exists (select 1 from auth.users where email = 'derik123@mesa.local') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated',
      'derik123@mesa.local',
      crypt(v_senha, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nome":"Derik123"}'::jsonb,
      now(), now(), '', '', '', ''
    );
  end if;

  -- ── Felipe123 ───────────────────────────────────────────────────
  if not exists (select 1 from auth.users where email = 'felipe123@mesa.local') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated',
      'felipe123@mesa.local',
      crypt(v_senha, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nome":"Felipe123"}'::jsonb,
      now(), now(), '', '', '', ''
    );
  end if;
end $$;

-- Confere se foi tudo certo
select id, email, raw_user_meta_data->>'nome' as nome
from auth.users
where email like '%@mesa.local'
order by email;

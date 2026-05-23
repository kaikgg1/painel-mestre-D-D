-- ═══════════════════════════════════════════════════════════════════
-- Adiciona o usuário Mestre + restringe RLS
--   - Jogadores: só VEEM e EDITAM os próprios personagens/listas
--   - Mestre (Mestre123@mesa.local): VÊ e EDITA tudo
-- Rodar APÓS 001..004
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Função is_mestre() — checa se o usuário atual é o mestre ────
create or replace function public.is_mestre()
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and email = 'mestre123@mesa.local'
  );
$$;

comment on function public.is_mestre() is 'True se auth.uid() é o Mestre da mesa';

-- ── 2. Seed do Mestre123 ────────────────────────────────────────────
do $$
declare v_senha text := 'mesa-dnd-5e';
begin
  if not exists (select 1 from auth.users where email = 'mestre123@mesa.local') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated',
      'mestre123@mesa.local',
      crypt(v_senha, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nome":"Mestre123","is_mestre":true}'::jsonb,
      now(), now(), '', '', '', ''
    );
  end if;
end $$;

-- ── 3. RLS restrito ─────────────────────────────────────────────────
-- profiles: todos autenticados ainda veem (precisa ver nome dos outros)
-- characters: dono OU mestre
-- spell_lists: dono OU mestre

-- ── characters ────────────────────────────────────────────────────
drop policy if exists "characters_select_all"   on public.characters;
drop policy if exists "characters_select_own"   on public.characters;
drop policy if exists "characters_insert_own"   on public.characters;
drop policy if exists "characters_update_own"   on public.characters;
drop policy if exists "characters_delete_own"   on public.characters;
drop policy if exists "characters_select"       on public.characters;
drop policy if exists "characters_insert"       on public.characters;
drop policy if exists "characters_update"       on public.characters;
drop policy if exists "characters_delete"       on public.characters;

create policy "characters_select" on public.characters
  for select to authenticated
  using (auth.uid() = user_id or public.is_mestre());

create policy "characters_insert" on public.characters
  for insert to authenticated
  with check (auth.uid() = user_id or public.is_mestre());

create policy "characters_update" on public.characters
  for update to authenticated
  using (auth.uid() = user_id or public.is_mestre());

create policy "characters_delete" on public.characters
  for delete to authenticated
  using (auth.uid() = user_id or public.is_mestre());

-- ── spell_lists ───────────────────────────────────────────────────
drop policy if exists "spell_lists_select_all"  on public.spell_lists;
drop policy if exists "spell_lists_select_own"  on public.spell_lists;
drop policy if exists "spell_lists_insert_own"  on public.spell_lists;
drop policy if exists "spell_lists_update_own"  on public.spell_lists;
drop policy if exists "spell_lists_delete_own"  on public.spell_lists;
drop policy if exists "spell_lists_select"      on public.spell_lists;
drop policy if exists "spell_lists_insert"      on public.spell_lists;
drop policy if exists "spell_lists_update"      on public.spell_lists;
drop policy if exists "spell_lists_delete"      on public.spell_lists;

create policy "spell_lists_select" on public.spell_lists
  for select to authenticated
  using (auth.uid() = user_id or public.is_mestre());

create policy "spell_lists_insert" on public.spell_lists
  for insert to authenticated
  with check (auth.uid() = user_id or public.is_mestre());

create policy "spell_lists_update" on public.spell_lists
  for update to authenticated
  using (auth.uid() = user_id or public.is_mestre());

create policy "spell_lists_delete" on public.spell_lists
  for delete to authenticated
  using (auth.uid() = user_id or public.is_mestre());

-- ── Verificação ─────────────────────────────────────────────────────
select 'Mestre criado: ' || (raw_user_meta_data->>'nome') as resultado
from auth.users where email = 'mestre123@mesa.local';

select tablename, policyname from pg_policies
where schemaname = 'public' order by tablename, policyname;

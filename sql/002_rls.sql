-- ═══════════════════════════════════════════════════════════════════
-- Row Level Security — quem pode ler/escrever o quê
-- Rodar APÓS 001_schema.sql
-- ═══════════════════════════════════════════════════════════════════

-- Habilita RLS em todas as tabelas (sem isso, qualquer um lê tudo via anon key)
alter table public.profiles    enable row level security;
alter table public.characters  enable row level security;
alter table public.spell_lists enable row level security;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ PROFILES                                                         │
-- │   Visíveis a todos os logados (jogadores se reconhecem)        │
-- │   Cada um edita só o próprio                                    │
-- └─────────────────────────────────────────────────────────────────┘
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id);

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ CHARACTERS                                                       │
-- │   Visíveis a todos os logados (mestre + jogadores se veem)     │
-- │   Cada um cria/edita/deleta só os próprios                      │
-- └─────────────────────────────────────────────────────────────────┘
drop policy if exists "characters_select_all" on public.characters;
create policy "characters_select_all" on public.characters
  for select to authenticated
  using (true);

drop policy if exists "characters_insert_own" on public.characters;
create policy "characters_insert_own" on public.characters
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "characters_update_own" on public.characters;
create policy "characters_update_own" on public.characters
  for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "characters_delete_own" on public.characters;
create policy "characters_delete_own" on public.characters
  for delete to authenticated
  using (auth.uid() = user_id);

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ SPELL_LISTS                                                      │
-- │   Visíveis a todos os logados (mestre vê o que cada um prepara) │
-- │   Cada um cria/edita/deleta só as próprias                      │
-- └─────────────────────────────────────────────────────────────────┘
drop policy if exists "spell_lists_select_all" on public.spell_lists;
create policy "spell_lists_select_all" on public.spell_lists
  for select to authenticated
  using (true);

drop policy if exists "spell_lists_insert_own" on public.spell_lists;
create policy "spell_lists_insert_own" on public.spell_lists
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "spell_lists_update_own" on public.spell_lists;
create policy "spell_lists_update_own" on public.spell_lists
  for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "spell_lists_delete_own" on public.spell_lists;
create policy "spell_lists_delete_own" on public.spell_lists
  for delete to authenticated
  using (auth.uid() = user_id);

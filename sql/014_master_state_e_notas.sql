-- ═══════════════════════════════════════════════════════════════════
-- Tabelas usadas exclusivamente pelo Mestre:
--   • master_state  → estado livre por chave (ex.: 'vilao:strahd')
--   • master_notes  → anotações dos jogadores em timeline (data + categoria)
-- ═══════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ master_state — key/value JSONB scoped por user                  │
-- │   Usado para: ficha de vilão (HP, slots, condições, notas)      │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.master_state (
  user_id    uuid not null references auth.users on delete cascade,
  chave      text not null,
  dados      jsonb default '{}'::jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, chave)
);

comment on table public.master_state is 'Estado livre do mestre (vilões, trackers, etc.) — key/value por usuário';
comment on column public.master_state.chave is 'Identificador único, ex.: "vilao:strahd"';

drop trigger if exists master_state_updated_at on public.master_state;
create trigger master_state_updated_at
  before update on public.master_state
  for each row execute function public.update_updated_at();

alter table public.master_state enable row level security;

-- Só o próprio usuário lê/escreve. (Cada mestre tem seu próprio estado.)
drop policy if exists "master_state_select_own" on public.master_state;
create policy "master_state_select_own" on public.master_state
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "master_state_insert_own" on public.master_state;
create policy "master_state_insert_own" on public.master_state
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "master_state_update_own" on public.master_state;
create policy "master_state_update_own" on public.master_state
  for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "master_state_delete_own" on public.master_state;
create policy "master_state_delete_own" on public.master_state
  for delete to authenticated
  using (auth.uid() = user_id);

-- Realtime (para sincronizar entre dispositivos do mestre)
alter publication supabase_realtime add table public.master_state;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ master_notes — anotações do mestre por personagem               │
-- │   Timeline: data + categoria + texto                             │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.master_notes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,  -- mestre que criou
  character_id  uuid not null references public.characters on delete cascade,

  categoria     text not null default 'historia'
                check (categoria in ('historia','equipamento','npc','segredo','decisao','loot','outro')),
  texto         text not null,
  data_ref      date default current_date,   -- data da sessão (editável)

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_master_notes_char on public.master_notes(character_id, data_ref desc);
create index if not exists idx_master_notes_user on public.master_notes(user_id);

comment on table public.master_notes is 'Anotações timeline do mestre sobre cada personagem (PJ): história, equipamentos, NPCs, segredos, decisões, loot.';

drop trigger if exists master_notes_updated_at on public.master_notes;
create trigger master_notes_updated_at
  before update on public.master_notes
  for each row execute function public.update_updated_at();

alter table public.master_notes enable row level security;

-- Apenas o usuário mestre (autor) lê/edita suas notas. Jogadores NÃO veem.
drop policy if exists "master_notes_select_own" on public.master_notes;
create policy "master_notes_select_own" on public.master_notes
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "master_notes_insert_own" on public.master_notes;
create policy "master_notes_insert_own" on public.master_notes
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "master_notes_update_own" on public.master_notes;
create policy "master_notes_update_own" on public.master_notes
  for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "master_notes_delete_own" on public.master_notes;
create policy "master_notes_delete_own" on public.master_notes
  for delete to authenticated
  using (auth.uid() = user_id);

alter publication supabase_realtime add table public.master_notes;

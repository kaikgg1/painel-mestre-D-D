-- ═══════════════════════════════════════════════════════════════════
-- Schema MVP1 + MVP2: Painel do Mestre D&D 5e
-- Auth: "só nome" — 3 jogadores criados em 003_seed.sql
-- Rodar no SQL Editor do Supabase: https://supabase.com/dashboard/project/ehbngkmxwsjxuetjnztz/sql
-- ═══════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ profiles — extensão de auth.users com nome amigável            │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  nome        text unique not null,
  avatar_url  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

comment on table public.profiles is 'Perfil amigável de cada jogador (nome de exibição)';

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ characters — ficha do personagem                                │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.characters (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,

  -- Identidade
  nome         text not null,
  raca         text,
  classe       text,
  subclasse    text,
  nivel        int default 1 check (nivel between 1 and 20),
  origem       text,
  alinhamento  text,

  -- Atributos (jsonb por flexibilidade)
  atributos    jsonb default '{"for":10,"dex":10,"con":10,"int":10,"sab":10,"car":10}'::jsonb,

  -- Combate
  hp_max           int default 10 check (hp_max >= 0),
  hp_atual         int default 10,
  hp_temp          int default 0 check (hp_temp >= 0),
  ca               int default 10,
  iniciativa_bonus int default 0,
  deslocamento     int default 9,
  dado_vida_tipo   int default 8 check (dado_vida_tipo in (6, 8, 10, 12)),
  dado_vida_atual  int default 1,

  -- Magia (slots por nível: {"1":{"max":4,"used":0}, "2":{"max":2,"used":0}, ...})
  slots_magia      jsonb default '{}'::jsonb,

  -- Estado de mesa
  condicoes        text[] default '{}',
  exaustao         int    default 0 check (exaustao between 0 and 6),
  inspiracao       boolean default false,

  -- Roleplay
  tracos_pessoais  text,
  ideais           text,
  vinculos         text,
  defeitos         text,
  historia         text,
  notas            text,

  -- Visual
  imagem_url       text,
  cor_destaque     text default '#8B6914',

  -- Meta
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists idx_characters_user on public.characters(user_id);

comment on table public.characters is 'Ficha completa de personagem D&D 5e';
comment on column public.characters.slots_magia is 'JSON: {"<nivel>":{"max":<int>,"used":<int>}}';
comment on column public.characters.atributos is 'JSON: {"for":<int>,"dex":<int>,"con":<int>,"int":<int>,"sab":<int>,"car":<int>}';

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ spell_lists — listas de magias por personagem                  │
-- │ (favoritas, preparadas, conhecidas, etc.)                       │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.spell_lists (
  id            uuid primary key default gen_random_uuid(),
  character_id  uuid not null references public.characters on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,

  nome          text not null default 'Favoritas',
  spell_names   text[] default '{}',

  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),

  unique(character_id, nome)
);

create index if not exists idx_spell_lists_char on public.spell_lists(character_id);
create index if not exists idx_spell_lists_user on public.spell_lists(user_id);

comment on table public.spell_lists is 'Listas nomeadas de magias por personagem (PT-BR igual ao data/magias_data.json)';

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ Triggers — atualiza updated_at automaticamente                  │
-- └─────────────────────────────────────────────────────────────────┘
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

drop trigger if exists characters_updated_at on public.characters;
create trigger characters_updated_at
  before update on public.characters
  for each row execute function public.update_updated_at();

drop trigger if exists spell_lists_updated_at on public.spell_lists;
create trigger spell_lists_updated_at
  before update on public.spell_lists
  for each row execute function public.update_updated_at();

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ Trigger — auto-cria profile quando user é criado em auth.users │
-- └─────────────────────────────────────────────────────────────────┘
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'nome',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

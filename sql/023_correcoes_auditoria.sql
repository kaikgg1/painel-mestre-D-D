-- ═══════════════════════════════════════════════════════════════════
-- Correções da auditoria técnica (bugs reais + segurança + integridade)
-- Idempotente — pode rodar quantas vezes for preciso.
-- ═══════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 1) master_notes NÃO deve ser apagado quando o JOGADOR apaga a   │
-- │    própria ficha — hoje é ON DELETE CASCADE, destruindo em      │
-- │    silêncio as anotações PRIVADAS do Mestre sobre aquele PJ.    │
-- │    Troca pra ON DELETE SET NULL + snapshot do nome/campanha,    │
-- │    pra manter contexto e continuar satisfazendo a constraint    │
-- │    master_notes_target_chk (character_id OU campanha presente). │
-- └─────────────────────────────────────────────────────────────────┘
alter table public.master_notes
  add column if not exists personagem_nome text;

comment on column public.master_notes.personagem_nome is
  'Snapshot do nome do personagem no momento em que ele foi apagado (character_id vira null). Preenchido automaticamente pelo trigger characters_before_delete_snapshot.';

create or replace function public.snapshot_antes_de_apagar_personagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.master_notes
     set personagem_nome = coalesce(personagem_nome, old.nome),
         campanha        = coalesce(campanha, old.campanha)
   where character_id = old.id;
  return old;
end;
$$;

comment on function public.snapshot_antes_de_apagar_personagem() is
  'Antes de um personagem ser apagado, salva seu nome e campanha nas anotações do Mestre que apontam pra ele, pra não perder contexto quando o FK virar null.';

drop trigger if exists characters_before_delete_snapshot on public.characters;
create trigger characters_before_delete_snapshot
  before delete on public.characters
  for each row execute function public.snapshot_antes_de_apagar_personagem();

alter table public.master_notes
  drop constraint if exists master_notes_character_id_fkey;
alter table public.master_notes
  add constraint master_notes_character_id_fkey
  foreign key (character_id) references public.characters(id) on delete set null;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2) Funções SECURITY DEFINER sem search_path fixo (aviso padrão  │
-- │    do Supabase Security Advisor). set_updated_by() nem precisa  │
-- │    ser SECURITY DEFINER — só grava na própria linha que a RLS   │
-- │    já autoriza.                                                  │
-- └─────────────────────────────────────────────────────────────────┘
create or replace function public.is_mestre()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and email = 'mestre123@mesa.local'
  );
$$;

create or replace function public.set_updated_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
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
$$;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 3) "campanha" é texto livre — um typo de maiúscula/minúscula     │
-- │    ("Barovia" vs "barovia") faz a ficha/nota sumir em silêncio   │
-- │    dos filtros do painel. Trava tudo em minúsculas.              │
-- └─────────────────────────────────────────────────────────────────┘
update public.characters   set campanha = lower(campanha) where campanha is not null and campanha <> lower(campanha);
update public.master_notes set campanha = lower(campanha) where campanha is not null and campanha <> lower(campanha);

alter table public.characters
  drop constraint if exists characters_campanha_chk;
alter table public.characters
  add constraint characters_campanha_chk check (campanha = lower(campanha));

alter table public.master_notes
  drop constraint if exists master_notes_campanha_chk;
alter table public.master_notes
  add constraint master_notes_campanha_chk check (campanha = lower(campanha));

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 4) hp_atual e ca aceitavam qualquer inteiro (diferente de       │
-- │    hp_max/hp_temp/exaustao/nivel, que já têm CHECK).             │
-- └─────────────────────────────────────────────────────────────────┘
alter table public.characters
  drop constraint if exists characters_hp_atual_chk;
alter table public.characters
  add constraint characters_hp_atual_chk check (hp_atual >= -100);

alter table public.characters
  drop constraint if exists characters_ca_chk;
alter table public.characters
  add constraint characters_ca_chk check (ca >= 0);

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 5) Índice composto pra carga do painel filtrando por campanha + │
-- │    ativo (padrão de query mais comum nos painéis do Mestre).    │
-- └─────────────────────────────────────────────────────────────────┘
create index if not exists idx_characters_campanha_ativo
  on public.characters(campanha, is_active)
  where is_active = true;

-- ── Verificação ─────────────────────────────────────────────────────
select conname from pg_constraint
where conrelid = 'public.characters'::regclass
  and conname in ('characters_campanha_chk','characters_hp_atual_chk','characters_ca_chk');

select conname from pg_constraint
where conrelid = 'public.master_notes'::regclass
  and conname in ('master_notes_character_id_fkey','master_notes_campanha_chk');

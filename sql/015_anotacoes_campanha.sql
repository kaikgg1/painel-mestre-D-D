-- ═══════════════════════════════════════════════════════════════════
-- Estende master_notes para suportar anotações da CAMPANHA
-- (não vinculadas a um personagem específico).
--
-- character_id agora pode ser NULL.
-- campanha (text) identifica a campanha quando character_id é NULL.
-- Valores típicos: 'mestre' (Crônica dos Aventureiros) ou 'barovia'.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Permite character_id NULL
alter table public.master_notes
  alter column character_id drop not null;

-- 2) Adiciona coluna campanha
alter table public.master_notes
  add column if not exists campanha text;

-- 3) Garante que toda anotação tenha um alvo: PJ OU campanha
alter table public.master_notes
  drop constraint if exists master_notes_target_chk;
alter table public.master_notes
  add constraint master_notes_target_chk
  check (character_id is not null or campanha is not null);

-- 4) Índice pra lookup rápido por campanha
create index if not exists idx_master_notes_campanha
  on public.master_notes(user_id, campanha, data_ref desc)
  where character_id is null;

comment on column public.master_notes.campanha is
  'Identificador da campanha quando a nota é geral (sem PJ). Ex.: "mestre", "barovia".';

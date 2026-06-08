-- ═══════════════════════════════════════════════════════════════════
-- Criaturas favoritas do bestiário, por personagem.
-- Cada PJ tem sua lista de nomes favoritados (atalho rápido na aba Aliados).
-- ═══════════════════════════════════════════════════════════════════

alter table public.characters
  add column if not exists bestiario_favoritos jsonb default '[]'::jsonb;

comment on column public.characters.bestiario_favoritos is
  'Nomes de criaturas do Manual dos Monstros favoritadas por este personagem (atalho na aba Aliados).';

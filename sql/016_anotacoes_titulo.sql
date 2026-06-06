-- ═══════════════════════════════════════════════════════════════════
-- Adiciona campo 'titulo' opcional em master_notes.
-- Útil pra dar nome a NPCs, eventos, loot, decisões, etc.
-- ═══════════════════════════════════════════════════════════════════

alter table public.master_notes
  add column if not exists titulo text;

comment on column public.master_notes.titulo is
  'Título/cabeçalho opcional da anotação. Ex.: nome do NPC, nome do item, evento.';

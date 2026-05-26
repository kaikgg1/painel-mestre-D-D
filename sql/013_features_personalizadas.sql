-- ═══════════════════════════════════════════════════════════════════
-- Features personalizadas adicionadas pelo jogador
-- ═══════════════════════════════════════════════════════════════════
-- Cada entrada: { "id": "uuid", "nome": "...", "desc": "...", "max": N, "nivel": N? }
-- Renderizada na aba Habilidades junto com as do catálogo.

alter table public.characters
  add column if not exists features_personalizadas jsonb not null default '[]'::jsonb;

update public.characters
  set features_personalizadas = '[]'::jsonb
  where features_personalizadas is null;

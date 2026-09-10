-- ═══════════════════════════════════════════════════════════════════
-- Habilidades favoritadas, por personagem (Fase 5 do redesign da ficha).
-- Cada PJ tem sua lista de slugs de habilidade (de classe ou personalizada)
-- favoritados — aparecem em destaque na aba Habilidades e num atalho no
-- Resumo. Mesmo padrão de bestiario_favoritos (019): array de identificadores
-- em vez de duplicar o conteúdo da habilidade.
--
-- A ficha funciona mesmo ANTES desta migration rodar: favoritar degrada
-- pra "só nesta sessão" (guarda local, não persiste) se a coluna ainda não
-- existir — não é um pré-requisito bloqueante.
-- ═══════════════════════════════════════════════════════════════════

alter table public.characters
  add column if not exists habilidades_favoritas jsonb default '[]'::jsonb;

comment on column public.characters.habilidades_favoritas is
  'Slugs de habilidades (de classe ou personalizadas) favoritadas por este personagem — atalho na aba Habilidades e no Resumo.';

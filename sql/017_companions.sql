-- ═══════════════════════════════════════════════════════════════════
-- Criaturas/NPCs controlados por um personagem (companheiros, invocações,
-- familiares, golems, etc.). Cada PJ pode ter vários.
--
-- Armazenado como array jsonb na própria characters (controlado pelo dono).
-- Estrutura de cada item:
--   { id, nome, tipo, ca, hp_max, hp_atual, deslocamento,
--     atributos:{for,dex,con,int,sab,car}, resistencias, imunidades,
--     sentidos, idiomas, nd, tracos:[{nome,desc}], acoes:[{nome,desc}], notas }
-- ═══════════════════════════════════════════════════════════════════

alter table public.characters
  add column if not exists companions jsonb default '[]'::jsonb;

comment on column public.characters.companions is
  'Criaturas/NPCs controladas pelo personagem (invocações, familiares, golems). Array jsonb.';

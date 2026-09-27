-- ═══════════════════════════════════════════════════════════════════
-- Assistente de subida de nível (assets/js/ficha/subida_nivel.js).
-- nivel_escolhas = {
--   "ultimoNivelProcessado": <nível cujas escolhas o jogador já concluiu>,
--   "historico": { "<nível>": { "em": <iso>, "subclasse"?, "asi"?: {"for":2}, ... } }
-- }
-- Quando characters.nivel > ultimoNivelProcessado, a ficha do jogador abre a
-- caixa do nível seguinte. O backfill marca o nível atual de todo mundo como
-- já processado, pra ninguém receber caixa retroativa dos níveis antigos.
-- ═══════════════════════════════════════════════════════════════════

alter table public.characters
  add column if not exists nivel_escolhas jsonb;

update public.characters
set nivel_escolhas = jsonb_build_object('ultimoNivelProcessado', coalesce(nivel, 1), 'historico', '{}'::jsonb)
where nivel_escolhas is null;

alter table public.characters
  alter column nivel_escolhas set default '{"ultimoNivelProcessado": 1, "historico": {}}'::jsonb;

comment on column public.characters.nivel_escolhas is
  'Subida de nível: último nível com escolhas concluídas + histórico do que foi escolhido em cada nível (assets/js/ficha/subida_nivel.js).';

-- ═══════════════════════════════════════════════════════════════════
-- Colunas novas usadas pelo painel do Mestre (redesign): percepção
-- passiva, CD/bônus de ataque de magia e concentração ativa.
-- Sem isso esses campos existiam só na tela (não sincronizavam nem
-- sobreviviam a um reload/realtime — cada cliente via um valor diferente).
-- ═══════════════════════════════════════════════════════════════════

alter table public.characters
  add column if not exists percepcao_passiva integer default 10;

alter table public.characters
  add column if not exists spell_dc integer;

alter table public.characters
  add column if not exists spell_atk integer;

alter table public.characters
  add column if not exists concentracao jsonb default '{"ativa":false,"magia":""}'::jsonb;

-- Verificação
select column_name, data_type, column_default
from information_schema.columns
where table_schema='public' and table_name='characters'
  and column_name in ('percepcao_passiva','spell_dc','spell_atk','concentracao')
order by column_name;

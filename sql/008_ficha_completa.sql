-- ═══════════════════════════════════════════════════════════════════
-- Campos adicionais para ficha completa (PHB 5e)
-- ═══════════════════════════════════════════════════════════════════

alter table public.characters
  add column if not exists xp                  int     default 0,
  add column if not exists idiomas             text[]  default '{}',
  add column if not exists ferramentas         text[]  default '{}',
  add column if not exists tracos_raciais      text,
  add column if not exists pericias            jsonb   default '{}'::jsonb,
  -- {"acrobacia":{"prof":true,"exp":false}, "atletismo":{"prof":false}}
  add column if not exists salvaguardas        jsonb   default '{}'::jsonb,
  -- {"for":true,"dex":false,"con":true,...}
  add column if not exists truques_conhecidos  int     default 0,
  add column if not exists magias_conhecidas   int     default 0,
  add column if not exists cd_resistencia      int     default 8,
  add column if not exists bonus_atq_magia     int     default 0,
  add column if not exists caracteristicas_adicionais text;

-- Verificação
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='characters'
  and column_name in ('xp','idiomas','ferramentas','tracos_raciais','pericias',
                      'salvaguardas','truques_conhecidos','magias_conhecidas',
                      'cd_resistencia','bonus_atq_magia','caracteristicas_adicionais')
order by column_name;

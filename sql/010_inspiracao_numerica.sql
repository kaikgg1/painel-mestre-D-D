-- ═══════════════════════════════════════════════════════════════════
-- inspiracao: boolean → integer (quantidade de inspirações)
-- Converte true=1 / false=0 dos dados existentes.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='characters'
      and column_name='inspiracao' and data_type='boolean'
  ) then
    alter table public.characters
      alter column inspiracao drop default;
    alter table public.characters
      alter column inspiracao type integer
      using (case when inspiracao then 1 else 0 end);
    alter table public.characters
      alter column inspiracao set default 0;
  end if;
end $$;

select column_name, data_type, column_default
from information_schema.columns
where table_schema='public' and table_name='characters' and column_name='inspiracao';

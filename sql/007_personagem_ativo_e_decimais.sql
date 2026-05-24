-- ═══════════════════════════════════════════════════════════════════
-- Personagem ativo + valores decimais
-- ═══════════════════════════════════════════════════════════════════

-- 1. Coluna is_active: marca qual PJ aparece no painel do mestre
alter table public.characters
  add column if not exists is_active boolean default false;

-- 2. deslocamento aceita decimais (10,5m por ex.)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='characters'
      and column_name='deslocamento' and data_type='integer'
  ) then
    alter table public.characters alter column deslocamento type numeric(5,2) using deslocamento::numeric;
  end if;
end $$;

-- 3. Coluna inventory (jsonb) - armas, armaduras, itens, dinheiro
alter table public.characters
  add column if not exists inventario jsonb default '{
    "moedas":{"po":0,"pp":0,"pe":0,"pc":0,"pl":0},
    "armas":[],
    "armaduras":[],
    "itens":[]
  }'::jsonb;

-- 4. Habilidades de classe (jsonb, preenchidas automaticamente)
alter table public.characters
  add column if not exists habilidades_classe jsonb default '[]'::jsonb;

-- 5. Garante que cada usuário tenha NO MÁXIMO 1 ativo por vez (constraint via trigger)
create or replace function public.garantir_um_ativo_por_usuario()
returns trigger as $$
begin
  if new.is_active = true then
    update public.characters
      set is_active = false
      where user_id = new.user_id
        and id <> new.id
        and is_active = true;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists characters_um_ativo on public.characters;
create trigger characters_um_ativo
  before insert or update of is_active on public.characters
  for each row execute function public.garantir_um_ativo_por_usuario();

-- Verificação
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='characters'
  and column_name in ('is_active','deslocamento','inventario','habilidades_classe')
order by column_name;

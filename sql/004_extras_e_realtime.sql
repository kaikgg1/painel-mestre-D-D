-- ═══════════════════════════════════════════════════════════════════
-- Colunas adicionais para os painéis + habilita Realtime
-- Rodar APÓS 001/002/003 (idempotente)
-- ═══════════════════════════════════════════════════════════════════

-- Salvaguardas de morte (0–3 sucessos e falhas)
alter table public.characters
  add column if not exists morte_sucessos int default 0 check (morte_sucessos between 0 and 3);
alter table public.characters
  add column if not exists morte_falhas int default 0 check (morte_falhas between 0 and 3);

-- Qual campanha (ex.: 'mestre', 'barovia') — null = sem campanha
alter table public.characters
  add column if not exists campanha text;

-- Texto livre de "magias preparadas / conhecidas" (compatibilidade com painéis)
alter table public.characters
  add column if not exists magias_preparadas text;

-- Habilita Realtime para as tabelas que o front escuta
do $$
begin
  -- characters
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'characters'
  ) then
    execute 'alter publication supabase_realtime add table public.characters';
  end if;

  -- spell_lists
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spell_lists'
  ) then
    execute 'alter publication supabase_realtime add table public.spell_lists';
  end if;
end $$;

-- Verificação
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;

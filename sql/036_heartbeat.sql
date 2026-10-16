-- ═══════════════════════════════════════════════════════════════════
-- Heartbeat — mantém o projeto Supabase (plano free) acordado
--
-- O plano free pausa o projeto depois de ~7 dias "sem atividade". O ping
-- antigo do GitHub Actions (um SELECT via REST a cada 3 dias) rodou com
-- sucesso em 07/10 e 10/10 e mesmo assim o projeto foi pausado antes de
-- 13/10 — ou seja, leitura via REST não bastou.
--
-- Agora o workflow chama a RPC public.ping(), que faz uma ESCRITA real
-- (UPDATE numa tabela de uma linha só). A anon key pode executar a função,
-- mas não enxerga nem altera a tabela diretamente: RLS ligado sem nenhuma
-- policy, e a função é SECURITY DEFINER.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.heartbeat (
  id          int primary key default 1 check (id = 1),
  batidas     bigint      not null default 0,
  ultima_em   timestamptz not null default now()
);

alter table public.heartbeat enable row level security;

insert into public.heartbeat (id) values (1) on conflict (id) do nothing;

create or replace function public.ping()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update public.heartbeat
     set batidas = batidas + 1, ultima_em = now()
   where id = 1
  returning ultima_em;
$$;

comment on function public.ping() is
  'Keep-alive do plano free: grava em public.heartbeat. Chamado pelo workflow .github/workflows/manter-supabase-ativo.yml.';

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

-- ── Verificação ─────────────────────────────────────────────────────
select * from public.heartbeat;

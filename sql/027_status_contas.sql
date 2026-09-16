-- ═══════════════════════════════════════════════════════════════════
-- Status das contas: online = LOGADO (não "com a aba aberta")
--
-- A primeira versão disto usava só Realtime Presence, que responde
-- "quem está com o sistema aberto agora". Na prática o que o Mestre quer
-- saber é "quem está logado": o jogador entra, fecha a aba, continua
-- logado — e só some quando clica em Sair.
--
-- auth.sessions é exatamente isso: o Supabase cria a linha no login e
-- apaga no signOut(). Nesta instância not_after é null (sessão não expira
-- por tempo), então a presença de linha = conta logada.
--
-- Substitui listar_ultimo_login() (sql/026) — mesma ideia, mesma trava de
-- acesso (só o Mestre recebe linhas), com as colunas de sessão a mais.
-- ═══════════════════════════════════════════════════════════════════

drop function if exists public.listar_ultimo_login();
drop function if exists public.listar_status_contas();

create function public.listar_status_contas()
returns table (
  id uuid,
  nome text,
  email text,
  ultimo_login timestamptz,
  sessoes integer,
  ultima_atividade timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id,
    coalesce(p.nome, split_part(u.email, '@', 1)) as nome,
    u.email,
    u.last_sign_in_at as ultimo_login,
    count(s.id)::integer as sessoes,
    max(s.updated_at) as ultima_atividade
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join auth.sessions s on s.user_id = u.id
  where public.is_mestre()
  group by u.id, p.nome, u.email, u.last_sign_in_at
  order by count(s.id) desc, u.last_sign_in_at desc nulls last;
$$;

comment on function public.listar_status_contas() is
  'Status de cada conta: último login + nº de sessões ativas (auth.sessions = logado). Só retorna linhas pro Mestre.';

grant execute on function public.listar_status_contas() to authenticated;

-- ── Verificação ─────────────────────────────────────────────────────
select proname, pg_get_function_result(oid) as retorno
from pg_proc where proname = 'listar_status_contas';

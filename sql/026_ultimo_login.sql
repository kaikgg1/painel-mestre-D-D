-- ═══════════════════════════════════════════════════════════════════
-- Último login de cada conta (visível só pro Mestre)
--
-- O Supabase Auth já registra sozinho auth.users.last_sign_in_at a cada
-- login — não precisamos duplicar isso numa tabela nossa (evita log
-- desincronizado se algum dia o front esquecer de gravar). O problema é
-- que o schema `auth` não é exposto pro cliente (anon/authenticated) por
-- segurança, então o app não consegue ler last_sign_in_at direto via
-- window.sb.from(...).
--
-- Esta function SECURITY DEFINER expõe só o necessário (nome + e-mail +
-- último login + data de criação da conta) via RPC, e só devolve linhas
-- quando quem chama é o Mestre — pra qualquer outro usuário autenticado,
-- a função roda mas devolve 0 linhas (a checagem de public.is_mestre()
-- entra no WHERE, então não é um "erro de permissão" que vaze informação
-- nenhuma, só uma lista vazia).
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.listar_ultimo_login()
returns table (nome text, email text, ultimo_login timestamptz, criado_em timestamptz)
language sql
security definer
set search_path = public, auth
as $$
  select
    coalesce(p.nome, split_part(u.email, '@', 1)) as nome,
    u.email,
    u.last_sign_in_at as ultimo_login,
    u.created_at as criado_em
  from auth.users u
  left join public.profiles p on p.id = u.id
  where public.is_mestre()
  order by u.last_sign_in_at desc nulls last;
$$;

comment on function public.listar_ultimo_login() is
  'Último login de cada conta (auth.users.last_sign_in_at) — só retorna linhas se quem chama é o Mestre (public.is_mestre()).';

grant execute on function public.listar_ultimo_login() to authenticated;

-- ── Verificação ─────────────────────────────────────────────────────
select proname from pg_proc where proname = 'listar_ultimo_login';

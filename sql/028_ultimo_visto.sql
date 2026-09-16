-- ═══════════════════════════════════════════════════════════════════
-- "Visto por último" — timeout de inatividade feito por nós
--
-- Por quê: o timeout de inatividade nativo do Supabase (Authentication →
-- Sessions) só existe no plano Pro. Sem ele, auth.sessions só some quando
-- o jogador clica em Sair — e quase ninguém clica, só fecha o navegador.
-- Resultado: a bolinha ficava verde pra sempre.
--
-- Como resolve: enquanto o site está aberto, a página chama marcar_visto()
-- de tempos em tempos. O painel considera online quem tem sessão ativa E
-- foi visto nos últimos 30 minutos (a janela fica em assets/js/presenca.js,
-- não aqui, pra ajustar sem migração nova).
--
-- Os 30 min existem por causa do celular: tela bloqueada derruba a conexão
-- do Realtime, e sem essa folga o jogador sentado na mesa apareceria offline.
-- ═══════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists ultimo_visto timestamptz;

comment on column public.profiles.ultimo_visto is
  'Último sinal de vida do usuário (gravado por public.marcar_visto() enquanto o site está aberto).';

-- Grava com o relógio do SERVIDOR (now()), não com o horário mandado pelo
-- cliente: relógio errado no celular de alguém bagunçaria a conta do tempo.
-- SECURITY DEFINER + auth.uid() garante que cada um só marca a si mesmo,
-- sem precisar abrir UPDATE de profiles pro cliente.
create or replace function public.marcar_visto()
returns void
language sql
security definer
set search_path = public, auth
as $$
  update public.profiles set ultimo_visto = now() where id = auth.uid();
$$;

comment on function public.marcar_visto() is
  'Marca o usuário atual como visto agora (heartbeat de presença).';

grant execute on function public.marcar_visto() to authenticated;

-- ── Status das contas, agora com o visto por último ──────────────────
drop function if exists public.listar_status_contas();

create function public.listar_status_contas()
returns table (
  id uuid,
  nome text,
  email text,
  ultimo_login timestamptz,
  ultimo_visto timestamptz,
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
    p.ultimo_visto,
    count(s.id)::integer as sessoes,
    max(s.updated_at) as ultima_atividade
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join auth.sessions s on s.user_id = u.id
  where public.is_mestre()
  group by u.id, p.nome, p.ultimo_visto, u.email, u.last_sign_in_at
  order by p.ultimo_visto desc nulls last, u.last_sign_in_at desc nulls last;
$$;

comment on function public.listar_status_contas() is
  'Status de cada conta: último login, último sinal de vida e nº de sessões ativas. Só retorna linhas pro Mestre.';

grant execute on function public.listar_status_contas() to authenticated;

-- ── Verificação ─────────────────────────────────────────────────────
select column_name from information_schema.columns
where table_schema='public' and table_name='profiles' and column_name='ultimo_visto';

select proname from pg_proc where proname in ('marcar_visto','listar_status_contas') order by proname;

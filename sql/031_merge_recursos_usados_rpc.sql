-- ═══════════════════════════════════════════════════════════════════
-- Merge de recursos_usados direto no banco (RPC), sem SELECT prévio
--
-- sql/029/030 fecharam o bug de dados (Mestre sobrescrevendo recursos que
-- só existiam no banco), e o fix do lado do cliente (RecursosClasse.
-- mesclarComBanco, em recursos_classe.js) fazia SELECT + merge local +
-- UPDATE — dois round-trips de rede em SÉRIE, a cada clique num pip.
-- Reportado como "delay muito grande quando marco/desmarco alguma
-- habilidade" — com razão: antes era 1 round-trip (grava direto, sem
-- checar nada); virou 2 round-trips SEQUENCIAIS + o debounce de 400ms de
-- DBSync.salvarCampo por cima.
--
-- Esta função faz a MESMA mesclagem, mas ATÔMICA e em UM round-trip: o
-- próprio Postgres já tem o jsonb || jsonb (concatenação nível-raiz, quem
-- vem da direita vence a mesma chave) — não precisa ler antes de escrever,
-- o merge acontece dentro do próprio UPDATE.
--
-- SECURITY INVOKER (padrão — não marcado DEFINER): roda como quem chamou,
-- então a RLS de characters_update continua valendo normalmente (dono ou
-- Mestre), e os triggers de sempre disparam (updated_by, o log em
-- character_changes) exatamente como um UPDATE comum.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.mesclar_recurso_usado(p_character_id uuid, p_patch jsonb)
returns jsonb
language sql
as $$
  update public.characters
    set recursos_usados = coalesce(recursos_usados, '{}'::jsonb) || p_patch
  where id = p_character_id
  returning recursos_usados;
$$;

comment on function public.mesclar_recurso_usado(uuid, jsonb) is
  'Mescla p_patch em characters.recursos_usados (jsonb || jsonb, nível raiz) num único UPDATE atômico — chaves de p_patch vencem, as demais chaves já salvas no banco são preservadas. Usado por assets/js/recursos_classe.js pra gravar sem o round-trip extra de ler antes de escrever.';

grant execute on function public.mesclar_recurso_usado(uuid, jsonb) to authenticated;

-- ── Verificação ─────────────────────────────────────────────────────
select proname from pg_proc where proname = 'mesclar_recurso_usado';

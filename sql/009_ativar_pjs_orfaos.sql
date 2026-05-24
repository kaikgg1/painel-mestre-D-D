-- ═══════════════════════════════════════════════════════════════════
-- Marca como ativo o primeiro PJ de cada usuário que ainda não tem
-- nenhum ativo (idempotente).
-- ═══════════════════════════════════════════════════════════════════

with usuarios_sem_ativo as (
  select user_id
  from public.characters
  group by user_id
  having bool_or(is_active) = false
),
primeiro_pj as (
  select distinct on (c.user_id) c.id, c.user_id
  from public.characters c
  join usuarios_sem_ativo u on u.user_id = c.user_id
  order by c.user_id, c.created_at
)
update public.characters
  set is_active = true
where id in (select id from primeiro_pj);

-- Verificação
select c.nome, p.nome as dono, c.is_active, c.campanha
from public.characters c
join public.profiles p on p.id = c.user_id
order by p.nome, c.created_at;

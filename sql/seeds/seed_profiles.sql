-- ═══════════════════════════════════════════════════════════════════
-- Garante que os 4 usuários têm registro em public.profiles
-- (o trigger handle_new_user só funciona em INSERTs novos; usuários
-- criados antes do trigger ou via SQL podem ter ficado sem profile)
-- ═══════════════════════════════════════════════════════════════════

insert into public.profiles (id, nome)
select id, coalesce(raw_user_meta_data->>'nome', split_part(email, '@', 1))
from auth.users
where email like '%@mesa.local'
on conflict (id) do update set nome = excluded.nome;

-- Verificação
select id, nome from public.profiles order by nome;

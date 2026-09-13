-- ═══════════════════════════════════════════════════════════════════
-- regras_casa — lista de Regras da Casa desta mesa.
--   Leitura: qualquer usuário autenticado (mestre e jogadores).
--   Escrita (inserir/editar/apagar): só o Mestre.
-- Separada da tabela de críticos, que é conteúdo fixo (não editável)
-- embutido direto na página paineis/tabela_criticos.html.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.regras_casa (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  descricao   text not null,
  ordem       integer not null default 0,
  created_by  uuid references auth.users on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

comment on table public.regras_casa is 'Regras da casa desta mesa (além do livro básico) — visível a todos, editável só pelo Mestre.';

drop trigger if exists regras_casa_updated_at on public.regras_casa;
create trigger regras_casa_updated_at
  before update on public.regras_casa
  for each row execute function public.update_updated_at();

alter table public.regras_casa enable row level security;

drop policy if exists "regras_casa_select" on public.regras_casa;
create policy "regras_casa_select" on public.regras_casa
  for select to authenticated
  using (true);

drop policy if exists "regras_casa_insert" on public.regras_casa;
create policy "regras_casa_insert" on public.regras_casa
  for insert to authenticated
  with check (public.is_mestre());

drop policy if exists "regras_casa_update" on public.regras_casa;
create policy "regras_casa_update" on public.regras_casa
  for update to authenticated
  using (public.is_mestre());

drop policy if exists "regras_casa_delete" on public.regras_casa;
create policy "regras_casa_delete" on public.regras_casa
  for delete to authenticated
  using (public.is_mestre());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'regras_casa'
  ) then
    execute 'alter publication supabase_realtime add table public.regras_casa';
  end if;
end $$;

-- Seed das 10 regras originais desta mesa — só insere se a tabela estiver
-- vazia (rodar de novo não duplica, e não atrapalha regras que o Mestre
-- já tenha adicionado depois).
insert into public.regras_casa (titulo, descricao, ordem)
select * from (values
  ('Descanso Longo', 'Só concede todos os benefícios se for feito num local confortável e seguro (uma cama, um abrigo, um acampamento vigiado). Num lugar desconfortável ou exposto, concede só metade dos benefícios.', 1),
  ('Descanso Curto', 'No máximo 2 por dia, cada um leva 1 hora. Só é possível gastar Dados de Vida durante um descanso curto se houver algum insumo de cura disponível (bandagens, kit médico, esparadrapo, álcool etc.) ou alguém com magia de cura por perto. Dados de Vida gastos assim só voltam no próximo descanso curto do dia seguinte.', 2),
  ('Salvaguarda contra a Morte', 'As falhas de resistência contra a morte acumulam — não resetam sozinhas. Só recupera 1 nível de falha acumulada fazendo um Descanso Longo.', 3),
  ('Inspiração em Grupo', 'O grupo ganha Inspiração por uma boa ação coletiva — só pode ser usada se todos os jogadores concordarem em cedê-la pra quem for usar.', 4),
  ('1 Natural', 'Falha crítica no ataque: além de errar, aplica uma penalidade — veja a Tabela de Falhas Críticas.', 5),
  ('Flanco', 'Atacar um inimigo com um aliado posicionado no lado oposto dele dá +2 para acertar.', 6),
  ('Poção de Cura', 'Usada como ação normal, recupera o valor máximo da poção. Usada como ação bônus, rola os dados de cura normalmente.', 7),
  ('Subir de Nível', 'Ao rolar o Dado de Vida pra subir de nível, se o resultado sair menor que a média do dado, usa metade do dado no lugar da rolagem.', 8),
  ('Crítico Melhorado', 'Num acerto crítico (20 natural), dobra os dados de dano normalmente — e um dos dados extras conta como valor máximo. Ex.: um ataque de 1d10 + mod vira 1d10 + 10 + mod.', 9),
  ('Exaustão a 0 de Vida', 'Toda vez que um personagem cai a 0 pontos de vida, ele ganha 1 nível de exaustão.', 10)
) as v(titulo, descricao, ordem)
where not exists (select 1 from public.regras_casa);

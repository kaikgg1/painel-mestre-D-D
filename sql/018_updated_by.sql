-- ═══════════════════════════════════════════════════════════════════
-- Rastreia QUEM fez a última alteração em cada ficha (characters).
-- Usado pela ficha do jogador para só avisar "atualizada pelo Mestre"
-- quando a mudança veio de outra pessoa (o Mestre), e não do próprio
-- jogador editando em outro aparelho.
--
-- O trigger preenche updated_by = auth.uid() automaticamente em todo
-- UPDATE/INSERT vindo do app (via PostgREST/Supabase). Operações de
-- scripts admin (conexão direta) deixam null — o que não dispara aviso.
-- ═══════════════════════════════════════════════════════════════════

alter table public.characters
  add column if not exists updated_by uuid;

comment on column public.characters.updated_by is
  'auth.uid() de quem fez a última alteração. Null = script admin. Usado p/ aviso de edição do Mestre na ficha.';

create or replace function public.set_updated_by()
returns trigger as $$
begin
  -- auth.uid() é o usuário autenticado da requisição (jogador ou mestre).
  -- Em conexões diretas (scripts) retorna null.
  new.updated_by = auth.uid();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists characters_set_updated_by on public.characters;
create trigger characters_set_updated_by
  before insert or update on public.characters
  for each row execute function public.set_updated_by();

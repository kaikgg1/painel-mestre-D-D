-- ═══════════════════════════════════════════════════════════════════
-- Storage bucket "retratos" para upload de imagens de personagem
-- ═══════════════════════════════════════════════════════════════════

-- Cria bucket público (leitura aberta) — uploads requerem auth
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'retratos', 'retratos', true,
  3145728,  -- 3 MB
  array['image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policies: cada usuário só edita arquivos em sua "pasta" (user_id/)
-- Mas qualquer um logado lê (leitura pública pelo bucket)

drop policy if exists "Retratos: leitura pública" on storage.objects;
create policy "Retratos: leitura pública"
  on storage.objects for select
  using (bucket_id = 'retratos');

drop policy if exists "Retratos: upload do próprio user" on storage.objects;
create policy "Retratos: upload do próprio user"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'retratos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Retratos: update do próprio user" on storage.objects;
create policy "Retratos: update do próprio user"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'retratos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Retratos: delete do próprio user" on storage.objects;
create policy "Retratos: delete do próprio user"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'retratos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Mestre pode tudo (precisa pra editar retratos de NPCs no painel)
drop policy if exists "Retratos: mestre faz tudo" on storage.objects;
create policy "Retratos: mestre faz tudo"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'retratos' and public.is_mestre())
  with check (bucket_id = 'retratos' and public.is_mestre());

-- Verificação
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'retratos';

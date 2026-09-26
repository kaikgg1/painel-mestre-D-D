-- ═══════════════════════════════════════════════════════════════════
-- Log de alterações mais descritivo: slots de magia e recursos de classe
-- ganham UMA LINHA POR ITEM que mudou (nível do slot, nome do recurso),
-- com o valor de verdade — em vez de só "Slots de magia alterado".
--
-- Pedido: "deixe descrito exatamente o que foi alterado, tipo a
-- quantidade de vida, qual espaço de magia foi adicionado ou retirado".
-- PV já saía com valor (sql/029, campo escalar comum); slots_magia e
-- recursos_usados são jsonb com VÁRIOS sub-valores dentro da mesma coluna
-- — o formato genérico "campo alterado" (sql/029) existe justamente pra
-- não tentar formatar um dump de JSON ilegível, mas esses dois têm
-- estrutura conhecida e fixa o bastante pra valer a pena abrir.
-- ═══════════════════════════════════════════════════════════════════

-- Formata um valor de recurso, que aparece em DOIS formatos no mesmo
-- objeto recursos_usados (ver comentário em recursos_classe.js):
--   número puro            → "2"          (RecursosClasse.gravarUsado)
--   {"atual":1,"max":2}     → "1/2 usados" (trackers da aba Habilidades)
create or replace function public.formatar_valor_recurso(v jsonb)
returns text
language sql immutable
as $$
  select case
    when v is null then '0'
    when jsonb_typeof(v) = 'number' then v::text
    when jsonb_typeof(v) = 'object' and v ? 'atual'
      then coalesce(v->>'atual', '0') || '/' || coalesce(v->>'max', '0') || ' usados'
    else v::text
  end;
$$;

create or replace function public.registrar_alteracoes_ficha()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  atuando uuid := auth.uid();
  mestre boolean := public.is_mestre();
  antigo jsonb := to_jsonb(old);
  novo jsonb := to_jsonb(new);
  chave text;
  rotulo text;
  antes text;
  depois text;
  gravou boolean := false;
  nivel text;
  chave_recurso text;
  rotulo_recurso text;
  ignorar constant text[] := array['id','user_id','created_at','updated_at','updated_by'];
  -- slots_magia e recursos_usados saíram desta lista: ganharam loop próprio
  -- logo abaixo, com uma linha por sub-item (não é mais "alterado" genérico).
  eh_blob constant text[] := array['atributos','inventario',
    'habilidades_classe','pericias','salvaguardas',
    'features_personalizadas','companions','bestiario_favoritos',
    'concentracao','habilidades_favoritas','classes_secundarias'];
begin
  if atuando is null then
    return new;
  end if;

  for chave in select jsonb_object_keys(novo) loop
    if chave = any(ignorar) then continue; end if;
    if antigo -> chave is not distinct from novo -> chave then continue; end if;

    -- ── Slots de magia: uma linha por NÍVEL que mudou (1 a 9) ──
    if chave = 'slots_magia' then
      for nivel in select unnest(array['1','2','3','4','5','6','7','8','9']) loop
        if (antigo -> chave -> nivel) is not distinct from (novo -> chave -> nivel) then continue; end if;
        insert into public.character_changes
          (character_id, user_id, changed_by, por_mestre, campo, rotulo, valor_antes, valor_depois)
        values (
          new.id, new.user_id, atuando, mestre,
          'slots_magia_' || nivel, 'Espaço de magia (nível ' || nivel || ')',
          coalesce((antigo -> chave -> nivel ->> 'atual'), '0') || '/' || coalesce((antigo -> chave -> nivel ->> 'max'), '0') || ' usados',
          coalesce((novo   -> chave -> nivel ->> 'atual'), '0') || '/' || coalesce((novo   -> chave -> nivel ->> 'max'), '0') || ' usados'
        );
        gravou := true;
      end loop;
      continue;
    end if;

    -- ── Recursos de classe: uma linha por RECURSO que mudou (Canalizar
    -- Divindade, Fúria, Golpe Divino, qualquer characteristic detectada na
    -- aba Habilidades…) — as chaves são dinâmicas, não uma lista fixa como
    -- as colunas normais, por isso o rótulo vem da própria chave. ──
    if chave = 'recursos_usados' then
      for chave_recurso in
        select k from jsonb_object_keys(coalesce(antigo -> chave, '{}'::jsonb)) k
        union
        select k from jsonb_object_keys(coalesce(novo -> chave, '{}'::jsonb)) k
      loop
        if (antigo -> chave -> chave_recurso) is not distinct from (novo -> chave -> chave_recurso) then continue; end if;
        -- "canalizar_divindade_2_descanso" → "Canalizar divindade 2 descanso"
        -- (mesmo fallback que o painel já usa em JS até o catálogo responder
        -- com o nome de verdade — aqui não temos acesso ao catálogo).
        rotulo_recurso := initcap(replace(chave_recurso, '_', ' '));
        insert into public.character_changes
          (character_id, user_id, changed_by, por_mestre, campo, rotulo, valor_antes, valor_depois)
        values (
          new.id, new.user_id, atuando, mestre,
          'recursos_usados_' || chave_recurso, rotulo_recurso,
          public.formatar_valor_recurso(antigo -> chave -> chave_recurso),
          public.formatar_valor_recurso(novo -> chave -> chave_recurso)
        );
        gravou := true;
      end loop;
      continue;
    end if;

    rotulo := case chave
      when 'nome' then 'Nome' when 'raca' then 'Raça' when 'classe' then 'Classe'
      when 'subclasse' then 'Subclasse' when 'nivel' then 'Nível'
      when 'origem' then 'Origem' when 'alinhamento' then 'Alinhamento'
      when 'hp_max' then 'PV máximo' when 'hp_atual' then 'PV atual'
      when 'hp_temp' then 'PV temporário' when 'ca' then 'CA'
      when 'iniciativa_bonus' then 'Bônus de iniciativa' when 'deslocamento' then 'Deslocamento'
      when 'dado_vida_atual' then 'Dado de vida' when 'condicoes' then 'Condições'
      when 'exaustao' then 'Exaustão' when 'inspiracao' then 'Inspiração'
      when 'tracos_pessoais' then 'Traços pessoais' when 'ideais' then 'Ideais'
      when 'vinculos' then 'Vínculos' when 'defeitos' then 'Defeitos'
      when 'historia' then 'História' when 'notas' then 'Notas'
      when 'imagem_url' then 'Retrato' when 'cor_destaque' then 'Cor de destaque'
      when 'morte_sucessos' then 'Sucessos de morte' when 'morte_falhas' then 'Falhas de morte'
      when 'campanha' then 'Campanha' when 'magias_preparadas' then 'Magias preparadas'
      when 'is_active' then 'Ativo na campanha' when 'xp' then 'XP'
      when 'idiomas' then 'Idiomas' when 'ferramentas' then 'Ferramentas'
      when 'tracos_raciais' then 'Traços raciais' when 'truques_conhecidos' then 'Truques conhecidos'
      when 'magias_conhecidas' then 'Magias conhecidas' when 'cd_resistencia' then 'CD de resistência'
      when 'bonus_atq_magia' then 'Bônus de ataque mágico'
      when 'caracteristicas_adicionais' then 'Características adicionais'
      when 'percepcao_passiva' then 'Percepção passiva' when 'spell_dc' then 'CD de magia'
      when 'spell_atk' then 'Ataque de magia'
      when 'atributos' then 'Atributos' when 'inventario' then 'Inventário'
      when 'habilidades_classe' then 'Habilidades de classe'
      when 'pericias' then 'Perícias' when 'salvaguardas' then 'Salvaguardas'
      when 'features_personalizadas' then 'Características' when 'companions' then 'Aliados'
      when 'bestiario_favoritos' then 'Bestiário favorito' when 'concentracao' then 'Concentração'
      when 'habilidades_favoritas' then 'Habilidades favoritas' when 'classes_secundarias' then 'Multiclasse'
      else chave
    end;

    if chave = any(eh_blob) then
      antes := null; depois := null;
    elsif chave = 'condicoes' then
      antes  := (select string_agg(x, ', ') from jsonb_array_elements_text(coalesce(antigo -> chave, '[]'::jsonb)) x);
      depois := (select string_agg(x, ', ') from jsonb_array_elements_text(coalesce(novo   -> chave, '[]'::jsonb)) x);
    else
      antes  := left(trim(both '"' from (antigo -> chave)::text), 140);
      depois := left(trim(both '"' from (novo   -> chave)::text), 140);
    end if;

    insert into public.character_changes
      (character_id, user_id, changed_by, por_mestre, campo, rotulo, valor_antes, valor_depois)
    values
      (new.id, new.user_id, atuando, mestre, chave, rotulo, antes, depois);
    gravou := true;
  end loop;

  if gravou then
    delete from public.character_changes
    where character_id = new.id
      and id not in (
        select id from public.character_changes
        where character_id = new.id
        order by criado_em desc
        limit 200
      );
  end if;

  return new;
end;
$$;

comment on function public.registrar_alteracoes_ficha() is
  'Trigger AFTER UPDATE em characters: grava em character_changes cada coluna que mudou (slots_magia e recursos_usados abrem em uma linha por sub-item), com quem mudou e se foi o Mestre.';

-- ── Verificação ─────────────────────────────────────────────────────
select proname from pg_proc where proname in ('registrar_alteracoes_ficha', 'formatar_valor_recurso');

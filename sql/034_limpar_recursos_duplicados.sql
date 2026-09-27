-- ═══════════════════════════════════════════════════════════════════
-- Remove de recursos_usados os contadores criados a partir do texto das
-- habilidades que duplicavam um recurso de classe do catálogo
-- (canalizar_divindade_2_descanso ↔ canalizar_divindade, surto_de_acao_1_uso
-- ↔ surto_acao…). Eles apareciam como linhas extras no card do Mestre.
-- A ficha deixou de criá-los (RecursosClasse.idCatalogoDeHabilidade);
-- mesmas regras do MAPA_HABILIDADE_RECURSO em assets/js/recursos_classe.js.
-- Rodar depois do deploy do JS novo. Idempotente.
-- ═══════════════════════════════════════════════════════════════════

update public.characters c
set recursos_usados = (
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
  from jsonb_each(c.recursos_usados) e
  where e.key !~ '^(canalizar_divindade_[0-9]+_descanso|surto_de_acao_[0-9]+_usos?|indomavel_[0-9]+_usos?|arcanos?_misticos?_[0-9]_nivel|inspiracao_bardica_d[0-9]+|retomar_o_folego|golpe_de_sorte)$'
)
where jsonb_typeof(c.recursos_usados) = 'object'
  and exists (
    select 1 from jsonb_object_keys(c.recursos_usados) k
    where k ~ '^(canalizar_divindade_[0-9]+_descanso|surto_de_acao_[0-9]+_usos?|indomavel_[0-9]+_usos?|arcanos?_misticos?_[0-9]_nivel|inspiracao_bardica_d[0-9]+|retomar_o_folego|golpe_de_sorte)$'
  );

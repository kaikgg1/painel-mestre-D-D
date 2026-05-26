-- ═══════════════════════════════════════════════════════════════════
-- Tracking de uso de habilidades de classe/subclasse
-- ═══════════════════════════════════════════════════════════════════
-- recursos_usados: { "<chave_da_feature>": { "atual": N, "max": N }, ... }
-- A chave é montada pelo front: slug(nome) — ex.: "canalizar_divindade".
-- O Mestre reseta todos os "atual = 0" no descanso longo.

alter table public.characters
  add column if not exists recursos_usados jsonb not null default '{}'::jsonb;

-- Para classes "comuns" (Bárbaro, Guerreiro, Ladino, Monge) o jogador NÃO
-- usa magia — slots_magia continua zerado. Nada a migrar aqui; só garantia.
update public.characters
  set recursos_usados = '{}'::jsonb
  where recursos_usados is null;

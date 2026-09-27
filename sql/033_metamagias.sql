-- ═══════════════════════════════════════════════════════════════════
-- Opções de Metamágica escolhidas pelo Feiticeiro (PHB: 2 no 3° nível,
-- +1 no 10° e no 17°). Array de ids do catálogo METAMAGIAS em
-- assets/js/recursos_classe.js, ex.: ["acelerada","sutil"].
-- Editável pelo jogador (aba Habilidades) e pelo Mestre (painel).
-- ═══════════════════════════════════════════════════════════════════

alter table public.characters
  add column if not exists metamagias jsonb default '[]'::jsonb;

comment on column public.characters.metamagias is
  'Ids das opções de Metamágica escolhidas pelo Feiticeiro (catálogo METAMAGIAS em assets/js/recursos_classe.js).';

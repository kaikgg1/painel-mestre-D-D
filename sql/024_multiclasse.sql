-- ═══════════════════════════════════════════════════════════════════
-- Multiclasse (jog-4 da auditoria). Em vez de reescrever o modelo de dados
-- (classe/subclasse/nivel continuam sendo a classe PRINCIPAL, como sempre
-- foram), o personagem ganha um array opcional de classes secundárias —
-- cada entrada só precisa de {classe, nivel}. Nível total e dado de vida
-- somam a principal + as secundárias (PHB: multiclasse soma o nível de
-- TODAS as classes pra determinar bônus de proficiência e progressão de
-- conjurador; PV usa o dado de cada classe separadamente).
--
-- A ficha funciona igual antes desta migration rodar: sem a coluna, o PJ
-- é tratado como classe única (classes_secundarias vazio) — não é um
-- pré-requisito bloqueante, mesmo padrão de habilidades_favoritas (022).
-- ═══════════════════════════════════════════════════════════════════

alter table public.characters
  add column if not exists classes_secundarias jsonb default '[]'::jsonb;

comment on column public.characters.classes_secundarias is
  'Multiclasse: array de {classe, nivel} além da classe principal (colunas classe/subclasse/nivel). PHB: soma no nível total e no bônus de proficiência; cada classe rola seu próprio Dado de Vida.';

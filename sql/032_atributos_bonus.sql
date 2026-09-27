-- ═══════════════════════════════════════════════════════════════════
-- Bônus de atributo dado pelo Mestre (item, dádiva, ajuste racial não
-- refletido no valor base, etc). Mesmo padrão de pericias[k].bonus e
-- salvaguardas[k].bonus: soma por cima do valor base sem sobrescrevê-lo,
-- então o jogador continua livre pra editar o atributo base na aba
-- Personagem sem perder o ajuste do Mestre (e vice-versa).
--
-- Formato: {"for": 1, "car": -1} — só as chaves com bônus != 0 precisam
-- existir; chave ausente = 0.
--
-- A ficha funciona mesmo ANTES desta migration rodar: o bônus degrada
-- pra 0 (mod() usa só o atributo base) se a coluna ainda não existir.
-- ═══════════════════════════════════════════════════════════════════

alter table public.characters
  add column if not exists atributos_bonus jsonb default '{}'::jsonb;

comment on column public.characters.atributos_bonus is
  'Bônus do Mestre por atributo (for/dex/con/int/sab/car), somado ao valor base do personagem em todo cálculo de modificador — não sobrescreve characters.atributos.';

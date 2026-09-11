-- ═══════════════════════════════════════════════════════════════════
-- Novo jogador: Guilherme  (Paladino 8 — Juramento de Vingança)
--
-- Faz três coisas:
--   1. cria o usuário guilherme123@mesa.local em auth.users
--   2. garante o registro dele em public.profiles
--   3. cria a ficha "Vaclav Kovár" já preenchida (build do PDF)
--
-- ⚠️ Rodar no SQL Editor do Supabase (usa esquema auth).
-- ⚠️ Idempotente: pode rodar mais de uma vez sem duplicar nada.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Usuário ─────────────────────────────────────────────────────
do $$
declare
  v_senha text := 'mesa-dnd-5e';   -- mesma senha padrão dos outros jogadores
begin
  if not exists (select 1 from auth.users where email = 'guilherme123@mesa.local') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated',
      'guilherme123@mesa.local',
      crypt(v_senha, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nome":"Guilherme"}'::jsonb,
      now(), now(), '', '', '', ''
    );
  end if;
end $$;

-- ── 2. Profile ─────────────────────────────────────────────────────
insert into public.profiles (id, nome)
select id, coalesce(raw_user_meta_data->>'nome', split_part(email, '@', 1))
from auth.users
where email = 'guilherme123@mesa.local'
on conflict (id) do update set nome = excluded.nome;

-- ── 3. Ficha do personagem ─────────────────────────────────────────
-- Paladino 8, Juramento de Vingança, Meio-Orc, antecedente Assombrado.
-- Números conferidos: CA 18 (placas), PV 76, Prof +3, For 20 (+5),
-- ataque com espada grande +8 (For +5 + prof +3).
do $$
declare
  v_uid uuid;
begin
  select id into v_uid from auth.users where email = 'guilherme123@mesa.local';
  if v_uid is null then
    raise notice 'Usuário guilherme123 não encontrado — ficha não criada.';
    return;
  end if;

  if exists (select 1 from public.characters where user_id = v_uid and nome = 'Vaclav Kovár') then
    raise notice 'Ficha de Vaclav Kovár já existe — nada a fazer.';
    return;
  end if;

  insert into public.characters (
    user_id, nome, raca, classe, subclasse, nivel, origem, alinhamento,
    atributos,
    hp_max, hp_atual, hp_temp, ca, iniciativa_bonus, deslocamento,
    dado_vida_tipo, dado_vida_atual,
    slots_magia,
    salvaguardas, pericias,
    magias_conhecidas, truques_conhecidos, cd_resistencia, bonus_atq_magia,
    magias_preparadas,
    tracos_raciais, idiomas,
    tracos_pessoais, ideais, vinculos, defeitos, historia,
    caracteristicas_adicionais,
    inventario,
    is_active
  ) values (
    v_uid,
    'Vaclav Kovár',
    'Meio-Orc',
    'Paladino',
    'Juramento de Vingança',
    8,
    'Assombrado (Haunted One)',
    'Leal e Neutro',

    -- For 20 (+5) · Des 10 · Con 16 (+3) · Int 8 (-1) · Sab 10 · Car 14 (+2)
    '{"for":20,"dex":10,"con":16,"int":8,"sab":10,"car":14}'::jsonb,

    76, 76, 0, 18, 0, 9,
    10, 8,                       -- d10 de Paladino, 8 dados de vida

    -- Espaços de 8º nível: 4 de 1º e 3 de 2º (nenhum gasto)
    '{"1":{"max":4,"atual":0},"2":{"max":3,"atual":0}}'::jsonb,

    -- Proficiente em Sabedoria e Carisma (padrão do Paladino).
    -- OBS: o PDF lista Força/Carisma; as salvaguardas de Paladino no PHB são
    -- Sabedoria e Carisma. Mantive as do PHB — ajuste se a mesa combinou diferente.
    '{"sab":true,"car":true}'::jsonb,

    -- Atletismo e Persuasão (classe) + Religião e Sobrevivência (antecedente)
    '{"atletismo":{"prof":true,"exp":false},
      "persuasao":{"prof":true,"exp":false},
      "religiao":{"prof":true,"exp":false},
      "sobrevivencia":{"prof":true,"exp":false}}'::jsonb,

    6, 0, 13, 5,                 -- 6 magias preparadas · CD 13 (8+3+2) · ataque mágico +5

    -- Preparo sugerido do PDF + as sempre-preparadas do juramento
    E'Preparadas (6): Duelo Compelido, Proteção contra o Bem e o Mal, Abençoar, '
     'Marca Flamejante, Convocar Montaria, Auxílio.\n'
     'Juramento (sempre preparadas, não contam no limite): Maldição, '
     'Marca do Caçador, Paralisar Pessoa, Passo Nebuloso.',

    E'Visão no Escuro 18 m · Resiliência Implacável (ao cair a 0 PV, fica com 1 PV, 1×/descanso longo) · '
     'Ataques Selvagens (crítico corpo a corpo rola um dado de dano extra).',
    '{Comum,Orc}',

    'Fala pouco sobre o próprio passado, mas nunca esconde a cicatriz no rosto — deixa que perguntem, se quiserem.',
    'Ninguém mais deveria voltar para casa e encontrar cinzas.',
    'Carrega um pedaço enferrujado da bigorna do pai como talismã; é a única lembrança física de Korvenhal que lhe resta.',
    'Quando encontra crueldade gratuita, tem dificuldade em parar — mesmo quando parar seria a atitude mais sensata.',

    E'Nasceu em Korvenhal, vilarejo madeireiro de fronteira, filho de um ferreiro meio-orc e de uma curandeira humana. '
     'Aos dezessete anos voltou de uma caçada e encontrou o vilarejo em cinzas: os Retalhadores de Ferro, mercenários '
     'renegados, o haviam varrido atrás de um artefato do templo local, sem deixar testemunhas além dele. O líder, o '
     'cavaleiro desonrado Ordwin Kray, marcou-lhe o rosto e o deixou vivo "para que o mundo visse o que sobra de quem '
     'tenta guardar o que não é seu".\n\n'
     'Vaclav fez o Juramento de Vingança num templo de guerra nas montanhas — não como voto abstrato, mas como promessa '
     'concreta. Rastreou o grupo por três territórios até encurralar Kray numa estrada tomada por um nevoeiro denso '
     'demais para ser natural. Foi nesse nevoeiro que ambos desapareceram.\n\n'
     'Saiu da névoa sozinho, sem sinal de Kray, numa terra que não reconhece. O Voto de Inimizade perdeu o alvo fixo, '
     'mas não deixou de ser real — pronto para se fixar em qualquer inimigo que o mereça.\n\n'
     'SEGREDO SOMBRIO: em aberto de propósito — combinar com o Mestre.',

    E'ESTILO DE LUTA: Combate com Arma Grande (rerola 1 e 2 no dano da arma).\n'
     'ATAQUE: Espada Grande +8, 2d6+5 cortante, 2 ataques por turno (Ataque Extra).\n'
     'Sentido Divino 3×/descanso longo · Impor as Mãos: reserva de 40 PV · Saúde Divina (imune a doenças).\n'
     'Aura de Proteção (3 m): você e aliados somam +2 (Car) em todos os testes de resistência.\n'
     'Canalizar Divindade: Voto de Inimizade (vantagem nos ataques contra 1 alvo por 1 min) '
     'ou Repreender o Inimigo (Sab CD 13 ou amedrontado).\n'
     'Vingador Implacável (nível 7): ao acertar ataque de oportunidade, move metade do deslocamento sem provocar.\n'
     'GOLPE DIVINO: 2d8 (espaço de 1º) ou 3d8 (2º); +1d8 contra mortos-vivos e corruptores.\n'
     'SEM TALENTOS por decisão do Mestre.',

    '{"moedas":{"pc":0,"pp":0,"pe":0,"po":0,"pl":0},
      "armas":[{"nome":"Espada Grande","dano":"2d6 cortante","bonus":"+8"}],
      "armaduras":[{"nome":"Armadura de Placas","ca":18},{"nome":"Escudo (reserva)","ca":2}],
      "itens":[{"nome":"Símbolo sagrado (amuleto)"},{"nome":"Kit de exploração"},
               {"nome":"Pedaço da bigorna do pai (talismã)"}]}'::jsonb,

    true
  );

  raise notice 'Ficha de Vaclav Kovár criada para guilherme123.';
end $$;

-- ── Conferência ────────────────────────────────────────────────────
select u.email, p.nome as perfil, c.nome as personagem, c.classe, c.subclasse, c.nivel
from auth.users u
left join public.profiles p on p.id = u.id
left join public.characters c on c.user_id = u.id
where u.email = 'guilherme123@mesa.local';

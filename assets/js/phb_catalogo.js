// assets/js/phb_catalogo.js
// Catálogo completo de equipamentos do Livro do Jogador (PHB 5e).
// Armas, armaduras, ferramentas e itens de aventura — em PT-BR.
// Os arrays são ordenados alfabeticamente em runtime via window.PHB.

(function () {
  const ordemAlfa = (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt', { sensitivity: 'base' });

  // ─── ARMAS ──────────────────────────────────────────────────────
  // categoria → ordem de exibição no optgroup
  const ARMAS = [
    // ── Simples corpo-a-corpo (10) ──
    { nome: 'Adaga',              dano: '1d4',  tipo_dano: 'Perfurante', categoria: 'Simples corpo-a-corpo', propriedades: 'Acuidade, Leve, Arremesso (6/18m)',   peso: 0.5,  custo: '2 po' },
    { nome: 'Azagaia',            dano: '1d6',  tipo_dano: 'Perfurante', categoria: 'Simples corpo-a-corpo', propriedades: 'Arremesso (9/36m)',                    peso: 1,    custo: '5 pp' },
    { nome: 'Bordão',             dano: '1d6',  tipo_dano: 'Concussão',  categoria: 'Simples corpo-a-corpo', propriedades: 'Versátil (1d8)',                       peso: 2,    custo: '2 pp' },
    { nome: 'Clava',              dano: '1d4',  tipo_dano: 'Concussão',  categoria: 'Simples corpo-a-corpo', propriedades: 'Leve',                                 peso: 1,    custo: '1 pp' },
    { nome: 'Clava Grande',       dano: '1d8',  tipo_dano: 'Concussão',  categoria: 'Simples corpo-a-corpo', propriedades: 'Duas mãos',                            peso: 5,    custo: '2 pp' },
    { nome: 'Foice',              dano: '1d4',  tipo_dano: 'Cortante',   categoria: 'Simples corpo-a-corpo', propriedades: 'Leve',                                 peso: 1,    custo: '1 po' },
    { nome: 'Lança',              dano: '1d6',  tipo_dano: 'Perfurante', categoria: 'Simples corpo-a-corpo', propriedades: 'Arremesso (6/18m), Versátil (1d8)',    peso: 1.5,  custo: '1 po' },
    { nome: 'Maça',               dano: '1d6',  tipo_dano: 'Concussão',  categoria: 'Simples corpo-a-corpo', propriedades: '—',                                    peso: 2,    custo: '5 po' },
    { nome: 'Machadinha',         dano: '1d6',  tipo_dano: 'Cortante',   categoria: 'Simples corpo-a-corpo', propriedades: 'Leve, Arremesso (6/18m)',              peso: 1,    custo: '5 po' },
    { nome: 'Martelo Leve',       dano: '1d4',  tipo_dano: 'Concussão',  categoria: 'Simples corpo-a-corpo', propriedades: 'Leve, Arremesso (6/18m)',              peso: 1,    custo: '2 po' },

    // ── Simples distância (4) ──
    { nome: 'Arco Curto',         dano: '1d6',  tipo_dano: 'Perfurante', categoria: 'Simples distância',     propriedades: 'Duas mãos, Munição (24/96m)',          peso: 1,    custo: '25 po' },
    { nome: 'Besta Leve',         dano: '1d8',  tipo_dano: 'Perfurante', categoria: 'Simples distância',     propriedades: 'Duas mãos, Munição (24/96m), Recarga', peso: 2.5,  custo: '25 po' },
    { nome: 'Dardo',              dano: '1d4',  tipo_dano: 'Perfurante', categoria: 'Simples distância',     propriedades: 'Acuidade, Arremesso (6/18m)',          peso: 0.1,  custo: '5 pc' },
    { nome: 'Funda',              dano: '1d4',  tipo_dano: 'Concussão',  categoria: 'Simples distância',     propriedades: 'Munição (9/36m)',                      peso: 0,    custo: '1 pp' },

    // ── Marciais corpo-a-corpo (18) ──
    { nome: 'Alabarda',           dano: '1d10', tipo_dano: 'Cortante',   categoria: 'Marcial corpo-a-corpo', propriedades: 'Pesada, Alcance, Duas mãos',           peso: 3,    custo: '20 po' },
    { nome: 'Chicote',            dano: '1d4',  tipo_dano: 'Cortante',   categoria: 'Marcial corpo-a-corpo', propriedades: 'Acuidade, Alcance',                    peso: 1.5,  custo: '2 po' },
    { nome: 'Cimitarra',          dano: '1d6',  tipo_dano: 'Cortante',   categoria: 'Marcial corpo-a-corpo', propriedades: 'Acuidade, Leve',                       peso: 1.5,  custo: '25 po' },
    { nome: 'Espada Curta',       dano: '1d6',  tipo_dano: 'Perfurante', categoria: 'Marcial corpo-a-corpo', propriedades: 'Acuidade, Leve',                       peso: 1,    custo: '10 po' },
    { nome: 'Espada Longa',       dano: '1d8',  tipo_dano: 'Cortante',   categoria: 'Marcial corpo-a-corpo', propriedades: 'Versátil (1d10)',                      peso: 1.5,  custo: '15 po' },
    { nome: 'Glaive',             dano: '1d10', tipo_dano: 'Cortante',   categoria: 'Marcial corpo-a-corpo', propriedades: 'Pesada, Alcance, Duas mãos',           peso: 3,    custo: '20 po' },
    { nome: 'Lança Montada',      dano: '1d12', tipo_dano: 'Perfurante', categoria: 'Marcial corpo-a-corpo', propriedades: 'Alcance, Especial',                    peso: 3,    custo: '10 po' },
    { nome: 'Maça-estrela',       dano: '1d8',  tipo_dano: 'Perfurante', categoria: 'Marcial corpo-a-corpo', propriedades: '—',                                    peso: 2,    custo: '15 po' },
    { nome: 'Machado de Batalha', dano: '1d8',  tipo_dano: 'Cortante',   categoria: 'Marcial corpo-a-corpo', propriedades: 'Versátil (1d10)',                      peso: 2,    custo: '10 po' },
    { nome: 'Machado Grande',     dano: '1d12', tipo_dano: 'Cortante',   categoria: 'Marcial corpo-a-corpo', propriedades: 'Pesada, Duas mãos',                    peso: 3.5,  custo: '30 po' },
    { nome: 'Mangual',            dano: '1d8',  tipo_dano: 'Concussão',  categoria: 'Marcial corpo-a-corpo', propriedades: '—',                                    peso: 1,    custo: '10 po' },
    { nome: 'Marreta',            dano: '2d6',  tipo_dano: 'Concussão',  categoria: 'Marcial corpo-a-corpo', propriedades: 'Pesada, Duas mãos',                    peso: 5,    custo: '10 po' },
    { nome: 'Martelo de Guerra',  dano: '1d8',  tipo_dano: 'Concussão',  categoria: 'Marcial corpo-a-corpo', propriedades: 'Versátil (1d10)',                      peso: 1,    custo: '15 po' },
    { nome: 'Montante',           dano: '2d6',  tipo_dano: 'Cortante',   categoria: 'Marcial corpo-a-corpo', propriedades: 'Pesada, Duas mãos',                    peso: 3,    custo: '50 po' },
    { nome: 'Picareta de Guerra', dano: '1d8',  tipo_dano: 'Perfurante', categoria: 'Marcial corpo-a-corpo', propriedades: '—',                                    peso: 1,    custo: '5 po'  },
    { nome: 'Pique',              dano: '1d10', tipo_dano: 'Perfurante', categoria: 'Marcial corpo-a-corpo', propriedades: 'Pesada, Alcance, Duas mãos',           peso: 9,    custo: '5 po'  },
    { nome: 'Rapieira',           dano: '1d8',  tipo_dano: 'Perfurante', categoria: 'Marcial corpo-a-corpo', propriedades: 'Acuidade',                             peso: 1,    custo: '25 po' },
    { nome: 'Tridente',           dano: '1d6',  tipo_dano: 'Perfurante', categoria: 'Marcial corpo-a-corpo', propriedades: 'Arremesso (6/18m), Versátil (1d8)',    peso: 2,    custo: '5 po'  },

    // ── Marciais distância (5) ──
    { nome: 'Arco Longo',         dano: '1d8',  tipo_dano: 'Perfurante', categoria: 'Marcial distância',     propriedades: 'Pesada, Duas mãos, Munição (45/180m)', peso: 1,    custo: '50 po' },
    { nome: 'Besta de Mão',       dano: '1d6',  tipo_dano: 'Perfurante', categoria: 'Marcial distância',     propriedades: 'Leve, Munição (9/36m), Recarga',       peso: 1.5,  custo: '75 po' },
    { nome: 'Besta Pesada',       dano: '1d10', tipo_dano: 'Perfurante', categoria: 'Marcial distância',     propriedades: 'Pesada, Duas mãos, Munição (30/120m), Recarga', peso: 8.5, custo: '50 po' },
    { nome: 'Rede',               dano: '—',    tipo_dano: '—',          categoria: 'Marcial distância',     propriedades: 'Arremesso (1,5/4,5m), Especial',       peso: 1.5,  custo: '1 po'  },
    { nome: 'Zarabatana',         dano: '1',    tipo_dano: 'Perfurante', categoria: 'Marcial distância',     propriedades: 'Munição (7,5/30m), Recarga',           peso: 0.5,  custo: '10 po' },
  ].sort(ordemAlfa);

  // ─── ARMADURAS ───────────────────────────────────────────────────
  const ARMADURAS = [
    // ── Leves ──
    { nome: 'Acolchoada',         ca: '11 + DES',         tipo: 'Leve',   furtividade: 'Desvantagem', forca: '—',   peso: 4,    custo: '5 po'   },
    { nome: 'Couro',              ca: '11 + DES',         tipo: 'Leve',   furtividade: '—',           forca: '—',   peso: 5,    custo: '10 po'  },
    { nome: 'Couro Batido',       ca: '12 + DES',         tipo: 'Leve',   furtividade: '—',           forca: '—',   peso: 6.5,  custo: '45 po'  },
    // ── Médias ──
    { nome: 'Camisão de Malha',   ca: '13 + DES (máx 2)', tipo: 'Média',  furtividade: '—',           forca: '—',   peso: 10,   custo: '50 po'  },
    { nome: 'Cota de Escamas',    ca: '14 + DES (máx 2)', tipo: 'Média',  furtividade: 'Desvantagem', forca: '—',   peso: 22,   custo: '50 po'  },
    { nome: 'Gibão de Peles',     ca: '12 + DES (máx 2)', tipo: 'Média',  furtividade: '—',           forca: '—',   peso: 6,    custo: '10 po'  },
    { nome: 'Meia-armadura',      ca: '15 + DES (máx 2)', tipo: 'Média',  furtividade: 'Desvantagem', forca: '—',   peso: 20,   custo: '750 po' },
    { nome: 'Peitoral',           ca: '14 + DES (máx 2)', tipo: 'Média',  furtividade: '—',           forca: '—',   peso: 10,   custo: '400 po' },
    // ── Pesadas ──
    { nome: 'Armadura de Placas', ca: '18',               tipo: 'Pesada', furtividade: 'Desvantagem', forca: 'F15', peso: 32,   custo: '1500 po' },
    { nome: 'Brunea Marcial',     ca: '17',               tipo: 'Pesada', furtividade: 'Desvantagem', forca: 'F15', peso: 30,   custo: '200 po' },
    { nome: 'Cota de Anéis',      ca: '14',               tipo: 'Pesada', furtividade: 'Desvantagem', forca: '—',   peso: 20,   custo: '30 po'  },
    { nome: 'Cota de Malha',      ca: '16',               tipo: 'Pesada', furtividade: 'Desvantagem', forca: 'F13', peso: 27,   custo: '75 po'  },
    // ── Escudo ──
    { nome: 'Escudo',             ca: '+2',               tipo: 'Escudo', furtividade: '—',           forca: '—',   peso: 3,    custo: '10 po'  },
  ].sort(ordemAlfa);

  // ─── FERRAMENTAS, KITS E INSTRUMENTOS (PHB Cap. 5) ──────────────
  const FERRAMENTAS = [
    // Ferramentas de Artesão
    { nome: 'Ferramentas de Alquimista',      categoria: 'Artesão',     peso: 4,    custo: '50 po' },
    { nome: 'Ferramentas de Calçoeiro',       categoria: 'Artesão',     peso: 2.5,  custo: '5 po'  },
    { nome: 'Ferramentas de Calígrafo',       categoria: 'Artesão',     peso: 2.5,  custo: '10 po' },
    { nome: 'Ferramentas de Carpinteiro',     categoria: 'Artesão',     peso: 3,    custo: '8 po'  },
    { nome: 'Ferramentas de Cartógrafo',      categoria: 'Artesão',     peso: 3,    custo: '15 po' },
    { nome: 'Ferramentas de Cervejeiro',      categoria: 'Artesão',     peso: 4.5,  custo: '20 po' },
    { nome: 'Ferramentas de Cozinheiro',      categoria: 'Artesão',     peso: 4,    custo: '1 po'  },
    { nome: 'Ferramentas de Curtidor',        categoria: 'Artesão',     peso: 2.5,  custo: '5 po'  },
    { nome: 'Ferramentas de Ferreiro',        categoria: 'Artesão',     peso: 4,    custo: '20 po' },
    { nome: 'Ferramentas de Funileiro',       categoria: 'Artesão',     peso: 5,    custo: '50 po' },
    { nome: 'Ferramentas de Joalheiro',       categoria: 'Artesão',     peso: 1,    custo: '25 po' },
    { nome: 'Ferramentas de Oleiro',          categoria: 'Artesão',     peso: 1.5,  custo: '10 po' },
    { nome: 'Ferramentas de Pedreiro',        categoria: 'Artesão',     peso: 4,    custo: '10 po' },
    { nome: 'Ferramentas de Pintor',          categoria: 'Artesão',     peso: 2.5,  custo: '10 po' },
    { nome: 'Ferramentas de Tecelão',         categoria: 'Artesão',     peso: 2.5,  custo: '1 po'  },
    { nome: 'Ferramentas de Vidreiro',        categoria: 'Artesão',     peso: 2.5,  custo: '30 po' },
    { nome: 'Ferramentas de Entalhador',      categoria: 'Artesão',     peso: 2.5,  custo: '1 po'  },

    // Kits
    { nome: 'Ferramentas de Ladrão',          categoria: 'Kit',         peso: 0.5,  custo: '25 po' },
    { nome: 'Ferramentas de Navegação',       categoria: 'Kit',         peso: 1,    custo: '25 po' },
    { nome: 'Kit de Disfarce',                categoria: 'Kit',         peso: 1.5,  custo: '25 po' },
    { nome: 'Kit de Envenenamento',           categoria: 'Kit',         peso: 1,    custo: '50 po' },
    { nome: 'Kit de Erveiro',                 categoria: 'Kit',         peso: 1.5,  custo: '5 po'  },
    { nome: 'Kit de Falsificação',            categoria: 'Kit',         peso: 2.5,  custo: '15 po' },
    { nome: 'Kit de Cura',                    categoria: 'Kit',         peso: 1.5,  custo: '5 po'  },

    // Jogos
    { nome: 'Jogo de Dados',                  categoria: 'Jogo',        peso: 0,    custo: '1 pp'  },
    { nome: 'Jogo de Xadrez de Dragão',       categoria: 'Jogo',        peso: 0.5,  custo: '1 po'  },
    { nome: 'Cartas de Jogar',                categoria: 'Jogo',        peso: 0,    custo: '5 pp'  },
    { nome: 'Aposta dos Três Dragões',        categoria: 'Jogo',        peso: 0,    custo: '1 po'  },

    // Instrumentos musicais
    { nome: 'Alaúde',                         categoria: 'Instrumento', peso: 1,    custo: '35 po' },
    { nome: 'Bandolim',                       categoria: 'Instrumento', peso: 1,    custo: '25 po' },
    { nome: 'Corneta',                        categoria: 'Instrumento', peso: 1,    custo: '3 po'  },
    { nome: 'Flauta',                         categoria: 'Instrumento', peso: 0.5,  custo: '2 po'  },
    { nome: 'Flauta de Pã',                   categoria: 'Instrumento', peso: 1,    custo: '12 po' },
    { nome: 'Gaita de Foles',                 categoria: 'Instrumento', peso: 3,    custo: '30 po' },
    { nome: 'Lira',                           categoria: 'Instrumento', peso: 1,    custo: '30 po' },
    { nome: 'Saltério',                       categoria: 'Instrumento', peso: 5,    custo: '25 po' },
    { nome: 'Tambor',                         categoria: 'Instrumento', peso: 1.5,  custo: '6 po'  },
    { nome: 'Viola',                          categoria: 'Instrumento', peso: 0.5,  custo: '30 po' },
  ].sort(ordemAlfa);

  // ─── ITENS DE AVENTURA (PHB Cap. 5 – Adventuring Gear) ──────────
  const ITENS = [
    // Pacotes de equipamento
    { nome: 'Pacote de Aventureiro',          categoria: 'Pacote',  peso: 0,     custo: '10 po', desc: 'Mochila genérica' },
    { nome: 'Pacote de Artista',              categoria: 'Pacote',  peso: 27,    custo: '40 po' },
    { nome: 'Pacote de Diplomata',            categoria: 'Pacote',  peso: 23,    custo: '39 po' },
    { nome: 'Pacote de Erudito',              categoria: 'Pacote',  peso: 5,     custo: '40 po' },
    { nome: 'Pacote de Explorador',           categoria: 'Pacote',  peso: 26.5,  custo: '10 po' },
    { nome: 'Pacote de Masmorra',             categoria: 'Pacote',  peso: 31.5,  custo: '12 po' },
    { nome: 'Pacote de Sacerdote',            categoria: 'Pacote',  peso: 12,    custo: '19 po' },
    { nome: 'Pacote de Saqueador',            categoria: 'Pacote',  peso: 21.5,  custo: '16 po' },

    // Focos
    { nome: 'Foco Arcano (bastão)',           categoria: 'Foco',    peso: 1,     custo: '5 po'  },
    { nome: 'Foco Arcano (cajado)',           categoria: 'Foco',    peso: 2,     custo: '5 po'  },
    { nome: 'Foco Arcano (cristal)',          categoria: 'Foco',    peso: 0.5,   custo: '10 po' },
    { nome: 'Foco Arcano (orbe)',             categoria: 'Foco',    peso: 1.5,   custo: '20 po' },
    { nome: 'Foco Arcano (varinha)',          categoria: 'Foco',    peso: 0.5,   custo: '10 po' },
    { nome: 'Foco Druídico (azevinho)',       categoria: 'Foco',    peso: 0.5,   custo: '1 po'  },
    { nome: 'Foco Druídico (cajado totêmico)',categoria: 'Foco',    peso: 2,     custo: '5 po'  },
    { nome: 'Foco Druídico (visco)',          categoria: 'Foco',    peso: 0.5,   custo: '1 po'  },
    { nome: 'Símbolo Sagrado (amuleto)',      categoria: 'Foco',    peso: 0.5,   custo: '5 po'  },
    { nome: 'Símbolo Sagrado (emblema)',      categoria: 'Foco',    peso: 0,     custo: '5 po'  },
    { nome: 'Símbolo Sagrado (relicário)',    categoria: 'Foco',    peso: 1,     custo: '5 po'  },
    { nome: 'Bolsa de Componentes',           categoria: 'Foco',    peso: 1,     custo: '25 po' },

    // Munição
    { nome: 'Flechas (20)',                   categoria: 'Munição', peso: 0.5,   custo: '1 po'  },
    { nome: 'Virotes de Besta (20)',          categoria: 'Munição', peso: 0.75,  custo: '1 po'  },
    { nome: 'Virotes de Besta de Mão (20)',   categoria: 'Munição', peso: 0.75,  custo: '1 po'  },
    { nome: 'Pedras de Funda (20)',           categoria: 'Munição', peso: 0.75,  custo: '4 pc'  },
    { nome: 'Agulhas de Zarabatana (50)',     categoria: 'Munição', peso: 0.5,   custo: '1 po'  },

    // Recipientes e armazenamento
    { nome: 'Algibeira',                      categoria: 'Recipiente', peso: 0.5,  custo: '5 pp'  },
    { nome: 'Aljava',                         categoria: 'Recipiente', peso: 0.5,  custo: '1 po'  },
    { nome: 'Barril',                         categoria: 'Recipiente', peso: 35,   custo: '2 po'  },
    { nome: 'Baú',                            categoria: 'Recipiente', peso: 12.5, custo: '5 po'  },
    { nome: 'Caixa-forte',                    categoria: 'Recipiente', peso: 6,    custo: '20 po' },
    { nome: 'Cesto',                          categoria: 'Recipiente', peso: 1,    custo: '4 pp'  },
    { nome: 'Estojo (mapas/pergaminhos)',     categoria: 'Recipiente', peso: 0.5,  custo: '1 po'  },
    { nome: 'Estojo de Besta',                categoria: 'Recipiente', peso: 0.5,  custo: '1 po'  },
    { nome: 'Frasco ou Cantil',               categoria: 'Recipiente', peso: 0.5,  custo: '2 pc'  },
    { nome: 'Garrafa de Vidro',               categoria: 'Recipiente', peso: 1,    custo: '2 po'  },
    { nome: 'Jarra ou Cântaro',               categoria: 'Recipiente', peso: 2,    custo: '2 pc'  },
    { nome: 'Mochila',                        categoria: 'Recipiente', peso: 2.5,  custo: '2 po'  },
    { nome: 'Odre',                           categoria: 'Recipiente', peso: 2.5,  custo: '2 pp'  },
    { nome: 'Panela de Ferro',                categoria: 'Recipiente', peso: 5,    custo: '2 po'  },
    { nome: 'Pote de Vidro',                  categoria: 'Recipiente', peso: 0,    custo: '1 po'  },
    { nome: 'Saco',                           categoria: 'Recipiente', peso: 0.25, custo: '1 pc'  },
    { nome: 'Vasilha de Barro',               categoria: 'Recipiente', peso: 2,    custo: '2 pc'  },

    // Iluminação
    { nome: 'Lanterna Furta-fogo',            categoria: 'Iluminação', peso: 1,    custo: '5 po'  },
    { nome: 'Lanterna Holofote',              categoria: 'Iluminação', peso: 1,    custo: '10 po' },
    { nome: 'Óleo (frasco)',                  categoria: 'Iluminação', peso: 0.5,  custo: '1 pp'  },
    { nome: 'Pederneira e Isqueiro',          categoria: 'Iluminação', peso: 0,    custo: '5 pc'  },
    { nome: 'Tocha',                          categoria: 'Iluminação', peso: 0.5,  custo: '1 pc'  },
    { nome: 'Vela',                           categoria: 'Iluminação', peso: 0,    custo: '1 pc'  },

    // Cordas e escalada
    { nome: 'Corda de Cânhamo (15 m)',        categoria: 'Cordas',     peso: 5,    custo: '1 po'  },
    { nome: 'Corda de Seda (15 m)',           categoria: 'Cordas',     peso: 2.5,  custo: '10 po' },
    { nome: 'Corrente (3 m)',                 categoria: 'Cordas',     peso: 5,    custo: '5 po'  },
    { nome: 'Gancho de Escalada',             categoria: 'Cordas',     peso: 2,    custo: '2 po'  },
    { nome: 'Pé-de-cabra',                    categoria: 'Cordas',     peso: 2.5,  custo: '2 po'  },
    { nome: 'Piton',                          categoria: 'Cordas',     peso: 0.25, custo: '5 pc'  },
    { nome: 'Vara de 3 m',                    categoria: 'Cordas',     peso: 3.5,  custo: '5 pc'  },

    // Acampamento / sobrevivência
    { nome: 'Apito de Sinalização',           categoria: 'Acampamento', peso: 0,   custo: '5 pc'  },
    { nome: 'Cobertor',                       categoria: 'Acampamento', peso: 1.5, custo: '5 pp'  },
    { nome: 'Marmita',                        categoria: 'Acampamento', peso: 0.5, custo: '2 pp'  },
    { nome: 'Rações (1 dia)',                 categoria: 'Acampamento', peso: 1,   custo: '5 pp'  },
    { nome: 'Saco de Dormir',                 categoria: 'Acampamento', peso: 3.5, custo: '1 po'  },
    { nome: 'Tenda (2 pessoas)',              categoria: 'Acampamento', peso: 10,  custo: '2 po'  },

    // Restrição / Captura
    { nome: 'Abrolho (saco de 20)',           categoria: 'Restrição',  peso: 1,    custo: '1 po'  },
    { nome: 'Algemas',                        categoria: 'Restrição',  peso: 3,    custo: '2 po'  },
    { nome: 'Armadilha de Caça',              categoria: 'Restrição',  peso: 12.5, custo: '5 po'  },

    // Detecção / Investigação
    { nome: 'Ampulheta',                      categoria: 'Detecção',   peso: 0.5,  custo: '25 po' },
    { nome: 'Balança de Mercador',            categoria: 'Detecção',   peso: 1.5,  custo: '5 po'  },
    { nome: 'Espelho de Aço',                 categoria: 'Detecção',   peso: 0.25, custo: '5 po'  },
    { nome: 'Lente de Aumento',               categoria: 'Detecção',   peso: 0,    custo: '100 po'},
    { nome: 'Luneta',                         categoria: 'Detecção',   peso: 0.5,  custo: '1000 po'},
    { nome: 'Sino',                           categoria: 'Detecção',   peso: 0,    custo: '1 po'  },

    // Escrita
    { nome: 'Livro',                          categoria: 'Escrita',    peso: 2.5,  custo: '25 po' },
    { nome: 'Papel (folha)',                  categoria: 'Escrita',    peso: 0,    custo: '2 pp'  },
    { nome: 'Pena',                           categoria: 'Escrita',    peso: 0,    custo: '2 pc'  },
    { nome: 'Pergaminho (em branco)',         categoria: 'Escrita',    peso: 0,    custo: '1 pp'  },
    { nome: 'Tinta (frasco de 30 ml)',        categoria: 'Escrita',    peso: 0,    custo: '10 po' },

    // Poções e itens consumíveis
    { nome: 'Poção de Cura',                  categoria: 'Consumível', peso: 0.25, custo: '50 po' },
    { nome: 'Veneno Básico (frasco)',         categoria: 'Consumível', peso: 0,    custo: '100 po'},
    { nome: 'Ácido (frasco)',                 categoria: 'Consumível', peso: 0.5,  custo: '25 po' },
    { nome: 'Fogo Alquímico (frasco)',        categoria: 'Consumível', peso: 0.5,  custo: '50 po' },
    { nome: 'Água Benta (frasco)',            categoria: 'Consumível', peso: 0.5,  custo: '25 po' },
    { nome: 'Incenso (bloco)',                categoria: 'Consumível', peso: 0,    custo: '1 po'  },
    { nome: 'Sabão',                          categoria: 'Consumível', peso: 0,    custo: '2 pc'  },

    // Vestuário
    { nome: 'Manto com Capuz',                categoria: 'Vestuário',  peso: 2,    custo: '5 pp'  },
    { nome: 'Vestes Comuns',                  categoria: 'Vestuário',  peso: 1.5,  custo: '5 pp'  },
    { nome: 'Vestes Finas',                   categoria: 'Vestuário',  peso: 3,    custo: '15 po' },
    { nome: 'Vestes de Viajante',             categoria: 'Vestuário',  peso: 2,    custo: '2 po'  },
    { nome: 'Trajes de Trabalho',             categoria: 'Vestuário',  peso: 2,    custo: '5 pp'  },
    { nome: 'Vestes Religiosas',              categoria: 'Vestuário',  peso: 2,    custo: '5 pp'  },
  ].sort(ordemAlfa);

  // ─── MOEDAS ──────────────────────────────────────────────────────
  const MOEDAS = [
    { codigo: 'pc', nome: 'Peças de Cobre',    abrev: 'PC' },
    { codigo: 'pp', nome: 'Peças de Prata',    abrev: 'PP' },
    { codigo: 'pe', nome: 'Peças de Eletro',   abrev: 'PE' },
    { codigo: 'po', nome: 'Peças de Ouro',     abrev: 'PO' },
    { codigo: 'pl', nome: 'Peças de Platina',  abrev: 'PL' },
  ];

  window.PHB = { ARMAS, ARMADURAS, FERRAMENTAS, ITENS, MOEDAS };
})();

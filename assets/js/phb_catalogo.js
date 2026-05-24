// assets/js/phb_catalogo.js
// Catálogo de equipamentos do PHB para a aba de Equipamento da ficha.
// Subset prático — armas comuns, armaduras, ferramentas e itens de aventura.

(function () {
  // ─── ARMAS ──────────────────────────────────────────────────────
  // {nome, dano, dano_tipo, tipo (simples/marcial), categoria (corpo/distancia), propriedades, peso, custo}
  const ARMAS = [
    // Simples Corpo-a-corpo
    { nome: 'Adaga',         dano: '1d4',  tipo_dano: 'Perfurante', categoria: 'Simples corpo-a-corpo', propriedades: 'Acuidade, Leve, Arremesso (6/18m)', peso: 0.5,  custo: '2 po' },
    { nome: 'Bordão',        dano: '1d6',  tipo_dano: 'Concussão',  categoria: 'Simples corpo-a-corpo', propriedades: 'Versátil (1d8)',                     peso: 2,    custo: '2 pp' },
    { nome: 'Clava',         dano: '1d4',  tipo_dano: 'Concussão',  categoria: 'Simples corpo-a-corpo', propriedades: 'Leve',                               peso: 1,    custo: '1 pp' },
    { nome: 'Clava Grande',  dano: '1d8',  tipo_dano: 'Concussão',  categoria: 'Simples corpo-a-corpo', propriedades: 'Duas mãos',                          peso: 5,    custo: '2 pp' },
    { nome: 'Foice',         dano: '1d6',  tipo_dano: 'Cortante',   categoria: 'Simples corpo-a-corpo', propriedades: 'Leve',                               peso: 1,    custo: '1 po' },
    { nome: 'Lança',         dano: '1d6',  tipo_dano: 'Perfurante', categoria: 'Simples corpo-a-corpo', propriedades: 'Arremesso (6/18m), Versátil (1d8)',  peso: 1.5,  custo: '1 po' },
    { nome: 'Maça',          dano: '1d6',  tipo_dano: 'Concussão',  categoria: 'Simples corpo-a-corpo', propriedades: '—',                                  peso: 2,    custo: '5 po' },
    { nome: 'Machadinha',    dano: '1d6',  tipo_dano: 'Cortante',   categoria: 'Simples corpo-a-corpo', propriedades: 'Leve, Arremesso (6/18m)',            peso: 1,    custo: '5 po' },
    { nome: 'Martelo Leve',  dano: '1d4',  tipo_dano: 'Concussão',  categoria: 'Simples corpo-a-corpo', propriedades: 'Leve, Arremesso (6/18m)',            peso: 1,    custo: '2 po' },
    { nome: 'Picareta de Guerra', dano: '1d6', tipo_dano: 'Perfurante', categoria: 'Simples corpo-a-corpo', propriedades: '—',                              peso: 1,    custo: '5 po' },
    // Simples Distância
    { nome: 'Arco Curto',    dano: '1d6',  tipo_dano: 'Perfurante', categoria: 'Simples distância',     propriedades: 'Duas mãos, Munição (24/96m)',        peso: 1,    custo: '25 po' },
    { nome: 'Besta Leve',    dano: '1d8',  tipo_dano: 'Perfurante', categoria: 'Simples distância',     propriedades: 'Duas mãos, Munição (24/96m), Recarga', peso: 2.5, custo: '25 po' },
    { nome: 'Dardo',         dano: '1d4',  tipo_dano: 'Perfurante', categoria: 'Simples distância',     propriedades: 'Acuidade, Arremesso (6/18m)',        peso: 0.1,  custo: '5 pc' },
    { nome: 'Funda',         dano: '1d4',  tipo_dano: 'Concussão',  categoria: 'Simples distância',     propriedades: 'Munição (9/36m)',                    peso: 0,    custo: '1 pp' },
    // Marciais Corpo-a-corpo
    { nome: 'Cimitarra',     dano: '1d6',  tipo_dano: 'Cortante',   categoria: 'Marcial corpo-a-corpo', propriedades: 'Acuidade, Leve',                     peso: 1.5,  custo: '25 po' },
    { nome: 'Espada Curta',  dano: '1d6',  tipo_dano: 'Perfurante', categoria: 'Marcial corpo-a-corpo', propriedades: 'Acuidade, Leve',                     peso: 1,    custo: '10 po' },
    { nome: 'Espada Longa',  dano: '1d8',  tipo_dano: 'Cortante',   categoria: 'Marcial corpo-a-corpo', propriedades: 'Versátil (1d10)',                    peso: 1.5,  custo: '15 po' },
    { nome: 'Espadagual',    dano: '2d6',  tipo_dano: 'Cortante',   categoria: 'Marcial corpo-a-corpo', propriedades: 'Pesada, Duas mãos',                  peso: 3,    custo: '50 po' },
    { nome: 'Glaive',        dano: '1d10', tipo_dano: 'Cortante',   categoria: 'Marcial corpo-a-corpo', propriedades: 'Pesada, Alcance, Duas mãos',         peso: 3,    custo: '20 po' },
    { nome: 'Machado de Batalha', dano: '1d8', tipo_dano: 'Cortante', categoria: 'Marcial corpo-a-corpo', propriedades: 'Versátil (1d10)',                  peso: 2,    custo: '10 po' },
    { nome: 'Machado Grande', dano: '1d12', tipo_dano: 'Cortante',  categoria: 'Marcial corpo-a-corpo', propriedades: 'Pesada, Duas mãos',                  peso: 3.5,  custo: '30 po' },
    { nome: 'Martelo de Guerra', dano: '1d8', tipo_dano: 'Concussão', categoria: 'Marcial corpo-a-corpo', propriedades: 'Versátil (1d10)',                  peso: 1,    custo: '15 po' },
    { nome: 'Mangual',       dano: '1d8',  tipo_dano: 'Concussão',  categoria: 'Marcial corpo-a-corpo', propriedades: '—',                                  peso: 1,    custo: '10 po' },
    { nome: 'Maça-estrela',  dano: '1d8',  tipo_dano: 'Perfurante', categoria: 'Marcial corpo-a-corpo', propriedades: '—',                                  peso: 2,    custo: '5 po' },
    { nome: 'Rapieira',      dano: '1d8',  tipo_dano: 'Perfurante', categoria: 'Marcial corpo-a-corpo', propriedades: 'Acuidade',                           peso: 1,    custo: '25 po' },
    { nome: 'Tridente',      dano: '1d6',  tipo_dano: 'Perfurante', categoria: 'Marcial corpo-a-corpo', propriedades: 'Arremesso (6/18m), Versátil (1d8)',  peso: 2,    custo: '5 po' },
    // Marciais Distância
    { nome: 'Arco Longo',    dano: '1d8',  tipo_dano: 'Perfurante', categoria: 'Marcial distância',     propriedades: 'Pesada, Duas mãos, Munição (45/180m)', peso: 1, custo: '50 po' },
    { nome: 'Besta de Mão',  dano: '1d6',  tipo_dano: 'Perfurante', categoria: 'Marcial distância',     propriedades: 'Leve, Munição (9/36m), Recarga',     peso: 1.5,  custo: '75 po' },
    { nome: 'Besta Pesada',  dano: '1d10', tipo_dano: 'Perfurante', categoria: 'Marcial distância',     propriedades: 'Pesada, Duas mãos, Munição (30/120m), Recarga', peso: 8.5, custo: '50 po' },
  ];

  // ─── ARMADURAS ───────────────────────────────────────────────────
  const ARMADURAS = [
    // Leves
    { nome: 'Acolchoada',       ca: '11 + DES',                 tipo: 'Leve',     furtividade: 'Desvantagem', forca: '—', peso: 4,    custo: '5 po' },
    { nome: 'Couro',            ca: '11 + DES',                 tipo: 'Leve',     furtividade: '—',          forca: '—', peso: 5,    custo: '10 po' },
    { nome: 'Couro Batido',     ca: '12 + DES',                 tipo: 'Leve',     furtividade: '—',          forca: '—', peso: 6.5,  custo: '45 po' },
    // Médias
    { nome: 'Camisão de Malha', ca: '13 + DES (máx 2)',         tipo: 'Média',    furtividade: '—',          forca: '—', peso: 10,   custo: '50 po' },
    { nome: 'Gibão de Peles',   ca: '12 + DES (máx 2)',         tipo: 'Média',    furtividade: '—',          forca: '—', peso: 6,    custo: '10 po' },
    { nome: 'Brunea',           ca: '14 + DES (máx 2)',         tipo: 'Média',    furtividade: 'Desvantagem', forca: '—', peso: 10,   custo: '75 po' },
    { nome: 'Cota de Escamas',  ca: '14 + DES (máx 2)',         tipo: 'Média',    furtividade: 'Desvantagem', forca: '—', peso: 22,   custo: '50 po' },
    { nome: 'Peitoral',         ca: '14 + DES (máx 2)',         tipo: 'Média',    furtividade: '—',          forca: '—', peso: 10,   custo: '400 po' },
    { nome: 'Meia-armadura',    ca: '15 + DES (máx 2)',         tipo: 'Média',    furtividade: 'Desvantagem', forca: '—', peso: 20,   custo: '750 po' },
    // Pesadas
    { nome: 'Cota de Anéis',    ca: '14',                       tipo: 'Pesada',   furtividade: 'Desvantagem', forca: '—', peso: 20,   custo: '30 po' },
    { nome: 'Cota de Malha',    ca: '16',                       tipo: 'Pesada',   furtividade: 'Desvantagem', forca: 'F13', peso: 27, custo: '75 po' },
    { nome: 'Brunea Marcial',   ca: '17',                       tipo: 'Pesada',   furtividade: 'Desvantagem', forca: 'F15', peso: 30, custo: '200 po' },
    { nome: 'Armadura de Placas', ca: '18',                     tipo: 'Pesada',   furtividade: 'Desvantagem', forca: 'F15', peso: 32, custo: '1500 po' },
    // Escudo
    { nome: 'Escudo',           ca: '+2',                       tipo: 'Escudo',   furtividade: '—',          forca: '—', peso: 3,    custo: '10 po' },
  ];

  // ─── FERRAMENTAS E KITS ──────────────────────────────────────────
  const FERRAMENTAS = [
    { nome: 'Ferramentas de Ladrão',          peso: 0.5,  custo: '25 po' },
    { nome: 'Kit de Disfarce',                peso: 1.5,  custo: '25 po' },
    { nome: 'Kit de Falsificação',            peso: 2.5,  custo: '15 po' },
    { nome: 'Kit de Cura',                    peso: 1.5,  custo: '5 po' },
    { nome: 'Kit de Erveiro',                 peso: 1.5,  custo: '5 po' },
    { nome: 'Kit de Envenenamento',           peso: 1,    custo: '50 po' },
    { nome: 'Suprimentos de Calígrafo',       peso: 2.5,  custo: '10 po' },
    { nome: 'Suprimentos de Pintura',         peso: 2.5,  custo: '10 po' },
    { nome: 'Suprimentos de Alquimista',      peso: 4,    custo: '50 po' },
    { nome: 'Instrumento Musical (qualquer)', peso: 1,    custo: '— po' },
  ];

  // ─── ITENS DE AVENTURA ───────────────────────────────────────────
  const ITENS = [
    { nome: 'Mochila',                  peso: 2.5,  custo: '2 po' },
    { nome: 'Saco de Dormir',           peso: 3.5,  custo: '1 po' },
    { nome: 'Algemas',                  peso: 3,    custo: '2 po' },
    { nome: 'Cantil',                   peso: 2.5,  custo: '2 pp' },
    { nome: 'Corda de Cânhamo (15m)',   peso: 5,    custo: '1 po' },
    { nome: 'Corda de Seda (15m)',      peso: 2.5,  custo: '10 po' },
    { nome: 'Gancho de Escalada',       peso: 2,    custo: '2 po' },
    { nome: 'Lanterna Furta-Fogo',      peso: 1,    custo: '5 po' },
    { nome: 'Tocha',                    peso: 0.5,  custo: '1 pc' },
    { nome: 'Vela',                     peso: 0,    custo: '1 pc' },
    { nome: 'Pederneira e Isqueiro',    peso: 0,    custo: '5 pc' },
    { nome: 'Rações (1 dia)',           peso: 1,    custo: '5 pp' },
    { nome: 'Odre',                     peso: 2.5,  custo: '2 pp' },
    { nome: 'Poção de Cura',            peso: 0.25, custo: '50 po' },
    { nome: 'Pergaminho (em branco)',   peso: 0,    custo: '1 pp' },
    { nome: 'Tinta (frasco)',           peso: 0,    custo: '10 po' },
    { nome: 'Pena',                     peso: 0,    custo: '2 pc' },
    { nome: 'Livro',                    peso: 2.5,  custo: '25 po' },
    { nome: 'Foco Arcano (cajado)',     peso: 2,    custo: '5 po' },
    { nome: 'Foco Druídico',            peso: 0.5,  custo: '1 po' },
    { nome: 'Símbolo Sagrado',          peso: 0.5,  custo: '5 po' },
    { nome: 'Componente Material',      peso: 1,    custo: '5 po' },
    { nome: 'Manto com Capuz',          peso: 2,    custo: '5 pp' },
    { nome: 'Vestes Comuns',            peso: 1.5,  custo: '5 pp' },
    { nome: 'Vestes Finas',             peso: 3,    custo: '15 po' },
    { nome: 'Vestes Viajante',          peso: 2,    custo: '2 po' },
  ];

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

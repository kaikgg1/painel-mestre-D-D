// assets/js/condicoes_regras.js
// Lista canônica das 14 condições do PHB 5e (2014) + descrição curta de cada
// efeito mecânico. A ORDEM e os NOMES são exatamente os mesmos do array
// CONDICOES já usado em paineis/painel_mestre_dnd5e.html — os dois lêem/
// escrevem a mesma coluna characters.condicoes (text[]), então uma lista
// diferente quebraria a compatibilidade entre ficha e painel do Mestre.
// Módulo novo (Fase 3 do redesign da ficha): a ficha agora também MOSTRA e
// edita condições (antes só o Mestre via); o painel do Mestre continua com
// sua própria lista inline — não foi tocado.
//
// API:
//   CondicoesRegras.LISTA                 -> array de nomes, na ordem canônica
//   CondicoesRegras.descricao(nome)        -> string (efeito mecânico resumido)

(function () {
  const LISTA = [
    'Agarrado', 'Amedrontado', 'Atordoado', 'Caído', 'Cego', 'Enfeitiçado',
    'Envenenado', 'Impedido', 'Incapacitado', 'Inconsciente', 'Invisível',
    'Paralisado', 'Petrificado', 'Surdo',
  ];

  const DESCRICOES = {
    'Agarrado':     'Deslocamento reduzido a 0; a condição acaba se quem agarra for incapacitado ou se algo forçar o alvo pra fora do alcance.',
    'Amedrontado':  'Desvantagem em testes de habilidade e jogadas de ataque enquanto a fonte do medo estiver à vista; não pode se aproximar dela voluntariamente.',
    'Atordoado':    'Incapacitado, não pode se mover e só fala com dificuldade; falha automaticamente em testes de Força e Destreza; ataques contra ele têm vantagem.',
    'Caído':        'Só pode se arrastar (ou gastar metade do deslocamento pra ficar em pé); desvantagem em jogadas de ataque; ataques corpo-a-corpo contra ele têm vantagem, à distância têm desvantagem.',
    'Cego':         'Falha automaticamente em qualquer teste que exija visão; desvantagem em jogadas de ataque; ataques contra ele têm vantagem.',
    'Enfeitiçado':  'Não pode atacar quem o enfeitiçou nem alvejá-lo com efeitos nocivos; quem o enfeitiçou tem vantagem em testes de interação social com ele.',
    'Envenenado':   'Desvantagem em jogadas de ataque e em testes de habilidade.',
    'Impedido':     'Deslocamento reduzido a 0; desvantagem em jogadas de ataque e em testes de Destreza; ataques contra ele têm vantagem.',
    'Incapacitado': 'Não pode realizar ações nem reações.',
    'Inconsciente': 'Incapacitado, caído, larga o que estiver segurando; falha automaticamente em Força e Destreza; ataques contra ele têm vantagem, e acertos a até 1,5m são críticos automáticos.',
    'Invisível':    'Impossível de ver sem magia ou sentido especial; tem vantagem em jogadas de ataque; jogadas de ataque contra ele têm desvantagem.',
    'Paralisado':   'Incapacitado, não pode se mover nem falar; falha automaticamente em Força e Destreza; ataques contra ele têm vantagem, e acertos a até 1,5m são críticos automáticos.',
    'Petrificado':  'Transformado em substância sólida (junto com itens não-mágicos carregados); incapacitado, não percebe o ambiente; resistência a todo dano; imune a veneno e doença.',
    'Surdo':        'Falha automaticamente em qualquer teste que exija audição.',
  };

  function descricao(nome) {
    return DESCRICOES[nome] || '';
  }

  window.CondicoesRegras = { LISTA, descricao };
})();

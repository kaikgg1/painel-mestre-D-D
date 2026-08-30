// assets/js/icones.js
// Mapa CANÔNICO de ícones do projeto (Iconify + game-icons) e helpers.
//
// Objetivo: parar de usar emoji colorido de sistema (que muda de cara em cada
// SO/navegador) e padronizar em ícones vetoriais que herdam `currentColor`.
//
// Uso:
//   <script src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js"></script>
//   <script src="../assets/js/icones.js"></script>
//
//   Icones.html('dragao')                    -> '<iconify-icon icon="game-icons:dragon-head"></iconify-icon>'
//   Icones.html('dragao', {cor:'var(--gold)', tam:'22px', cls:'meu-icone'})
//   Icones.slug('dragao')                    -> 'game-icons:dragon-head'
//   Icones.aplicar(document.body)            -> troca [data-ico] pelo ícone
//
// No HTML dá pra usar direto, sem JS:
//   <span data-ico="dragao"></span>
//
// IMPORTANTE: só emoji PICTÓRICO vira ícone. Setas (←→↑), checks (✓✕),
// estrelas (★☆) e ornamentos (✦✠⚜) continuam como texto — são leves,
// consistentes entre plataformas e não valem uma requisição de rede.

(function () {
  'use strict';

  // chave semântica -> slug do game-icons (TODOS verificados: HTTP 200)
  const MAPA = {
    // --- Criaturas / tipos de monstro ---
    dragao:           'dragon-head',
    besta:            'paw-print',
    celestial:        'sparkles',
    constructo:       'robot-golem',
    corruptor:        'imp-laugh',
    elemental:        'tornado',
    enxame:           'fly',
    fada:             'mushroom-gills',
    gigante:          'stone-block',
    humanoide:        'person',
    limo:             'abstract-024',
    monstruosidade:   'scorpion',
    mortovivo:        'skull-crossed-bones',
    planta:           'leaf-swirl',
    aberracao:        'eye-target',
    vampiro:          'vampire-dracula',
    lobo:             'wolf-howl',

    // --- Escolas de magia ---
    abjuracao:        'magic-shield',
    conjuracao:       'magic-palm',
    adivinhacao:      'crystal-ball',
    encantamento:     'enlightenment',
    evocacao:         'fire-ray',
    ilusao:           'ghost',
    necromancia:      'crossed-bones',
    transmutacao:     'crystal-shine',

    // --- Seções / navegação ---
    bestiario:        'dragon-head',
    magias:           'book-cover',
    itens:            'scroll-unfurled',
    personagens:      'drama-masks',
    campanha:         'crossed-swords',
    buscar:           'magnifying-glass',
    grimorio:         'open-book',
    notas:            'notebook',
    mapa:             'treasure-map',

    // --- Ficha / combate ---
    vida:             'bleeding-heart',
    cura:             'heart-plus',
    dano:             'sword-wound',
    escudo:           'round-shield',
    armadura:         'helmet',
    iniciativa:       'stopwatch',
    dado:             'dice-twenty-faces-twenty',
    ataque:           'crossed-swords',
    alvo:             'bullseye',
    exaustao:         'hourglass',
    inspiracao:       'sparkles',
    mochila:          'backpack',
    pocao:            'health-potion',
    moedas:           'coins',
    tesouro:          'chest',
    anel:             'ring',
    manto:            'cloak',
    bota:             'boot-prints',
    varinha:          'quill-ink',
    pegadas:          'footprint',

    // --- Estado / ações de UI ---
    salvar:           'save',
    editar:           'pencil',
    lixeira:          'trash-can',
    cadeado:          'padlock',
    mestre:           'crown',
    jogador:          'player-base',
    grupo:            'two-shadows',
    descanso:         'campfire',
    noite:            'moon',
    dia:              'sun',
    fogo:             'flame',
    tocha:            'torch',
    lanterna:         'lantern-flame',
    tempo:            'sands-of-time',
    troféu:           'trophy',
    musica:           'musical-notes',
    dossie:           'drama-masks',
    oculto:           'hooded-figure',

    // --- Acrescentados pela ficha do jogador (todos verificados: HTTP 200) ---
    cadeado_aberto:   'padlock-open',      // modo edição liberado
    coracao:          'hearts',            // PV saudável
    caveira:          'skull-crossed-bones',
    folego:           'lungs',             // Retomar o Fôlego (Guerreiro)
    sorte:            'clover',            // Golpe de Sorte (Ladino)
    raio:             'lightning-arc',     // Surto de Ação (Guerreiro)
    atordoado:        'knocked-out-stars', // Exaustão
    brilho:           'sparkles',          // ✨ genérico
    conjurar:         'magic-swirl',       // conjurar magia
    pergaminho:       'scroll-unfurled',
    olho:             'eye-target',        // Sentido Divino
    retrato:          'portrait',          // placeholder de imagem
    arquivo:          'files',             // escolher arquivo
    aviso:            'hazard-sign',

    // --- Acrescentados pelos filtros do hub de Personagens (verificados: HTTP 200) ---
    vilao:            'evil-minion',       // filtro "Vilões"
    aliado:           'shaking-hands',     // filtro "Aliados & NPCs"
    metamorfo:        'transform',         // filtro "Múltiplas formas"

    // --- Acrescentados pelos painéis do Mestre / login / compêndio (HTTP 200) ---
    calendario:       'calendar',          // data da anotação
    clique:           'click',             // "selecione um item da lista"
    caixa:            'cardboard-box',     // estado vazio
    balanca:          'scales',            // categoria "Decisão"
    imprimir:         'paper-tray',        // botão Imprimir
    ficha:            'scroll-quill',      // ficha de personagem
    elfa:             'elf-helmet',        // avatar de jogadora elfa
    arqueiro:         'bowman',            // avatar de jogador arqueiro
    arma:             'sword-brandish',    // item mágico do tipo Arma
    cajado:           'wizard-staff',      // item mágico Cajado/Bastão
    peitoral:         'breastplate',       // item mágico Armadura
    // --- Condicoes e estados das fichas de personagem (verificados: HTTP 200) ---
    amedrontado:      'terror',
    luz_solar:        'sun-radiations',
    agua_corrente:    'water-drop',
    envenenado:       'poison-bottle',
    cego:             'sight-disabled',
    surdo:            'sound-off',
    lento:            'snail',
    sangrando:        'bleeding-wound',
    enfeiticado:      'love-howl',
    inconsciente:     'knocked-out-stars',
    invisivel:        'invisible',
    prata:            'silver-bullet',
    corvo:            'raven',
    pena:             'feather',
    morcego:          'bat-wing',
    espelho:          'mirror-mirror',
    sopro:            'dragon-breath',
    telepatia:        'telepathy',
    teia:             'spider-web',
    fantasma:         'ghost',
    ossos:            'broken-bone',
    areia:            'quicksand',
    bolhas:           'bubbles',
    sono:             'sleepy',
    estaca:           'wood-club',
    cruz:             'cross-mark',
    caixao:           'coffin',
    espada:           'sword-brandish',
    caixa2:           'box-unpacking',
    forma_lobo:       'wolf-head',
    forma_humana:     'person',
    transformar:      'transform',
    sombras:          'shadow-follower',
    gelo:             'zigzag-leaf',
    ceu_noturno:      'night-sky',
  };

  const PREFIXO = 'game-icons:';

  function slug(chave) {
    const s = MAPA[chave];
    return s ? PREFIXO + s : null;
  }

  /** Gera a tag <iconify-icon>. opts: {cor, tam, cls, titulo} */
  function html(chave, opts) {
    const s = slug(chave);
    if (!s) return '';
    const o = opts || {};
    const estilo = [
      o.cor ? `color:${o.cor}` : '',
      o.tam ? `font-size:${o.tam}` : '',
    ].filter(Boolean).join(';');
    return '<iconify-icon'
      + ` icon="${s}"`
      + (o.cls ? ` class="${o.cls}"` : '')
      + (estilo ? ` style="${estilo}"` : '')
      + (o.titulo ? ` title="${o.titulo}"` : ' aria-hidden="true"')
      + '></iconify-icon>';
  }

  /**
   * Troca todo [data-ico="chave"] pelo ícone correspondente.
   * Atributos opcionais no elemento: data-ico-cor, data-ico-tam.
   * Idempotente: já processados ganham data-ico-ok e são pulados.
   */
  function aplicar(raiz) {
    const alvo = raiz || document;
    alvo.querySelectorAll('[data-ico]:not([data-ico-ok])').forEach(el => {
      const marcado = html(el.dataset.ico, {
        cor: el.dataset.icoCor,
        tam: el.dataset.icoTam,
      });
      if (marcado) {
        el.innerHTML = marcado;
        el.setAttribute('data-ico-ok', '');
      }
    });
  }

  window.Icones = { MAPA, slug, html, aplicar };

  // Aplica sozinho no carregamento (e de novo se o DOM já estiver pronto).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => aplicar());
  } else {
    aplicar();
  }
})();

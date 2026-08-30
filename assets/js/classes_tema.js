// assets/js/classes_tema.js
// Tema visual (cor + ícone) por classe de D&D 5e, usado nos painéis do mestre
// pra dar identidade visual a cada personagem. Auto-contido, sem CSS externo.
(function () {
  const CLASSES = [
    { chave: 'clerigo',     estilos: ['clerig'],               cor: '#c9922a', icone: 'clerigo' },
    { chave: 'guerreiro',   estilos: ['guerreir'],              cor: '#6e7f8f', icone: 'guerreiro' },
    { chave: 'feiticeiro',  estilos: ['feitic'],                cor: '#8b3fa8', icone: 'feiticeiro' },
    { chave: 'bruxo',       estilos: ['brux'],                  cor: '#5a2e7a', icone: 'bruxo' },
    { chave: 'bardo',       estilos: ['bard'],                  cor: '#c04d8a', icone: 'bardo' },
    { chave: 'druida',      estilos: ['druid'],                 cor: '#4f8f3a', icone: 'druida' },
    { chave: 'monge',       estilos: ['monge', 'monj'],         cor: '#c47a2a', icone: 'monge' },
    // 'paladino' PRECISA vir antes de 'ladino': "paladino" contém a substring "ladin".
    { chave: 'paladino',    estilos: ['paladin'],               cor: '#d4af37', icone: 'paladino' },
    { chave: 'ladino',      estilos: ['ladin'],                 cor: '#4a4a55', icone: 'ladino' },
    { chave: 'barbaro',     estilos: ['barbar'],                cor: '#a4291f', icone: 'barbaro' },
    { chave: 'artifice',    estilos: ['artific'],                cor: '#2a8c8c', icone: 'artifice' },
    { chave: 'patrulheiro', estilos: ['patrulheir', 'ranger'],  cor: '#5a7a3a', icone: 'patrulheiro' },
    { chave: 'mago',        estilos: ['mago', 'maga'],          cor: '#3d63a8', icone: 'mago' },
  ];

  function normalizar(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function obter(classeTexto) {
    const n = normalizar(classeTexto);
    for (const c of CLASSES) {
      if (c.estilos.some(e => n.includes(e))) return c;
    }
    return null; // classe não reconhecida -> quem chama usa o tema padrão do painel
  }

  function hexRgba(hex, alpha) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!m) return `rgba(0,0,0,${alpha})`;
    const [r, g, b] = m.slice(1).map(x => parseInt(x, 16));
    return `rgba(${r},${g},${b},${alpha})`;
  }

  window.ClasseTema = { obter, hexRgba, LISTA: CLASSES };
})();

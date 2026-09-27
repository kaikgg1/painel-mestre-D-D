// assets/js/habilidades_regras.js
// Catálogo de habilidades de classe (data/habilidades_classes.json) e o
// filtro "o que o personagem tem neste nível" — compartilhado pela ficha do
// jogador e pelos painéis do Mestre, pra os dois listarem exatamente o mesmo.
//
// API:
//   HabilidadesRegras.chaveDeClasse(classe)                 → 'clerigo'
//   HabilidadesRegras.habilidadesDoNivel(todas, nivel, sub) → [...]
//   await HabilidadesRegras.carregarCatalogo()              → {classe: [...]} | null
//   await HabilidadesRegras.doPersonagem(classe, nivel, sub) → [...]

(function () {
  // paineis/*.html → ../data/ ; raiz → data/
  const BASE = location.pathname.includes('/paineis/') ? '../data/' : 'data/';

  function chaveDeClasse(classe) {
    return (classe || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  // Quando a subclasse do PJ já tem as habilidades reais cadastradas, some a
  // linha genérica ("Característica do Arquétipo" etc.) que só marcava o nível.
  function habilidadesDoNivel(todas, nivel, subclasse) {
    const lista = Array.isArray(todas) ? todas : [];
    const temSub = !!subclasse && lista.some(h => h.subclasse === subclasse);
    return lista.filter(h => h.nivel <= (nivel || 1)
      && (!h.subclasse || h.subclasse === subclasse)
      && !(temSub && !h.subclasse && /^Característica d/i.test(h.nome)));
  }

  let _catalogo = null;
  function carregarCatalogo() {
    if (!_catalogo) {
      _catalogo = fetch(BASE + 'habilidades_classes.json')
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .catch(e => { console.warn('[habilidades] catálogo:', e); _catalogo = null; return null; });
    }
    return _catalogo;
  }

  async function doPersonagem(classe, nivel, subclasse) {
    const db = await carregarCatalogo();
    if (!db || !classe) return [];
    return habilidadesDoNivel(db[chaveDeClasse(classe)], nivel, subclasse);
  }

  window.HabilidadesRegras = { chaveDeClasse, habilidadesDoNivel, carregarCatalogo, doPersonagem };
})();

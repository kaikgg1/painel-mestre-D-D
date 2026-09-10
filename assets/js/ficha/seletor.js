// assets/js/ficha/seletor.js
// Componente de seleção reutilizável (Fase 7, §14) — substitui os <select>
// nativos gigantes de armas/armaduras/itens por busca + categorias + lista
// com scroll. Mesma marcação em qualquer largura; CSS decide a apresentação:
// bottom sheet no mobile, popover centralizado no desktop (ver seletor.css).
//
// API:
//   UI.abrirSeletor({
//     titulo: 'Adicionar arma',
//     placeholder: 'Buscar arma…',
//     itens: window.PHB.ARMAS,               // array de objetos quaisquer
//     agrupar: it => it.categoria,           // string do grupo (optgroup antigo)
//     ordemGrupos: ['Simples corpo-a-corpo', ...],  // opcional
//     rotulo: it => it.nome,                  // texto principal da linha
//     sublabel: it => `${it.dano} ${it.tipo_dano}`, // texto secundário (opcional)
//     recentesChave: 'ficha_recentes_armas',  // localStorage (opcional — sem "Recentes" se omitido)
//     onEscolher: (it) => { ... },            // chamado com o objeto original
//   })
//
// Não depende de nada específico de Equipamento — dá pra reaproveitar em
// qualquer outra lista longa que precise de busca+categoria no futuro.

(function () {
  function semAcento(s) { return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  function lerRecentes(chave) {
    if (!chave) return [];
    try { return JSON.parse(localStorage.getItem(chave) || '[]'); } catch { return []; }
  }
  function gravarRecente(chave, nome) {
    if (!chave) return;
    try {
      const atuais = lerRecentes(chave).filter(n => n !== nome);
      atuais.unshift(nome);
      localStorage.setItem(chave, JSON.stringify(atuais.slice(0, 5)));
    } catch { /* localStorage indisponível — recentes é só conveniência, não crítico */ }
  }

  function abrirSeletor(opts) {
    const {
      titulo, placeholder, itens, agrupar, ordemGrupos, rotulo,
      sublabel, recentesChave, onEscolher,
    } = opts;

    const rotuloDe = it => escape(rotulo(it));
    const sublabelDe = it => sublabel ? escape(sublabel(it)) : '';

    const overlay = document.createElement('div');
    overlay.className = 'seletor-overlay';
    overlay.innerHTML = `
      <div class="seletor-painel" role="dialog" aria-modal="true" aria-label="${escape(titulo)}">
        <div class="seletor-handle" aria-hidden="true"></div>
        <div class="seletor-header">
          <h4>${escape(titulo)}</h4>
          <button type="button" class="seletor-fechar no-lock" aria-label="Fechar">✕</button>
        </div>
        <input type="search" class="seletor-busca" placeholder="${escape(placeholder || 'Buscar…')}" aria-label="${escape(placeholder || 'Buscar')}">
        <div class="seletor-corpo"></div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // .seletor-corpo (classe, não id): esta função pode rodar de novo antes
    // do overlay ANTERIOR terminar sua animação de saída (setTimeout de 200ms
    // no fechar() abaixo) — dois overlays com o mesmo id coexistindo no DOM
    // por uma fração de segundo já causou getElementById-like lookups
    // resolverem pro elemento errado (ou null). Sempre escopado a `overlay`,
    // então não precisa de id nenhum pra ser único.
    const corpo = overlay.querySelector('.seletor-corpo');
    const buscaInput = overlay.querySelector('.seletor-busca');

    function renderLinha(it, idx) {
      const sub = sublabelDe(it);
      return `<button type="button" class="seletor-item" data-idx="${idx}">
        <span class="seletor-item-nome">${rotuloDe(it)}</span>
        ${sub ? `<span class="seletor-item-sub">${sub}</span>` : ''}
      </button>`;
    }

    function montarLista(termo) {
      const t = semAcento(termo);
      const filtrados = itens
        .map((it, idx) => ({ it, idx }))
        .filter(({ it }) => !t || semAcento(rotulo(it) + ' ' + (sublabel ? sublabel(it) : '')).includes(t));

      let html = '';

      // "Recentes" só faz sentido sem busca ativa (senão é só ruído redundante)
      if (!t && recentesChave) {
        const nomesRecentes = lerRecentes(recentesChave);
        const recentesItens = nomesRecentes
          .map(nome => itens.findIndex(it => rotulo(it) === nome))
          .filter(idx => idx !== -1)
          .map(idx => ({ it: itens[idx], idx }));
        if (recentesItens.length) {
          html += `<div class="seletor-secao"><h5>Recentes</h5>${recentesItens.map(({it,idx}) => renderLinha(it, idx)).join('')}</div>`;
        }
      }

      const grupos = {};
      for (const { it, idx } of filtrados) {
        const cat = agrupar ? (agrupar(it) || 'Outros') : '';
        (grupos[cat] = grupos[cat] || []).push({ it, idx });
      }
      const nomesGrupos = Object.keys(grupos).sort((a, b) => {
        if (ordemGrupos) {
          const ia = ordemGrupos.indexOf(a), ib = ordemGrupos.indexOf(b);
          if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        }
        return a.localeCompare(b, 'pt');
      });
      for (const cat of nomesGrupos) {
        html += `<div class="seletor-secao">${cat ? `<h5>${escape(cat)}</h5>` : ''}${grupos[cat].map(({it,idx}) => renderLinha(it, idx)).join('')}</div>`;
      }

      corpo.innerHTML = html || `<div class="item-vazio" style="padding:20px">Nada encontrado.</div>`;
      corpo.querySelectorAll('.seletor-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const it = itens[+btn.dataset.idx];
          gravarRecente(recentesChave, rotulo(it));
          fechar();
          onEscolher(it);
        });
      });
    }

    montarLista('');
    buscaInput.addEventListener('input', () => montarLista(buscaInput.value));

    function fechar() {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      setTimeout(() => overlay.remove(), 200);
    }
    const onKey = e => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });
    overlay.querySelector('.seletor-fechar').addEventListener('click', fechar);

    requestAnimationFrame(() => {
      overlay.classList.add('open');
      buscaInput.focus();
    });
  }

  window.UI = Object.assign(window.UI || {}, { abrirSeletor });
})();

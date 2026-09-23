// paineis/reloaded/busca.js
// Busca do guia Reloaded: full-text em todas as páginas, com trecho na lista de
// resultados e destaque das ocorrências dentro da página aberta.
//
// O índice (busca-indice.js + busca-texto.js, gerados por
// scripts/gerar_indice_reloaded.js) só é baixado quando alguém usa a busca.
// Os cabeçalhos chegam primeiro e já respondem; o corpo entra depois e a lista
// se refaz sozinha.
(function () {
  'use strict';

  var MIN_TERMO = 2;
  var MAX_PAGINAS = 12;      // páginas listadas
  var MAX_SECOES = 3;        // trechos por página
  var LARGURA_TRECHO = 110;  // caracteres em volta da ocorrência

  // ---------------------------------------------------------------- utilidades
  // Tirar acento por NFD mantém o comprimento 1:1 com o texto original em todo o
  // corpus do guia (conferido na geração do índice), então dá pra usar as
  // posições achadas no texto normalizado direto no texto original.
  function norm(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  // palavras que aparecem em toda frase do guia: só atrapalham o ranking e
  // sujariam o destaque na página. Saem, a não ser que a busca seja só elas.
  var VAZIAS = {
    de: 1, da: 1, do: 1, das: 1, dos: 1, no: 1, na: 1, nos: 1, nas: 1, em: 1,
    um: 1, uma: 1, uns: 1, umas: 1, os: 1, as: 1, ao: 1, aos: 1, ou: 1, se: 1,
    que: 1, com: 1, por: 1, para: 1, pra: 1, sem: 1, sobre: 1, como: 1
  };

  function termosDe(q) {
    var vistos = {};
    var todos = norm(q).split(/[^0-9a-z]+/).filter(function (t) {
      if (t.length < MIN_TERMO || vistos[t]) return false;
      vistos[t] = 1;
      return true;
    });
    var uteis = todos.filter(function (t) { return !VAZIAS[t]; });
    return uteis.length ? uteis : todos;
  }

  function ocorrencias(alvo, ts) {
    var res = [];
    for (var i = 0; i < ts.length; i++) {
      var t = ts[i], de = 0, p;
      while ((p = alvo.indexOf(t, de)) !== -1) {
        res.push([p, p + t.length]);
        de = p + t.length;
      }
    }
    res.sort(function (a, b) { return a[0] - b[0]; });
    var out = [];
    for (var k = 0; k < res.length; k++) {
      var ult = out[out.length - 1];
      if (ult && res[k][0] <= ult[1]) { if (res[k][1] > ult[1]) ult[1] = res[k][1]; }
      else out.push([res[k][0], res[k][1]]);
    }
    return out;
  }

  function temTodos(alvo, ts) {
    for (var i = 0; i < ts.length; i++) if (alvo.indexOf(ts[i]) === -1) return false;
    return true;
  }

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  var PAGINA_ATUAL = (location.pathname.split('/').pop() || 'index.html');

  // ------------------------------------------------------------------- índice
  var IDX = { leve: null, texto: null, erro: false, pedido: false, aoMudar: [] };

  function carregarScript(src, cb) {
    var s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = function () { cb(null); };
    s.onerror = function () { cb(new Error(src)); };
    document.head.appendChild(s);
  }

  function pedirIndice() {
    if (IDX.pedido) return;
    IDX.pedido = true;
    carregarScript('busca-indice.js', function (err) {
      if (err) { IDX.erro = true; } else {
        IDX.leve = window.RELOADED_BUSCA;
        IDX.leve.paginas.forEach(function (p) {
          p.nt = norm(p.t); p.ng = norm(p.g || '');
          p.s.forEach(function (sec) { sec.nh = norm(sec.h || ''); });
        });
        casarTexto();
      }
      avisar();
    });
    carregarScript('busca-texto.js', function (err) {
      if (err) { IDX.erro = true; } else { IDX.texto = window.RELOADED_BUSCA_TEXTO; casarTexto(); }
      avisar();
    });
  }

  function casarTexto() {
    if (!IDX.leve || !IDX.texto || IDX.leve.pronto) return;
    IDX.leve.paginas.forEach(function (p, pi) {
      var textos = IDX.texto[pi] || [];
      p.s.forEach(function (sec, si) {
        sec.x = textos[si] || '';
        sec.nx = norm(sec.x);
      });
    });
    IDX.leve.pronto = true;
  }

  function avisar() { IDX.aoMudar.forEach(function (f) { f(); }); }

  // -------------------------------------------------------------------- busca
  function buscar(q) {
    var ts = termosDe(q);
    if (!ts.length || !IDX.leve) return { ts: ts, paginas: [], totalPaginas: 0 };
    // com mais de uma palavra, quem tem a expressão inteira junta vem antes de
    // quem só tem as palavras espalhadas pela seção
    var frase = ts.length > 1 ? norm(q).trim().replace(/\s+/g, ' ') : '';
    var achados = [];

    IDX.leve.paginas.forEach(function (p) {
      var noTitulo = temTodos(p.nt + ' ' + p.ng, ts);
      var secoes = [], total = 0, soma = 0, melhor = 0;

      p.s.forEach(function (sec) {
        var nh = sec.nh || '', nx = sec.nx || '';
        var hitsH = ocorrencias(nh, ts);
        var hitsX = nx ? ocorrencias(nx, ts) : [];
        if (!hitsH.length && !hitsX.length) return;
        // só vira trecho quando a seção (com seu cabeçalho) cobre todos os termos
        var completa = temTodos(nh + ' ' + nx, ts);
        total += hitsH.length + hitsX.length;
        // a seção que tem o assunto no próprio cabeçalho vale muito mais que
        // uma página comprida que só cita o termo várias vezes de passagem —
        // por isso o corpo entra com teto baixo.
        var naFrase = frase && (nh.indexOf(frase) !== -1 || nx.indexOf(frase) !== -1);
        var pontos = (nh && temTodos(nh, ts) ? 150 : hitsH.length * 15) +
          Math.min(hitsX.length, 5) + (completa ? 10 : 0) + (naFrase ? 200 : 0);
        soma += pontos;
        if (pontos > melhor) melhor = pontos;
        if (completa) secoes.push({ sec: sec, frase: naFrase ? frase : '', pontos: pontos });
      });

      if (!secoes.length && !noTitulo) return;
      // o que manda é a melhor seção da página, não a soma: senão uma página
      // comprida que cita o termo em 30 lugares rasos passa na frente da página
      // que realmente trata do assunto.
      var peso = melhor + Math.min((soma - melhor) * 0.12, 50) + (noTitulo ? 300 : 0);
      secoes.sort(function (a, b) { return b.pontos - a.pontos; });
      achados.push({ p: p, secoes: secoes.slice(0, MAX_SECOES), total: total, peso: peso, noTitulo: noTitulo });
    });

    achados.sort(function (a, b) { return b.peso - a.peso; });
    return { ts: ts, paginas: achados.slice(0, MAX_PAGINAS), totalPaginas: achados.length };
  }

  // Monta o trecho já com <mark> nos termos, sem passar por HTML (nada de escape).
  function trechoDOM(texto, normTexto, ts, frase) {
    var hits = ocorrencias(normTexto, ts);
    var frag = document.createDocumentFragment();
    if (!hits.length) {
      frag.appendChild(document.createTextNode(texto.slice(0, LARGURA_TRECHO * 2).trim() + '…'));
      return frag;
    }
    // quando a expressão inteira aparece, mostra o trecho em volta dela
    var pFrase = frase ? normTexto.indexOf(frase) : -1;
    var centro = pFrase !== -1 ? pFrase : hits[0][0];
    var ini = Math.max(0, centro - Math.round(LARGURA_TRECHO * 0.4));
    var fim = Math.min(texto.length, ini + LARGURA_TRECHO * 2);
    if (ini > 0) {
      var esp = texto.indexOf(' ', ini);
      if (esp !== -1 && esp < ini + 20) ini = esp + 1;
    }
    if (fim < texto.length) {
      var esp2 = texto.lastIndexOf(' ', fim);
      if (esp2 > ini) fim = esp2;
    }

    if (ini > 0) frag.appendChild(document.createTextNode('…'));
    var cursor = ini;
    hits.forEach(function (h) {
      if (h[1] <= ini || h[0] >= fim) return;
      if (h[0] > cursor) frag.appendChild(document.createTextNode(texto.slice(cursor, h[0])));
      frag.appendChild(el('mark', 'busca-mark', texto.slice(h[0], Math.min(h[1], fim))));
      cursor = Math.min(h[1], fim);
    });
    if (cursor < fim) frag.appendChild(document.createTextNode(texto.slice(cursor, fim)));
    if (fim < texto.length) frag.appendChild(document.createTextNode('…'));
    return frag;
  }

  function tituloDOM(texto, ts) {
    var frag = document.createDocumentFragment();
    var hits = ocorrencias(norm(texto), ts);
    var cursor = 0;
    hits.forEach(function (h) {
      if (h[0] > cursor) frag.appendChild(document.createTextNode(texto.slice(cursor, h[0])));
      frag.appendChild(el('mark', 'busca-mark', texto.slice(h[0], h[1])));
      cursor = h[1];
    });
    if (cursor < texto.length) frag.appendChild(document.createTextNode(texto.slice(cursor)));
    return frag;
  }

  // Seções com id viram âncora normal. As que não têm (statblocks, por exemplo)
  // vão pelo número do cabeçalho na página — o mesmo que o índice guardou.
  function urlDe(pagina, secao, q) {
    var url = pagina + '?q=' + encodeURIComponent(q);
    if (secao && !secao.i && secao.k >= 0) url += '&s=' + secao.k;
    return url + (secao && secao.i ? '#' + encodeURIComponent(secao.i) : '');
  }

  function cabecalhoDe(artigo, id, ordem) {
    if (id) return document.getElementById(id);
    if (ordem >= 0) {
      var hs = artigo.querySelectorAll('h1, h2, h3, h4');
      return hs[ordem] || null;
    }
    return null;
  }

  // ------------------------------------------------------------------- painel
  function montarPainel(sidebar, input) {
    var painel = el('div', 'busca-res');
    painel.setAttribute('role', 'listbox');
    painel.hidden = true;
    input.closest('.search-box').insertAdjacentElement('afterend', painel);

    var estado = { q: '', itens: [], sel: -1 };

    function selecionar(i) {
      if (estado.sel >= 0 && estado.itens[estado.sel]) estado.itens[estado.sel].classList.remove('sel');
      estado.sel = i;
      if (i >= 0 && estado.itens[i]) {
        estado.itens[i].classList.add('sel');
        estado.itens[i].scrollIntoView({ block: 'nearest' });
        input.setAttribute('aria-activedescendant', estado.itens[i].id);
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }

    function fechar() {
      painel.hidden = true;
      sidebar.classList.remove('buscando');
      estado.itens = [];
      estado.sel = -1;
      input.removeAttribute('aria-activedescendant');
    }

    function abrir(a) {
      if (!a) return;
      if (a.getAttribute('data-pagina') === PAGINA_ATUAL) {
        // mesma página: não recarrega nada, só pula e destaca
        var id = a.getAttribute('data-id') || '';
        var ordem = a.hasAttribute('data-s') ? +a.getAttribute('data-s') : -1;
        if ((id || ordem >= 0) && history.replaceState) {
          history.replaceState(null, '', urlDe(PAGINA_ATUAL, { i: id, k: ordem }, estado.q));
        }
        destacar(estado.q, id, ordem);
        fechar();
        var sl = document.querySelector('.sidebar-left');
        if (sl) sl.classList.remove('open');
      } else {
        location.href = a.href;
      }
    }

    function render() {
      var q = estado.q;
      painel.textContent = '';
      estado.itens = [];
      estado.sel = -1;

      if (!q) { fechar(); return; }
      painel.hidden = false;
      sidebar.classList.add('buscando');

      var ts = termosDe(q);
      if (!ts.length) {
        painel.appendChild(el('div', 'busca-vazio', 'Digite ao menos ' + MIN_TERMO + ' letras.'));
        return;
      }
      if (IDX.erro) {
        painel.appendChild(el('div', 'busca-vazio', 'Não deu pra carregar o índice da busca.'));
        return;
      }
      if (!IDX.leve) {
        painel.appendChild(el('div', 'busca-vazio', 'Carregando índice…'));
        return;
      }

      var r = buscar(q);
      var cab = el('div', 'busca-cab');
      if (!r.paginas.length) {
        cab.textContent = IDX.leve.pronto
          ? 'Nada encontrado para "' + q + '".'
          : 'Nada nos títulos — ainda carregando o texto…';
        painel.appendChild(cab);
        return;
      }
      cab.textContent = r.totalPaginas + (r.totalPaginas === 1 ? ' página' : ' páginas') +
        (IDX.leve.pronto ? '' : ' · carregando o texto…');
      painel.appendChild(cab);

      r.paginas.forEach(function (res, n) {
        var grupo = el('div', 'busca-grupo');

        var cabPag = el('div', 'busca-pag');
        cabPag.appendChild(tituloDOM(res.p.t, ts));
        if (res.p.g) cabPag.appendChild(el('span', 'busca-grupo-nome', res.p.g));
        grupo.appendChild(cabPag);

        var linhas = res.secoes.length ? res.secoes : [null];
        linhas.forEach(function (item, k) {
          var a = el('a', 'busca-item');
          a.id = 'busca-item-' + n + '-' + k;
          a.setAttribute('role', 'option');
          a.href = urlDe(res.p.u, item && item.sec, q);
          a.setAttribute('data-pagina', res.p.u);
          if (item && item.sec && item.sec.i) a.setAttribute('data-id', item.sec.i);
          else if (item && item.sec && item.sec.k >= 0) a.setAttribute('data-s', item.sec.k);

          if (item && item.sec && item.sec.h) {
            var h = el('div', 'busca-sec');
            h.appendChild(tituloDOM(item.sec.h, ts));
            a.appendChild(h);
          }
          if (item && item.sec && item.sec.x) {
            var trecho = el('div', 'busca-snip');
            trecho.appendChild(trechoDOM(item.sec.x, item.sec.nx, ts, item.frase));
            a.appendChild(trecho);
          } else if (!item) {
            a.appendChild(el('div', 'busca-snip', 'Abrir a página'));
          }
          a.addEventListener('click', function (ev) {
            if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
            ev.preventDefault();
            abrir(a);
          });
          grupo.appendChild(a);
          estado.itens.push(a);
        });

        painel.appendChild(grupo);
      });

      if (r.totalPaginas > r.paginas.length) {
        painel.appendChild(el('div', 'busca-cab',
          'Mostrando as ' + r.paginas.length + ' páginas mais relevantes.'));
      }
    }

    IDX.aoMudar.push(function () { if (estado.q) render(); });

    input.addEventListener('input', function () {
      estado.q = input.value.trim();
      if (estado.q) pedirIndice();
      render();
      filtrarArvore(sidebar, estado.q);
    });
    input.addEventListener('focus', function () {
      if (!estado.q) return;
      pedirIndice();
      painel.hidden = false;
      sidebar.classList.add('buscando');
    });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        if (!estado.itens.length) return;
        ev.preventDefault();
        var i = estado.sel + (ev.key === 'ArrowDown' ? 1 : -1);
        if (i < 0) i = estado.itens.length - 1;
        if (i >= estado.itens.length) i = 0;
        selecionar(i);
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        abrir(estado.itens[estado.sel >= 0 ? estado.sel : 0]);
      } else if (ev.key === 'Escape') {
        if (estado.q) {
          input.value = '';
          estado.q = '';
          render();
          filtrarArvore(sidebar, '');
        } else {
          input.blur();
          fechar();
        }
      }
    });

    document.addEventListener('click', function (ev) {
      if (painel.hidden) return;
      if (painel.contains(ev.target) || ev.target === input) return;
      painel.hidden = true;
      sidebar.classList.remove('buscando');
    });

    return {
      input: input,
      definir: function (v) { input.value = v; estado.q = v.trim(); }
    };
  }

  // filtro antigo da árvore (só títulos) — continua valendo por baixo do painel
  function filtrarArvore(sidebar, q) {
    if (!q) { sidebar.classList.remove('filtering'); return; }
    var nq = norm(q);
    sidebar.classList.add('filtering');
    sidebar.querySelectorAll('.tree .leaf').forEach(function (a) {
      a.classList.toggle('match', norm(a.textContent).indexOf(nq) !== -1);
    });
    sidebar.querySelectorAll('.tree > details').forEach(function (d) {
      d.classList.toggle('has-match', !!d.querySelector('.leaf.match'));
    });
  }

  // ------------------------------------------------- destaque dentro da página
  var marcas = [], marcaAtual = -1, barra = null;

  function limparDestaque() {
    marcas.forEach(function (m) {
      var pai = m.parentNode;
      if (!pai) return;
      pai.replaceChild(document.createTextNode(m.textContent), m);
      pai.normalize();
    });
    marcas = [];
    marcaAtual = -1;
    if (barra) { barra.remove(); barra = null; }
  }

  function destacar(q, alvoId, ordem) {
    limparDestaque();
    var artigo = document.querySelector('main.article');
    var ts = termosDe(q);
    if (!artigo || !ts.length) return;

    var caminhador = document.createTreeWalker(artigo, NodeFilter.SHOW_TEXT, {
      acceptNode: function (no) {
        if (!no.nodeValue || !no.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var pai = no.parentNode;
        while (pai && pai !== artigo) {
          var t = pai.nodeName;
          if (t === 'SCRIPT' || t === 'STYLE' || t === 'MARK') return NodeFilter.FILTER_REJECT;
          pai = pai.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    var nos = [], no;
    while ((no = caminhador.nextNode())) nos.push(no);

    nos.forEach(function (n) {
      var hits = ocorrencias(norm(n.nodeValue), ts);
      if (!hits.length) return;
      var resto = n, deslocado = 0;
      hits.forEach(function (h) {
        var meio = resto.splitText(h[0] - deslocado);
        meio.splitText(h[1] - h[0]);
        var m = el('mark', 'busca-hit');
        m.textContent = meio.nodeValue;
        var depois = meio.nextSibling;
        meio.parentNode.replaceChild(m, meio);
        marcas.push(m);
        resto = depois;
        deslocado = h[1];
      });
    });

    if (!marcas.length) return;

    // abre callouts/detalhes fechados que esconderiam alguma ocorrência
    marcas.forEach(function (m) {
      var p = m.parentNode;
      while (p && p !== artigo) {
        if (p.nodeName === 'DETAILS') p.open = true;
        p = p.parentNode;
      }
    });

    montarBarra();

    // começa na primeira ocorrência dentro da seção que o resultado apontou
    var inicio = 0;
    var cab = cabecalhoDe(artigo, alvoId, ordem == null ? -1 : ordem);
    if (cab) {
      for (var i = 0; i < marcas.length; i++) {
        if (cab.compareDocumentPosition(marcas[i]) & Node.DOCUMENT_POSITION_FOLLOWING) {
          inicio = i;
          break;
        }
      }
    }
    irPara(inicio);
  }

  function irPara(i) {
    if (!marcas.length) return;
    if (marcaAtual >= 0 && marcas[marcaAtual]) marcas[marcaAtual].classList.remove('atual');
    marcaAtual = (i + marcas.length) % marcas.length;
    var m = marcas[marcaAtual];
    m.classList.add('atual');
    m.scrollIntoView({ block: 'center' });
    if (barra) {
      barra.querySelector('.busca-barra-num').textContent = (marcaAtual + 1) + ' de ' + marcas.length;
    }
  }

  function montarBarra() {
    barra = el('div', 'busca-barra');
    var ant = el('button', 'busca-barra-btn', '‹');
    ant.title = 'Ocorrência anterior (Shift+Enter)';
    var prox = el('button', 'busca-barra-btn', '›');
    prox.title = 'Próxima ocorrência (Enter)';
    var fecha = el('button', 'busca-barra-btn busca-barra-x', '✕');
    fecha.title = 'Tirar o destaque (Esc)';
    ant.addEventListener('click', function () { irPara(marcaAtual - 1); });
    prox.addEventListener('click', function () { irPara(marcaAtual + 1); });
    fecha.addEventListener('click', function () {
      limparDestaque();
      if (history.replaceState) history.replaceState(null, '', location.pathname + location.hash);
    });
    barra.appendChild(el('span', 'busca-barra-lupa', '🔍'));
    barra.appendChild(el('span', 'busca-barra-num', '1 de ' + marcas.length));
    barra.appendChild(ant);
    barra.appendChild(prox);
    barra.appendChild(fecha);
    document.body.appendChild(barra);
  }

  // ------------------------------------------------------------------- estilo
  var CSS = [
    '.busca-res{max-height:calc(100vh - 150px);overflow-y:auto;margin:-6px 0 14px;',
    'border:1px solid var(--border);border-radius:8px;background:var(--bg-card);}',
    '.busca-cab{padding:8px 11px;font-size:11px;letter-spacing:.4px;text-transform:uppercase;',
    'color:var(--text-faint);border-bottom:1px solid var(--border);}',
    '.busca-vazio{padding:12px 11px;font-size:13px;color:var(--text-dim);}',
    '.busca-grupo{border-bottom:1px solid var(--border);}',
    '.busca-grupo:last-child{border-bottom:none;}',
    '.busca-pag{padding:9px 11px 3px;font-size:13px;font-weight:700;color:var(--gold);}',
    '.busca-grupo-nome{display:block;font-size:10.5px;font-weight:400;letter-spacing:.3px;',
    'text-transform:uppercase;color:var(--text-faint);margin-top:2px;}',
    '.busca-item{display:block;padding:6px 11px 9px;color:var(--text-dim);text-decoration:none;',
    'border-left:2px solid transparent;}',
    '.busca-item:hover,.busca-item.sel{background:var(--bg-hover);border-left-color:var(--active);',
    'text-decoration:none;color:var(--text);}',
    '.busca-sec{font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:2px;}',
    '.busca-snip{font-size:12px;line-height:1.5;color:var(--text-dim);overflow:hidden;',
    'display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;}',
    '.busca-mark{background:rgba(224,165,66,.28);color:var(--gold);font-weight:600;',
    'border-radius:2px;padding:0 1px;}',
    '.sidebar-left.buscando .tree{display:none;}',
    'mark.busca-hit{background:rgba(224,165,66,.3);color:inherit;border-radius:2px;',
    'box-shadow:0 0 0 1px rgba(224,165,66,.35);padding:0 1px;}',
    'mark.busca-hit.atual{background:var(--gold);color:#1c1c1e;font-weight:600;',
    'box-shadow:0 0 0 3px rgba(224,165,66,.3);scroll-margin-top:90px;}',
    '.busca-barra{position:fixed;left:50%;transform:translateX(-50%);bottom:20px;z-index:80;',
    'display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:999px;',
    'background:var(--bg-card);border:1px solid var(--border);box-shadow:0 6px 22px rgba(0,0,0,.45);',
    'font-size:12.5px;color:var(--text);}',
    '.busca-barra-lupa{font-size:12px;opacity:.7;}',
    '.busca-barra-num{color:var(--text-dim);white-space:nowrap;}',
    '.busca-barra-btn{background:none;border:1px solid var(--border);border-radius:6px;',
    'color:var(--text);font:inherit;line-height:1;padding:3px 8px;cursor:pointer;}',
    '.busca-barra-btn:hover{border-color:var(--gold-dim);color:var(--gold);}',
    '.busca-barra-x:hover{border-color:#e2645a;color:#f08078;}',
    '@media (max-width:860px){.busca-res{max-height:calc(100vh - 190px);}.busca-barra{bottom:14px;}}'
  ].join('');

  function injetarCSS() {
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ------------------------------------------------------------------- início
  function iniciar() {
    injetarCSS();

    var caixas = [];
    document.querySelectorAll('.search-box input').forEach(function (inp) {
      var sidebar = inp.closest('.sidebar-left') || inp.parentNode.parentNode;
      inp.setAttribute('placeholder', 'Buscar no guia inteiro…');
      inp.setAttribute('aria-label', 'Buscar no guia inteiro');
      inp.setAttribute('autocomplete', 'off');
      caixas.push(montarPainel(sidebar, inp));
    });

    document.addEventListener('keydown', function (ev) {
      var alvo = ev.target;
      var digitando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable);
      // atalhos globais: / ou Ctrl/Cmd+K focam a busca
      if ((ev.key === '/' && !digitando) || ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K'))) {
        if (!caixas.length) return;
        ev.preventDefault();
        var sl = document.querySelector('.sidebar-left');
        if (sl) sl.classList.add('open');
        caixas[0].input.focus();
        caixas[0].input.select();
        return;
      }
      if (!marcas.length || digitando) return;
      if (ev.key === 'Enter') { ev.preventDefault(); irPara(marcaAtual + (ev.shiftKey ? -1 : 1)); }
      else if (ev.key === 'Escape') { limparDestaque(); }
    });

    // chegou de um resultado: destaca o que foi pesquisado
    var q = (location.search.match(/[?&]q=([^&]*)/) || [])[1];
    if (q) {
      try { q = decodeURIComponent(q.replace(/\+/g, ' ')); } catch (e) { /* usa como veio */ }
      caixas.forEach(function (c) { c.definir(q); });
      var alvo = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
      var ordem = (location.search.match(/[?&]s=(\d+)/) || [, -1])[1];
      destacar(q, alvo, +ordem);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();

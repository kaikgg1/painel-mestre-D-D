// assets/js/ficha/subida_nivel.js
// Assistente de subida de nível. O Mestre sobe o nível no painel; quando
// characters.nivel passa de nivel_escolhas.ultimoNivelProcessado (sql/035),
// a ficha do jogador abre uma caixa OBRIGATÓRIA com o que o personagem ganha
// no nível seguinte e as escolhas daquele nível. Subir vários níveis de uma
// vez (8→10) abre uma caixa por nível, em ordem.
//
// Detecção: agendarVerificacaoNivel() no fim de render() (cobre abrir a
// ficha, trocar de personagem e o realtime do Mestre) — com debounce e
// leitura fresca do banco, então níveis intermediários não abrem caixa.
//
// Conclusão: UM update com tudo que o nível mudou + nivel_escolhas,
// condicionado a ultimoNivelProcessado = N-1 e nivel >= N. Se outro aparelho
// já concluiu, ou o Mestre baixou o nível no meio, o update não pega linha
// nenhuma e a caixa fecha sem aplicar. Magias escolhidas vão pra lista
// "Favoritas" (spell_lists) depois do update dar certo.
//
// Cada escolha é um passo em PASSOS_NIVEL: { titulo, render(ctx, el),
// valido(ctx), aplicar(ctx, payload, registro) }. Quais aparecem em cada
// nível: ProgressaoPHB.escolhasDoNivel (assets/js/progressao_classes.js).
// Regras extraídas do Livro do Jogador: data/talentos.json,
// data/estilos_luta.json, data/invocacoes.json, data/progressao_magias.json.

const ATRASO_VERIFICAR_NIVEL = 1500;
let _timerNivel = null;
let _assistenteNivel = null;   // { id, N, fechar } enquanto a caixa está aberta
// Saída de emergência ("Fechar e avisar o Mestre"): a caixa não reabre pra
// este personagem/nível até recarregar a página.
let _nivelAdiado = null;       // { id, N }

function agendarVerificacaoNivel() {
  clearTimeout(_timerNivel);
  _timerNivel = setTimeout(verificarSubidaNivel, ATRASO_VERIFICAR_NIVEL);
}

function lerUltimoNivelProcessado(ne) {
  const v = ne && ne.ultimoNivelProcessado;
  return v !== null && v !== undefined && v !== '' && Number.isInteger(+v) ? +v : null;
}

async function verificarSubidaNivel() {
  if (!window.sb || !charAtivo?.id) return;
  const id = charAtivo.id;
  const { data, error } = await window.sb.from('characters')
    .select('id,nivel,classe,subclasse,atributos,pericias,metamagias,features_personalizadas,nivel_escolhas')
    .eq('id', id).maybeSingle();
  // Sem a coluna (migration 035 pendente) ou sem rede: não faz nada.
  if (error || !data || charAtivo?.id !== id) return;

  const nivel = Math.max(1, Math.min(20, +data.nivel || 1));
  const ult = lerUltimoNivelProcessado(data.nivel_escolhas);

  if (_assistenteNivel) {
    // Caixa aberta: se outro aparelho concluiu esse nível, ou o Mestre
    // baixou o nível, ela deixa de fazer sentido.
    if (_assistenteNivel.id === id && ((ult !== null && ult >= _assistenteNivel.N) || nivel < _assistenteNivel.N)) {
      _assistenteNivel.fechar();
      _assistenteNivel = null;
      toast('O nível foi atualizado em outro lugar', 'aviso');
      agendarVerificacaoNivel();
    }
    return;
  }

  // Personagem sem registro: marca o nível atual como processado, sem caixa
  // (não cobra escolhas de níveis antigos).
  if (ult === null || !data.classe) {
    if (ult !== nivel) await gravarNivelProcessado(id, data.nivel_escolhas, nivel);
    return;
  }
  if (nivel <= ult) return;           // igual, ou o Mestre baixou o nível
  if (_nivelAdiado && _nivelAdiado.id === id && _nivelAdiado.N === ult + 1) return;
  abrirAssistenteNivel(ult + 1, data);
}

async function gravarNivelProcessado(id, neAtual, nivel) {
  const ne = { historico: {}, ...(neAtual || {}), ultimoNivelProcessado: nivel };
  _ultimoSaveLocal = Date.now();
  const { error } = await window.sb.from('characters').update({ nivel_escolhas: ne }).eq('id', id);
  if (!error && charAtivo?.id === id) charAtivo.nivel_escolhas = ne;
}

// Catálogos das escolhas — carregados uma vez, na primeira caixa.
let _dadosNivel = null;
function carregarDadosNivel() {
  if (!_dadosNivel) {
    const json = arq => fetch('../data/' + arq).then(r => { if (!r.ok) throw new Error(arq + ' HTTP ' + r.status); return r.json(); });
    _dadosNivel = Promise.all([
      window.HabilidadesRegras.carregarCatalogo(),
      json('progressao_magias.json'), json('talentos.json'), json('estilos_luta.json'), json('invocacoes.json'),
      carregarMagiasCache(),
    ]).then(([habilidades, prog, talentos, estilos, invocacoes, magias]) => ({ habilidades, prog, talentos, estilos, invocacoes, magias }))
      .catch(e => { console.warn('[subida de nível] catálogos:', e); _dadosNivel = null; return null; });
  }
  return _dadosNivel;
}

// ─── Helpers de passo ─────────────────────────────────────────────────
const semAcentoNivel = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const featuresDe = ctx => Array.isArray(ctx.dados.features_personalizadas) ? ctx.dados.features_personalizadas : [];
const novaFeature = (campos) => ({ id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), desc: '', max: 0, ...campos });
function subclasseEfetivaNivel(ctx) { return ctx.escolhas.subclasse || ctx.dados.subclasse || ''; }
function baseAtr(ctx, k) { return +(ctx.dados.atributos || {})[k] || 10; }
const nomeAtr = k => (ATRIBUTOS.find(a => a[0] === k) || [k, k])[1];

// Opções em cartões clicáveis (checkbox com limite exato, ou radio).
// itens = [{v, rotulo, meta?, desc?, bloqueio?, aviso?, grupo?}]
// marcado = Set (checkbox) ou valor (radio). rolavel = lista longa com rolagem própria.
function htmlCartoes(nome, tipo, itens, marcado, limite = 1, rolavel = false) {
  const estaMarcado = v => (tipo === 'radio' ? marcado === v : marcado.has(v));
  const cheio = tipo === 'checkbox' && marcado.size >= limite;
  let grupoAtual = null;
  const corpo = itens.map(it => {
    const mar = estaMarcado(it.v);
    const off = !!it.bloqueio || (!mar && cheio);
    const cab = it.grupo && it.grupo !== grupoAtual ? `<div class="levelup-grupo">${escape(it.grupo)}</div>` : '';
    if (it.grupo) grupoAtual = it.grupo;
    return `${cab}<label class="levelup-cartao${mar ? ' marcado' : ''}${off ? ' off' : ''}"${it.desc ? ` title="${escape(it.desc)}"` : ''}>
      <input type="${tipo}" name="lvl-${nome}" data-lista="${nome}" value="${escape(it.v)}" ${mar ? 'checked' : ''} ${off ? 'disabled' : ''}>
      <span class="levelup-cartao-corpo">
        <span class="levelup-cartao-topo"><strong>${escape(it.rotulo)}</strong>${it.meta ? `<span class="levelup-tag">${escape(it.meta)}</span>` : ''}</span>
        ${it.bloqueio ? `<span class="levelup-motivo">${escape(it.bloqueio)}</span>` : ''}
        ${it.aviso ? `<span class="levelup-motivo aviso">${escape(it.aviso)}</span>` : ''}
        ${it.desc ? `<span class="levelup-cartao-desc">${escape(it.desc)}</span>` : ''}
      </span>
    </label>`;
  }).join('');
  return `<div class="levelup-lista${rolavel ? ' rolavel' : ''}" data-rolagem="${nome}">${corpo || '<p class="ajuda-mini">Nada encontrado.</p>'}</div>`;
}
// Liga os cartões: checkbox → soma/tira do Set; radio → chama escolher(valor).
function ligarCartoes(el, nome, ctx, alvo) {
  el.querySelectorAll(`input[data-lista="${nome}"]`).forEach(inp => inp.addEventListener('change', () => {
    if (typeof alvo === 'function') alvo(inp.value);
    else if (inp.checked) alvo.add(inp.value); else alvo.delete(inp.value);
    ctx.redesenhar();
  }));
}
// Campo de busca de uma lista (mantém foco e cursor ao redesenhar a caixa).
function htmlBusca(chave, valor, placeholder) {
  return `<div class="levelup-busca"><input type="search" data-busca="${chave}" placeholder="${escape(placeholder)}" value="${escape(valor || '')}" aria-label="${escape(placeholder)}"></div>`;
}
function ligarBusca(el, chave, ctx) {
  const inp = el.querySelector(`[data-busca="${chave}"]`);
  if (!inp) return;
  inp.addEventListener('input', () => {
    ctx.escolhas['busca_' + chave] = inp.value;
    const pos = inp.selectionStart;
    ctx.redesenhar();
    const novo = document.querySelector(`.levelup-overlay [data-busca="${chave}"]`);
    if (novo) { novo.focus(); try { novo.setSelectionRange(pos, pos); } catch { /* type=search */ } }
  });
}
const bateBusca = (ctx, chave, texto) => {
  const f = semAcentoNivel(ctx.escolhas['busca_' + chave] || '');
  return !f || semAcentoNivel(texto).includes(f);
};
const contador = (n, total) => `<span class="levelup-contador${n >= total ? ' ok' : ''}">${n}/${total}</span>`;

// ─── Passos (escolhas) ────────────────────────────────────────────────
const PASSOS_NIVEL = {
  subclasse: {
    titulo: ctx => `Subclasse: ${rotuloSubclasse(ctx.dados.classe)}`,
    render(ctx, el) {
      const opcoes = SUBCLASSES_POR_CLASSE[chaveDeClasse(ctx.dados.classe)] || [];
      const todas = ctx.cat.habilidades?.[chaveDeClasse(ctx.dados.classe)] || [];
      const itens = opcoes.map(o => {
        const primeiras = todas.filter(h => h.subclasse === o && h.nivel <= ctx.N).map(h => h.nome);
        return { v: o, rotulo: o, desc: primeiras.length ? 'Ganha agora: ' + primeiras.join(', ') : '' };
      });
      el.innerHTML = `<p class="ajuda-mini">As habilidades da subclasse escolhida aparecem em "O que você ganha", acima.</p>`
        + htmlCartoes('subclasse', 'radio', itens, ctx.escolhas.subclasse || '');
      ligarCartoes(el, 'subclasse', ctx, v => { ctx.escolhas.subclasse = v; });
    },
    valido: ctx => !!ctx.escolhas.subclasse,
    aplicar(ctx, payload, registro) {
      payload.subclasse = ctx.escolhas.subclasse;
      registro.subclasse = ctx.escolhas.subclasse;
    },
  },

  asi: {
    titulo: () => 'Aumento no Valor de Habilidade ou Talento',
    render(ctx, el) {
      const e = ctx.escolhas.asi || (ctx.escolhas.asi = { modo: '2', a: '', b: '', talento: '', talentoAtr: '' });
      const base = k => baseAtr(ctx, k);
      const modos = [['2', '+2 em um atributo'], ['11', '+1 em dois'], ['talento', 'Talento']];
      let corpo = '';
      if (e.modo === '2' || e.modo === '11') {
        const inc = e.modo === '2' ? 2 : 1;
        const marcados = new Set([e.a, e.b].filter(Boolean));
        const itens = ATRIBUTOS.map(([k, nome]) => {
          const bloq = base(k) + inc > 20;
          const escolhido = marcados.has(k);
          return { v: k, rotulo: nome, meta: `${base(k)} → ${escolhido || !bloq ? Math.min(20, base(k) + inc) : base(k)}`, bloqueio: bloq ? 'já está no máximo (20)' : '' };
        });
        corpo = e.modo === '2'
          ? htmlCartoes('asi-atr', 'radio', itens, e.a)
          : htmlCartoes('asi-atr', 'checkbox', itens, marcados, 2);
      } else {
        const t = (ctx.cat.talentos || []).find(x => x.id === e.talento);
        const itens = (ctx.cat.talentos || [])
          .filter(tl => tl.id === e.talento || bateBusca(ctx, 'talento', tl.nome + ' ' + tl.desc))
          .map(tl => {
            const bloq = bloqueioTalento(ctx, tl);
            const pr = tl.prereq && !bloq && (tl.prereq.proficiencia || (!tl.prereq.atributo && !tl.prereq.conjurador))
              ? `Pré-requisito: ${tl.prereq.texto || tl.prereq.proficiencia} — confirme com o Mestre` : '';
            return { v: tl.id, rotulo: tl.nome, meta: tl.atributo ? '+1 atributo' : '', desc: tl.desc, bloqueio: bloq, aviso: pr };
          })
          .sort((a, b) => !!a.bloqueio - !!b.bloqueio);
        const atrOps = t?.atributo ? t.atributo.opcoes.filter(k => base(k) < 20) : [];
        corpo = htmlBusca('talento', ctx.escolhas.busca_talento, 'Buscar talento…')
          + htmlCartoes('talento', 'radio', itens, e.talento, 1, true)
          + (atrOps.length ? `<div class="levelup-grupo">+1 do talento em:</div>`
            + htmlCartoes('talento-atr', 'radio', atrOps.map(k => ({ v: k, rotulo: nomeAtr(k), meta: `${base(k)} → ${base(k) + 1}` })), e.talentoAtr) : '');
      }
      el.innerHTML = `
        <div class="levelup-segmentos" role="radiogroup" aria-label="Tipo de aumento">
          ${modos.map(([v, r]) => `<label class="${e.modo === v ? 'marcado' : ''}"><input type="radio" name="lvl-asi-modo" value="${v}" ${e.modo === v ? 'checked' : ''}>${r}</label>`).join('')}
        </div>
        ${corpo}`;
      el.querySelectorAll('[name="lvl-asi-modo"]').forEach(r => r.addEventListener('change', () => {
        Object.assign(e, { modo: r.value, a: '', b: '', talento: '', talentoAtr: '' }); ctx.redesenhar();
      }));
      if (e.modo === '2') ligarCartoes(el, 'asi-atr', ctx, v => { e.a = v; });
      if (e.modo === '11') {
        el.querySelectorAll('input[data-lista="asi-atr"]').forEach(inp => inp.addEventListener('change', () => {
          const s = new Set([e.a, e.b].filter(Boolean));
          if (inp.checked) s.add(inp.value); else s.delete(inp.value);
          [e.a = '', e.b = ''] = [...s];
          ctx.redesenhar();
        }));
      }
      ligarCartoes(el, 'talento', ctx, v => { e.talento = v; e.talentoAtr = ''; });
      ligarCartoes(el, 'talento-atr', ctx, v => { e.talentoAtr = v; });
      ligarBusca(el, 'talento', ctx);
    },
    valido(ctx) {
      const base = k => baseAtr(ctx, k);
      const e = ctx.escolhas.asi;
      if (!e) return false;
      if (e.modo === 'talento') {
        const t = (ctx.cat.talentos || []).find(x => x.id === e.talento);
        if (!t || bloqueioTalento(ctx, t)) return false;
        const atrOps = t.atributo ? t.atributo.opcoes.filter(k => base(k) < 20) : [];
        return !atrOps.length || !!e.talentoAtr;
      }
      if (!e.a) return ATRIBUTOS.every(([k]) => base(k) >= 20);
      if (e.modo === '2') return base(e.a) + 2 <= 20;
      return !!e.b && e.a !== e.b && base(e.a) + 1 <= 20 && base(e.b) + 1 <= 20;
    },
    aplicar(ctx, payload, registro) {
      const e = ctx.escolhas.asi;
      const atrs = { ...(payload.atributos || ctx.dados.atributos || {}) };
      if (e.modo === 'talento') {
        const t = ctx.cat.talentos.find(x => x.id === e.talento);
        const f = novaFeature({ nome: t.nome, desc: t.desc, talento: true, talentoId: t.id, nivelOrigem: ctx.N });
        if (e.talentoAtr) {
          atrs[e.talentoAtr] = Math.min(20, (+atrs[e.talentoAtr] || 10) + 1);
          Object.assign(f, { talentoAtributo: e.talentoAtr, talentoBonus: 1, talentoAplicado: true });
          payload.atributos = atrs;
        }
        payload.features_personalizadas = [...(payload.features_personalizadas || featuresDe(ctx)), f];
        registro.talento = { id: t.id, nome: t.nome, atributo: e.talentoAtr || null };
        return;
      }
      if (!e.a) return;
      const inc = e.modo === '2' ? { [e.a]: 2 } : { [e.a]: 1, [e.b]: 1 };
      for (const [k, v] of Object.entries(inc)) atrs[k] = Math.min(20, (+atrs[k] || 10) + v);
      payload.atributos = atrs;
      registro.asi = inc;
    },
  },

  estilo: {
    titulo: ctx => ctx.N === 10 ? 'Estilo de Luta Adicional' : 'Estilo de Luta',
    render(ctx, el) {
      const k = chaveDeClasse(ctx.dados.classe);
      const jaTem = new Set(featuresDe(ctx).map(f => f.estiloId).filter(Boolean));
      const itens = (ctx.cat.estilos || []).filter(s => s.classes.includes(k))
        .map(s => ({ v: s.id, rotulo: s.nome, desc: s.desc, bloqueio: jaTem.has(s.id) ? 'você já tem este estilo' : '' }));
      el.innerHTML = htmlCartoes('estilo', 'radio', itens, ctx.escolhas.estilo || '');
      ligarCartoes(el, 'estilo', ctx, v => { ctx.escolhas.estilo = v; });
    },
    valido: ctx => !!ctx.escolhas.estilo,
    aplicar(ctx, payload, registro) {
      const s = ctx.cat.estilos.find(x => x.id === ctx.escolhas.estilo);
      payload.features_personalizadas = [...(payload.features_personalizadas || featuresDe(ctx)),
        novaFeature({ nome: 'Estilo de Luta: ' + s.nome, desc: s.desc, estiloId: s.id, nivelOrigem: ctx.N })];
      registro.estilo = s.nome;
    },
  },

  expertise: {
    titulo: () => 'Especialização',
    candidatos(ctx) {
      const per = ctx.dados.pericias || {};
      const itens = PERICIAS.filter(([k]) => per[k]?.prof && !per[k]?.exp)
        .map(([k, nome, atr]) => ({ v: k, rotulo: nome, meta: String(atr).toUpperCase() }));
      const temFerr = featuresDe(ctx).some(f => f.expertiseFerramentas);
      if (chaveDeClasse(ctx.dados.classe) === 'ladino' && !temFerr) itens.push({ v: 'ferramentas_ladrao', rotulo: 'Ferramentas de Ladrão', meta: 'ferramenta' });
      return itens;
    },
    limite(ctx) { return Math.min(window.ProgressaoPHB.qtdExpertise(ctx.dados, ctx.N), this.candidatos(ctx).length); },
    extraTitulo(ctx) { return contador(ctx.escolhas.expertise?.size || 0, this.limite(ctx)); },
    render(ctx, el) {
      const sel = ctx.escolhas.expertise || (ctx.escolhas.expertise = new Set());
      const itens = this.candidatos(ctx);
      const lim = this.limite(ctx);
      el.innerHTML = `<p class="ajuda-mini">Escolha ${lim} perícia${lim > 1 ? 's' : ''} em que você já é proficiente: o bônus de proficiência nelas passa a ser dobrado.</p>`
        + (itens.length ? htmlCartoes('exp', 'checkbox', itens, sel, lim) : '<p class="ajuda-mini">Nenhuma perícia proficiente disponível — marque as proficiências na aba Combate e fale com o Mestre.</p>');
      ligarCartoes(el, 'exp', ctx, sel);
    },
    valido(ctx) { return (ctx.escolhas.expertise?.size || 0) === this.limite(ctx); },
    aplicar(ctx, payload, registro) {
      const per = JSON.parse(JSON.stringify(ctx.dados.pericias || {}));
      const nomes = [];
      for (const k of ctx.escolhas.expertise || []) {
        if (k === 'ferramentas_ladrao') {
          payload.features_personalizadas = [...(payload.features_personalizadas || featuresDe(ctx)),
            novaFeature({ nome: 'Especialização: Ferramentas de Ladrão', desc: 'Bônus de proficiência dobrado em testes com ferramentas de ladrão.', expertiseFerramentas: true, nivelOrigem: ctx.N })];
          nomes.push('Ferramentas de Ladrão');
          continue;
        }
        per[k] = { ...(per[k] || {}), prof: true, exp: true };
        nomes.push(PERICIAS.find(p => p[0] === k)[1]);
      }
      if (nomes.some(n => n !== 'Ferramentas de Ladrão')) payload.pericias = per;
      registro.expertise = nomes;
    },
  },

  metamagia: {
    titulo: () => 'Metamágica',
    limite(ctx) {
      const atuais = (ctx.dados.metamagias || []).length;
      return Math.max(0, window.RecursosClasse.metamagiasPermitidas(ctx.N) - atuais);
    },
    extraTitulo(ctx) { const l = this.limite(ctx); return l ? contador(ctx.escolhas.metamagia?.size || 0, l) : ''; },
    render(ctx, el) {
      const sel = ctx.escolhas.metamagia || (ctx.escolhas.metamagia = new Set());
      const atuais = new Set(ctx.dados.metamagias || []);
      const lim = this.limite(ctx);
      if (!lim) { el.innerHTML = '<p class="ajuda-mini">Você já tem todas as opções de Metamágica deste nível.</p>'; return; }
      const itens = window.RecursosClasse.METAMAGIAS.filter(m => !atuais.has(m.id))
        .map(m => ({ v: m.id, rotulo: m.nome, meta: m.custo === 'nivel' ? 'nível da magia' : m.custo + ' pt', desc: m.desc }));
      el.innerHTML = `<p class="ajuda-mini">Escolha ${lim} opç${lim > 1 ? 'ões' : 'ão'}.</p>` + htmlCartoes('mm', 'checkbox', itens, sel, lim);
      ligarCartoes(el, 'mm', ctx, sel);
    },
    valido(ctx) { return (ctx.escolhas.metamagia?.size || 0) === this.limite(ctx); },
    aplicar(ctx, payload, registro) {
      const novas = [...(ctx.escolhas.metamagia || [])];
      if (!novas.length) return;
      const ordem = window.RecursosClasse.METAMAGIAS.map(m => m.id);
      payload.metamagias = ordem.filter(id => novas.includes(id) || (ctx.dados.metamagias || []).includes(id));
      registro.metamagias = novas.map(id => window.RecursosClasse.METAMAGIAS.find(m => m.id === id).nome);
    },
  },

  pacto: {
    titulo: () => 'Dádiva do Pacto',
    render(ctx, el) {
      if (pactoAtual(ctx, true)) { el.innerHTML = `<p class="ajuda-mini">Você já tem o ${escape(pactoAtual(ctx, true).nome)}.</p>`; return; }
      const itens = (ctx.cat.invocacoes?.pactos || []).map(p => ({ v: p.id, rotulo: p.nome, desc: p.desc }));
      el.innerHTML = htmlCartoes('pacto', 'radio', itens, ctx.escolhas.pacto || '');
      ligarCartoes(el, 'pacto', ctx, v => { ctx.escolhas.pacto = v; });
    },
    valido: ctx => !!pactoAtual(ctx, true) || !!ctx.escolhas.pacto,
    aplicar(ctx, payload, registro) {
      if (pactoAtual(ctx, true)) return;
      const p = ctx.cat.invocacoes.pactos.find(x => x.id === ctx.escolhas.pacto);
      payload.features_personalizadas = [...(payload.features_personalizadas || featuresDe(ctx)),
        novaFeature({ nome: p.nome, desc: p.desc, pactoId: p.id, nivelOrigem: ctx.N })];
      registro.pacto = p.nome;
    },
  },

  invocacoes: {
    titulo: () => 'Invocações Místicas',
    itens(ctx) {
      const jaTem = new Set(featuresDe(ctx).map(f => f.invocacaoId).filter(Boolean));
      const pacto = pactoAtual(ctx)?.id || '';
      const temRajada = ctx.favoritas.has('Rajada Mística') || (ctx.escolhas.truques && ctx.escolhas.truques.has('Rajada Mística'));
      return (ctx.cat.invocacoes?.invocacoes || []).filter(i => !jaTem.has(i.id)).map(i => {
        const pr = i.prereq || {};
        let bloqueio = '';
        if (pr.nivel && ctx.N < pr.nivel) bloqueio = `requer nível ${pr.nivel}`;
        else if (pr.pacto && pr.pacto !== pacto) bloqueio = `requer ${(ctx.cat.invocacoes.pactos.find(p => p.id === pr.pacto) || {}).nome || 'pacto'}`;
        const aviso = pr.magia && !temRajada ? `requer o truque ${pr.magia}` : '';
        return { v: i.id, rotulo: i.nome, desc: i.desc, bloqueio, aviso };
      }).sort((a, b) => !!a.bloqueio - !!b.bloqueio);
    },
    // Nunca pede mais do que dá pra marcar (pré-requisitos e invocações já tidas).
    limite(ctx) {
      const livres = this.itens(ctx).filter(i => !i.bloqueio).length;
      return Math.min(window.ProgressaoPHB.qtdInvocacoes(ctx.dados, ctx.N, ctx.cat.prog), livres);
    },
    extraTitulo(ctx) { const l = this.limite(ctx); return l ? contador(ctx.escolhas.invocacoes?.size || 0, l) : ''; },
    render(ctx, el) {
      const sel = ctx.escolhas.invocacoes || (ctx.escolhas.invocacoes = new Set());
      for (const id of [...sel]) if (!this.itens(ctx).some(i => i.v === id && !i.bloqueio)) sel.delete(id);
      const lim = this.limite(ctx);
      if (!lim) { el.innerHTML = '<p class="ajuda-mini">Nenhuma invocação disponível pra escolher agora — combine com o Mestre.</p>'; return; }
      const itens = this.itens(ctx).filter(i => sel.has(i.v) || bateBusca(ctx, 'inv', i.rotulo + ' ' + i.desc));
      el.innerHTML = `<p class="ajuda-mini">Escolha ${lim} invocaç${lim > 1 ? 'ões' : 'ão'}.</p>`
        + htmlBusca('inv', ctx.escolhas.busca_inv, 'Buscar invocação…')
        + htmlCartoes('inv', 'checkbox', itens, sel, lim, true);
      ligarCartoes(el, 'inv', ctx, sel);
      ligarBusca(el, 'inv', ctx);
    },
    valido(ctx) { return (ctx.escolhas.invocacoes?.size || 0) === this.limite(ctx); },
    aplicar(ctx, payload, registro) {
      const novas = [...(ctx.escolhas.invocacoes || [])].map(id => ctx.cat.invocacoes.invocacoes.find(i => i.id === id));
      payload.features_personalizadas = [...(payload.features_personalizadas || featuresDe(ctx)),
        ...novas.map(i => novaFeature({ nome: 'Invocação: ' + i.nome, desc: i.desc, invocacaoId: i.id, nivelOrigem: ctx.N }))];
      registro.invocacoes = novas.map(i => i.nome);
    },
  },

  magias: {
    titulo: () => 'Truques e magias',
    ganho(ctx) { return window.ProgressaoPHB.ganhoMagias({ ...ctx.dados, subclasse: subclasseEfetivaNivel(ctx) }, ctx.N, ctx.cat.prog); },
    maxNivel(ctx) {
      const sub = subclasseEfetivaNivel(ctx);
      if (chaveDeClasse(ctx.dados.classe) === 'bruxo') return +(ctx.cat.prog?.bruxo?.nivelEspacoPacto || [])[ctx.N - 1] || 1;
      const s = window.SlotsPHB?.porClasse(ctx.dados.classe, ctx.N, sub) || {};
      let m = 0;
      for (let i = 1; i <= 9; i++) if ((s[i] || 0) > 0) m = i;
      return m;
    },
    pools(ctx) {
      const g = this.ganho(ctx);
      const lista = g.lista;
      const todas = ctx.cat.magias || [];
      const livre = m => !ctx.favoritas.has(m.nome);
      const daLista = m => (m.classes || []).includes(lista);
      const escolaOk = m => !g.escolas || g.escolas.includes(semAcentoNivel(m.escola));
      const max = this.maxNivel(ctx);
      return {
        g, max,
        truques: todas.filter(m => m.nivel === 0 && daLista(m) && livre(m)),
        magias: todas.filter(m => m.nivel >= 1 && m.nivel <= max && (g.segredos ? true : daLista(m)) && livre(m))
          .sort((a, b) => a.nivel - b.nivel || a.nome.localeCompare(b.nome)),
        arcana: g.arcana ? todas.filter(m => m.nivel === g.arcana && daLista(m) && livre(m)) : [],
        escolaOk,
      };
    },
    limites(ctx, p) {
      const e = ctx.escolhas;
      return {
        t: Math.min(p.g.truques, p.truques.length + (e.truques?.size || 0)),
        m: Math.min(p.g.magias, p.magias.length + (e.magiasNovas?.size || 0)),
        a: p.g.arcana ? Math.min(1, p.arcana.length) : 0,
      };
    },
    extraTitulo(ctx) {
      const p = this.pools(ctx), l = this.limites(ctx, p), e = ctx.escolhas;
      return contador((e.truques?.size || 0) + (e.magiasNovas?.size || 0) + (e.arcana?.size || 0), l.t + l.m + l.a);
    },
    // Magias fora das escolas da subclasse (Cavaleiro Místico/Trapaceiro Arcano) permitidas neste nível.
    foraEscolaMax(ctx, p) {
      if (!p.g.escolas) return Infinity;
      if (!p.g.escolaLivre) return 0;
      return ctx.N === 3 ? 1 : p.g.magias;
    },
    render(ctx, el) {
      const p = this.pools(ctx);
      const e = ctx.escolhas;
      const tr = e.truques || (e.truques = new Set());
      const mg = e.magiasNovas || (e.magiasNovas = new Set());
      const ar = e.arcana || (e.arcana = new Set());
      const lim = this.limites(ctx, p);
      const bate = m => bateBusca(ctx, 'magia', m.nome + ' ' + m.escola);
      const meta = m => [m.escola, m.concentracao ? 'concentração' : '', m.ritual ? 'ritual' : '',
        p.g.segredos && !(m.classes || []).includes(p.g.lista) ? 'outra classe' : ''].filter(Boolean).join(' · ');
      const item = m => ({ v: m.nome, rotulo: m.nome, meta: meta(m), grupo: m.nivel ? `${m.nivel}° nível` : undefined });
      const fora = [...mg].filter(n => { const m = p.magias.find(x => x.nome === n); return m && !p.escolaOk(m); }).length;
      const foraMax = this.foraEscolaMax(ctx, p);
      const itensMagia = p.magias.filter(m => bate(m) || mg.has(m.nome)).map(m => ({
        ...item(m),
        bloqueio: !mg.has(m.nome) && !p.escolaOk(m) && fora >= foraMax ? `só ${p.g.escolas.join(' ou ')} neste nível` : '',
      }));
      el.innerHTML = `
        <p class="ajuda-mini">As escolhidas entram na sua lista <strong>Favoritas</strong> (aba Magias).${p.g.lista !== ctx.dados.classe ? ` Lista de magias: ${escape(p.g.lista)}.` : ''}${p.g.segredos ? ` Segredos Mágicos: estas ${p.g.segredos} podem ser de qualquer classe.` : ''}${subclasseEfetivaNivel(ctx) === 'Trapaceiro Arcano' && ctx.N === 3 && !ctx.favoritas.has('Mãos Mágicas') ? ' Um dos truques tem que ser <strong>Mãos Mágicas</strong>.' : ''}</p>
        ${htmlBusca('magia', e.busca_magia, 'Buscar magia pelo nome ou escola…')}
        ${lim.t ? `<div class="levelup-subtitulo">Truques novos ${contador(tr.size, lim.t)}</div>${htmlCartoes('tr', 'checkbox', p.truques.filter(m => bate(m) || tr.has(m.nome)).map(item), tr, lim.t, true)}` : ''}
        ${lim.m ? `<div class="levelup-subtitulo">Magias novas ${contador(mg.size, lim.m)} <span class="ajuda-mini">até ${p.max}° nível</span></div>${htmlCartoes('mg', 'checkbox', itensMagia, mg, lim.m, true)}` : ''}
        ${lim.a ? `<div class="levelup-subtitulo">Arcana Mística — magia de ${p.g.arcana}° nível ${contador(ar.size, 1)}</div>${htmlCartoes('ar', 'checkbox', p.arcana.filter(m => bate(m) || ar.has(m.nome)).map(item), ar, 1, true)}` : ''}`;
      ligarCartoes(el, 'tr', ctx, tr);
      ligarCartoes(el, 'mg', ctx, mg);
      ligarCartoes(el, 'ar', ctx, ar);
      ligarBusca(el, 'magia', ctx);
    },
    valido(ctx) {
      const p = this.pools(ctx), l = this.limites(ctx, p), e = ctx.escolhas;
      return (e.truques?.size || 0) === l.t && (e.magiasNovas?.size || 0) === l.m && (e.arcana?.size || 0) === l.a;
    },
    aplicar(ctx, payload, registro) {
      const e = ctx.escolhas;
      const tr = [...(e.truques || [])], mg = [...(e.magiasNovas || [])], ar = [...(e.arcana || [])];
      if (tr.length) registro.truques = tr;
      if (mg.length) registro.magias = mg;
      if (ar.length) registro.arcana = ar;
      ctx.magiasParaFavoritas = [...tr, ...mg, ...ar];
    },
  },
};

// Pacto já escolhido (característica gravada) ou escolhido nesta mesma caixa.
function pactoAtual(ctx, soGravado) {
  const f = featuresDe(ctx).find(x => x.pactoId);
  if (f) return { id: f.pactoId, nome: f.nome };
  if (soGravado || !ctx.escolhas.pacto) return null;
  return (ctx.cat.invocacoes?.pactos || []).find(p => p.id === ctx.escolhas.pacto) || null;
}

// Motivo de o talento não poder ser escolhido ('' = pode).
function bloqueioTalento(ctx, t) {
  const jaTem = featuresDe(ctx).some(f => f.talentoId === t.id);
  if (jaTem && !t.repetivel) return 'já escolhido';
  const pr = t.prereq;
  if (!pr) return '';
  if (pr.atributo) {
    const efetivo = k => atributoTotal({ ...charAtivo, atributos: ctx.dados.atributos }, k);
    if (pr.atributo.opcoes) {
      if (!pr.atributo.opcoes.some(k => efetivo(k) >= pr.atributo.min)) return pr.texto || 'pré-requisito';
    } else if (Object.entries(pr.atributo).some(([k, v]) => efetivo(k) < v)) return pr.texto || 'pré-requisito';
  }
  if (pr.conjurador && !window.SlotsPHB?.tipoDaClasse(ctx.dados.classe, subclasseEfetivaNivel(ctx))) return pr.texto || 'precisa conjurar magia';
  return '';
}

function rotuloSubclasse(classe) {
  const k = chaveDeClasse(classe);
  return ({ clerigo: 'Domínio Divino', feiticeiro: 'Origem Feiticeira', bruxo: 'Patrono Transcendental',
    druida: 'Círculo Druídico', mago: 'Tradição Arcana', guerreiro: 'Arquétipo Marcial',
    ladino: 'Arquétipo Ladino', barbaro: 'Caminho Primitivo', bardo: 'Colégio de Bardo',
    monge: 'Tradição Monástica', paladino: 'Juramento Sagrado', patrulheiro: 'Arquétipo de Patrulheiro' })[k] || 'subclasse';
}

// Soma nomes à lista "Favoritas" (spell_lists) — cria a lista se não existir.
async function adicionarMagiasFavoritas(characterId, nomes) {
  if (!nomes.length) return true;
  const { data: lista, error } = await window.sb.from('spell_lists')
    .select('id, spell_names').eq('character_id', characterId).eq('nome', 'Favoritas').maybeSingle();
  if (error) return false;
  if (lista) {
    const uniao = [...new Set([...(lista.spell_names || []), ...nomes])];
    const { error: e2 } = await window.sb.from('spell_lists').update({ spell_names: uniao }).eq('id', lista.id);
    return !e2;
  }
  const { error: e3 } = await window.sb.from('spell_lists')
    .insert({ character_id: characterId, user_id: usuario?.id, nome: 'Favoritas', spell_names: nomes });
  return !e3;
}

// ─── Caixa ────────────────────────────────────────────────────────────
async function abrirAssistenteNivel(N, dados) {
  if (_assistenteNivel) return;
  _assistenteNivel = { id: dados.id, N, fechar: () => {} };   // reserva: evita duas caixas enquanto carrega
  const [cat, favoritas] = await Promise.all([carregarDadosNivel(), carregarFavoritasDoBanco(dados.id)]);
  if (!cat || charAtivo?.id !== dados.id) { _assistenteNivel = null; return; }
  const db = cat.habilidades || {};

  const { card, fechar } = UI.abrirModal({
    tituloHtml: `${ico('brilho')} Nível ${N}!`,
    className: 'wizard-overlay levelup-overlay',
    bloqueante: true,
    corpoHtml: `
      <p class="levelup-sub" id="lvl-sub"></p>
      <div id="lvl-ganhos"></div>
      <div id="lvl-passos"></div>
      <div class="modal-acoes levelup-acoes">
        <span class="ajuda-mini" id="lvl-status"></span>
        <button type="button" class="btn" id="lvl-adiar" hidden>Fechar e avisar o Mestre</button>
        <button type="button" class="btn" id="lvl-concluir">✓ Concluir nível ${N}</button>
      </div>`,
  });
  _assistenteNivel = { id: dados.id, N, fechar };
  if (window.FX?.confete) FX.confete('levelup');

  const ctx = { N, dados, cat, favoritas: favoritas || new Set(), escolhas: {}, redesenhar: () => desenhar() };
  const btn = card.querySelector('#lvl-concluir');
  const faces = dadoVidaDaClasse(dados.classe);
  card.querySelector('#lvl-sub').textContent =
    `${dados.classe} nível ${N}` + (faces ? ` · PV: role 1d${faces} + mod. de Constituição e atualize o PV máximo com o Mestre.` : '');

  // Passos: 'subclasse' se o personagem ainda não tem; os demais pela
  // subclasse efetiva (escolher Cavaleiro Místico no 3° faz aparecer magias).
  function passosAtuais() {
    const k = new Set(window.ProgressaoPHB.escolhasDoNivel(dados, N, cat.prog));
    for (const p of window.ProgressaoPHB.escolhasDoNivel({ ...dados, subclasse: subclasseEfetivaNivel(ctx) }, N, cat.prog)) k.add(p);
    return [...k].filter(p => PASSOS_NIVEL[p]);
  }

  function desenharGanhos() {
    const todas = db[chaveDeClasse(dados.classe)] || [];
    const sub = subclasseEfetivaNivel(ctx);
    const doNivel = window.HabilidadesRegras.habilidadesDoNivel(todas, N, sub).filter(h => h.nivel === N);
    const pers = { ...dados, nivel: N, subclasse: sub };
    const antes = { ...dados, nivel: N - 1, subclasse: sub };
    const mudancas = [];
    const recAntes = new Map(window.RecursosClasse.recursosPara(antes).map(r => [r.id, r.max]));
    for (const r of window.RecursosClasse.recursosPara(pers)) {
      const m0 = recAntes.get(r.id) || 0;
      if (r.max !== m0) mudancas.push(m0 ? `${r.nome}: ${m0} → ${r.max}` : `Novo recurso: ${r.nome} (${r.max})`);
    }
    const s1 = window.SlotsPHB?.porClasse(dados.classe, N, sub);
    const s0 = window.SlotsPHB?.porClasse(dados.classe, N - 1, sub);
    // Bruxo: os espaços do pacto sobem de nível todos juntos — uma linha só.
    const pacto = sl => { for (let i = 9; i >= 1; i--) if (sl && sl[i]) return [sl[i], i]; return [0, 0]; };
    if (s1 && window.SlotsPHB.tipoDaClasse(dados.classe, sub) === 'pact') {
      const [q0, n0] = pacto(s0), [q1, n1] = pacto(s1);
      if (q0 !== q1 || n0 !== n1) mudancas.push(`Magia do Pacto: ${q0} espaço${q0 === 1 ? '' : 's'} de ${n0}° → ${q1} espaço${q1 === 1 ? '' : 's'} de ${n1}° nível`);
    } else if (s1) for (let i = 1; i <= 9; i++) {
      const a = (s0 && s0[i]) || 0, b = s1[i] || 0;
      if (a !== b) mudancas.push(`Espaços de magia de ${i}° nível: ${a} → ${b}`);
    }
    card.querySelector('#lvl-ganhos').innerHTML = `
      <div class="levelup-bloco">
        <h4>O que você ganha</h4>
        ${doNivel.length ? doNivel.map(h => `
          <details class="levelup-ganho">
            <summary><strong>${escape(h.nome)}</strong>${h.subclasse ? ` <span class="hab-sub-tag">${escape(h.subclasse)}</span>` : ''}</summary>
            <p>${escape(h.desc || '')}</p>
          </details>`).join('') : '<p class="ajuda-mini">Nenhuma habilidade nova de classe neste nível.</p>'}
        ${mudancas.length ? `<ul class="levelup-mudancas">${mudancas.map(m => `<li>${escape(m)}</li>`).join('')}</ul>` : ''}
      </div>`;
  }

  function desenhar() {
    // Redesenhar a cada clique não pode jogar a rolagem pro topo (listas de
    // magias/talentos têm rolagem própria, e a caixa também rola).
    const rolagens = {};
    card.querySelectorAll('.levelup-lista.rolavel[data-rolagem]').forEach(l => { rolagens[l.dataset.rolagem] = l.scrollTop; });
    const rolagemCaixa = card.scrollTop;

    desenharGanhos();
    const wrap = card.querySelector('#lvl-passos');
    wrap.textContent = '';
    const passos = passosAtuais();
    for (const p of passos) {
      const def = PASSOS_NIVEL[p];
      const ok = def.valido(ctx);
      const bloco = document.createElement('div');
      bloco.className = 'levelup-bloco' + (ok ? ' completo' : ' pendente');
      bloco.dataset.passo = p;
      bloco.innerHTML = `<h4><span>${escape(def.titulo(ctx))}</span>${def.extraTitulo ? def.extraTitulo(ctx) : ''}${ok ? '<span class="levelup-ok" aria-label="Escolha feita">✓</span>' : ''}</h4><div></div>`;
      def.render(ctx, bloco.lastElementChild);
      wrap.appendChild(bloco);
    }
    card.querySelectorAll('.levelup-lista.rolavel[data-rolagem]').forEach(l => { if (rolagens[l.dataset.rolagem]) l.scrollTop = rolagens[l.dataset.rolagem]; });
    card.scrollTop = rolagemCaixa;

    const faltam = passos.filter(p => !PASSOS_NIVEL[p].valido(ctx)).length;
    btn.disabled = faltam > 0;
    card.querySelector('#lvl-status').textContent = faltam ? `Falta${faltam > 1 ? 'm' : ''} ${faltam} escolha${faltam > 1 ? 's' : ''}` : 'Tudo escolhido';
    // Escolha pendente sem nenhum controle habilitado = impossível de completar.
    const travado = [...wrap.querySelectorAll('.levelup-bloco.pendente')]
      .some(b => !b.querySelector('input:not([disabled]):not([data-busca]), select:not([disabled])'));
    if (travado) mostrarSaida('Uma escolha deste nível não tem opção disponível.');
  }

  // Saída de emergência: fecha sem concluir, grava o aviso pro Mestre e não
  // reabre até recarregar a página (aí a caixa volta, no mesmo nível).
  const btnAdiar = card.querySelector('#lvl-adiar');
  let motivoSaida = '';
  function mostrarSaida(motivo) { motivoSaida = motivo; btnAdiar.hidden = false; }
  btnAdiar.addEventListener('click', async () => {
    _nivelAdiado = { id: dados.id, N };
    fechar();
    _assistenteNivel = null;
    const ne = { historico: {}, ...(dados.nivel_escolhas || {}), aviso: { nivel: N, motivo: motivoSaida, em: new Date().toISOString() } };
    _ultimoSaveLocal = Date.now();
    const { error } = await window.sb.from('characters').update({ nivel_escolhas: ne }).eq('id', dados.id);
    toast(error ? 'Escolhas do nível adiadas — avise o Mestre' : 'Escolhas do nível adiadas — o Mestre foi avisado', 'aviso');
  });

  desenhar();

  btn.addEventListener('click', async () => {
    const passos = passosAtuais();
    if (passos.some(p => !PASSOS_NIVEL[p].valido(ctx))) return;
    btn.disabled = true;
    card.querySelector('#lvl-status').textContent = 'Salvando…';
    const payload = {};
    const registro = { em: new Date().toISOString() };
    ctx.magiasParaFavoritas = [];
    for (const p of passos) PASSOS_NIVEL[p].aplicar(ctx, payload, registro);
    const ne = { historico: {}, ...(dados.nivel_escolhas || {}) };
    payload.nivel_escolhas = { ...ne, ultimoNivelProcessado: N, historico: { ...(ne.historico || {}), [N]: registro } };
    delete payload.nivel_escolhas.aviso;

    _ultimoSaveLocal = Date.now();
    const { data: linha, error } = await window.sb.from('characters')
      .update(payload)
      .eq('id', dados.id)
      .eq('nivel_escolhas->>ultimoNivelProcessado', String(N - 1))
      .gte('nivel', N)
      .select('*').maybeSingle();
    if (error) {
      btn.disabled = false;
      card.querySelector('#lvl-status').textContent = 'Erro ao salvar — tente de novo.';
      mostrarSaida('Erro ao salvar: ' + (error.message || 'sem conexão'));
      console.warn('[subida de nível] erro:', error);
      return;
    }
    fechar();
    _assistenteNivel = null;
    if (!linha) {
      toast('O nível foi atualizado em outro lugar', 'aviso');
      agendarVerificacaoNivel();
      return;
    }
    if (ctx.magiasParaFavoritas.length && !(await adicionarMagiasFavoritas(dados.id, ctx.magiasParaFavoritas))) {
      toast('Não deu pra salvar as magias nas Favoritas: ' + ctx.magiasParaFavoritas.join(', '), 'aviso');
    }
    if (charAtivo?.id === linha.id) {
      Object.assign(charAtivo, linha);
      chars = chars.map(c => c.id === charAtivo.id ? charAtivo : c);
      toast(`Nível ${N} concluído!`, 'brilho');
      render();   // agenda a verificação do próximo nível
    } else {
      agendarVerificacaoNivel();
    }
  });
}

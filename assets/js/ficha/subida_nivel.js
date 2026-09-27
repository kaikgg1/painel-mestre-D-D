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

// Lista de checkboxes com limite exato. itens = [{v, rotulo, desc?, bloqueio?, aviso?}]
function htmlChecklist(nome, itens, marcados, limite) {
  const cheio = marcados.size >= limite;
  return itens.map(it => {
    const mar = marcados.has(it.v);
    const off = !!it.bloqueio || (!mar && cheio);
    return `<label class="levelup-opcao" style="align-items:flex-start">
      <input type="checkbox" data-lista="${nome}" value="${escape(it.v)}" ${mar ? 'checked' : ''} ${off ? 'disabled' : ''}>
      <span><strong>${escape(it.rotulo)}</strong>${it.bloqueio ? ` <em class="ajuda-mini">— ${escape(it.bloqueio)}</em>` : ''}${it.aviso ? ` <em class="ajuda-mini">— ${escape(it.aviso)}</em>` : ''}
      ${it.desc ? `<br><span class="ajuda-mini">${escape(it.desc)}</span>` : ''}</span>
    </label>`;
  }).join('');
}
function ligarChecklist(el, nome, conjunto, ctx) {
  el.querySelectorAll(`input[data-lista="${nome}"]`).forEach(cb => cb.addEventListener('change', () => {
    if (cb.checked) conjunto.add(cb.value); else conjunto.delete(cb.value);
    ctx.redesenhar();
  }));
}

// ─── Passos (escolhas) ────────────────────────────────────────────────
const PASSOS_NIVEL = {
  subclasse: {
    titulo: ctx => `Escolha sua ${rotuloSubclasse(ctx.dados.classe)}`,
    render(ctx, el) {
      const opcoes = SUBCLASSES_POR_CLASSE[chaveDeClasse(ctx.dados.classe)] || [];
      el.innerHTML = `
        <p class="ajuda-mini">A partir daqui o personagem ganha as habilidades da subclasse escolhida (a lista de ganhos acima se atualiza).</p>
        <select id="lvl-subclasse" aria-label="Subclasse">
          <option value="">— escolher —</option>
          ${opcoes.map(o => `<option ${o === ctx.escolhas.subclasse ? 'selected' : ''}>${escape(o)}</option>`).join('')}
        </select>`;
      el.querySelector('#lvl-subclasse').addEventListener('change', e => {
        ctx.escolhas.subclasse = e.target.value || null;
        ctx.redesenhar();
      });
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
      const opt = (sel, limite) => `<option value="">— atributo —</option>` + ATRIBUTOS.map(([k, nome]) => {
        const bloqueado = base(k) + limite > 20;
        return `<option value="${k}" ${sel === k ? 'selected' : ''} ${bloqueado ? 'disabled' : ''}>${nome} (${base(k)}${bloqueado ? ' — máx. 20' : ''})</option>`;
      }).join('');
      const t = (ctx.cat.talentos || []).find(x => x.id === e.talento);
      let corpoModo = '';
      if (e.modo === '2' || e.modo === '11') {
        corpoModo = `<div class="levelup-linha">
            <select id="lvl-asi-a" aria-label="Primeiro atributo">${opt(e.a, e.modo === '2' ? 2 : 1)}</select>
            ${e.modo === '11' ? `<select id="lvl-asi-b" aria-label="Segundo atributo">${opt(e.b, 1)}</select>` : ''}
          </div>
          ${e.modo === '11' && e.a && e.a === e.b ? '<div class="levelup-erro">Escolha dois atributos diferentes.</div>' : ''}`;
      } else {
        const opcoes = (ctx.cat.talentos || []).map(tl => {
          const bloq = bloqueioTalento(ctx, tl);
          return `<option value="${tl.id}" ${tl.id === e.talento ? 'selected' : ''} ${bloq ? 'disabled' : ''}>${escape(tl.nome)}${bloq ? ' — ' + escape(bloq) : ''}</option>`;
        }).join('');
        const atrOps = t?.atributo ? t.atributo.opcoes.filter(k => base(k) < 20) : [];
        corpoModo = `<div class="levelup-linha"><select id="lvl-talento" aria-label="Talento"><option value="">— talento —</option>${opcoes}</select></div>
          ${t ? `<p class="ajuda-mini" style="margin-top:6px">${escape(t.desc)}</p>` : ''}
          ${t?.prereq && (t.prereq.proficiencia || (!t.prereq.atributo && !t.prereq.conjurador)) ? `<p class="ajuda-mini">Pré-requisito: ${escape(t.prereq.texto || t.prereq.proficiencia)} — confirme com o Mestre.</p>` : ''}
          ${atrOps.length ? `<div class="levelup-linha"><span class="ajuda-mini">+1 em:</span><select id="lvl-talento-atr" aria-label="Atributo do talento"><option value="">— atributo —</option>${atrOps.map(k => `<option value="${k}" ${k === e.talentoAtr ? 'selected' : ''}>${ATRIBUTOS.find(a => a[0] === k)[1]} (${base(k)})</option>`).join('')}</select></div>` : ''}`;
      }
      el.innerHTML = `
        <p class="ajuda-mini">+2 em um atributo ou +1 em dois (máx. 20), somado direto no atributo — ou troque por um talento.</p>
        <label class="levelup-opcao"><input type="radio" name="lvl-asi-modo" value="2" ${e.modo === '2' ? 'checked' : ''}> +2 em um atributo</label>
        <label class="levelup-opcao"><input type="radio" name="lvl-asi-modo" value="11" ${e.modo === '11' ? 'checked' : ''}> +1 em dois atributos</label>
        <label class="levelup-opcao"><input type="radio" name="lvl-asi-modo" value="talento" ${e.modo === 'talento' ? 'checked' : ''}> Talento</label>
        ${corpoModo}`;
      el.querySelectorAll('[name="lvl-asi-modo"]').forEach(r => r.addEventListener('change', () => {
        Object.assign(e, { modo: r.value, a: '', b: '', talento: '', talentoAtr: '' }); ctx.redesenhar();
      }));
      el.querySelector('#lvl-asi-a')?.addEventListener('change', ev => { e.a = ev.target.value; ctx.redesenhar(); });
      el.querySelector('#lvl-asi-b')?.addEventListener('change', ev => { e.b = ev.target.value; ctx.redesenhar(); });
      el.querySelector('#lvl-talento')?.addEventListener('change', ev => { e.talento = ev.target.value; e.talentoAtr = ''; ctx.redesenhar(); });
      el.querySelector('#lvl-talento-atr')?.addEventListener('change', ev => { e.talentoAtr = ev.target.value; ctx.redesenhar(); });
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
      const opcoes = (ctx.cat.estilos || []).filter(s => s.classes.includes(k));
      el.innerHTML = opcoes.map(s => `
        <label class="levelup-opcao" style="align-items:flex-start">
          <input type="radio" name="lvl-estilo" value="${s.id}" ${ctx.escolhas.estilo === s.id ? 'checked' : ''} ${jaTem.has(s.id) ? 'disabled' : ''}>
          <span><strong>${escape(s.nome)}</strong>${jaTem.has(s.id) ? ' <em class="ajuda-mini">— já escolhido</em>' : ''}<br><span class="ajuda-mini">${escape(s.desc)}</span></span>
        </label>`).join('');
      el.querySelectorAll('[name="lvl-estilo"]').forEach(r => r.addEventListener('change', () => { ctx.escolhas.estilo = r.value; ctx.redesenhar(); }));
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
      const itens = PERICIAS.filter(([k]) => per[k]?.prof && !per[k]?.exp).map(([k, nome]) => ({ v: k, rotulo: nome }));
      const temFerr = featuresDe(ctx).some(f => f.expertiseFerramentas);
      if (chaveDeClasse(ctx.dados.classe) === 'ladino' && !temFerr) itens.push({ v: 'ferramentas_ladrao', rotulo: 'Ferramentas de Ladrão' });
      return itens;
    },
    limite(ctx) { return Math.min(window.ProgressaoPHB.qtdExpertise(ctx.dados, ctx.N), this.candidatos(ctx).length); },
    render(ctx, el) {
      const sel = ctx.escolhas.expertise || (ctx.escolhas.expertise = new Set());
      const itens = this.candidatos(ctx);
      const lim = this.limite(ctx);
      el.innerHTML = `<p class="ajuda-mini">Escolha ${lim} perícia${lim > 1 ? 's' : ''} em que você já é proficiente: o bônus de proficiência nelas passa a ser dobrado.</p>`
        + (itens.length ? htmlChecklist('exp', itens, sel, lim) : '<p class="ajuda-mini">Nenhuma perícia proficiente disponível — marque as proficiências na aba Combate e fale com o Mestre.</p>');
      ligarChecklist(el, 'exp', sel, ctx);
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
    render(ctx, el) {
      const sel = ctx.escolhas.metamagia || (ctx.escolhas.metamagia = new Set());
      const atuais = new Set(ctx.dados.metamagias || []);
      const lim = this.limite(ctx);
      if (!lim) { el.innerHTML = '<p class="ajuda-mini">Você já tem todas as opções de Metamágica deste nível.</p>'; return; }
      const itens = window.RecursosClasse.METAMAGIAS.filter(m => !atuais.has(m.id))
        .map(m => ({ v: m.id, rotulo: `${m.nome} (${m.custo === 'nivel' ? 'nível da magia' : m.custo + ' pt'})`, desc: m.desc }));
      el.innerHTML = `<p class="ajuda-mini">Escolha ${lim} opção${lim > 1 ? 'ões' : ''}.</p>` + htmlChecklist('mm', itens, sel, lim);
      ligarChecklist(el, 'mm', sel, ctx);
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
      el.innerHTML = (ctx.cat.invocacoes?.pactos || []).map(p => `
        <label class="levelup-opcao" style="align-items:flex-start">
          <input type="radio" name="lvl-pacto" value="${p.id}" ${ctx.escolhas.pacto === p.id ? 'checked' : ''}>
          <span><strong>${escape(p.nome)}</strong><br><span class="ajuda-mini">${escape(p.desc)}</span></span>
        </label>`).join('');
      el.querySelectorAll('[name="lvl-pacto"]').forEach(r => r.addEventListener('change', () => { ctx.escolhas.pacto = r.value; ctx.redesenhar(); }));
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
    limite(ctx) { return window.ProgressaoPHB.qtdInvocacoes(ctx.dados, ctx.N, ctx.cat.prog); },
    render(ctx, el) {
      const sel = ctx.escolhas.invocacoes || (ctx.escolhas.invocacoes = new Set());
      const jaTem = new Set(featuresDe(ctx).map(f => f.invocacaoId).filter(Boolean));
      const pacto = pactoAtual(ctx)?.id || '';
      const temRajada = ctx.favoritas.has('Rajada Mística') || (ctx.escolhas.truques && ctx.escolhas.truques.has('Rajada Mística'));
      const itens = (ctx.cat.invocacoes?.invocacoes || []).filter(i => !jaTem.has(i.id)).map(i => {
        const pr = i.prereq || {};
        let bloqueio = '';
        if (pr.nivel && ctx.N < pr.nivel) bloqueio = `requer nível ${pr.nivel}`;
        else if (pr.pacto && pr.pacto !== pacto) bloqueio = `requer ${(ctx.cat.invocacoes.pactos.find(p => p.id === pr.pacto) || {}).nome || 'pacto'}`;
        const aviso = pr.magia && !temRajada ? `requer o truque ${pr.magia}` : '';
        return { v: i.id, rotulo: i.nome, desc: i.desc, bloqueio, aviso };
      }).sort((a, b) => !!a.bloqueio - !!b.bloqueio);
      const lim = this.limite(ctx);
      el.innerHTML = `<p class="ajuda-mini">Escolha ${lim} invocaç${lim > 1 ? 'ões' : 'ão'}.</p>` + htmlChecklist('inv', itens, sel, lim);
      ligarChecklist(el, 'inv', sel, ctx);
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
        magias: todas.filter(m => m.nivel >= 1 && m.nivel <= max && (g.segredos ? true : daLista(m)) && livre(m)),
        arcana: g.arcana ? todas.filter(m => m.nivel === g.arcana && daLista(m) && livre(m)) : [],
        escolaOk,
      };
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
      const filtro = e.filtroMagia || '';
      const bate = m => !filtro || semAcentoNivel(m.nome).includes(semAcentoNivel(filtro));
      const rot = m => `${m.nome} (${m.nivel ? m.nivel + '°' : 'truque'}, ${m.escola}${p.g.segredos && !(m.classes || []).includes(p.g.lista) ? ', outra classe' : ''})`;
      const limT = Math.min(p.g.truques, p.truques.length + tr.size);
      const limM = Math.min(p.g.magias, p.magias.length + mg.size);
      const fora = [...mg].filter(n => { const m = p.magias.find(x => x.nome === n); return m && !p.escolaOk(m); }).length;
      const foraMax = this.foraEscolaMax(ctx, p);
      const itensMagia = p.magias.filter(m => bate(m) || mg.has(m.nome)).map(m => ({
        v: m.nome, rotulo: rot(m),
        bloqueio: !mg.has(m.nome) && !p.escolaOk(m) && fora >= foraMax ? `só ${p.g.escolas.join(' ou ')} neste nível` : '',
      }));
      el.innerHTML = `
        <p class="ajuda-mini">As escolhidas entram na sua lista <strong>Favoritas</strong> (aba Magias).${p.g.lista !== ctx.dados.classe ? ` Lista de magias: ${escape(p.g.lista)}.` : ''}${p.g.segredos ? ` Segredos Mágicos: estas ${p.g.segredos} podem ser de qualquer classe.` : ''}</p>
        <input type="search" id="lvl-magia-busca" placeholder="Buscar magia…" value="${escape(filtro)}" style="width:100%;min-height:38px;margin-bottom:6px">
        ${limT ? `<h5>Truques novos (${tr.size}/${limT})</h5>${htmlChecklist('tr', p.truques.filter(m => bate(m) || tr.has(m.nome)).map(m => ({ v: m.nome, rotulo: rot(m) })), tr, limT)}` : ''}
        ${limM ? `<h5>Magias novas (${mg.size}/${limM}, até ${p.max}° nível)</h5>${htmlChecklist('mg', itensMagia, mg, limM)}` : ''}
        ${p.g.arcana ? `<h5>Arcana Mística — 1 magia de ${p.g.arcana}° nível (${ar.size}/1)</h5>${htmlChecklist('ar', p.arcana.filter(m => bate(m) || ar.has(m.nome)).map(m => ({ v: m.nome, rotulo: rot(m) })), ar, 1)}` : ''}`;
      ligarChecklist(el, 'tr', tr, ctx);
      ligarChecklist(el, 'mg', mg, ctx);
      ligarChecklist(el, 'ar', ar, ctx);
      const busca = el.querySelector('#lvl-magia-busca');
      busca.addEventListener('input', () => {
        e.filtroMagia = busca.value;
        const pos = busca.selectionStart;
        ctx.redesenhar();
        const nova = document.getElementById('lvl-magia-busca');
        if (nova) { nova.focus(); try { nova.setSelectionRange(pos, pos); } catch { /* type=search */ } }
      });
    },
    valido(ctx) {
      const p = this.pools(ctx);
      const e = ctx.escolhas;
      const okT = (e.truques?.size || 0) === Math.min(p.g.truques, p.truques.length + (e.truques?.size || 0));
      const okM = (e.magiasNovas?.size || 0) === Math.min(p.g.magias, p.magias.length + (e.magiasNovas?.size || 0));
      const okA = !p.g.arcana || (e.arcana?.size || 0) === Math.min(1, p.arcana.length);
      return okT && okM && okA;
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
    if (s1) for (let i = 1; i <= 9; i++) {
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
    desenharGanhos();
    const wrap = card.querySelector('#lvl-passos');
    wrap.textContent = '';
    const passos = passosAtuais();
    for (const p of passos) {
      const def = PASSOS_NIVEL[p];
      const bloco = document.createElement('div');
      bloco.className = 'levelup-bloco' + (def.valido(ctx) ? '' : ' pendente');
      bloco.dataset.passo = p;
      bloco.innerHTML = `<h4>${escape(def.titulo(ctx))}</h4><div></div>`;
      def.render(ctx, bloco.lastElementChild);
      wrap.appendChild(bloco);
    }
    const faltam = passos.filter(p => !PASSOS_NIVEL[p].valido(ctx)).length;
    btn.disabled = faltam > 0;
    card.querySelector('#lvl-status').textContent = faltam ? `Falta${faltam > 1 ? 'm' : ''} ${faltam} escolha${faltam > 1 ? 's' : ''}` : '';
  }
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

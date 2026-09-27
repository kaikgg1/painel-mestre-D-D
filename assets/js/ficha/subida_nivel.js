// assets/js/ficha/subida_nivel.js
// Assistente de subida de nível. O Mestre sobe o nível no painel; quando
// characters.nivel passa de nivel_escolhas.ultimoNivelProcessado (sql/035),
// a ficha do jogador abre uma caixa OBRIGATÓRIA com o que o personagem ganha
// no nível seguinte e as escolhas daquele nível. Subir vários níveis de uma
// vez (8→10) abre uma caixa por nível, em ordem.
//
// Detecção: agendarVerificacaoNivel() no fim de render() (cobre abrir a
// ficha, trocar de personagem e o realtime do Mestre) — com debounce e
// leitura fresca do banco, então níveis intermediários digitados no painel
// não abrem caixa nenhuma.
//
// Conclusão: UM update com tudo que o nível mudou + nivel_escolhas,
// condicionado a ultimoNivelProcessado = N-1 e nivel >= N. Se outro aparelho
// já concluiu, ou o Mestre baixou o nível no meio, o update não pega linha
// nenhuma e a caixa fecha sem aplicar.
//
// Cada escolha é um passo em PASSOS_NIVEL: { titulo, render(ctx, el),
// valido(ctx), aplicar(ctx, payload, registro), resumo(registro) }.
// ProgressaoPHB.escolhasDoNivel (progressao_classes.js) decide quais aparecem.

const ATRASO_VERIFICAR_NIVEL = 1500;
let _timerNivel = null;
let _assistenteNivel = null;   // { id, N, fechar } enquanto a caixa está aberta

function agendarVerificacaoNivel() {
  clearTimeout(_timerNivel);
  _timerNivel = setTimeout(verificarSubidaNivel, ATRASO_VERIFICAR_NIVEL);
}

function lerUltimoNivelProcessado(ne) {
  const v = ne && ne.ultimoNivelProcessado;
  return Number.isInteger(+v) && v !== null && v !== '' ? +v : null;
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
  if (ult === null) {
    await gravarNivelProcessado(id, data.nivel_escolhas, nivel, null);
    return;
  }
  if (nivel <= ult) return;           // igual, ou o Mestre baixou o nível
  if (!data.classe) {                 // sem classe não há o que escolher
    await gravarNivelProcessado(id, data.nivel_escolhas, nivel, null);
    return;
  }
  abrirAssistenteNivel(ult + 1, data);
}

async function gravarNivelProcessado(id, neAtual, nivel, registro) {
  const ne = { historico: {}, ...(neAtual || {}), ultimoNivelProcessado: nivel };
  if (registro) ne.historico = { ...(ne.historico || {}), [nivel]: registro };
  _ultimoSaveLocal = Date.now();
  const { error } = await window.sb.from('characters').update({ nivel_escolhas: ne }).eq('id', id);
  if (!error && charAtivo?.id === id) charAtivo.nivel_escolhas = ne;
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
    resumo: r => r.subclasse ? `Subclasse: ${r.subclasse}` : '',
  },

  asi: {
    titulo: () => 'Aumento no Valor de Habilidade',
    render(ctx, el) {
      const e = ctx.escolhas.asi || (ctx.escolhas.asi = { modo: '2', a: '', b: '' });
      const base = k => +(ctx.dados.atributos || {})[k] || 10;
      const opt = (sel, limite) => `<option value="">— atributo —</option>` + ATRIBUTOS.map(([k, nome]) => {
        const bloqueado = base(k) + limite > 20;
        return `<option value="${k}" ${sel === k ? 'selected' : ''} ${bloqueado ? 'disabled' : ''}>${nome} (${base(k)}${bloqueado ? ' — máx. 20' : ''})</option>`;
      }).join('');
      const tudoNo20 = ATRIBUTOS.every(([k]) => base(k) >= 20);
      el.innerHTML = tudoNo20
        ? `<p class="ajuda-mini">Todos os atributos já estão em 20 — nada a aumentar.</p>`
        : `
        <p class="ajuda-mini">+2 em um atributo ou +1 em dois, sem passar de 20. O valor é somado direto no atributo da aba Personagem.</p>
        <label class="levelup-opcao"><input type="radio" name="lvl-asi-modo" value="2" ${e.modo === '2' ? 'checked' : ''}> +2 em um atributo</label>
        <label class="levelup-opcao"><input type="radio" name="lvl-asi-modo" value="11" ${e.modo === '11' ? 'checked' : ''}> +1 em dois atributos</label>
        <div class="levelup-linha">
          <select id="lvl-asi-a" aria-label="Primeiro atributo">${opt(e.a, e.modo === '2' ? 2 : 1)}</select>
          ${e.modo === '11' ? `<select id="lvl-asi-b" aria-label="Segundo atributo">${opt(e.b, 1)}</select>` : ''}
        </div>
        ${e.modo === '11' && e.a && e.a === e.b ? '<div class="levelup-erro">Escolha dois atributos diferentes.</div>' : ''}`;
      el.querySelectorAll('[name="lvl-asi-modo"]').forEach(r => r.addEventListener('change', () => {
        e.modo = r.value; e.a = ''; e.b = ''; ctx.redesenhar();
      }));
      el.querySelector('#lvl-asi-a')?.addEventListener('change', ev => { e.a = ev.target.value; ctx.redesenhar(); });
      el.querySelector('#lvl-asi-b')?.addEventListener('change', ev => { e.b = ev.target.value; ctx.redesenhar(); });
    },
    valido(ctx) {
      const base = k => +(ctx.dados.atributos || {})[k] || 10;
      if (ATRIBUTOS.every(([k]) => base(k) >= 20)) return true;
      const e = ctx.escolhas.asi;
      if (!e || !e.a) return false;
      if (e.modo === '2') return base(e.a) + 2 <= 20;
      return !!e.b && e.a !== e.b && base(e.a) + 1 <= 20 && base(e.b) + 1 <= 20;
    },
    aplicar(ctx, payload, registro) {
      const e = ctx.escolhas.asi;
      if (!e || !e.a) return;
      const inc = e.modo === '2' ? { [e.a]: 2 } : { [e.a]: 1, [e.b]: 1 };
      const atrs = { ...(ctx.dados.atributos || {}) };
      for (const [k, v] of Object.entries(inc)) atrs[k] = Math.min(20, (+atrs[k] || 10) + v);
      payload.atributos = atrs;
      registro.asi = inc;
    },
    resumo: r => r.asi ? Object.entries(r.asi).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(', ') : '',
  },
};

function rotuloSubclasse(classe) {
  const k = chaveDeClasse(classe);
  return ({ clerigo: 'Domínio Divino', feiticeiro: 'Origem Feiticeira', bruxo: 'Patrono Transcendental',
    druida: 'Círculo Druídico', mago: 'Tradição Arcana', guerreiro: 'Arquétipo Marcial',
    ladino: 'Arquétipo Ladino', barbaro: 'Caminho Primitivo', bardo: 'Colégio de Bardo',
    monge: 'Tradição Monástica', paladino: 'Juramento Sagrado', patrulheiro: 'Arquétipo de Patrulheiro' })[k] || 'subclasse';
}

// ─── Caixa ────────────────────────────────────────────────────────────
async function abrirAssistenteNivel(N, dados) {
  const db = await window.HabilidadesRegras.carregarCatalogo();
  if (!db || charAtivo?.id !== dados.id || _assistenteNivel) return;
  const passos = window.ProgressaoPHB.escolhasDoNivel(dados, N).filter(p => PASSOS_NIVEL[p]);

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

  const ctx = { N, dados, escolhas: {}, redesenhar: () => desenhar() };
  const btn = card.querySelector('#lvl-concluir');
  const faces = dadoVidaDaClasse(dados.classe);
  card.querySelector('#lvl-sub').textContent =
    `${dados.classe} nível ${N}` + (faces ? ` · PV: role 1d${faces} + mod. de Constituição e atualize o PV máximo com o Mestre.` : '');

  function subclasseEfetiva() { return ctx.escolhas.subclasse || dados.subclasse || ''; }

  function desenharGanhos() {
    const todas = db[chaveDeClasse(dados.classe)] || [];
    const sub = subclasseEfetiva();
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
    for (const p of passos) {
      const def = PASSOS_NIVEL[p];
      const bloco = document.createElement('div');
      bloco.className = 'levelup-bloco' + (def.valido(ctx) ? '' : ' pendente');
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
    if (passos.some(p => !PASSOS_NIVEL[p].valido(ctx))) return;
    btn.disabled = true;
    card.querySelector('#lvl-status').textContent = 'Salvando…';
    const payload = {};
    const registro = { em: new Date().toISOString() };
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
    } else if (charAtivo?.id === linha.id) {
      Object.assign(charAtivo, linha);
      chars = chars.map(c => c.id === charAtivo.id ? charAtivo : c);
      toast(`Nível ${N} concluído!`, 'brilho');
      render();
      return;   // render() agenda a verificação do próximo nível
    }
    agendarVerificacaoNivel();
  });
}

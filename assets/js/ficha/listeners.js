// assets/js/ficha/listeners.js
// conectarListeners(): religa TUDO após cada render() — abas, HP ao vivo,
// pips de slot, inspiração, retrato, validação inline e o auto-save (debounce
// de 800ms em input/change do #ficha-form).
//
// A troca de personagem, Novo/Duplicar/Ativo/Excluir e o toggle Editar/Travar
// agora vivem no header (assets/js/ficha/header.js, conectarListenersHeader())
// — render() já chama renderHeader(c) antes de reconstruir #conteudo.

function conectarListeners() {
  // Tabs
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    // Flush qualquer edição pendente antes de re-renderizar (textarea da aba
    // some do DOM e o auto-save debounce ainda não disparou).
    const form = document.getElementById('ficha-form');
    if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
    tabAtiva = t.dataset.tab;
    render();
    // Transição suave de entrada do conteúdo da nova aba
    const novoForm = document.getElementById('ficha-form');
    if (novoForm) { novoForm.classList.remove('tab-anim'); void novoForm.offsetWidth; novoForm.classList.add('tab-anim'); }
    if (tabAtiva === 'magias') carregarMagiasPreparadas();
  }));
  // Tabs scroll indicator (gradient hints)
  const tabs = document.getElementById('tabs');
  const wrap = document.getElementById('tabs-wrap');
  if (tabs && wrap) {
    const upd = () => {
      const max = tabs.scrollWidth - tabs.clientWidth;
      wrap.classList.toggle('scroll-left',  tabs.scrollLeft > 4);
      wrap.classList.toggle('scroll-right', tabs.scrollLeft < max - 4);
    };
    upd();
    tabs.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);
    // Scroll a aba ativa pra dentro do viewport
    const ativa = tabs.querySelector('.tab.ativa');
    if (ativa) ativa.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  // Modificadores ao vivo (e recalcula salv/perícias se a tab Combate estiver presente)
  $$('[data-attr]').forEach(inp => {
    inp.addEventListener('input', () => { validarEAtualizarMod(inp); recalcularValoresPericiasSalv(); });
  });

  // Efeitos de exaustão (PHB) ao vivo — reflete no aviso de PV, deslocamento efetivo e resumo
  atualizarExaustaoUI();
  ['exaustao', 'deslocamento', 'hp_max'].forEach(nomeCampo => {
    const inp = document.querySelector(`[name="${nomeCampo}"]`);
    if (inp) inp.addEventListener('input', atualizarExaustaoUI);
  });
  // Nível também afeta bônus de proficiência
  const inpNivel = document.querySelector('[name="nivel"]');
  if (inpNivel) inpNivel.addEventListener('input', () => {
    const v = parseNum(inpNivel.value, { inteiro: true, min: 1, max: 20 });
    if (v !== null) charAtivo.nivel = v;
    recalcularValoresPericiasSalv();
  });

  // Validação inline
  $$('[data-validar]').forEach(inp => {
    inp.addEventListener('input', () => validarCampo(inp));
    inp.addEventListener('blur', () => validarCampo(inp));
  });

  // Carregar magias se já estiver na aba
  if (tabAtiva === 'magias') carregarMagiasPreparadas();

  // Habilidades — carrega quando entra
  if (tabAtiva === 'habilidades') {
    renderRecursosClasse(charAtivo);
    conectarListenersFiltroHabilidades(); // busca + pills (Fase 5) — antes de popular, aplicarFiltroHabilidades() já roda no fim de cada popular*
    popularHabilidades(charAtivo.classe, charAtivo.nivel, charAtivo.subclasse);
    popularFeaturesPersonalizadas();
    const btnAdd = document.getElementById('btn-add-feature');
    if (btnAdd) btnAdd.addEventListener('click', adicionarFeaturePersonalizada);
  }

  // Resumo — mesmo painel de recursos de classe da aba Habilidades
  // (renderRecursosClasse), só que dentro de #recursos-classe-wrap do Resumo.
  if (tabAtiva === 'resumo') {
    renderRecursosClasse(charAtivo);
    conectarListenersResumo();
  }

  // Listeners de tags (idiomas/ferramentas) — só na aba Personagem
  if (tabAtiva === 'personagem') {
    conectarListenersTags();
    // Quando a classe muda: atualiza dropdown de subclasse + dado de vida
    const selClasse = document.getElementById('sel-classe');
    if (selClasse) selClasse.addEventListener('change', e => {
      const nova = e.target.value;
      // Subclasse vira novas opções (e zera)
      const wrap = document.querySelector('[name="subclasse"]')?.closest('.campo');
      if (wrap) {
        const ajuda = wrap.querySelector('.ajuda');
        wrap.querySelector('select,input')?.remove();
        wrap.insertBefore(
          Object.assign(document.createElement('div'), { innerHTML: renderSubclasseSelect(nova, '') }).firstElementChild,
          ajuda
        );
      }
      // Dado de vida atualiza com a classe
      const dv = dadoVidaDaClasse(nova);
      if (dv) {
        charAtivo.dado_vida_tipo = dv;
        const hidden = document.getElementById('dv-hidden');
        if (hidden) hidden.value = dv;
      }
    });

  }

  // Pips de slots de magia (clique alterna gasto/disponível)
  $$('.slot-pip').forEach(p => {
    p.addEventListener('click', () => {
      const nv = +p.dataset.slotNv;
      const grupo = document.querySelector(`.slot-pips[data-slot-nv="${nv}"]`);
      if (!grupo) return;
      const pips = [...grupo.querySelectorAll('.slot-pip')];
      const max = pips.length;
      const idx = +p.dataset.slotIdx;
      const eraGasto = p.classList.contains('gasto');
      // Lógica intuitiva: clicar no primeiro disponível gasta;
      // clicar no último gasto disponibiliza.
      let novoGastos;
      if (eraGasto) {
        // Quer disponibilizar até esse índice (inclusive este vira disponível)
        novoGastos = idx;
      } else {
        // Quer gastar até esse índice (inclusive este vira gasto)
        novoGastos = idx + 1;
      }
      novoGastos = Math.max(0, Math.min(max, novoGastos));
      pips.forEach((pip, i) => pip.classList.toggle('gasto', i < novoGastos));
      if (window.FX) FX.slot(p);
      // Atualiza o hidden input + status text
      const wrap = grupo.closest('.slot-card');
      if (wrap) {
        const hAtual = wrap.querySelector(`input[name="slot_${nv}_atual"]`);
        if (hAtual) {
          hAtual.value = novoGastos;
          hAtual.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const status = wrap.querySelector('.slot-status');
        if (status) status.innerHTML = `<strong>${max - novoGastos}</strong> / ${max} disponíveis`;
      }
    });
  });

  // Inspiração: + / − buttons
  const inspMais = document.getElementById('insp-mais');
  const inspMenos = document.getElementById('insp-menos');
  const inspIn = document.getElementById('insp-input');
  if (inspMais && inspIn) inspMais.addEventListener('click', () => {
    inspIn.value = Math.max(0, (+inspIn.value || 0) + 1);
    inspIn.dispatchEvent(new Event('input', { bubbles: true }));
  });
  if (inspMenos && inspIn) inspMenos.addEventListener('click', () => {
    inspIn.value = Math.max(0, (+inspIn.value || 0) - 1);
    inspIn.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Barra de HP ao vivo
  const hpAtual = document.getElementById('hp-atual-input');
  const hpMax = document.getElementById('hp-max-input');
  const atualizarBarraHP = () => {
    if (!hpAtual || !hpMax) return;
    const a = parseNum(hpAtual.value, { inteiro: true }) ?? 0;
    const m = parseNum(hpMax.value, { inteiro: true }) ?? 0;
    const pct = m > 0 ? Math.max(0, Math.min(100, Math.round((a / m) * 100))) : 0;
    const fill = document.getElementById('hp-fill');
    const pctEl = document.getElementById('hp-percent');
    const icEl = document.getElementById('hp-icone-atual');
    if (fill) {
      fill.style.width = pct + '%';
      fill.className = 'hp-fill' + (pct <= 15 ? ' critico' : pct <= 35 ? ' baixo' : pct <= 65 ? ' medio' : '');
    }
    if (pctEl) pctEl.textContent = pct + '%';
    if (icEl) icEl.innerHTML = iconeVida(pct);
  };
  if (hpAtual && hpMax) {
    hpAtual.addEventListener('input', atualizarBarraHP);
    hpMax.addEventListener('input', atualizarBarraHP);
  }

  // Aplicar dano/cura — soma/subtrai do hp_atual, clamp [0, hp_max]
  function aplicarHP(delta) {
    if (!hpAtual || !hpMax) return;
    const max = parseNum(hpMax.value, { inteiro: true }) ?? 0;
    const atual = parseNum(hpAtual.value, { inteiro: true }) ?? 0;
    let novo = atual + delta;
    if (novo < 0) novo = 0;
    if (max > 0 && novo > max) novo = max;
    const mudou = novo - atual;
    hpAtual.value = novo;
    // Feedback visual no input
    hpAtual.style.color = delta < 0 ? '#c9847a' : '#7a8a5e';
    setTimeout(() => { hpAtual.style.color = ''; }, 600);
    atualizarBarraHP();
    // Efeito dinâmico (FX) no bloco de HP + contagem animada do número
    if (window.FX && mudou !== 0) {
      const alvo = document.querySelector('.stat-card.stat-hp') || hpAtual;
      if (mudou < 0) FX.dano(alvo, mudou); else FX.cura(alvo, mudou);
      if (FX.contarInput) FX.contarInput(hpAtual, atual, novo);
      // Cura total → confete
      if (mudou > 0 && max > 0 && novo === max && atual < max && FX.confete) FX.confete('cura');
    }
    // Dispara input event para auto-save pegar (valor final)
    hpAtual.dispatchEvent(new Event('input', { bubbles: true }));

    // Lembrete de teste de concentração (PHB): tomar dano enquanto
    // concentrado exige um teste de Constituição, CD 10 ou metade do dano
    // (o que for maior). A ficha não rola por você — só lembra a CD.
    if (delta < 0 && charAtivo?.concentracao?.ativa) {
      const cd = Math.max(10, Math.floor(-delta / 2));
      toast(`◐ Teste de Constituição CD ${cd} pra manter a concentração em "${charAtivo.concentracao.magia}"`, 'encantamento');
    }
  }

  document.querySelectorAll('[data-aplicar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('hp-aplicar-input');
      const v = parseNum(input?.value, { inteiro: true });
      if (v === null || v <= 0) { input?.focus(); return; }
      aplicarHP(btn.dataset.aplicar === 'dano' ? -v : v);
      input.value = '';
    });
  });
  document.querySelectorAll('[data-quick]').forEach(btn => {
    btn.addEventListener('click', () => aplicarHP(+btn.dataset.quick));
  });
  // Enter no input aplica baseado no sinal
  const inputAplicar = document.getElementById('hp-aplicar-input');
  if (inputAplicar) inputAplicar.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Sinal explícito (-5, +10) ou padrão é dano
      const txt = inputAplicar.value.trim();
      let n = parseNum(txt, { inteiro: true });
      if (n === null || n === 0) return;
      // Se digitou só número positivo sem +, considera dano
      if (txt[0] !== '+' && txt[0] !== '-' && n > 0) n = -n;
      aplicarHP(n);
      inputAplicar.value = '';
    }
  });

  // Listeners das checkboxes de perícia (habilita/desabilita E quando P muda)
  $$('input[name^="per_"][name$="_prof"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const k = cb.name.replace('per_', '').replace('_prof', '');
      const exp = document.querySelector(`input[name="per_${k}_exp"]`);
      if (exp) {
        exp.disabled = !cb.checked;
        if (!cb.checked) exp.checked = false;
      }
      recalcularValoresPericiasSalv();
    });
  });
  $$('input[name^="per_"][name$="_exp"]').forEach(cb => cb.addEventListener('change', recalcularValoresPericiasSalv));
  $$('input[type="checkbox"][name^="salv_"]').forEach(cb => cb.addEventListener('change', recalcularValoresPericiasSalv));

  // Inputs de bônus extra (salvaguardas e perícias) — recalcula ao vivo
  $$('[data-per-bonus], [data-salv-bonus]').forEach(inp => {
    inp.addEventListener('input', recalcularValoresPericiasSalv);
  });

  // Combate (Fase 4): editores em acordeão de salvaguardas/perícias + condições
  if (tabAtiva === 'combate') conectarListenersCombate();

  // Botões de equipamento
  if (tabAtiva === 'equipamento') conectarListenersEquipamento();

  // Aba Aliados (criaturas controladas)
  if (tabAtiva === 'aliados') conectarListenersAliados();

  // Roleplay (dentro da aba Personagem, Fase 9): preview + upload de retrato.
  // Bloco separado do de cima de propósito (mesma condição, escopos
  // isolados) — mais simples e seguro que interligar as duas const/let.
  if (tabAtiva === 'personagem') {
    const inp = document.getElementById('input-imagem');
    const prev = document.getElementById('retrato-preview');
    const arquivo = document.getElementById('input-arquivo');
    const btnRm = document.getElementById('btn-remover-img');
    const lbl = document.getElementById('lbl-upload');
    const stat = document.getElementById('upload-status');

    function setPreview(url) {
      if (!prev) return;
      if (url) {
        prev.innerHTML = `<img src="${url.replace(/"/g, '&quot;')}" alt="Retrato" onerror="this.outerHTML='<div class=\\'retrato-placeholder\\' style=\\'color:#c9847a\\'>⚠ não carregou</div>'">`;
      } else {
        prev.innerHTML = `<div class="retrato-placeholder">${ico('retrato')}<br><span>Sem imagem</span></div>`;
      }
    }

    if (inp) inp.addEventListener('input', () => setPreview(inp.value.trim()));

    if (arquivo) arquivo.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (f.size > 3 * 1024 * 1024) {
        if (stat) { stat.className = 'upload-status erro'; stat.textContent = '❌ Arquivo maior que 3 MB'; }
        return;
      }
      if (lbl) lbl.classList.add('loading');
      if (stat) { stat.className = 'upload-status info'; stat.textContent = '⬆ Enviando…'; }
      try {
        const ext = (f.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${usuario.id}/${charAtivo.id}-${Date.now()}.${ext}`;
        const { error } = await window.sb.storage.from('retratos').upload(path, f, {
          upsert: true, contentType: f.type, cacheControl: '3600',
        });
        if (error) throw error;
        const { data } = window.sb.storage.from('retratos').getPublicUrl(path);
        const url = data.publicUrl;
        if (inp) inp.value = url;
        setPreview(url);
        // dispara input event pro auto-save pegar
        inp?.dispatchEvent(new Event('input', { bubbles: true }));
        if (stat) { stat.className = 'upload-status ok'; stat.textContent = '✓ Enviado'; }
        setTimeout(() => { if (stat) stat.textContent = ''; }, 3000);
      } catch (err) {
        if (stat) { stat.className = 'upload-status erro'; stat.textContent = '❌ ' + (err.message || 'Falha no upload'); }
      } finally {
        if (lbl) lbl.classList.remove('loading');
        arquivo.value = '';  // permite re-enviar mesmo arquivo
      }
    });

    if (btnRm) btnRm.addEventListener('click', () => {
      if (inp) inp.value = '';
      setPreview('');
      inp?.dispatchEvent(new Event('input', { bubbles: true }));
    });

  }

  // Submit manual (botão)
  const form = $('#ficha-form');
  if (form) {
    form.addEventListener('submit', salvar);
    // ── AUTO-SAVE ── (qualquer mudança dispara salvamento em 800ms)
    const autoSave = debounce(() => {
      const ev = new Event('submit', { cancelable: true });
      form.dispatchEvent(ev);
    }, 800);
    form.addEventListener('input', autoSave);
    form.addEventListener('change', autoSave);
  }
}

// Debounce simples
let _debounceTimers = new Map();
function debounce(fn, ms) {
  return function(...args) {
    const key = fn;
    if (_debounceTimers.has(key)) clearTimeout(_debounceTimers.get(key));
    _debounceTimers.set(key, setTimeout(() => fn.apply(this, args), ms));
  };
}

function validarCampo(inp) {
  const tipo = inp.dataset.validar;
  const min = inp.dataset.min !== undefined ? +inp.dataset.min : undefined;
  const max = inp.dataset.max !== undefined ? +inp.dataset.max : undefined;
  const valor = parseNum(inp.value, { inteiro: tipo === 'int', min, max });
  const valido = valor !== null;
  inp.classList.toggle('erro', !valido);
  inp.closest('.campo')?.classList.toggle('tem-erro', !valido);
  return valido;
}

function validarEAtualizarMod(inp) {
  if (validarCampo(inp)) {
    const k = inp.dataset.attr;
    const v = parseNum(inp.value, { inteiro: true, min: 1, max: 30 });
    if (v !== null) {
      const el = document.querySelector(`[data-mod="${k}"]`);
      if (el) el.textContent = fmtMod(mod(v));
      // Atualiza no charAtivo pra recálculo das perícias funcionar
      if (!charAtivo.atributos) charAtivo.atributos = {};
      charAtivo.atributos[k] = v;
    }
  }
}

// Recalcula valores das salvaguardas e perícias on the fly (sem re-render)
function recalcularValoresPericiasSalv() {
  const atrs = charAtivo.atributos || {};
  const nv = +charAtivo.nivel || 1;
  const bp = bonusProf(nv);
  // Coleta inputs atuais (incluindo possíveis edições não-salvas)
  $$('[data-attr]').forEach(inp => {
    const v = parseNum(inp.value, { inteiro: true });
    if (v !== null) atrs[inp.dataset.attr] = v;
  });
  // Salvaguardas
  ATRIBUTOS.forEach(([k]) => {
    const cb = document.querySelector(`[data-salv="${k}"]`);
    const out = document.querySelector(`[data-salv-valor="${k}"]`);
    if (!cb || !out) return;
    const bonusEl = document.querySelector(`[data-salv-bonus="${k}"]`);
    const bonus = bonusEl ? (parseInt(bonusEl.value, 10) || 0) : 0;
    const m = mod(atrs[k] ?? 10);
    out.textContent = fmtMod(m + (cb.checked ? bp : 0) + bonus);
    // Símbolo ○/● da linha compacta (Fase 4, §9) — opcional: só existe em Combate
    const simb = document.querySelector(`[data-salv-simbolo="${k}"]`);
    if (simb) { simb.textContent = cb.checked ? '●' : '○'; simb.classList.toggle('prof', cb.checked); }
  });
  // Perícias
  PERICIAS.forEach(([k, , atr]) => {
    const prof = document.querySelector(`[data-per="${k}"]`);
    const exp = document.querySelector(`[data-per-exp="${k}"]`);
    const out = document.querySelector(`[data-per-valor="${k}"]`);
    if (!prof || !out) return;
    const bonusEl = document.querySelector(`[data-per-bonus="${k}"]`);
    const bonus = bonusEl ? (parseInt(bonusEl.value, 10) || 0) : 0;
    const m = mod(atrs[atr] ?? 10);
    out.textContent = fmtMod(m + (prof.checked ? bp : 0) + (exp?.checked ? bp : 0) + bonus);
    // Símbolo ○/●/◆ da linha compacta (Fase 4, §9) — opcional: só existe em Combate
    const simb = document.querySelector(`[data-per-simbolo="${k}"]`);
    if (simb) {
      const ehExp = !!exp?.checked;
      simb.textContent = ehExp ? '◆' : prof.checked ? '●' : '○';
      simb.classList.toggle('exp', ehExp);
      simb.classList.toggle('prof', prof.checked && !ehExp);
    }
  });
}

function conectarListenersTags() {
  // Adicionar tag
  $$('[data-addtag]').forEach(b => b.addEventListener('click', () => {
    const f = b.dataset.addtag;
    const input = document.getElementById(`add-${f}-input`);
    const v = input.value.trim();
    if (!v) return;
    if (!charAtivo[f]) charAtivo[f] = [];
    if (!charAtivo[f].includes(v)) charAtivo[f].push(v);
    input.value = '';
    render();
  }));
  // Remover tag
  $$('[data-rmtag]').forEach(x => x.addEventListener('click', () => {
    const f = x.dataset.rmtag;
    const idx = +x.dataset.idx;
    if (charAtivo[f]) {
      charAtivo[f].splice(idx, 1);
      render();
    }
  }));
  // Enter no input adiciona
  ['idiomas','ferramentas'].forEach(f => {
    const i = document.getElementById(`add-${f}-input`);
    if (i) i.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); document.querySelector(`[data-addtag="${f}"]`).click(); }
    });
  });
}

function conectarListenersEquipamento() {
  // Carga ao vivo: moedas não disparam render() (só o autosave normal),
  // então recalcula na hora pra barra de carga não ficar desatualizada
  // enquanto o jogador ainda está digitando.
  $$('.moedas input[name^="moeda_"]').forEach(inp => {
    inp.addEventListener('input', () => {
      const inv = charAtivo.inventario || {};
      inv.moedas = inv.moedas || {};
      const cod = inp.name.replace('moeda_', '');
      inv.moedas[cod] = parseNum(inp.value, { min: 0 }) ?? 0;
      charAtivo.inventario = inv;
      const carga = calcularCarga(charAtivo);
      const bar = document.getElementById('carga-bar');
      const total = document.getElementById('carga-total');
      if (total) total.textContent = carga.total.toFixed(1);
      if (bar) bar.className = 'carga-bar carga-' + carga.nivel;
    });
  });

  // Remover item (armas/armaduras/itens — mesmo botão de sempre). Confirmação
  // padronizada (mesmo modal de remover companion/característica): um "✕" de
  // lista é fácil de tocar sem querer, e sem isso o item some sem chance de
  // desfazer.
  $$('[data-rm]').forEach(b => b.addEventListener('click', async e => {
    const tipo = e.currentTarget.dataset.rm;
    const idx = +e.currentTarget.dataset.idx;
    const inv = charAtivo.inventario || {};
    if (!inv[tipo] || !inv[tipo][idx]) return;
    const nome = inv[tipo][idx].nome || 'este item';
    const cf = window.Confirmar
      ? await Confirmar.perguntar({ titulo: 'Remover item?', mensagem: `"${nome}" será removido do inventário.`, confirmar: 'Remover', danger: true })
      : confirm(`Remover "${nome}"?`);
    if (!cf) return;
    inv[tipo].splice(idx, 1);
    charAtivo.inventario = inv;
    render();  // re-renderiza apenas a tab
  }));

  // Rolar ataque rápido de uma arma do inventário (mesma lógica do Resumo)
  $$('[data-equip-rolar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.equipRolar;
      const arma = (charAtivo.inventario?.armas || [])[idx];
      if (!arma || !window.Ataques) return;
      const r = Ataques.rolar(arma, charAtivo.atributos, charAtivo.nivel, _modoRolagem);
      const critico = r.critico ? ' · CRÍTICO!' : r.falhaCritica ? ' · falha crítica' : '';
      toast(`${arma.nome}: ataque ${r.ataqueTexto}${critico} · dano ${r.danoTexto}`);
    });
  });

  // Adicionar arma do catálogo — abre o seletor (busca + categoria) em vez
  // do <select> nativo gigante (§14).
  const btnArma = $('#btn-abrir-seletor-arma');
  if (btnArma) btnArma.addEventListener('click', () => {
    UI.abrirSeletor({
      titulo: 'Adicionar arma',
      placeholder: 'Buscar arma…',
      itens: window.PHB.ARMAS,
      agrupar: a => a.categoria,
      rotulo: a => a.nome,
      sublabel: a => `${a.dano} ${a.tipo_dano}`,
      recentesChave: 'ficha_recentes_armas',
      onEscolher: (arma) => {
        const inv = charAtivo.inventario || {};
        inv.armas = inv.armas || [];
        inv.armas.push(arma);
        charAtivo.inventario = inv;
        render();
      },
    });
  });

  // Adicionar armadura
  const btnArm = $('#btn-abrir-seletor-armadura');
  if (btnArm) btnArm.addEventListener('click', () => {
    UI.abrirSeletor({
      titulo: 'Adicionar armadura',
      placeholder: 'Buscar armadura…',
      itens: window.PHB.ARMADURAS,
      agrupar: a => a.tipo,
      ordemGrupos: ['Leve', 'Média', 'Pesada', 'Escudo'],
      rotulo: a => a.nome,
      sublabel: a => `CA ${a.ca}`,
      recentesChave: 'ficha_recentes_armaduras',
      onEscolher: (armadura) => {
        const inv = charAtivo.inventario || {};
        inv.armaduras = inv.armaduras || [];
        inv.armaduras.push(armadura);
        charAtivo.inventario = inv;
        render();
      },
    });
  });

  // Adicionar item do catálogo (armas/ferramentas juntas na mesma busca)
  const btnItemCat = $('#btn-abrir-seletor-item');
  if (btnItemCat) btnItemCat.addEventListener('click', () => {
    const catalogo = [...window.PHB.ITENS, ...window.PHB.FERRAMENTAS];
    UI.abrirSeletor({
      titulo: 'Adicionar item',
      placeholder: 'Buscar item…',
      itens: catalogo,
      agrupar: it => it.categoria,
      rotulo: it => it.nome,
      recentesChave: 'ficha_recentes_itens',
      onEscolher: (item) => {
        const qtd = +($('#add-item-qtd')?.value || 1);
        const it = { ...item, qtd };
        const inv = charAtivo.inventario || {};
        inv.itens = inv.itens || [];
        inv.itens.push(it);
        charAtivo.inventario = inv;
        render();
      },
    });
  });

  // Item personalizado
  const btnItemCustom = $('#btn-add-item-custom');
  if (btnItemCustom) btnItemCustom.addEventListener('click', () => {
    const nome = $('#add-item-nome').value.trim();
    const qtd = +($('#add-item-qtd-custom').value || 1);
    if (!nome) return;
    const inv = charAtivo.inventario || {};
    inv.itens = inv.itens || [];
    inv.itens.push({ nome, qtd, peso: '—' });
    charAtivo.inventario = inv;
    render();
  });
}


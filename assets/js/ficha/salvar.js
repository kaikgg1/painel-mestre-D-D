// assets/js/ficha/salvar.js
// salvar(): monta o payload a partir do FormData e faz o UPDATE em characters.
// ATENÇÃO: as guardas por aba (fd.has("_aba_combate"), "slot_1_max", "moeda_po",
// "attr_for") existem para NÃO reenviar campos de abas não renderizadas com a
// cópia local desatualizada — sem elas, um auto-save de qualquer aba desfaz
// mudanças que o Mestre fez nesse meio-tempo. Último script: termina em init().

// Estados do badge de autosave no header (§17): ✓ Salvo / ••• Salvando /
// ⚠ Erro ao salvar (+ botão Tentar novamente). Um só lugar pra montar
// className+innerHTML+visibilidade do retry evita repetir os três em cada
// ramo (validação, sucesso, erro de rede).
function definirStatusAutosave(estado, msg) {
  const status = document.getElementById('status');
  const retry = document.getElementById('status-retry');
  if (!status) return;
  status.className = 'status-msg ' + estado;
  status.innerHTML = msg;
  if (retry) retry.hidden = estado !== 'erro';
}

async function salvar(e) {
  e.preventDefault();
  const btn = $('#btn-salvar');
  const status = $('#status');

  // Valida todos os campos com data-validar
  const invalidos = [];
  $$('[data-validar]').forEach(inp => { if (!validarCampo(inp)) invalidos.push(inp); });
  if (invalidos.length) {
    definirStatusAutosave('erro', `⚠ ${invalidos.length} campo(s) com erro — corrija antes de salvar`);
    invalidos[0].focus();
    return;
  }

  if (btn) btn.disabled = true;
  definirStatusAutosave('salvando', '<span class="dots"><span>•</span><span>•</span><span>•</span></span> <span class="txt">Salvando</span>');

  const f = e.target;
  const fd = new FormData(f);
  const payload = { ...charAtivo };  // começa com o estado atual (preserva tabs não-renderizadas)

  // Helpers
  const num = (k, intt = true) => {
    if (!fd.has(k)) return undefined;
    const v = parseNum(fd.get(k), { inteiro: intt });
    return v === null ? undefined : v;
  };
  const txt = (k) => fd.has(k) ? (fd.get(k) || null) : undefined;

  // Identidade
  const set = (k, v) => { if (v !== undefined) payload[k] = v; };
  set('nome', txt('nome'));
  set('nivel', num('nivel'));
  set('raca', txt('raca'));
  set('classe', txt('classe'));
  set('subclasse', txt('subclasse'));
  set('origem', txt('origem'));
  set('alinhamento', txt('alinhamento'));
  // campanha: '' significa "sem campanha" → null no banco
  if (fd.has('campanha')) {
    const v = fd.get('campanha');
    payload.campanha = v ? v : null;
  }
  set('tracos_raciais', txt('tracos_raciais'));
  // idiomas e ferramentas (arrays) — pegam direto do estado (mantidos pelos handlers de tag)
  if (charAtivo.idiomas !== undefined)     payload.idiomas = charAtivo.idiomas;
  if (charAtivo.ferramentas !== undefined) payload.ferramentas = charAtivo.ferramentas;

  // Atributos (só se tab identidade)
  if (fd.has('attr_for')) {
    const atrs = {};
    for (const [k] of ATRIBUTOS) atrs[k] = num('attr_' + k) ?? 10;
    payload.atributos = atrs;
  }

  // Combate
  set('hp_atual', num('hp_atual'));
  set('hp_max', num('hp_max'));
  set('hp_temp', num('hp_temp'));
  set('ca', num('ca'));
  set('iniciativa_bonus', num('iniciativa_bonus'));
  set('deslocamento', num('deslocamento', false));  // decimal
  // Dado de vida sempre derivado da classe (não editável)
  const dvDaClasse = dadoVidaDaClasse(payload.classe || charAtivo.classe);
  if (dvDaClasse) payload.dado_vida_tipo = dvDaClasse;
  else set('dado_vida_tipo', num('dado_vida_tipo'));
  set('dado_vida_atual', num('dado_vida_atual'));
  set('exaustao', num('exaustao'));

  // Slots (apenas se tab combate ativa)
  if (fd.has('slot_1_max')) {
    const slots = {};
    for (let n = 1; n <= 9; n++) {
      const max   = num(`slot_${n}_max`)   ?? 0;
      const atual = num(`slot_${n}_atual`) ?? 0;
      if (max > 0 || atual > 0) slots[n] = { max, atual };
    }
    payload.slots_magia = slots;
  } else {
    // Tab Combate não está aberta — não reenvia slots_magia.
    // `payload` começou como cópia de charAtivo (pra preservar outras abas),
    // então sem este delete o auto-save de QUALQUER outro campo (ex: Notas,
    // Identidade) reescreveria slots_magia com o valor local desatualizado,
    // podendo desfazer um Descanso Longo aplicado pelo Mestre nesse meio-tempo.
    delete payload.slots_magia;
  }

  // Salvaguardas + Perícias + Magia (só se tab Combate aberta — usa marker hidden)
  // Bug evitado: checkboxes desmarcados NÃO aparecem no FormData,
  // por isso não dá pra usar fd.has('salv_for') como detecção.
  if (fd.has('_aba_combate')) {
    const salv = {};
    for (const [k] of ATRIBUTOS) {
      const prof = fd.has('salv_' + k);
      const bonus = parseInt(fd.get('salv_' + k + '_bonus'), 10) || 0;
      // objeto {prof,bonus} quando há bônus; bool quando só proficiência (enxuto + compat)
      if (bonus) salv[k] = { prof, bonus };
      else if (prof) salv[k] = true;
    }
    payload.salvaguardas = salv;
    const per = {};
    for (const [k] of PERICIAS) {
      const prof = fd.has('per_' + k + '_prof');
      const exp  = fd.has('per_' + k + '_exp');
      const bonus = parseInt(fd.get('per_' + k + '_bonus'), 10) || 0;
      if (prof || exp || bonus) {
        per[k] = { prof, exp };
        if (bonus) per[k].bonus = bonus;
      }
    }
    payload.pericias = per;
    set('truques_conhecidos', num('truques_conhecidos'));
    set('magias_conhecidas',  num('magias_conhecidas'));
    set('cd_resistencia',     num('cd_resistencia'));
    set('bonus_atq_magia',    num('bonus_atq_magia'));
  } else {
    // Tab Combate não está aberta — mesmo caso do slots_magia acima:
    // não reenvia esses campos com a cópia local (possivelmente desatualizada)
    // de charAtivo, pra não sobrescrever uma mudança feita pelo Mestre/outro
    // aparelho nesse meio-tempo.
    delete payload.salvaguardas;
    delete payload.pericias;
    delete payload.truques_conhecidos;
    delete payload.magias_conhecidas;
    delete payload.cd_resistencia;
    delete payload.bonus_atq_magia;
  }

  // Características adicionais (aba Habilidades)
  set('caracteristicas_adicionais', txt('caracteristicas_adicionais'));

  // Moedas (apenas se tab equipamento ativa)
  if (fd.has('moeda_po')) {
    const inv = payload.inventario || { moedas:{}, armas:[], armaduras:[], itens:[] };
    inv.moedas = {};
    for (const md of window.PHB.MOEDAS) inv.moedas[md.codigo] = num('moeda_' + md.codigo) ?? 0;
    payload.inventario = inv;
  }
  // armas/armaduras/itens já foram setados pelo conectarListenersEquipamento (mantidos em payload.inventario)

  // Roleplay
  set('tracos_pessoais', txt('tracos_pessoais'));
  set('ideais', txt('ideais'));
  set('vinculos', txt('vinculos'));
  set('defeitos', txt('defeitos'));
  set('historia', txt('historia'));
  set('notas', txt('notas'));
  set('imagem_url', txt('imagem_url'));
  // Inspiração agora é numérica (sempre que aba Roleplay estiver aberta)
  if (fd.has('inspiracao')) {
    const v = num('inspiracao');
    payload.inspiracao = v ?? 0;
  }

  // Campos com save dedicado próprio (salvarRecursos, salvarFeaturesPersonalizadas,
  // salvarCompanions, salvarFavoritosBestiario, salvarCondicoes, salvarHabilidadesFavoritas,
  // salvarConcentracao, salvarClassesSecundarias) — nunca reenviar pela cópia local
  // de charAtivo aqui, senão qualquer autosave de outra aba reenvia a versão
  // desatualizada e desfaz uma mudança feita pelo Mestre/outro aparelho nesse
  // meio-tempo (mesma causa raiz do bug de slots_magia não resetar no Descanso Longo).
  delete payload.recursos_usados;
  delete payload.features_personalizadas;
  delete payload.companions;
  delete payload.bestiario_favoritos;
  delete payload.condicoes;
  delete payload.habilidades_favoritas;
  delete payload.concentracao;
  delete payload.classes_secundarias;

  // Remove campos que não vão pro UPDATE
  delete payload.id;
  delete payload.user_id;
  delete payload.created_at;
  delete payload.updated_at;

  // Percepção passiva (10 + perícia Percepção): SEMPRE derivada, nunca
  // editada direto pelo jogador — mas até aqui nunca era gravada no banco,
  // só existia calculada na hora pra exibir na própria ficha. O painel do
  // Mestre lê characters.percepcao_passiva direto (é o único jeito de saber
  // sem recalcular a fórmula de novo lá), então ficava sempre preso no
  // valor padrão (10), mesmo pra PJ com Percepção/Sabedoria/proficiência
  // configurados. Recalcula do melhor dado disponível (o que está indo
  // neste payload agora, senão o que já tinha em charAtivo) e grava sempre
  // — não tem "aba dona" pra isso ficar desatualizado feito slots_magia.
  payload.percepcao_passiva = percepcaoPassiva({
    atributos: payload.atributos ?? charAtivo.atributos,
    pericias: payload.pericias ?? charAtivo.pericias,
    nivel: payload.nivel ?? charAtivo.nivel,
    classes_secundarias: charAtivo.classes_secundarias,
  });

  // Coerção forçada de tipos (evita "invalid input syntax for integer: false"
  // quando algum campo veio como boolean/string do state antigo)
  const CAMPOS_INT = ['nivel','hp_atual','hp_max','hp_temp','ca','iniciativa_bonus',
    'dado_vida_tipo','dado_vida_atual','exaustao','inspiracao','morte_sucessos','morte_falhas',
    'truques_conhecidos','magias_conhecidas','cd_resistencia','bonus_atq_magia','xp',
    'percepcao_passiva'];
  for (const k of CAMPOS_INT) {
    if (payload[k] !== undefined && payload[k] !== null) {
      const n = +payload[k];
      payload[k] = Number.isFinite(n) ? n : 0;
    }
  }
  // deslocamento é numeric (aceita decimal)
  if (payload.deslocamento !== undefined && payload.deslocamento !== null) {
    const n = parseFloat(String(payload.deslocamento).replace(',', '.'));
    payload.deslocamento = Number.isFinite(n) ? n : 0;
  }

  const { data, error } = await window.sb
    .from('characters').update(payload).eq('id', charAtivo.id).select('*').single();

  if (error) {
    definirStatusAutosave('erro', '⚠ <span class="txt">Erro ao salvar</span>');
    console.warn('[ficha] erro ao salvar:', error);
  } else {
    _ultimoSaveLocal = Date.now();   // pra ignorar echo do nosso save no realtime
    // Atualiza CAMPO POR CAMPO em vez de substituir o objeto inteiro
    // (preserva edições em progresso de outros campos não-salvos)
    Object.assign(charAtivo, payload);
    chars = chars.map(c => c.id === charAtivo.id ? charAtivo : c);
    definirStatusAutosave('ok', '✓ <span class="txt">Salvo · ' + new Date().toLocaleTimeString('pt-BR') + '</span>');
    if (window.FX) FX.salvo(status);
    setTimeout(() => {
      if (status.classList.contains('ok')) definirStatusAutosave('ok', ico('salvar') + ' <span class="txt">Auto-save ativo</span>');
    }, 2500);
  }
  if (btn) btn.disabled = false;
}

// Confete ao subir de nível (compara com o nível antes do auto-save aplicar)
document.addEventListener('change', e => {
  if (e.target && e.target.name === 'nivel' && charAtivo && window.FX && FX.confete) {
    const novo = parseInt(e.target.value, 10);
    const antigo = parseInt(charAtivo.nivel, 10) || 0;
    if (!isNaN(novo) && novo > antigo && novo <= 20) FX.confete('levelup');
  }
});

init();

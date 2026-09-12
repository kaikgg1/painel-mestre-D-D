// assets/js/vilao_combate.js
// Sincronismo + tracker de combate compartilhado pras fichas de vilão "com
// fases" (HP, CA por fase, reações, condições, contador de rodada, notas,
// acordeão de habilidades) — mst-5 da auditoria. Confirmado por diff que
// abade/babalysaga/bonegrinder/fleshmound/gallows/izek/kiril/patrina/
// varushka/vladimir tinham esse bloco ~100 linhas colado, idêntico a não
// ser por: STORAGE_KEY/MS_CHAVE, PV padrão/média, valor de reset da CA por
// input, e o que (se algo) atualiza no cabeçalho ao trocar de fase — daí
// esses virarem parâmetros em vez de constantes fixas no módulo.
//
// API: VilaoCombate.iniciar({
//   storageKey, msChave, downloadPrefix,   // strings, únicas por ficha
//   hpDefault, hpMedia,                    // números (PV de reset / "PV na média")
//   caReset(inputEl) => number,            // valor de CA ao resetar, por input (pode olhar inputEl.dataset.phase)
//   formas,                                // {1:{...}, 2:{...}} usado só se onFormaChange for passado; null se a ficha não tem fase alguma
//   onFormaChange(formaAtual, num)?,       // opcional: atualiza campos de cabeçalho específicos da ficha (ND, PB, PV médio…) — sem isso, só troca a aba/conteúdo ativo
// })
//
// Expõe switchPhase/adjustHP/resetHP/setMedia/toggleReact/resetReactions/
// adjustRound/resetRound/toggleAbility/saveState/loadState/resetAll/
// exportJSON/importJSON como globais soltos (window.X) — o HTML chama via
// onclick="X(...)" inline, precisam existir nesse escopo.
window.VilaoCombate = (function () {
  // Nome exibido no topo de toda ficha de vilão (paineis/vilao/*.html) —
  // usado só pro log de combate opcional (mst-9, assets/js/log_combate.js)
  // saber de quem é o evento, sem precisar de mais um parâmetro de config.
  function _nomeFicha() {
    return document.querySelector('.brand')?.textContent?.trim() || 'Vilão';
  }
  // Liga um listener delegado (1 por página) nos chips de condição — eles
  // já têm onclick inline (this.classList.toggle('active');saveState(true))
  // em cada ficha; isso só ADICIONA o registro no log, sem tocar no HTML.
  let _logCondicoesLigado = false;
  function _ligarLogCondicoes() {
    if (!window.LogCombate || _logCondicoesLigado) return;
    _logCondicoesLigado = true;
    document.addEventListener('click', e => {
      const chip = e.target.closest('.condition-row .chip');
      if (!chip) return;
      const ativo = chip.classList.contains('active');
      window.LogCombate.registrar(`${_nomeFicha()}: <strong>${chip.textContent.trim()}</strong> ${ativo ? 'ativada' : 'removida'}`);
    });
  }

  function iniciar(config) {
    const { storageKey, msChave, downloadPrefix, hpDefault, hpMedia, caReset, formas, onFormaChange } = config;
    let _msAplicando = false;

    function _setSyncStatus(txt, cor) {
      const el = document.getElementById('syncStatus');
      if (el) { el.textContent = txt; el.style.color = cor || 'var(--gold-dim)'; }
    }

    function switchPhase(num) { switchPhaseSilent(num); saveState(true); }
    function switchPhaseSilent(num) {
      const tab = document.querySelector(`.phase-tab[data-phase="${num}"]`);
      const content = document.getElementById(`phase-${num}`);
      if (!tab || !content) return; // fase inexistente nesta ficha (ex.: atalho de teclado pra fase que não existe) — no-op seguro
      document.querySelectorAll('.phase-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.phase-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      content.classList.add('active');
      document.body.dataset.fase = num;
      if (onFormaChange && formas) onFormaChange(formas[num] || formas[1], num);
    }

    const hpCurrent = document.getElementById('hpCurrent');
    const hpMax = document.getElementById('hpMax');
    const hpBar = document.getElementById('hpBar');
    const hpLabel = document.getElementById('hpLabel');
    function updateHPBar() {
      const cur = parseInt(hpCurrent.value) || 0, max = parseInt(hpMax.value) || 1;
      const pct = Math.max(0, Math.min(100, (cur / max) * 100));
      hpBar.style.width = pct + '%'; hpLabel.textContent = Math.round(pct) + '%';
      if (pct > 50) hpBar.style.background = 'linear-gradient(90deg, var(--blood-dark), var(--blood))';
      else if (pct > 25) hpBar.style.background = 'linear-gradient(90deg, #4a1014, #a82020)';
      else hpBar.style.background = 'linear-gradient(90deg, #3a0808, #6a0e0e)';
    }
    function adjustHP(delta) {
      const max = parseInt(hpMax.value) || 1; let cur = parseInt(hpCurrent.value) || 0; const antes = cur;
      cur = Math.max(0, Math.min(max, cur + delta)); hpCurrent.value = cur; updateHPBar();
      const mudou = cur - antes;
      if (window.FX && mudou !== 0) { const alvo = document.querySelector('.combat-bar .panel') || hpCurrent; if (mudou < 0) FX.dano(alvo, mudou); else FX.cura(alvo, mudou); if (FX.contarInput) FX.contarInput(hpCurrent, antes, cur); }
      if (mudou !== 0) window.LogCombate?.registrar(`${_nomeFicha()}: <strong>${mudou > 0 ? '+' : ''}${mudou} PV</strong> (${antes}→${cur})`);
      saveState(true);
    }
    function resetHP() { hpCurrent.value = hpMax.value; updateHPBar(); saveState(true); }
    // hpMedia é opcional: kiril/patrina não têm o botão "Usar média" (já
    // mostram PV médio por fase no próprio cabeçalho via onFormaChange).
    function setMedia() {
      const v = hpMedia ?? hpDefault;
      hpMax.value = v; hpCurrent.value = v; updateHPBar(); saveState(true); showToast(`✓ PV na média (${v})`);
    }
    hpCurrent.addEventListener('input', () => { updateHPBar(); saveState(true); });
    hpMax.addEventListener('input', () => { updateHPBar(); saveState(true); });

    function toggleReact(el) { el.classList.toggle('used'); saveState(true); }
    function resetReactions() { document.querySelectorAll('.react-dot').forEach(d => d.classList.remove('used')); saveState(true); }
    function adjustRound(delta) {
      const el = document.getElementById('roundCounter'); if (!el) return;
      let n = Math.max(1, (parseInt(el.textContent) || 1) + delta); el.textContent = n;
      if (delta > 0) document.querySelectorAll('.react-dot').forEach(d => d.classList.remove('used'));
      saveState(true);
    }
    function resetRound() { const el = document.getElementById('roundCounter'); if (el) el.textContent = 1; saveState(true); }
    function toggleAbility(header) { header.parentElement.classList.toggle('open'); }

    function getState() {
      return {
        hpCurrent: hpCurrent.value, hpMax: hpMax.value,
        ca: Array.from(document.querySelectorAll('.ca-input')).map(i => ({ phase: i.dataset.phase, val: i.value })),
        activePhase: document.querySelector('.phase-tab.active')?.dataset.phase,
        reactions: Array.from(document.querySelectorAll('.react-dot')).map(d => d.classList.contains('used')),
        conditions: Array.from(document.querySelectorAll('.condition-row .chip')).map(c => c.classList.contains('active')),
        notes: document.getElementById('notesArea').value,
        round: (document.getElementById('roundCounter')?.textContent) || '1',
        openAbilities: Array.from(document.querySelectorAll('.ability.open')).map(a => { const p = a.closest('.phase-content'); return `${p ? p.id : 'global'}::${a.querySelector('.ability-name').textContent}`; })
      };
    }
    function applyState(s) {
      if (!s) return;
      hpCurrent.value = s.hpCurrent ?? hpDefault; hpMax.value = s.hpMax ?? hpDefault; updateHPBar();
      if (s.ca) s.ca.forEach(c => { const inp = document.querySelector(`.ca-input[data-phase="${c.phase}"]`); if (inp) inp.value = c.val; });
      switchPhaseSilent(parseInt(s.activePhase) || 1);
      (s.reactions || []).forEach((u, i) => { const d = document.querySelectorAll('.react-dot')[i]; if (d) d.classList.toggle('used', u); });
      (s.conditions || []).forEach((u, i) => { const c = document.querySelectorAll('.condition-row .chip')[i]; if (c) c.classList.toggle('active', u); });
      document.getElementById('notesArea').value = s.notes || '';
      const roundEl = document.getElementById('roundCounter'); if (roundEl) roundEl.textContent = s.round || '1';
      if (s.openAbilities) s.openAbilities.forEach(key => {
        const [phase, name] = key.split('::');
        const container = phase === 'global' ? document : document.getElementById(phase);
        if (!container) return;
        container.querySelectorAll('.ability').forEach(a => { if (a.querySelector('.ability-name').textContent === name) a.classList.add('open'); });
      });
    }
    function saveState(silent = false) {
      if (_msAplicando) return;
      try {
        const dados = getState();
        localStorage.setItem(storageKey, JSON.stringify(dados));
        window.VilaoAtividade?.registrar(storageKey.replace(/_ficha_v1$/, ''), _nomeFicha());
        if (window.MasterState) { _setSyncStatus('⟳ sincronizando…', 'var(--gold-dim)'); window.MasterState.salvarDebounced(msChave, dados, silent ? 600 : 0); setTimeout(() => _setSyncStatus('● sincronizado', 'var(--gold)'), silent ? 800 : 200); }
        if (!silent) showToast('✓ Salvo');
      } catch (e) { if (!silent) showToast('Erro ao salvar'); }
    }
    async function loadState() {
      try {
        let dados = null;
        if (window.MasterState) dados = await window.MasterState.carregar(msChave);
        if (!dados) { const local = localStorage.getItem(storageKey); if (local) dados = JSON.parse(local); }
        if (!dados) { showToast('Nada salvo'); return; }
        _msAplicando = true; applyState(dados); _msAplicando = false;
        _setSyncStatus(window.MasterState ? '● sincronizado' : '○ local', window.MasterState ? 'var(--gold)' : 'var(--gold-dim)');
        showToast('✓ Carregado');
      } catch (e) { _msAplicando = false; showToast('Erro ao carregar'); }
    }
    function resetAll() {
      if (!confirm('Resetar tudo? (HP, forma, reações, condições, notas)')) return;
      localStorage.removeItem(storageKey);
      hpCurrent.value = hpDefault; hpMax.value = hpDefault;
      document.querySelectorAll('.ca-input').forEach(i => i.value = caReset(i));
      updateHPBar();
      document.querySelectorAll('.react-dot').forEach(d => d.classList.remove('used'));
      document.querySelectorAll('.condition-row .chip').forEach(c => c.classList.remove('active'));
      document.querySelectorAll('.ability.open').forEach(a => a.classList.remove('open'));
      document.getElementById('notesArea').value = '';
      const roundEl = document.getElementById('roundCounter'); if (roundEl) roundEl.textContent = 1;
      switchPhase(1); showToast('✓ Resetado');
    }
    function exportJSON() {
      const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `${downloadPrefix}_combate_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
      showToast('✓ Exportado');
    }
    function importJSON(evt) {
      const file = evt.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => { try { applyState(JSON.parse(e.target.result)); showToast('✓ Importado'); saveState(true); } catch (err) { showToast('Arquivo inválido'); } };
      reader.readAsText(file); evt.target.value = '';
    }
    let toastTimer;
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg; t.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
    }

    document.querySelectorAll('.ca-input').forEach(inp => inp.addEventListener('input', () => saveState(true)));
    document.getElementById('notesArea').addEventListener('input', () => { clearTimeout(window._notesTimer); window._notesTimer = setTimeout(() => saveState(true), 600); });
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') { if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveState(); } return; }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveState(); return; }
      if (e.key === '1') switchPhase(1);
      if (e.key === '2') switchPhase(2);
      if (e.key === '3') switchPhase(3);
    });

    switchPhaseSilent(1);
    updateHPBar();
    _ligarLogCondicoes();
    (async function bootstrap() {
      if (window.Auth) {
        const u = await window.Auth.requerLogin('../login.html'); if (!u) return;
        const ehMestre = await window.Auth.ehMestre();
        if (!ehMestre) { document.body.innerHTML = '<div style="padding:60px;text-align:center;color:var(--bone);font-family:Cinzel,serif"><h2>Acesso restrito ao Mestre.</h2><p style="margin-top:14px"><a href="../../index.html" style="color:var(--gold)">Voltar</a></p></div>'; return; }
      }
      await loadState();
      if (window.MasterState) window.MasterState.iniciarRealtime(msChave, dados => { if (!dados) return; _msAplicando = true; applyState(dados); _msAplicando = false; _setSyncStatus('● sincronizado', 'var(--gold)'); });
    })();

    window.switchPhase = switchPhase;
    window.adjustHP = adjustHP;
    window.resetHP = resetHP;
    window.setMedia = setMedia;
    window.toggleReact = toggleReact;
    window.resetReactions = resetReactions;
    window.adjustRound = adjustRound;
    window.resetRound = resetRound;
    window.toggleAbility = toggleAbility;
    window.saveState = saveState;
    window.loadState = loadState;
    window.resetAll = resetAll;
    window.exportJSON = exportJSON;
    window.importJSON = importJSON;
  }

  // Variante sem fases (monstro de forma única — 1 CA, sem phase-tabs) —
  // escher/ezmerelda/sasha/vanrichten tinham esse bloco colado, idêntico a
  // não ser por STORAGE_KEY/MS_CHAVE/HP_MAX/HP_MEDIA/CA_PADRAO/downloadPrefix.
  // Duplica a parte genérica (HP/reações/rodada/habilidades/salvar) da
  // iniciar() de propósito, em vez de uma função só com `if (temFases)`
  // espalhado — a forma dos dados (CA único vs array por fase) diverge
  // demais pra valer a pena forçar um único caminho de código.
  function iniciarSemFases(config) {
    const { storageKey, msChave, downloadPrefix, hpMax: HP_MAX, hpMedia: HP_MEDIA, caPadrao: CA_PADRAO } = config;
    let _msAplicando = false;

    function _setSyncStatus(txt, cor) {
      const el = document.getElementById('syncStatus');
      if (el) { el.textContent = txt; el.style.color = cor || 'var(--gold-dim)'; }
    }

    const hpCurrent = document.getElementById('hpCurrent');
    const hpMax = document.getElementById('hpMax');
    const hpBar = document.getElementById('hpBar');
    const hpLabel = document.getElementById('hpLabel');
    function updateHPBar() {
      const cur = parseInt(hpCurrent.value) || 0, max = parseInt(hpMax.value) || 1;
      const pct = Math.max(0, Math.min(100, (cur / max) * 100));
      hpBar.style.width = pct + '%'; hpLabel.textContent = Math.round(pct) + '%';
      if (pct > 50) hpBar.style.background = 'linear-gradient(90deg, var(--blood-dark), var(--blood))';
      else if (pct > 25) hpBar.style.background = 'linear-gradient(90deg, #4a1014, #a82020)';
      else hpBar.style.background = 'linear-gradient(90deg, #3a0808, #6a0e0e)';
    }
    function adjustHP(delta) {
      const max = parseInt(hpMax.value) || 1; let cur = parseInt(hpCurrent.value) || 0; const antes = cur;
      cur = Math.max(0, Math.min(max, cur + delta)); hpCurrent.value = cur; updateHPBar();
      const mudou = cur - antes;
      if (window.FX && mudou !== 0) { const alvo = document.querySelector('.combat-bar .panel') || hpCurrent; if (mudou < 0) FX.dano(alvo, mudou); else FX.cura(alvo, mudou); if (FX.contarInput) FX.contarInput(hpCurrent, antes, cur); }
      if (mudou !== 0) window.LogCombate?.registrar(`${_nomeFicha()}: <strong>${mudou > 0 ? '+' : ''}${mudou} PV</strong> (${antes}→${cur})`);
      saveState(true);
    }
    function resetHP() { hpCurrent.value = hpMax.value; updateHPBar(); saveState(true); }
    function setMedia() { hpMax.value = HP_MEDIA; hpCurrent.value = HP_MEDIA; updateHPBar(); saveState(true); showToast(`✓ PV na média (${HP_MEDIA})`); }
    hpCurrent.addEventListener('input', () => { updateHPBar(); saveState(true); });
    hpMax.addEventListener('input', () => { updateHPBar(); saveState(true); });

    function toggleReact(el) { el.classList.toggle('used'); saveState(true); }
    function resetReactions() { document.querySelectorAll('.react-dot').forEach(d => d.classList.remove('used')); saveState(true); }
    function adjustRound(delta) {
      const el = document.getElementById('roundCounter'); if (!el) return;
      let n = Math.max(1, (parseInt(el.textContent) || 1) + delta); el.textContent = n;
      if (delta > 0) document.querySelectorAll('.react-dot').forEach(d => d.classList.remove('used'));
      saveState(true);
    }
    function resetRound() { const el = document.getElementById('roundCounter'); if (el) el.textContent = 1; saveState(true); }
    function toggleAbility(header) { header.parentElement.classList.toggle('open'); }

    function getState() {
      return {
        hpCurrent: hpCurrent.value, hpMax: hpMax.value,
        ca: document.querySelector('.ca-input')?.value,
        reactions: Array.from(document.querySelectorAll('.react-dot')).map(d => d.classList.contains('used')),
        conditions: Array.from(document.querySelectorAll('.condition-row .chip')).map(c => c.classList.contains('active')),
        notes: document.getElementById('notesArea').value,
        round: (document.getElementById('roundCounter')?.textContent) || '1',
        openAbilities: Array.from(document.querySelectorAll('.ability.open')).map(a => a.querySelector('.ability-name').textContent)
      };
    }
    function applyState(s) {
      if (!s) return;
      hpCurrent.value = s.hpCurrent ?? HP_MAX; hpMax.value = s.hpMax ?? HP_MAX; updateHPBar();
      const caInp = document.querySelector('.ca-input'); if (caInp && s.ca != null) caInp.value = s.ca;
      (s.reactions || []).forEach((u, i) => { const d = document.querySelectorAll('.react-dot')[i]; if (d) d.classList.toggle('used', u); });
      (s.conditions || []).forEach((u, i) => { const c = document.querySelectorAll('.condition-row .chip')[i]; if (c) c.classList.toggle('active', u); });
      document.getElementById('notesArea').value = s.notes || '';
      const roundEl = document.getElementById('roundCounter'); if (roundEl) roundEl.textContent = s.round || '1';
      if (s.openAbilities) s.openAbilities.forEach(name => document.querySelectorAll('.ability').forEach(a => { if (a.querySelector('.ability-name').textContent === name) a.classList.add('open'); }));
    }
    function saveState(silent = false) {
      if (_msAplicando) return;
      try {
        const dados = getState();
        localStorage.setItem(storageKey, JSON.stringify(dados));
        window.VilaoAtividade?.registrar(storageKey.replace(/_ficha_v1$/, ''), _nomeFicha());
        if (window.MasterState) { _setSyncStatus('⟳ sincronizando…', 'var(--gold-dim)'); window.MasterState.salvarDebounced(msChave, dados, silent ? 600 : 0); setTimeout(() => _setSyncStatus('● sincronizado', 'var(--gold)'), silent ? 800 : 200); }
        if (!silent) showToast('✓ Salvo');
      } catch (e) { if (!silent) showToast('Erro ao salvar'); }
    }
    async function loadState() {
      try {
        let dados = null;
        if (window.MasterState) dados = await window.MasterState.carregar(msChave);
        if (!dados) { const local = localStorage.getItem(storageKey); if (local) dados = JSON.parse(local); }
        if (!dados) { showToast('Nada salvo'); return; }
        _msAplicando = true; applyState(dados); _msAplicando = false;
        _setSyncStatus(window.MasterState ? '● sincronizado' : '○ local', window.MasterState ? 'var(--gold)' : 'var(--gold-dim)');
        showToast('✓ Carregado');
      } catch (e) { _msAplicando = false; showToast('Erro ao carregar'); }
    }
    function resetAll() {
      if (!confirm('Resetar tudo? (HP, reações, condições, notas)')) return;
      localStorage.removeItem(storageKey);
      hpCurrent.value = HP_MAX; hpMax.value = HP_MAX;
      const caInp = document.querySelector('.ca-input'); if (caInp) caInp.value = CA_PADRAO;
      updateHPBar();
      document.querySelectorAll('.react-dot').forEach(d => d.classList.remove('used'));
      document.querySelectorAll('.condition-row .chip').forEach(c => c.classList.remove('active'));
      document.querySelectorAll('.ability.open').forEach(a => a.classList.remove('open'));
      document.getElementById('notesArea').value = '';
      const roundEl = document.getElementById('roundCounter'); if (roundEl) roundEl.textContent = 1;
      showToast('✓ Resetado');
    }
    function exportJSON() {
      const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `${downloadPrefix}_combate_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
      showToast('✓ Exportado');
    }
    function importJSON(evt) {
      const file = evt.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => { try { applyState(JSON.parse(e.target.result)); showToast('✓ Importado'); saveState(true); } catch (err) { showToast('Arquivo inválido'); } };
      reader.readAsText(file); evt.target.value = '';
    }
    let toastTimer;
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg; t.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
    }

    document.querySelector('.ca-input')?.addEventListener('input', () => saveState(true));
    document.getElementById('notesArea').addEventListener('input', () => { clearTimeout(window._notesTimer); window._notesTimer = setTimeout(() => saveState(true), 600); });
    document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveState(); } });

    updateHPBar();
    _ligarLogCondicoes();
    (async function bootstrap() {
      if (window.Auth) {
        const u = await window.Auth.requerLogin('../login.html'); if (!u) return;
        const ehMestre = await window.Auth.ehMestre();
        if (!ehMestre) { document.body.innerHTML = '<div style="padding:60px;text-align:center;color:var(--bone);font-family:Cinzel,serif"><h2>Acesso restrito ao Mestre.</h2><p style="margin-top:14px"><a href="../../index.html" style="color:var(--gold)">Voltar</a></p></div>'; return; }
      }
      await loadState();
      if (window.MasterState) window.MasterState.iniciarRealtime(msChave, dados => { if (!dados) return; _msAplicando = true; applyState(dados); _msAplicando = false; _setSyncStatus('● sincronizado', 'var(--gold)'); });
    })();

    window.adjustHP = adjustHP;
    window.resetHP = resetHP;
    window.setMedia = setMedia;
    window.toggleReact = toggleReact;
    window.resetReactions = resetReactions;
    window.adjustRound = adjustRound;
    window.resetRound = resetRound;
    window.toggleAbility = toggleAbility;
    window.saveState = saveState;
    window.loadState = loadState;
    window.resetAll = resetAll;
    window.exportJSON = exportJSON;
    window.importJSON = importJSON;
  }

  // Variante mais leve ainda (vilnius/zorya): só HP + condições + notas +
  // acordeão — sem CA, reações, rodada nem export/import. Mesmo motivo de
  // duplicar a parte de HP em vez de reusar iniciar()/iniciarSemFases(): a
  // forma do estado salvo é diferente o bastante (menos campos) pra um
  // "modo enxuto" condicional só confundir.
  function iniciarHpBasico(config) {
    const { storageKey, msChave, hpMax: HP_MAX, hpMedia: HP_MEDIA } = config;
    let _msAplicando = false;

    function _setSyncStatus(txt, cor) {
      const el = document.getElementById('syncStatus');
      if (el) { el.textContent = txt; el.style.color = cor || 'var(--gold-dim)'; }
    }

    const hpCurrent = document.getElementById('hpCurrent');
    const hpMax = document.getElementById('hpMax');
    const hpBar = document.getElementById('hpBar');
    const hpLabel = document.getElementById('hpLabel');
    function updateHPBar() {
      const cur = parseInt(hpCurrent.value) || 0, max = parseInt(hpMax.value) || 1;
      const pct = Math.max(0, Math.min(100, (cur / max) * 100));
      hpBar.style.width = pct + '%'; hpLabel.textContent = Math.round(pct) + '%';
      if (pct > 50) hpBar.style.background = 'linear-gradient(90deg, var(--blood-dark), var(--blood))';
      else if (pct > 25) hpBar.style.background = 'linear-gradient(90deg, #4a1014, #a82020)';
      else hpBar.style.background = 'linear-gradient(90deg, #3a0808, #6a0e0e)';
    }
    function adjustHP(delta) {
      const max = parseInt(hpMax.value) || 1; let cur = parseInt(hpCurrent.value) || 0; const antes = cur;
      cur = Math.max(0, Math.min(max, cur + delta)); hpCurrent.value = cur; updateHPBar();
      const mudou = cur - antes;
      if (window.FX && mudou !== 0) { const alvo = document.querySelector('.combat-bar .panel') || hpCurrent; if (mudou < 0) FX.dano(alvo, mudou); else FX.cura(alvo, mudou); if (FX.contarInput) FX.contarInput(hpCurrent, antes, cur); }
      if (mudou !== 0) window.LogCombate?.registrar(`${_nomeFicha()}: <strong>${mudou > 0 ? '+' : ''}${mudou} PV</strong> (${antes}→${cur})`);
      saveState(true);
    }
    function resetHP() { hpCurrent.value = hpMax.value; updateHPBar(); saveState(true); }
    function setMedia() { hpMax.value = HP_MEDIA; hpCurrent.value = HP_MEDIA; updateHPBar(); saveState(true); showToast(`✓ PV na média (${HP_MEDIA})`); }
    hpCurrent.addEventListener('input', () => { updateHPBar(); saveState(true); });
    hpMax.addEventListener('input', () => { updateHPBar(); saveState(true); });
    function toggleAbility(header) { header.parentElement.classList.toggle('open'); }

    function getState() {
      return {
        hpCurrent: hpCurrent.value, hpMax: hpMax.value,
        conditions: Array.from(document.querySelectorAll('.condition-row .chip')).map(c => c.classList.contains('active')),
        notes: document.getElementById('notesArea').value,
        openAbilities: Array.from(document.querySelectorAll('.ability.open')).map(a => a.querySelector('.ability-name').textContent)
      };
    }
    function applyState(s) {
      if (!s) return;
      hpCurrent.value = s.hpCurrent ?? HP_MAX; hpMax.value = s.hpMax ?? HP_MAX; updateHPBar();
      (s.conditions || []).forEach((u, i) => { const c = document.querySelectorAll('.condition-row .chip')[i]; if (c) c.classList.toggle('active', u); });
      document.getElementById('notesArea').value = s.notes || '';
      if (s.openAbilities) s.openAbilities.forEach(name => document.querySelectorAll('.ability').forEach(a => { if (a.querySelector('.ability-name').textContent === name) a.classList.add('open'); }));
    }
    function saveState(silent = false) {
      if (_msAplicando) return;
      try {
        const dados = getState();
        localStorage.setItem(storageKey, JSON.stringify(dados));
        window.VilaoAtividade?.registrar(storageKey.replace(/_ficha_v1$/, ''), _nomeFicha());
        if (window.MasterState) { _setSyncStatus('⟳ sincronizando…', 'var(--gold-dim)'); window.MasterState.salvarDebounced(msChave, dados, silent ? 600 : 0); setTimeout(() => _setSyncStatus('● sincronizado', 'var(--gold)'), silent ? 800 : 200); }
        if (!silent) showToast('✓ Salvo');
      } catch (e) { if (!silent) showToast('Erro ao salvar'); }
    }
    async function loadState() {
      try {
        let dados = null;
        if (window.MasterState) dados = await window.MasterState.carregar(msChave);
        if (!dados) { const local = localStorage.getItem(storageKey); if (local) dados = JSON.parse(local); }
        if (!dados) { showToast('Nada salvo'); return; }
        _msAplicando = true; applyState(dados); _msAplicando = false;
        _setSyncStatus(window.MasterState ? '● sincronizado' : '○ local', window.MasterState ? 'var(--gold)' : 'var(--gold-dim)');
        showToast('✓ Carregado');
      } catch (e) { _msAplicando = false; showToast('Erro ao carregar'); }
    }
    function resetAll() {
      if (!confirm('Resetar tudo? (HP, condições, notas)')) return;
      localStorage.removeItem(storageKey);
      hpCurrent.value = HP_MAX; hpMax.value = HP_MAX;
      updateHPBar();
      document.querySelectorAll('.condition-row .chip').forEach(c => c.classList.remove('active'));
      document.querySelectorAll('.ability.open').forEach(a => a.classList.remove('open'));
      document.getElementById('notesArea').value = '';
      showToast('✓ Resetado');
    }
    let toastTimer;
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg; t.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
    }

    document.getElementById('notesArea').addEventListener('input', () => { clearTimeout(window._notesTimer); window._notesTimer = setTimeout(() => saveState(true), 600); });
    document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveState(); } });

    updateHPBar();
    _ligarLogCondicoes();
    (async function bootstrap() {
      if (window.Auth) {
        const u = await window.Auth.requerLogin('../login.html'); if (!u) return;
        const ehMestre = await window.Auth.ehMestre();
        if (!ehMestre) { document.body.innerHTML = '<div style="padding:60px;text-align:center;color:var(--bone);font-family:Cinzel,serif"><h2>Acesso restrito ao Mestre.</h2><p style="margin-top:14px"><a href="../../index.html" style="color:var(--gold)">Voltar</a></p></div>'; return; }
      }
      await loadState();
      if (window.MasterState) window.MasterState.iniciarRealtime(msChave, dados => { if (!dados) return; _msAplicando = true; applyState(dados); _msAplicando = false; _setSyncStatus('● sincronizado', 'var(--gold)'); });
    })();

    window.adjustHP = adjustHP;
    window.resetHP = resetHP;
    window.setMedia = setMedia;
    window.toggleAbility = toggleAbility;
    window.saveState = saveState;
    window.loadState = loadState;
    window.resetAll = resetAll;
  }

  return { iniciar, iniciarSemFases, iniciarHpBasico };
})();

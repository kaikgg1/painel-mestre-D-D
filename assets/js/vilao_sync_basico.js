// assets/js/vilao_sync_basico.js
// Sincronismo genérico pras fichas de NPC "simples" (só notas + acordeão de
// habilidades, sem tracker de HP/combate) — donavich.html e doru.html tinham
// essa lógica colada, idêntica a não ser por STORAGE_KEY/MS_CHAVE/nome de
// exibição (mst-11).
//
// API: VilaoSyncBasico.iniciar({ storageKey, msChave, nomeExibicao })
//   - storageKey: chave do localStorage (fallback offline)
//   - msChave: chave do MasterState (assets/js/master_state.js), formato "vilao:<slug>"
//   - nomeExibicao: nome mostrado na confirmação de "Resetar" (ex.: "Doru")
//
// Expõe saveState/loadState/resetAll/toggleAbility como globais soltos
// (window.X) de propósito — o HTML chama via onclick="saveState()" etc.,
// então precisam existir nesse escopo pro atributo inline encontrar.
window.VilaoSyncBasico = (function () {
  function iniciar({ storageKey, msChave, nomeExibicao }) {
    let _msAplicando = false;

    function _setSyncStatus(txt, cor) {
      const el = document.getElementById('syncStatus');
      if (el) { el.textContent = txt; el.style.color = cor || 'var(--gold-dim)'; }
    }

    function toggleAbility(header) { header.parentElement.classList.toggle('open'); }

    function getState() {
      return {
        notes: document.getElementById('notesArea').value,
        openAbilities: Array.from(document.querySelectorAll('.ability.open')).map(a => a.querySelector('.ability-name').textContent)
      };
    }
    function applyState(s) {
      if (!s) return;
      document.getElementById('notesArea').value = s.notes || '';
      if (s.openAbilities) s.openAbilities.forEach(name => document.querySelectorAll('.ability').forEach(a => { if (a.querySelector('.ability-name').textContent === name) a.classList.add('open'); }));
    }
    function saveState(silent = false) {
      if (_msAplicando) return;
      try {
        const dados = getState();
        localStorage.setItem(storageKey, JSON.stringify(dados));
        window.VilaoAtividade?.registrar(storageKey.replace(/_ficha_v1$/, ''), nomeExibicao);
        if (window.MasterState) {
          _setSyncStatus('⟳ sincronizando…', 'var(--gold-dim)');
          window.MasterState.salvarDebounced(msChave, dados, silent ? 600 : 0);
          setTimeout(() => _setSyncStatus('● sincronizado', 'var(--gold)'), silent ? 800 : 200);
        }
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
      if (!confirm(`Limpar notas de ${nomeExibicao}?`)) return;
      localStorage.removeItem(storageKey);
      document.getElementById('notesArea').value = '';
      document.querySelectorAll('.ability.open').forEach(a => a.classList.remove('open'));
      showToast('✓ Resetado');
    }
    let toastTimer;
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
    }

    document.getElementById('notesArea').addEventListener('input', () => {
      clearTimeout(window._notesTimer);
      window._notesTimer = setTimeout(() => saveState(true), 600);
    });
    document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveState(); } });

    (async function bootstrap() {
      if (window.Auth) {
        const u = await window.Auth.requerLogin('../login.html'); if (!u) return;
        const ehMestre = await window.Auth.ehMestre();
        if (!ehMestre) { document.body.innerHTML = '<div style="padding:60px;text-align:center;color:var(--bone);font-family:Cinzel,serif"><h2>Acesso restrito ao Mestre.</h2><p style="margin-top:14px"><a href="../../index.html" style="color:var(--gold)">Voltar</a></p></div>'; return; }
      }
      await loadState();
      if (window.MasterState) window.MasterState.iniciarRealtime(msChave, dados => { if (!dados) return; _msAplicando = true; applyState(dados); _msAplicando = false; _setSyncStatus('● sincronizado', 'var(--gold)'); });
    })();

    window.toggleAbility = toggleAbility;
    window.saveState = saveState;
    window.loadState = loadState;
    window.resetAll = resetAll;
  }

  return { iniciar };
})();

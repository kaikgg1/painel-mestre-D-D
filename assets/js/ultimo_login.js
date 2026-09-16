// assets/js/ultimo_login.js
// Modal "👥 Contas" — último login de cada conta. O Supabase Auth já
// registra isso sozinho (auth.users.last_sign_in_at); a function
// public.listar_ultimo_login() (sql/026_ultimo_login.sql) expõe só o
// necessário via RPC, e só devolve linhas pro Mestre.
//
// Uso: window.UltimoLogin.abrir()
// Depende de: window.sb.

(function () {
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmtData(iso) {
    if (!iso) return 'nunca logou';
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  // "há 3h", "há 2 dias" etc. — mais fácil de escanear numa lista curta
  // que só datas absolutas; a data completa continua no title (hover).
  function fmtRelativo(iso) {
    if (!iso) return '';
    const diffMs = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    return `há ${d} dia${d > 1 ? 's' : ''}`;
  }

  async function abrir() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="Último login de cada conta" style="padding:22px;max-width:480px">
        <h3 style="margin:0 0 4px;color:var(--gold-light,var(--gold));font-family:'Cinzel',serif;font-size:18px">👥 Último login de cada conta</h3>
        <p style="margin:0 0 14px;color:var(--text-muted,#9e947c);font-size:12.5px;font-style:italic">Registrado automaticamente a cada entrada — não precisa fazer nada.</p>
        <div id="ul-lista" style="display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow-y:auto">Carregando…</div>
        <div style="display:flex;justify-content:flex-end;margin-top:16px">
          <button type="button" class="btn" id="ul-fechar">Fechar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const fechar = () => { overlay.remove(); document.removeEventListener('keydown', onEsc); };
    function onEsc(e) { if (e.key === 'Escape') fechar(); }
    overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });
    document.addEventListener('keydown', onEsc);
    overlay.querySelector('#ul-fechar').addEventListener('click', fechar);
    overlay.querySelector('#ul-fechar').focus();

    const lista = overlay.querySelector('#ul-lista');
    if (!window.sb) { lista.textContent = 'Erro: cliente Supabase não carregado.'; return; }

    const { data, error } = await window.sb.rpc('listar_ultimo_login');
    if (error) { lista.textContent = 'Erro ao carregar: ' + error.message; return; }
    if (!data || !data.length) {
      lista.textContent = 'Nenhuma conta encontrada (ou esta conta não é o Mestre).';
      return;
    }
    lista.innerHTML = data.map(c => `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;background:var(--surface,#1c1a14);border:1px solid var(--border-soft,#3d3420);border-radius:6px">
        <strong style="color:var(--text,#e5d8b9);font-family:'Cinzel',serif;font-size:13px">${escapeHtml(c.nome)}</strong>
        <span style="color:var(--text-muted,#9e947c);font-size:12.5px;text-align:right" title="${escapeHtml(fmtData(c.ultimo_login))}">
          ${escapeHtml(fmtRelativo(c.ultimo_login) || fmtData(c.ultimo_login))}
        </span>
      </div>`).join('');
  }

  window.UltimoLogin = { abrir };
})();

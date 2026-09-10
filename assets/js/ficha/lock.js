// assets/js/ficha/lock.js
// Modo leitura × edição. body.modo-unlock (persistido em localStorage
// "ficha_unlock") libera os campos; travado é o padrão. Também tira os campos
// travados da ordem de tabulação (a11y). O CSS mora em assets/css/ficha/sistema.css.

function aplicarBloqueioRoleplay(bloqueado) {
  const blocos = document.querySelectorAll('[data-rp-lock]');
  blocos.forEach(b => {
    b.classList.toggle('rp-locked', bloqueado);
    b.querySelectorAll('input, textarea').forEach(el => {
      if (bloqueado) el.setAttribute('readonly', '');
      else el.removeAttribute('readonly');
    });
  });
  const btn = document.getElementById('btn-rp-toggle');
  const lbl = document.getElementById('btn-rp-label');
  const hint = document.getElementById('rp-lock-hint');
  if (btn) btn.setAttribute('aria-pressed', String(!bloqueado));
  if (lbl) lbl.textContent = bloqueado ? 'Editar' : 'Salvar e travar';
  if (btn) btn.classList.toggle('editando', !bloqueado);
  if (hint) hint.style.display = bloqueado ? '' : 'none';
}

// Lock genérico para qualquer bloco [data-X-lock]
function aplicarBloqueioGenerico(blocos, btnId, lblId, hintId, bloqueado) {
  blocos.forEach(b => {
    b.classList.toggle('rp-locked', bloqueado);
    b.querySelectorAll('input, textarea').forEach(el => {
      if (bloqueado) el.setAttribute('readonly', '');
      else el.removeAttribute('readonly');
    });
  });
  const btn = document.getElementById(btnId);
  const lbl = document.getElementById(lblId);
  const hint = document.getElementById(hintId);
  if (btn) btn.setAttribute('aria-pressed', String(!bloqueado));
  if (lbl) lbl.textContent = bloqueado ? 'Editar' : 'Salvar e travar';
  if (btn) btn.classList.toggle('editando', !bloqueado);
  if (hint) hint.style.display = bloqueado ? '' : 'none';
}

function aplicarEstadoLock() {
  let unlock = false;
  try { unlock = localStorage.getItem('ficha_unlock') === '1'; } catch {}
  document.body.classList.toggle('modo-unlock', unlock);
  atualizarLockLabel();
  aplicarTabIndexLock();
}

// Remove inputs travados do tab order (a11y) e adiciona aria-disabled.
function aplicarTabIndexLock() {
  const unlock = document.body.classList.contains('modo-unlock');
  document.querySelectorAll('.tab-content').forEach(zona => {
    const elementos = zona.querySelectorAll('input:not([type="hidden"]), select, textarea, [contenteditable="true"]');
    elementos.forEach(el => {
      // Não mexe nos elementos marcados como no-lock (toggles internos)
      if (el.closest('.no-lock')) return;
      if (unlock) {
        if (el.dataset.lockTabidxOrig !== undefined) {
          if (el.dataset.lockTabidxOrig === '') el.removeAttribute('tabindex');
          else el.setAttribute('tabindex', el.dataset.lockTabidxOrig);
          delete el.dataset.lockTabidxOrig;
        } else {
          el.removeAttribute('tabindex');
        }
        el.removeAttribute('aria-disabled');
      } else {
        if (el.dataset.lockTabidxOrig === undefined) {
          el.dataset.lockTabidxOrig = el.getAttribute('tabindex') ?? '';
        }
        el.setAttribute('tabindex', '-1');
        el.setAttribute('aria-disabled', 'true');
      }
    });
  });
}
function atualizarLockLabel() {
  const lbl = document.getElementById('lock-toggle-label');
  const btn = document.getElementById('btn-lock-toggle');
  if (!lbl || !btn) return;
  const unlock = document.body.classList.contains('modo-unlock');
  lbl.innerHTML = unlock ? ico('cadeado_aberto') + ' Travar' : ico('cadeado') + ' Editar';
  btn.setAttribute('aria-pressed', String(unlock));
  btn.title = unlock ? 'Travar a ficha (modo somente leitura)' : 'Liberar edição da ficha';
}


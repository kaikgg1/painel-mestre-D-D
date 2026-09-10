// assets/js/ficha/lock.js
// Modo leitura × edição. body.modo-unlock (persistido em localStorage
// "ficha_unlock", lido via estaDesbloqueado() em nucleo.js) libera os campos;
// travado é o padrão. Também tira os campos travados da ordem de tabulação
// (a11y). O CSS mora em assets/css/ficha/sistema.css.
//
// (aplicarBloqueioRoleplay/aplicarBloqueioGenerico existiam aqui — um
// mecanismo de trava POR AtBA que nunca chegou a ser usado por nenhum
// render(), superado por este lock GLOBAL. Removidos na Fase 9 ao mexer
// neste arquivo; nada no projeto os referenciava.)

function aplicarEstadoLock() {
  document.body.classList.toggle('modo-unlock', estaDesbloqueado());
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

// assets/js/ficha/aba_magias.js
// Aba Magias: lista as magias favoritadas no Grimório (spell_lists), com
// accordion de detalhes e o modal de Conjurar (escolha do espaço a gastar).

function renderMagias(c) {
  // Aba que carrega assincronamente (cards das favoritas)
  return `
    <h3>Magias Preparadas</h3>
    <p style="color:var(--text-dim);font-style:italic;margin-bottom:14px">
      Aparecem aqui as magias marcadas como favoritas no <a href="magias.html" style="color:var(--gold-bright)">Grimório</a>.
    </p>
    <div id="magias-prep">Carregando…</div>
  `;
}

async function carregarMagiasPreparadas() {
  const wrap = document.getElementById('magias-prep');
  if (!wrap) return;
  const favSet = await carregarFavoritasDoBanco();
  if (!favSet.size) {
    wrap.innerHTML = `<div class="item-vazio">Nenhuma magia favoritada. Abra o <a href="magias.html" style="color:var(--gold-bright)">Grimório</a> e clique na estrela ☆ das magias que seu personagem prepara.</div>`;
    return;
  }
  const todas = await carregarMagiasCache();
  const lista = todas.filter(m => favSet.has(m.nome))
    .sort((a,b) => a.nivel - b.nivel || a.nome.localeCompare(b.nome, 'pt'));
  if (!lista.length) { wrap.innerHTML = `<div class="item-vazio">Nenhuma magia encontrada.</div>`; return; }

  wrap.innerHTML = `<div class="magias-lista">${lista.map((m, i) => {
    const nv = m.nivel === 0 ? 'Truque' : `${m.nivel}°`;
    const tags = [m.ritual?'<span>Ritual</span>':'', m.concentracao?'<span>Conc.</span>':''].filter(Boolean).join('');
    const descHtml = (m.descricao || '').split(/\n\n+/).map(p => `<p>${escape(p.trim())}</p>`).join('');
    const comps = (m.componentes || '') + (m.material ? ` (${escape(m.material)})` : '');
    return `<div class="magia-item" data-idx="${i}">
      <div class="magia-row" role="button" tabindex="0" aria-expanded="false">
        <span class="magia-nivel">${nv}</span>
        <span class="magia-nome">${escape(m.nome)}</span>
        <span class="magia-escola">${escape(m.escola)}</span>
        <span class="magia-tags">${tags}</span>
        <span class="magia-chevron" aria-hidden="true">▸</span>
      </div>
      <div class="magia-detalhe">
        <div class="magia-info">
          <div class="magia-info-item"><div class="magia-info-key">Tempo</div><div class="magia-info-val">${escape(m.tempoCast || '—')}</div></div>
          <div class="magia-info-item"><div class="magia-info-key">Alcance</div><div class="magia-info-val">${escape(m.alcance || '—')}</div></div>
          <div class="magia-info-item"><div class="magia-info-key">Componentes</div><div class="magia-info-val">${comps || '—'}</div></div>
          <div class="magia-info-item"><div class="magia-info-key">Duração</div><div class="magia-info-val">${escape(m.duracao || '—')}</div></div>
        </div>
        <div class="magia-desc">${descHtml || '<p>—</p>'}</div>
        ${m.maiorNivel ? `<div class="magia-maior"><strong>Em Níveis Superiores.</strong> ${escape(m.maiorNivel)}</div>` : ''}
        ${m.nivel > 0 ? `<div class="magia-conjurar-bar">
          <button type="button" class="btn-conjurar" data-conjurar-nv="${m.nivel}" data-conjurar-nome="${escape(m.nome)}">
            ${ico('conjurar')} Conjurar
          </button>
        </div>` : `<div class="magia-conjurar-bar"><span class="magia-truque-info">Truque — sem custo de slot</span></div>`}
      </div>
    </div>`;
  }).join('')}</div>`;

  // Toggle expand
  wrap.querySelectorAll('.magia-row').forEach(row => {
    const acao = () => {
      const item = row.closest('.magia-item');
      const aberto = item.classList.toggle('aberta');
      row.setAttribute('aria-expanded', aberto);
    };
    row.addEventListener('click', acao);
    row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); acao(); } });
  });

  // Botão Conjurar → abre modal de escolha de slot
  wrap.querySelectorAll('.btn-conjurar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nv = +btn.dataset.conjurarNv;
      const nome = btn.dataset.conjurarNome;
      abrirModalConjurar(nome, nv);
    });
  });
}

// ─── Modal de Conjurar (escolha de slot) ─────────────────────────
function abrirModalConjurar(nomeMagia, nivelMin) {
  const c = charAtivo;
  const slotsClasse = (window.SlotsPHB && c.classe) ? window.SlotsPHB.porClasse(c.classe, c.nivel || 1, c.subclasse) : null;
  if (!slotsClasse) {
    alert('Sua classe/subclasse não tem espaços de magia.');
    return;
  }
  const slotsAtuais = c.slots_magia || {};
  // Lista níveis ≥ nivelMin com slots disponíveis
  const opcoes = [];
  for (let n = nivelMin; n <= 9; n++) {
    const max = slotsClasse[n] || 0;
    const usados = (slotsAtuais[n]?.atual) || 0;
    const disp = Math.max(0, max - usados);
    if (max > 0) opcoes.push({ nv: n, disp, max });
  }
  if (!opcoes.length) {
    alert(`Sem espaços de nível ${nivelMin} ou superior nesta classe.`);
    return;
  }

  // Cria overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
      <h3 id="modal-titulo">${ico('conjurar')} Conjurar <em>${escape(nomeMagia)}</em></h3>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:14px">
        Magia de <strong>${nivelMin}° nível</strong>. Escolha em qual espaço gastar:
      </p>
      <div class="modal-slots">
        ${opcoes.map(o => `
          <button type="button" class="modal-slot-btn" ${o.disp <= 0 ? 'disabled' : ''} data-nv="${o.nv}">
            <div class="modal-slot-nv">Nível ${o.nv}</div>
            <div class="modal-slot-disp">${o.disp} / ${o.max}</div>
            <div class="modal-slot-lbl">${o.disp <= 0 ? 'esgotado' : (o.nv > nivelMin ? 'upcast' : 'disponível')}</div>
          </button>
        `).join('')}
      </div>
      <div class="modal-acoes">
        <button type="button" class="btn" id="modal-cancelar">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const fechar = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });
  overlay.querySelector('#modal-cancelar').addEventListener('click', fechar);

  overlay.querySelectorAll('.modal-slot-btn').forEach(btn => {
    if (btn.disabled) return;
    btn.addEventListener('click', async () => {
      const nv = +btn.dataset.nv;
      const slots = c.slots_magia || {};
      const max = slotsClasse[nv] || 0;
      const atual = (slots[nv]?.atual) || 0;
      slots[nv] = { atual: Math.min(max, atual + 1), max };
      c.slots_magia = slots;
      fechar();
      // Salva direto (não passa pelo form, evita conflito de tabs)
      try {
        _ultimoSaveLocal = Date.now();
        await window.sb.from('characters').update({ slots_magia: slots }).eq('id', c.id);
        mostrarToastConjurar(nomeMagia, nv);
      } catch (e) {
        alert('Erro ao gastar slot: ' + e.message);
      }
    });
  });

  // ESC fecha
  const onKey = (e) => { if (e.key === 'Escape') { fechar(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
}

function mostrarToastConjurar(nome, nv) {
  const t = document.createElement('div');
  t.className = 'toast-conjurar';
  t.innerHTML = `${ico('brilho')} <strong>${escape(nome)}</strong> conjurada · slot de nível ${nv} gasto`;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2500);
}


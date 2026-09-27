// assets/js/feiticeiro_ui.js
// Bloco "Fonte de Magia + Metamágica" do Feiticeiro — o mesmo nos painéis
// do Mestre e na ficha do jogador. Regras e catálogo em recursos_classe.js
// (criarSlotComPontos, quebrarSlotEmPontos, METAMAGIAS); este arquivo só
// desenha e chama os callbacks de gravação de quem o usa.
//
// API:
//   FeiticeiroUI.bloco({
//     nivel,
//     getRec(), getSlots(), getMetamagias(),   // objetos vivos (mutáveis)
//     salvarRecursos(patch),                    // patch de recursos_usados
//     salvarSlots(),                            // grava slots_magia inteiro
//     salvarMetamagias(arr),
//     atualizar(),                              // re-render de quem chamou
//     avisar(msg),
//   }) -> HTMLElement
// Dependências: window.RecursosClasse.

(function () {
  const RC = () => window.RecursosClasse;
  let _css = false;

  const CSS = `
  .ftc { margin-top: 10px; }
  .ftc-linha { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: space-between; }
  .ftc-titulo { font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #b88a2c; margin: 10px 0 6px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .ftc-pontos { font-family: 'Cinzel', serif; font-size: 13px; color: #d4c5a0; }
  .ftc-pontos strong { color: #f4d878; font-size: 15px; }
  .ftc-btn {
    background: linear-gradient(180deg, rgba(139,105,20,0.35), rgba(80,60,12,0.5));
    border: 1px solid #8B6914; color: #f4d878; border-radius: 5px; cursor: pointer;
    font-family: 'Cinzel', serif; font-size: 11px; font-weight: 700; letter-spacing: 1px;
    padding: 6px 10px; min-height: 36px; min-width: 44px; text-transform: uppercase;
  }
  .ftc-btn:hover:not(:disabled) { background: linear-gradient(180deg, #b88a2c, #8B6914); color: #1a1014; }
  .ftc-btn:disabled { opacity: .4; cursor: not-allowed; }
  .ftc-btn-sec { background: transparent; border-color: #6b1010; color: #d4c5a0; }
  .ftc-mm { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid rgba(139,105,20,0.12); }
  .ftc-mm-nome { flex: 1; font-size: 14px; color: #d4c5a0; cursor: help; }
  .ftc-mm-desc { display: block; font-size: 11px; font-style: italic; color: #8c7d5e; line-height: 1.3; }
  .ftc-custo { font-family: 'Cinzel', serif; font-size: 11px; color: #b88a2c; border: 1px solid rgba(139,105,20,.5); border-radius: 999px; padding: 1px 7px; white-space: nowrap; }
  .ftc-vazio { font-size: 12px; font-style: italic; color: #8c7d5e; padding: 4px 0; }
  .ftc-sel { background: #1a1014; color: #d4c5a0; border: 1px solid #6b1010; border-radius: 4px; min-height: 36px; }
  .ftc-ov { position: fixed; inset: 0; z-index: 8600; background: rgba(0,0,0,.82); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .ftc-modal { background: linear-gradient(160deg,#1f1416,#160c10); border: 2px solid #8B6914; border-radius: 10px; max-width: 480px; width: 100%; max-height: 90vh; max-height: 90dvh; overflow-y: auto; padding: 16px 18px; color: #d4c5a0; font-family: 'EB Garamond', Georgia, serif; }
  .ftc-modal h3 { font-family: 'Cinzel Decorative', serif; color: #b88a2c; margin: 0 0 4px; font-size: 17px; }
  .ftc-sub { font-size: 13px; margin-bottom: 10px; }
  .ftc-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; margin-bottom: 12px; }
  .ftc-grade .ftc-btn { display: flex; flex-direction: column; gap: 2px; text-transform: none; }
  .ftc-check { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid rgba(139,105,20,.12); cursor: pointer; }
  .ftc-check input { width: 20px; height: 20px; margin-top: 2px; accent-color: #b88a2c; }
  .ftc-rodape { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 12px; }
  @media (max-width: 600px) { .ftc-ov { padding: 0; } .ftc-modal { max-height: 100dvh; height: 100%; border-radius: 0; } }
  `;

  function injetarCss() {
    if (_css) return;
    _css = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function abrirModal(montarCorpo) {
    const ov = el('div', 'ftc-ov');
    const modal = el('div', 'ftc-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    ov.appendChild(modal);
    const fechar = () => { ov.remove(); document.removeEventListener('keydown', esc); };
    const esc = e => { if (e.key === 'Escape') fechar(); };
    ov.addEventListener('click', e => { if (e.target === ov) fechar(); });
    document.addEventListener('keydown', esc);
    montarCorpo(modal, fechar);
    document.body.appendChild(ov);
    return fechar;
  }

  function custoTexto(m) { return m.custo === 'nivel' ? 'nível da magia' : `${m.custo} pt`; }

  function bloco(o) {
    injetarCss();
    const nv = +o.nivel || 1;
    const wrap = el('div', 'ftc');
    if (nv < 2 || !RC()) return wrap;

    const maxPontos = nv;
    const livres = () => Math.max(0, maxPontos - RC().lerUsado(o.getRec(), 'pontos_feiticaria'));

    // ── Fonte de Magia: conversor ──
    const tFonte = el('div', 'ftc-titulo');
    tFonte.appendChild(el('span', null, 'Fonte de Magia'));
    const pontos = el('span', 'ftc-pontos');
    pontos.innerHTML = `<strong>${livres()}</strong>/${maxPontos} pts`;
    tFonte.appendChild(pontos);
    wrap.appendChild(tFonte);

    const linhaConv = el('div', 'ftc-linha');
    const btnConv = el('button', 'ftc-btn', '⇄ Converter pontos/espaços');
    btnConv.type = 'button';
    btnConv.onclick = () => abrirConversor(o, maxPontos);
    linhaConv.appendChild(btnConv);
    wrap.appendChild(linhaConv);

    // ── Metamágica ──
    const permitidas = RC().metamagiasPermitidas(nv);
    if (permitidas > 0) {
      const escolhidas = (o.getMetamagias() || []).filter(id => RC().METAMAGIAS.some(m => m.id === id));
      const tMeta = el('div', 'ftc-titulo');
      tMeta.appendChild(el('span', null, `Metamágica (${escolhidas.length}/${permitidas})`));
      const btnEsc = el('button', 'ftc-btn ftc-btn-sec', 'Escolher');
      btnEsc.type = 'button';
      btnEsc.onclick = () => abrirEscolha(o, permitidas);
      tMeta.appendChild(btnEsc);
      wrap.appendChild(tMeta);

      if (!escolhidas.length) {
        wrap.appendChild(el('div', 'ftc-vazio', 'Nenhuma opção escolhida ainda — toque em "Escolher".'));
      }
      escolhidas.forEach(id => {
        const m = RC().METAMAGIAS.find(x => x.id === id);
        const row = el('div', 'ftc-mm');
        const nome = el('span', 'ftc-mm-nome', m.nome);
        nome.title = m.desc;
        nome.appendChild(el('span', 'ftc-mm-desc', m.desc));
        row.appendChild(nome);
        row.appendChild(el('span', 'ftc-custo', custoTexto(m)));

        let selNivel = null;
        if (m.custo === 'nivel') {
          selNivel = el('select', 'ftc-sel');
          selNivel.setAttribute('aria-label', 'Nível da magia');
          for (let n = 0; n <= 9; n++) {
            const op = el('option', null, n === 0 ? 'Truque' : `${n}°`);
            op.value = String(n);
            selNivel.appendChild(op);
          }
          row.appendChild(selNivel);
        }
        const custoAgora = () => m.custo === 'nivel' ? Math.max(1, +(selNivel?.value) || 0) : m.custo;
        const btnUsar = el('button', 'ftc-btn', 'Usar');
        btnUsar.type = 'button';
        const atualizarBtn = () => { btnUsar.disabled = livres() < custoAgora(); };
        if (selNivel) selNivel.onchange = atualizarBtn;
        atualizarBtn();
        btnUsar.onclick = () => {
          const custo = custoAgora();
          if (livres() < custo) { o.avisar?.('Pontos de feitiçaria insuficientes'); return; }
          const rec = o.getRec();
          RC().gravarUsado(rec, 'pontos_feiticaria', RC().lerUsado(rec, 'pontos_feiticaria') + custo);
          o.salvarRecursos({ pontos_feiticaria: rec.pontos_feiticaria });
          o.avisar?.(`${m.nome}: −${custo} pt`);
          o.atualizar();
        };
        row.appendChild(btnUsar);
        wrap.appendChild(row);
      });
    }
    return wrap;
  }

  function abrirConversor(o, maxPontos) {
    abrirModal((modal, fechar) => {
      const rec = o.getRec();
      const slots = o.getSlots();
      const usados = RC().lerUsado(rec, 'pontos_feiticaria');
      const livres = Math.max(0, maxPontos - usados);
      modal.appendChild(el('h3', null, '⇄ Fonte de Magia'));
      const sub = el('div', 'ftc-sub');
      sub.innerHTML = `Pontos de Feitiçaria: <strong>${livres}</strong> / ${maxPontos}`;
      modal.appendChild(sub);

      const aplicar = (erro, msg) => {
        if (erro) { o.avisar?.(erro); return; }
        o.salvarRecursos({ pontos_feiticaria: rec.pontos_feiticaria, slots_extras: rec.slots_extras || {} });
        o.salvarSlots();
        o.avisar?.(msg);
        fechar();
        o.atualizar();
      };

      modal.appendChild(el('div', 'ftc-titulo', 'Criar espaço (gasta pontos)'));
      const g1 = el('div', 'ftc-grade');
      for (let lvl = 1; lvl <= 5; lvl++) {
        const custo = RC().CUSTO_SLOT_DE_PONTOS[lvl];
        const b = el('button', 'ftc-btn');
        b.type = 'button';
        b.innerHTML = `<span>Espaço ${lvl}°</span><span>${custo} pt</span>`;
        b.disabled = livres < custo;
        b.onclick = () => aplicar(RC().criarSlotComPontos(slots, rec, lvl, maxPontos), `Espaço de ${lvl}° criado (−${custo} pt)`);
        g1.appendChild(b);
      }
      modal.appendChild(g1);

      modal.appendChild(el('div', 'ftc-titulo', 'Quebrar espaço em pontos'));
      const g2 = el('div', 'ftc-grade');
      let algum = false;
      for (let lvl = 1; lvl <= 9; lvl++) {
        const s = slots[lvl];
        const livresSlot = s ? (+s.max || 0) - (+s.atual || 0) : 0;
        if (livresSlot <= 0) continue;
        algum = true;
        const b = el('button', 'ftc-btn');
        b.type = 'button';
        b.innerHTML = `<span>Espaço ${lvl}° (${livresSlot})</span><span>→ ${lvl} pt</span>`;
        b.disabled = usados <= 0;
        b.onclick = () => aplicar(RC().quebrarSlotEmPontos(slots, rec, lvl), `Espaço de ${lvl}° → +${Math.min(lvl, usados)} pt`);
        g2.appendChild(b);
      }
      if (!algum) g2.appendChild(el('div', 'ftc-vazio', 'Nenhum espaço livre para converter.'));
      modal.appendChild(g2);

      const rod = el('div', 'ftc-rodape');
      rod.appendChild(el('span', 'ftc-mm-desc', 'Custos: 1°=2 · 2°=3 · 3°=5 · 4°=6 · 5°=7. Espaço criado além do máximo some no descanso longo.'));
      const bF = el('button', 'ftc-btn ftc-btn-sec', 'Fechar');
      bF.type = 'button';
      bF.onclick = fechar;
      rod.appendChild(bF);
      modal.appendChild(rod);
    });
  }

  function abrirEscolha(o, permitidas) {
    abrirModal((modal, fechar) => {
      const marcadas = new Set(o.getMetamagias() || []);
      modal.appendChild(el('h3', null, 'Metamágica'));
      const sub = el('div', 'ftc-sub');
      modal.appendChild(sub);
      const contar = () => { sub.textContent = `Escolha até ${permitidas} opções (${[...marcadas].length} marcadas).`; };
      contar();
      const caixas = [];
      RC().METAMAGIAS.forEach(m => {
        const lab = el('label', 'ftc-check');
        const cb = el('input');
        cb.type = 'checkbox';
        cb.checked = marcadas.has(m.id);
        cb.onchange = () => {
          if (cb.checked) marcadas.add(m.id); else marcadas.delete(m.id);
          caixas.forEach(c => { c.disabled = !c.checked && marcadas.size >= permitidas; });
          contar();
        };
        caixas.push(cb);
        lab.appendChild(cb);
        const txt = el('span');
        txt.appendChild(el('strong', null, `${m.nome} `));
        txt.appendChild(el('span', 'ftc-custo', custoTexto(m)));
        txt.appendChild(el('span', 'ftc-mm-desc', m.desc));
        lab.appendChild(txt);
        modal.appendChild(lab);
      });
      caixas.forEach(c => { c.disabled = !c.checked && marcadas.size >= permitidas; });

      const rod = el('div', 'ftc-rodape');
      const bC = el('button', 'ftc-btn ftc-btn-sec', 'Cancelar');
      bC.type = 'button';
      bC.onclick = fechar;
      const bS = el('button', 'ftc-btn', 'Salvar');
      bS.type = 'button';
      bS.onclick = () => {
        const ordem = RC().METAMAGIAS.map(m => m.id).filter(id => marcadas.has(id));
        o.salvarMetamagias(ordem);
        fechar();
        o.atualizar();
      };
      rod.appendChild(bC);
      rod.appendChild(bS);
      modal.appendChild(rod);
    });
  }

  window.FeiticeiroUI = { bloco };
})();

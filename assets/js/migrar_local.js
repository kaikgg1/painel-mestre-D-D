// assets/js/migrar_local.js
// Migra personagens do localStorage para o banco. Apenas Mestre pode usar
// (porque atribui ownership a outros jogadores via RLS).
//
// Uso:
//   await MigrarLocal.detectar(storageKey)    → quantos PJs há no localStorage
//   await MigrarLocal.executar({storageKey, campanha})  → cria no banco e limpa local
//
// Mapeia o campo "jogador" do localStorage para user_id via profiles.

(function () {
  // Heurísticas: nome do jogador → username (procura no profiles)
  function normalizar(s) {
    return (s || '').toString().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function lerLocal(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const dados = JSON.parse(raw);
      if (!dados || !Array.isArray(dados.personagens)) return null;
      return dados;
    } catch { return null; }
  }

  async function detectar(storageKey) {
    const d = lerLocal(storageKey);
    return d ? d.personagens.length : 0;
  }

  function ehJogadorPadrao(nome) {
    return /^(jogador\s*\d|nome do jogador|personagem)$/i.test((nome || '').trim());
  }

  // Procura user_id pelo nome do jogador, com fallback no usuário atual
  function encontrarUserId(jogador, profilesPorNome, fallbackId) {
    if (!jogador || ehJogadorPadrao(jogador)) return fallbackId;
    const alvo = normalizar(jogador);

    // Match direto
    for (const [nome, id] of profilesPorNome) {
      if (normalizar(nome) === alvo) return id;
    }
    // Match parcial: "Sabrina" deve casar com "Sabrina123"
    for (const [nome, id] of profilesPorNome) {
      const n = normalizar(nome);
      if (n.startsWith(alvo) || alvo.startsWith(n.replace(/\d+$/, ''))) return id;
    }
    return fallbackId;
  }

  // Mapeia formato UI → colunas do DB (mesmo mapping de dbsync.js)
  function uiToDb(p) {
    return {
      nome: p.nome || 'Personagem',
      raca: p.raca || null,
      classe: p.classe || null,
      nivel: p.nivel ?? 1,
      hp_atual: p.hpAtual ?? 0,
      hp_max: p.hpMax ?? 0,
      ca: p.ca ?? 10,
      inspiracao: !!p.inspiracao,
      exaustao: p.exaustao ?? 0,
      morte_sucessos: p.sucessos ?? 0,
      morte_falhas: p.falhas ?? 0,
      slots_magia: p.slots || {},
      magias_preparadas: p.magias || '',
      condicoes: p.condicoes || [],
    };
  }

  async function executar({ storageKey, campanha }) {
    const ehMestre = await window.Auth.ehMestre();
    if (!ehMestre) {
      alert('Apenas o Mestre pode migrar dados (atribui ownership aos jogadores).');
      return { migrados: 0 };
    }

    const dados = lerLocal(storageKey);
    if (!dados || !dados.personagens.length) {
      alert('Nenhum personagem encontrado no navegador.');
      return { migrados: 0 };
    }

    const mestre = await window.Auth.getUser();

    // Carrega profiles pra mapear jogador → user_id
    const { data: profiles, error: errP } = await window.sb.from('profiles').select('id, nome');
    if (errP) { alert('Erro ao carregar profiles: ' + errP.message); return { migrados: 0 }; }
    const mapaProfiles = new Map((profiles || []).map(p => [p.nome, p.id]));

    let migrados = 0, erros = 0;
    for (const p of dados.personagens) {
      const userId = encontrarUserId(p.jogador, mapaProfiles, mestre.id);
      const payload = { ...uiToDb(p), user_id: userId, campanha };
      const { error } = await window.sb.from('characters').insert(payload);
      if (error) {
        console.warn('[migrar] falha em', p.nome, error.message);
        erros++;
      } else {
        migrados++;
      }
    }

    if (migrados) {
      const limpar = confirm(`${migrados} migrado(s)${erros ? ', ' + erros + ' erro(s)' : ''}.\n\nLimpar dados antigos do navegador (recomendado)?`);
      if (limpar) localStorage.removeItem(storageKey);
    } else {
      alert('Nenhum personagem migrado. Veja o console pra detalhes.');
    }

    return { migrados, erros };
  }

  window.MigrarLocal = { detectar, executar };
})();

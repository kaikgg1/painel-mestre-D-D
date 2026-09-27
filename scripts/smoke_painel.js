// scripts/smoke_painel.js  —  roda junto com `npm run smoke`
//
// Rede de segurança dos helpers compartilhados dos painéis do Mestre
// (assets/js/painel_mestre_base.js): carrega os módulos num jsdom com a
// mesma ordem dos painéis e confere a seção "Habilidades" do card e o
// filtro de recursos duplicados. Os painéis inteiros (DBSync, realtime)
// não são montados aqui.
const fs = require('fs');
const path = require('path');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch { console.error('jsdom nao instalado. Rode: npm install'); process.exit(1); }

const raiz = process.argv[2] || path.join(__dirname, '..');
const dom = new JSDOM('<!doctype html><body><div id="toast"></div></body>', {
  runScripts: 'dangerously', url: 'http://localhost/paineis/painel_barovia_dnd5e.html',
});
const { window } = dom;
window.fetch = async (url) => {
  const arq = path.join(raiz, 'data', path.basename(String(url)));
  const txt = fs.readFileSync(arq, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(txt) };
};

for (const m of ['icones.js', 'regras_base.js', 'recursos_classe.js', 'feiticeiro_ui.js', 'habilidades_regras.js', 'progressao_classes.js', 'painel_mestre_base.js']) {
  const sc = window.document.createElement('script');
  sc.textContent = fs.readFileSync(path.join(raiz, 'assets/js', m), 'utf8');
  window.document.head.appendChild(sc);
}

const erros = [];
const esperar = async (cond) => { for (let i = 0; i < 100 && !cond(); i++) await new Promise(r => setTimeout(r, 10)); };

(async () => {
  if (typeof window.montarSecaoHabilidades !== 'function') erros.push('montarSecaoHabilidades ausente');

  // Clérigo 9, Domínio da Morte: habilidades até o 9° da classe e da subclasse,
  // sem nada acima do nível, mais o talento criado pelo jogador.
  const p = {
    classe: 'Clérigo', nivel: 9, _subclasse: 'Domínio da Morte',
    _featuresPersonalizadas: [{ nome: 'Atacante Selvagem', desc: 'Talento de teste', talento: true }, { nome: '' }],
  };
  const sec = window.montarSecaoHabilidades(p);
  window.document.body.appendChild(sec);
  await esperar(() => !/Carregando/.test(sec.textContent));
  const nomes = [...sec.querySelectorAll('.hab-mestre-item > summary')].map(s => s.firstChild.textContent);
  const niveis = [...sec.querySelectorAll('.hab-mestre-nivel')].map(h => h.textContent);
  for (const n of ['Ceifador', 'Canalizar Divindade: Toque da Morte', 'Destruição Inevitável', 'Golpe Divino', 'Atacante Selvagem']) {
    if (!nomes.includes(n)) erros.push('habilidades do Mestre: faltou "' + n + '"');
  }
  if (nomes.includes('Ceifador Aprimorado')) erros.push('habilidades do Mestre: mostrou habilidade do nível 17 num Clérigo 9');
  if (niveis.some(t => /Nível (1[0-9]|20)/.test(t))) erros.push('habilidades do Mestre: grupo de nível acima do 9');
  if (nomes.filter(n => n === '').length) erros.push('habilidades do Mestre: característica sem nome listada');
  if (!sec.querySelector('.hab-mestre-sub')) erros.push('habilidades do Mestre: sem tag de subclasse');

  // Histórico das escolhas de nível + aviso de nível pendente.
  const comHist = window.montarSecaoHabilidades({
    classe: 'Feiticeiro', nivel: 11, _subclasse: 'Linhagem Dracônica',
    _nivelEscolhas: { ultimoNivelProcessado: 10, historico: { 10: { metamagias: ['Magia Sutil'], asi: null, truques: ['Luz'] } } },
  });
  window.document.body.appendChild(comHist);
  await esperar(() => !/Carregando/.test(comHist.textContent));
  if (!/Nível 10: Metamágica: Magia Sutil · Truques: Luz/.test(comHist.textContent)) erros.push('habilidades do Mestre: histórico de escolhas do nível 10 não apareceu');
  if (!/ainda não fez as escolhas do nível 11/.test(comHist.textContent)) erros.push('habilidades do Mestre: sem aviso de escolhas pendentes');

  const comAviso = window.montarSecaoHabilidades({
    classe: 'Guerreiro', nivel: 5, _subclasse: 'Campeão',
    _nivelEscolhas: { ultimoNivelProcessado: 4, historico: {}, aviso: { nivel: 5, motivo: 'Erro ao salvar: sem conexão' } },
  });
  window.document.body.appendChild(comAviso);
  await esperar(() => !/Carregando/.test(comAviso.textContent));
  if (!/não conseguiu concluir o nível 5: Erro ao salvar/.test(comAviso.textContent)) erros.push('habilidades do Mestre: aviso de nível travado não apareceu');

  // Sem subclasse: aviso de subclasse pendente.
  const semSub = window.montarSecaoHabilidades({ classe: 'Guerreiro', nivel: 5, _subclasse: '' });
  window.document.body.appendChild(semSub);
  await esperar(() => !/Carregando/.test(semSub.textContent));
  if (!/Subclasse ainda não escolhida/.test(semSub.textContent)) erros.push('habilidades do Mestre: sem aviso de subclasse pendente');

  // Sem classe.
  const semClasse = window.montarSecaoHabilidades({ classe: '', nivel: 3 });
  if (!/Sem classe definida/.test(semClasse.textContent)) erros.push('habilidades do Mestre: sem classe não avisou');

  // Filtro de chaves livres do card: esconde contador duplicado.
  const RC = window.RecursosClasse;
  if (!RC.chaveCobertaPeloCatalogo({ classe: 'Clérigo', nivel: 9 }, 'canalizar_divindade_2_descanso')) erros.push('chaveCobertaPeloCatalogo não cobriu canalizar_divindade_2_descanso');
  if (RC.chaveCobertaPeloCatalogo({ classe: 'Clérigo', nivel: 9 }, 'custom_abc')) erros.push('chaveCobertaPeloCatalogo cobriu uma característica personalizada');

  if (erros.length) { console.error('FALHAS (painel):\n' + erros.map(e => '  ✗ ' + e).join('\n')); process.exit(1); }
  console.log('OK (painel) — seção Habilidades e filtro de recursos duplicados.');
})();

# Painel do Mestre — D&D 5e

Painel web para o mestre acompanhar status dos jogadores e consultar o grimório completo do PHB em português. **Sincronização em tempo real** via Supabase entre jogadores e mestre.

🔗 **Online:** https://kaikgg1.github.io/painel-mestre-D-D/

## Funcionalidades

- 🧙 **Ficha de personagem completa** (PHB 5e): identidade, atributos, combate, perícias, salvaguardas, magias, equipamento, roleplay
- 📖 **Grimório com 361 magias** do PHB em PT-BR, com filtros (classe, nível, escola, ritual, concentração) e favoritas por personagem
- 👑 **Visão do Mestre** em tempo real: vê todas as fichas marcadas como "ativas" pelos jogadores
- 🗺️ **2 painéis de campanha**: Maldição de Strahd + Crônica dos Aventureiros
- 🔐 **Login por nome** (Sabrina, Derick, Felipe, Mestre) — sem digitação de senha
- 📱 **Responsivo** mobile, tablet e desktop

## Estrutura

```
.
├── index.html                  # Landing page (GitHub Pages serve daqui)
├── README.md
├── .env / .env.example         # Credenciais Supabase (gitignored)
├── .gitignore
├── package.json                # npm scripts: parse, setup-db, etc.
│
├── paineis/                    # Telas HTML
│   ├── login.html              # Dropdown de 3 jogadores + Mestre
│   ├── ficha.html              # Casca da ficha (markup + <link>/<script>)
│   ├── magias.html             # Grimório com filtros + favoritas
│   ├── painel_barovia_dnd5e.html
│   └── painel_mestre_dnd5e.html
│
├── assets/
│   ├── img/
│   │   └── favicon.svg
│   ├── css/
│   │   ├── tokens.css          # Tokens dos 2 temas (geral / strahd)
│   │   ├── components.css      # Primitivos (.card, .btn, .pill, .modal)
│   │   ├── ui.css              # Acabamento dos <select> nativos
│   │   └── ficha/              # CSS da ficha — a ORDEM dos <link> é o contrato
│   │       ├── base.css        # reset, header, abas, campos, atributos
│   │       ├── equipamento.css │ magias.css │ habilidades.css
│   │       ├── combate.css     # HP, stats, perícias + responsividade
│   │       ├── personagem.css  # inspiração, retrato, lock de roleplay
│   │       ├── aliados.css     # stat blocks + buscador do bestiário
│   │       └── sistema.css     # toasts, recursos de classe, lock, ícones
│   └── js/                     # Módulos JS sem build step (scripts clássicos)
│       ├── supabase.js         # Cliente Supabase (window.sb)
│       ├── auth.js             # Login, sessão, header de auth
│       ├── dbsync.js           # CRUD characters + realtime (window.DBSync)
│       ├── favoritas.js        # Lista de magias favoritas (100% Supabase)
│       ├── phb_catalogo.js     # Catálogo de armas/armaduras/itens PHB
│       ├── phb_slots.js        # Espaços de magia por classe × nível
│       ├── recursos_classe.js  # Recursos de classe (ficha + painel do Mestre)
│       ├── exaustao_regras.js  # Efeitos de exaustão (PHB 2014)
│       └── ficha/              # Lógica da ficha — a ORDEM dos <script> é o contrato
│           ├── nucleo.js       # constantes, estado, init, realtime, CRUD de PJ
│           ├── render.js       # render(), abas, aba Identidade
│           ├── aba_combate.js  │ recursos.js │ aba_habilidades.js
│           ├── aba_magias.js   │ aba_equipamento.js │ aba_aliados.js
│           ├── aba_roleplay.js │ lock.js (modo ler/editar)
│           ├── listeners.js    # religa tudo após cada render + auto-save
│           └── salvar.js       # payload do UPDATE (guardas por aba!) + init()
│
├── data/                       # Dados estáticos (PT-BR)
│   ├── magias.md               # Fonte editorial das magias
│   ├── magias_data.json        # Compilado (lido pelo grimório)
│   └── habilidades_classes.json # Features fixas por classe×nível
│
├── sql/                        # Migrations Postgres (rodar via setup-db)
│   ├── README.md
│   ├── 001_schema.sql          → profiles, characters, spell_lists
│   ├── 002_rls.sql             → row-level security
│   ├── 003_seed_jogadores.sql  → cria Sabrina/Derik/Felipe
│   ├── 004_extras_e_realtime.sql
│   ├── 005_mestre_e_rls_restrito.sql → cria Mestre + RLS
│   ├── 006_profiles_seed.sql
│   ├── 007_personagem_ativo_e_decimais.sql
│   ├── 008_ficha_completa.sql  → perícias, salvaguardas, etc.
│   └── 009_ativar_pjs_orfaos.sql
│
├── scripts/                    # CLI Node.js
│   ├── README.md               # Doc de cada script
│   ├── setup_db.js             → npm run setup-db
│   ├── parse_magias.js         → npm run parse
│   ├── gerar_md.js             → npm run gerar-md
│   ├── extrair_pdf.js          → npm run extrair-pdf
│   ├── formatar_phb.js         → npm run formatar-phb
│   ├── smoke_ficha.js          → npm run smoke (regressão da ficha em jsdom)
│   └── extrair_habilidades_classes.js
│
└── docs/                       # Referência (gitignored — copyright)
    ├── LivroDoJogador.pdf/txt/md
    └── ficha *.pdf + fichas_txt/
```

## Setup do zero

```bash
git clone https://github.com/kaikgg1/painel-mestre-D-D.git
cd painel-mestre-D-D
npm install

# Configure credenciais
cp .env.example .env
# Edite .env e cole SUPABASE_URL + SUPABASE_ANON_KEY + DATABASE_URL

# Cria tabelas + jogadores no Supabase
npm run setup-db

# (Opcional) Abra index.html no navegador ou sirva localmente:
npx serve .
```

## Como adicionar/editar magias

A fonte é `data/magias.md` (markdown estruturado). Após editar:

```bash
npm run parse   # gera data/magias_data.json
```

O front-end recarrega automaticamente.

## Testando a ficha

`paineis/ficha.html` é só a casca: o estilo mora em `assets/css/ficha/` e a
lógica em `assets/js/ficha/`, carregados como scripts **clássicos** (sem
`type="module"`). Por isso **a ordem dos `<link>` e `<script>` é o contrato** —
todos compartilham o mesmo escopo global e a mesma cascata de CSS.

```bash
npm run smoke   # carrega os módulos em jsdom, renderiza as 7 abas
                # e confere os cálculos de regra do PHB
```

## Como adicionar um 4º jogador

Edite `sql/003_seed_jogadores.sql` (copie um bloco `if not exists`), rode `npm run setup-db`, depois adicione o nome no dropdown de `paineis/login.html`.

## Breakpoints responsivos

Três valores oficiais (lay-6 da auditoria) — não criar um novo sem necessidade real, e ao mexer numa tela existente preferir migrar pro valor oficial mais próximo em vez de introduzir mais um:

- **480px** — celular estreito (ajustes finos além do que 640px já resolve).
- **640px** — celular/mobile em geral. É o breakpoint principal; a maioria das telas só precisa deste.
- **1024px** — tablet / janela pequena de desktop.

Usados por `assets/css/components.css`, `assets/css/ui.css`, `assets/css/painel_mestre.css`, `assets/css/painel_barovia.css` e todo `assets/css/ficha/*.css`.

**Exceções conhecidas, ainda não migradas** (mudar o número exigiria reconferir o layout em cada arquivo, não é uma troca mecânica segura):
- `assets/css/painel_barovia.css`: breakpoints extras em 700px/1280px além dos 3 oficiais.
- `assets/css/painel_mestre.css`: uma faixa `min-width:641px / max-width:820px` própria pra tablet pequeno.
- `paineis/vilao/*.html` (fichas de vilão): cada ficha tem seus próprios breakpoints inline, tipicamente em torno de 480/720/860/1100px.
- `paineis/reloaded/*.html`: breakpoints inline próprios, não auditados ainda.

## Onde `assets/js/efeitos.js` é usado

`window.FX` dá feedback visual leve (shake, flash de dano/cura, pulso,
confete) e respeita `prefers-reduced-motion`. Carregar em qualquer tela
que tenha um **rastreador de PV/dano** — é esse o critério, não a tela em
si:

- `paineis/ficha.html`, `paineis/magias.html` (favoritar/preparar magia).
- Os 2 painéis do mestre (`painel_mestre_dnd5e.html`, `painel_barovia_dnd5e.html`).
- Fichas de vilão que usam `assets/js/vilao_combate.js` (tracker de
  combate com PV) — **não** as fichas simples migradas pra
  `assets/js/vilao_sync_basico.js` (só notas/habilidades, sem PV pra
  animar), que por isso não carregam `efeitos.js`.

## Padrões de UI

Uma normalização (`<select>` em `assets/css/ui.css`) cresceu por
sucessivos acréscimos (blocos comentados como "ADITIVO") em vez de
edição do bloco original, deixando declarações da mesma propriedade
repetidas em pontos diferentes do arquivo — a de baixo sempre vencendo
na cascata e a de cima virando código morto. Consolidado (lay-11): a
"fonte da verdade" de cada propriedade (a seta/`background-image`, o
`background-position` do mobile) agora existe numa única declaração, no
bloco final do arquivo. Ao editar `ui.css`, evite reabrir esse padrão —
mude a declaração existente em vez de adicionar mais uma por cima.

## Stack

- **Front:** HTML + CSS + Vanilla JS (sem build, sem framework)
- **Backend:** Supabase (Postgres + Auth + Realtime)
- **Hosting:** GitHub Pages (estático)
- **Fonte dos dados:** Livro do Jogador D&D 5e (Galápagos Jogos)

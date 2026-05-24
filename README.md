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
│   ├── ficha.html              # CRUD da ficha (6 abas)
│   ├── magias.html             # Grimório com filtros + favoritas
│   ├── painel_barovia_dnd5e.html
│   └── painel_mestre_dnd5e.html
│
├── assets/
│   ├── img/
│   │   └── favicon.svg
│   └── js/                     # Módulos JS sem build step
│       ├── supabase.js         # Cliente Supabase (window.sb)
│       ├── auth.js             # Login, sessão, header de auth
│       ├── dbsync.js           # CRUD characters + realtime (window.DBSync)
│       ├── favoritas.js        # Lista de magias favoritas (100% Supabase)
│       └── phb_catalogo.js     # Catálogo de armas/armaduras/itens PHB
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

## Como adicionar um 4º jogador

Edite `sql/003_seed_jogadores.sql` (copie um bloco `if not exists`), rode `npm run setup-db`, depois adicione o nome no dropdown de `paineis/login.html`.

## Stack

- **Front:** HTML + CSS + Vanilla JS (sem build, sem framework)
- **Backend:** Supabase (Postgres + Auth + Realtime)
- **Hosting:** GitHub Pages (estático)
- **Fonte dos dados:** Livro do Jogador D&D 5e (Galápagos Jogos)

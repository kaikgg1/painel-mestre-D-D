# Painel do Mestre — D&D 5e

Painel web para o mestre acompanhar status dos jogadores e consultar o grimório completo do PHB em português.

🔗 **Online:** https://kaikgg1.github.io/painel-mestre-D-D/

## Estrutura

```
.
├── index.html              # Landing page (escolha de campanha)
├── paineis/                # Telas (HTML)
│   ├── painel_barovia_dnd5e.html
│   ├── painel_mestre_dnd5e.html
│   ├── magias.html         # Grimório com filtros + favoritas
│   ├── ficha.html          # Ficha do personagem (autenticado)
│   └── login.html          # Tela de login
├── assets/
│   ├── favicon.svg
│   └── js/                 # Módulos JavaScript (sem build step)
│       ├── supabase.js     # Cliente Supabase global
│       ├── auth.js         # Login/logout/header de auth
│       └── favoritas.js    # Wrapper banco-ou-localStorage
├── data/
│   ├── magias.md           # Fonte editorial (markdown estruturado)
│   └── magias_data.json    # Compilado consumido pelo grimório
├── sql/                    # Setup do Supabase (rodar no SQL Editor)
│   ├── README.md
│   ├── 001_schema.sql
│   ├── 002_rls.sql
│   └── 003_seed_jogadores.sql
├── scripts/                # CLI utilitários (Node.js)
│   ├── parse_magias.js     # magias.md → magias_data.json
│   ├── gerar_md.js         # magias_data.json → magias.md
│   ├── extrair_pdf.js      # PDF → texto
│   └── formatar_phb.js     # texto → markdown navegável
├── docs/                   # Referência (não vai pro git)
│   ├── LivroDoJogador.pdf
│   ├── LivroDoJogador.txt
│   └── LivroDoJogador.md
├── .env                    # Credenciais Supabase (não vai pro git)
└── .env.example            # Template das credenciais
```

## Backend (Supabase)

Login simples: dropdown com nomes fixos dos jogadores (sem senha visível pro
jogador — o front preenche uma senha-padrão). Cada jogador autenticado tem:

- Suas próprias **fichas de personagem** (HP, atributos, slots de magia, etc.)
- Suas próprias **listas de magias favoritas** (vinculadas ao personagem)

Setup: rodar os 3 SQLs em `sql/` no dashboard. Detalhes: [`sql/README.md`](sql/README.md).

## Fluxo de dados do grimório

`paineis/magias.html` faz `fetch('../data/magias_data.json')` — todo o conteúdo é estático, sem dependência de APIs externas.

Para editar uma magia: ajuste `data/magias.md` à mão e rode:

```bash
node scripts/parse_magias.js
```

## Conteúdo

- **361 magias** do Livro do Jogador (edição Galápagos), todas em PT-BR oficial
- Nome, escola, nível, classes, componentes e descrição completa

# Painel do Mestre — D&D 5e

Painel web para o mestre acompanhar status dos jogadores e consultar o grimório completo do PHB em português.

🔗 **Online:** https://kaikgg1.github.io/painel-mestre-D-D/

## Estrutura

```
.
├── index.html              # Landing page (escolha de campanha)
├── paineis/                # Painéis HTML (campanhas + grimório)
│   ├── painel_barovia_dnd5e.html
│   ├── painel_mestre_dnd5e.html
│   └── magias.html         # Grimório com filtros
├── data/
│   ├── magias.md           # Fonte editorial (markdown estruturado)
│   └── magias_data.json    # Compilado consumido pelo grimório
├── scripts/
│   ├── parse_magias.js     # magias.md → magias_data.json
│   └── gerar_md.js         # magias_data.json → magias.md (one-shot)
└── docs/
    └── LivroDoJogador.pdf  # Referência (PHB Galápagos)
```

## Fluxo de dados do grimório

`paineis/magias.html` faz `fetch('../data/magias_data.json')` — todo o conteúdo é estático, sem dependência de APIs externas.

Para editar uma magia: ajuste `data/magias.md` à mão e rode:

```bash
node scripts/parse_magias.js
```

## Conteúdo

- **360 magias** do Livro do Jogador (edição Galápagos), todas em PT-BR oficial
- Nome, escola, nível, classes, componentes e descrição completa

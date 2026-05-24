# Scripts utilitários (Node.js)

Ferramentas de linha de comando para gerenciar dados estáticos e o banco Supabase. Todas rodam com `node scripts/<arquivo>.js` ou via `npm run <atalho>` quando disponível.

## Banco de dados (Supabase)

| Script | Atalho npm | O que faz |
|---|---|---|
| [`setup_db.js`](setup_db.js) | `npm run setup-db` | Conecta no Postgres via `DATABASE_URL` do `.env` e executa todos os SQLs em [`../sql/`](../sql/) em ordem. Imprime resumo (tabelas, jogadores, policies). Idempotente. |

## Dados das magias (`data/magias.*`)

| Script | Atalho npm | O que faz |
|---|---|---|
| [`parse_magias.js`](parse_magias.js) | `npm run parse` | Lê [`../data/magias.md`](../data/magias.md) e gera [`../data/magias_data.json`](../data/magias_data.json) — consumido pelo grimório. |
| [`gerar_md.js`](gerar_md.js) | `npm run gerar-md` | Caminho inverso: regenera `magias.md` a partir do `magias_data.json`. Use após editar o JSON manualmente. |

## Livro do Jogador (PHB, copyright Galápagos)

Os PDFs ficam em `docs/` (gitignored). Esses scripts processam-no para uso interno:

| Script | Atalho npm | O que faz |
|---|---|---|
| [`extrair_pdf.js`](extrair_pdf.js) | `npm run extrair-pdf` | `docs/LivroDoJogador.pdf` → `docs/LivroDoJogador.txt` via `pdf-parse`. |
| [`formatar_phb.js`](formatar_phb.js) | `npm run formatar-phb` | `LivroDoJogador.txt` → `LivroDoJogador.md` com cabeçalhos detectados, palavras hifenizadas juntadas, páginas vazias removidas. |
| [`extrair_habilidades_classes.js`](extrair_habilidades_classes.js) | — | Tentativa de extrair tabela classe×nível do PHB. **Resultado tem ruído** — o JSON oficial [`../data/habilidades_classes.json`](../data/habilidades_classes.json) foi montado à mão a partir do PHB. Este script fica como referência. |

## Fluxo típico (do zero)

```bash
# 1. Instalar dependências
npm install

# 2. Criar/atualizar tabelas no Supabase (.env precisa ter DATABASE_URL)
npm run setup-db

# 3. (Opcional) Re-gerar dados das magias após editar magias.md
npm run parse

# 4. (Opcional) Processar PHB para texto navegável
npm run extrair-pdf
npm run formatar-phb
```

# assets/vendor/

Bibliotecas de terceiros vendorizadas localmente (perf-4 da auditoria) — antes
carregadas via CDN (unpkg, jsDelivr, code.iconify.design). Servir do próprio
domínio evita depender da disponibilidade/latência de 3 CDNs diferentes numa
mesa de jogo ao vivo, e libera o `crossorigin`/SRI que a auditoria de
segurança pedia só pra manter uma pin de versão que já está garantida aqui
pelo próprio arquivo.

| Arquivo | Origem | Versão |
|---|---|---|
| `supabase-js-2.45.0.min.js` | https://unpkg.com/@supabase/supabase-js@2.45.0 | 2.45.0 |
| `iconify-icon-2.1.0.min.js` | https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js | 2.1.0 |
| `canvas-confetti-1.9.3.min.js` | https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js | 1.9.3 |

Os hashes SHA-384 batem exatamente com os que estavam pinados via `integrity=`
nas tags `<script>` antes da migração (conferido com `openssl dgst -sha384`).

Pra atualizar uma versão: baixe o novo arquivo, substitua aqui, e atualize
esta tabela e o nome do arquivo (mantendo a versão no nome, ex.:
`supabase-js-2.46.0.min.js`) nos `<script src="...">` das páginas que o usam.

# FeedLens · formulário público

Front do **cliente final** do [FeedLens](https://github.com/IannCarvalho/feedlens): uma tela só, onde a pessoa escreve e envia um feedback. Não tem login, não mostra feedbacks de outras pessoas e não fala em termos técnicos. Quem opera o produto vê o resultado no painel: [feedlens-panel](https://github.com/IannCarvalho/feedlens-panel).

Angular 22 (zoneless, Signal Forms), TypeScript e Vitest.

## Como se encaixa

```mermaid
flowchart LR
    Client["Cliente final"] --> Form["feedlens-form<br/>(site estático)"]
    Form -- "POST /api/feedbacks<br/>GET /health (acorda o servidor)" --> API["feedlens (backend Flask)<br/>analisa com IA e grava"]
    Operator["Operador"] --> Panel["Painel"] --> API
```

O formulário é um **site estático independente**. O backend não o serve, então o cookie de sessão do painel nunca chega a ele. Ele só conhece uma rota da API:

- `POST /api/feedbacks` com `{ "id": "<uuid>", "feedback": "<texto>" }`. O `id` é gerado no navegador e reaproveitado nas tentativas: reenviar é seguro, e um `409` conta como "já recebemos".
- `GET /health`, sem CORS (`no-cors`), só para acordar o servidor enquanto a pessoa escreve.

Limites do contrato: de 5 a 5000 caracteres (`MAX_FEEDBACK_CHARS` no backend). A API e o fluxo ponta a ponta estão no [README](https://github.com/IannCarvalho/feedlens/blob/main/README.md) e no [ARCHITECTURE.md](https://github.com/IannCarvalho/feedlens/blob/main/ARCHITECTURE.md) do backend.

## Configuração em tempo de execução

O app lê `config.json` ao subir (não entra no bundle), então o mesmo build serve qualquer ambiente:

| Campo | `config.json` do repositório | Se o arquivo faltar | Uso |
|---|---|---|---|
| `apiBaseUrl` | `http://127.0.0.1:5000` | `""` | Origem da API, sem barra final. Ex.: `https://api.exemplo.com` |
| `useMock` | `true` | `true` | `true` = modo demonstração, sem servidor. `false` = envia de verdade |
| `productName` | `o nosso produto` | `o nosso produto` | Nome citado nos textos, na voz do cliente final |

O `productName` entra no meio de uma frase ("Sua opinião ajuda a melhorar *{productName}*"), então escreva-o com o artigo: `o Acme App`, `a loja Acme`.

Se o arquivo faltar ou falhar, o app cai no modo demonstração (segunda coluna) em vez de abrir em branco.

**Modo demonstração** (`useMock: true`, o padrão do repositório): nada é enviado ao servidor e nada aparece no painel. Um painel recolhido, que não existe com `useMock: false`, troca o cenário (envio normal, repetido, lento, muitos envios, instável, sem conexão, recusado) e mostra o corpo que seria enviado. Também dá para abrir `?cenario=sem-conexao` na URL.

## Rodando em desenvolvimento

Requer Node 24.15 ou superior (`.node-version`; com `fnm`, rode `fnm use`).

```powershell
npm ci
npm start            # http://127.0.0.1:4200 (modo demonstração, sem servidor)
npm run typecheck    # tipos, inclusive dos templates e dos testes
npm run lint
npm test             # Vitest
npm run build        # dist/feedback-form/browser (com orçamento de bundle)
```

Para enviar de verdade a um backend local:

1. Suba o backend em `http://127.0.0.1:5000`, com um provedor de IA configurado (veja o [README do backend](https://github.com/IannCarvalho/feedlens/blob/main/README.md)).
2. Gere o `config.json` com o envio real ligado. Há dois caminhos:
   - **Por variáveis de ambiente (não deixa diff no repositório).** Use o mesmo script do build (`gen-config.mjs`, exposto como `npm run config:gen`). No PowerShell:
     ```powershell
     $env:API_BASE_URL = "http://127.0.0.1:5000"
     $env:USE_MOCK = "false"
     npm run config:gen   # grava public/config.json a partir das envs
     npm start
     ```
     O script reescreve `public/config.json` localmente; antes de commitar, descarte a alteração (`git checkout -- public/config.json`) para o padrão do repositório continuar `useMock: true`.
   - **Editando o arquivo à mão.** Em `public/config.json`, troque `"useMock": true` por `"useMock": false` (o `apiBaseUrl` do repositório já aponta para `http://127.0.0.1:5000`). **Não commite essa alteração**: o padrão do repositório precisa continuar `useMock: true`.
3. Rode `npm start` e envie um texto que pareça feedback sobre um produto ou serviço. Ele aparece em **Feedbacks** no painel.

> **Mínimo de 5 caracteres é só do cliente.** O formulário barra textos com menos de 5 caracteres (`FEEDBACK_MIN_CHARS` em `src/app/core/app-config.ts`) para evitar envios vazios — é uma regra de **UX**, não do contrato da API. O contrato do backend aceita de 1 a `MAX_FEEDBACK_CHARS` (5000) caracteres; o piso de 5 não existe no servidor e um cliente que ignore o formulário pode enviar menos.

Se o feedback não aparece no painel, as causas comuns são: o formulário ainda está em modo demonstração; a IA marcou o texto como spam (use o filtro de spam no painel); ou a IA não conseguiu analisar (o feedback fica com o selo "Não analisado").

## Docker

A imagem compila o app e o serve com nginx. A configuração entra por variáveis de ambiente, que o contêiner grava em `config.json` ao subir:

```powershell
docker build -t feedlens-form .
docker run --rm -p 8080:80 feedlens-form
```

Sem variáveis, a imagem sobe em modo demonstração em `http://localhost:8080`. Para enviar de verdade a uma API, passe as variáveis:

```powershell
docker run --rm -p 8080:80 -e USE_MOCK=false -e API_BASE_URL=https://api.exemplo.com -e "PRODUCT_NAME=o Acme App" feedlens-form
```

| Variável | Padrão | Observação |
|---|---|---|
| `USE_MOCK` | `true` | Só aceita `true` ou `false`; outro valor impede o contêiner de subir |
| `API_BASE_URL` | vazio | Origem da API, sem barra final. Com `USE_MOCK=false` e vazio, o envio vai para a própria origem do formulário e falha |
| `PRODUCT_NAME` | `o nosso produto` | Escreva com o artigo, como no `config.json` |

O nginx responde `200` em `/healthz`, serve o `index.html` para qualquer rota do app (reload em `/obrigado`, por exemplo) e nunca deixa o `config.json` em cache.

Sem Docker, qualquer hospedagem de arquivos estáticos serve (Vercel, Netlify, Render Static...): publique `dist/feedback-form/browser` e configure o fallback de rotas para o `index.html`.

### Configuração no deploy estático (Vercel etc.)

O `config.json` é um **asset** copiado de `public/` para o build. Como uma hospedagem estática **não** roda o entrypoint do contêiner, a configuração de runtime entra no momento do build: o hook `prebuild` (`scripts/gen-config.mjs`) gera o `public/config.json` a partir das **mesmas variáveis de ambiente** do caminho Docker. Basta defini-las no painel do provedor (o build é `npm run build`, a saída é `dist/feedback-form/browser`):

| Variável | Propósito | Exemplo |
|---|---|---|
| `API_BASE_URL` | Origem da API do backend, **sem barra final**. Vira `apiBaseUrl`. | `https://feedlens.onrender.com` |
| `USE_MOCK` | `false` = envia de verdade; `true` = modo demonstração. Só aceita `true`/`false`. Vira `useMock`. | `false` |
| `PRODUCT_NAME` | Nome citado nos textos, **com o artigo**. Vira `productName`. | `o FeedLens` |

Se **nenhuma** das três estiver definida, o `prebuild` não toca no `config.json` — então o `ng serve` de desenvolvimento e o build local continuam no `public/config.json` do repositório (modo demonstração). O caminho Docker é preservado: no estágio de build do contêiner essas variáveis não existem, e o entrypoint do nginx continua gravando o `config.json` a partir das env vars do runtime.

### Deploy no Vercel (instância publicada)

A instância em produção está em **[feedlens-tau.vercel.app](https://feedlens-tau.vercel.app)**. O projeto é configurado **pela UI do Vercel** (não há `vercel.json` no repositório — veja a decisão abaixo):

- **Build Command:** `npm run build` (o hook `prebuild` roda o `gen-config.mjs` antes).
- **Output Directory:** `dist/feedback-form/browser`.
- **Variáveis de ambiente** (Project → Settings → Environment Variables), os valores de produção:

  | Variável | Valor em produção |
  |---|---|
  | `API_BASE_URL` | `https://feedlens.onrender.com` |
  | `USE_MOCK` | `false` |
  | `PRODUCT_NAME` | `o FeedLens` |

- **Fallback de rotas:** o app tem só duas rotas — `/` (formulário) e `/obrigado` (confirmação, com guarda de sessão); o `**` do Angular redireciona para `/`. O recarregamento direto de `/obrigado` precisa cair no `index.html`. Hospedando um SPA no Vercel sem `vercel.json`, o Vercel já faz o fallback para o `index.html` nas rotas que não são arquivos do build (as rotas client-side do Angular), então o reload em `/obrigado` resolve e abre o formulário (a guarda de sessão redireciona para `/` por não ter envio prévio, que é o comportamento esperado).

> **Decisão: não criar `vercel.json`.** O deploy vivo já está configurado inteiramente pela UI (build, output e envs). Introduzir um `vercel.json` no repositório passaria a sobrepor essa configuração de UI e mudaria um deploy em produção que hoje funciona — risco sem ganho. O fallback de SPA já é o padrão do Vercel. Se um dia a configuração precisar virar código versionado, isso deve ser um PR deliberado que migre build, output e rewrites de uma vez, validado contra o projeto Vercel real.

## Exigências do backend

Este formulário é um site público e estático: **não guarda segredo**, então não envia `X-API-Key`. Para o backend aceitar os envios dele em produção, duas variáveis de ambiente precisam estar definidas lá (veja `app/config.py` e `app/ingest_auth.py` no [backend](https://github.com/IannCarvalho/feedlens)), **ambas com a origem exata do formulário** — no deploy atual, `https://feedlens-tau.vercel.app` (esquema + host, **sem barra final e sem caminho**):

| Variável (backend) | Para quê | Sem ela |
|---|---|---|
| `INGEST_PUBLIC_ORIGINS` | Liga a **ingestão pública opt-in**: um `POST /api/feedbacks` sem chave é aceito quando o header `Origin` bate exatamente com uma das origens listadas. | Se `INGEST_API_KEY` estiver definida no backend, todo POST sem chave recebe **`401`** (`code: ingest_key_required`) e nenhum feedback do formulário é gravado. |
| `CORS_ORIGINS` | Libera o navegador a ler a resposta do `POST` (CORS para `/api/*`). O padrão é `*`. | Com `*` funciona; **restrito sem incluir a origem do formulário**, o navegador bloqueia a resposta e o envio falha no cliente mesmo que o backend tenha gravado. |

Detalhes que valem citar:

- **`Origin` não é autenticação.** O header é forjável fora de um navegador; a origem só impede o uso a partir de páginas de outros sites. As barreiras reais contra gasto de LLM ficam nos dois limites abaixo.
- **Rate limit público por IP:** `RATELIMIT_INGEST_PUBLIC` (padrão **`5 per minute`**), aplicado só ao caminho público (sem chave, via `Origin`).
- **Teto diário global:** `INGEST_PUBLIC_DAILY_CAP` (padrão **`500`**) — total de ingestões públicas nas últimas 24h, contado no banco. Estourado, o endpoint responde **`429`** antes de ler o corpo ou chamar o LLM. O gasto máximo de LLM é ≈ este teto × custo por análise.
- `'*'` **é recusado** em `INGEST_PUBLIC_ORIGINS` no boot do backend: a origem precisa ser literal.
- Alternativas que NÃO se aplicam a este front: `INGEST_API_KEY` (o formulário não tem onde guardar a chave) e `INGEST_ALLOW_BYOK_WITHOUT_KEY` (o cliente final não traz chave de LLM). A leitura (`GET /api/feedbacks`) é governada por `API_READ_TOKEN`/`DASHBOARD_PASSWORD` e não envolve o formulário.

## Estrutura

```
public/config.json            apiBaseUrl, useMock, productName (lido em tempo de execução)
src/main.ts                   lê o config e sobe o app
src/app/app.config.ts         escolhe o gateway: mock ou HTTP
src/app/core/                 FeedbackGateway (contrato), HTTP, mock + dados, sessão de envio
src/app/features/send/        formulário (Signal Forms)
src/app/features/thanks/      confirmação (só abre depois de um envio)
src/app/features/demo/        painel do modo demonstração (não existe com useMock: false)
Dockerfile, docker/           imagem nginx e o script que grava o config.json
```

A tela só conhece `FeedbackGateway.send(id, texto)`, que devolve `ok` ou um motivo (`invalid`, `busy`, `offline`, `unavailable`). Status HTTP e formato da API ficam dentro de `http-feedback.gateway.ts`.

## Contrato com a API

O contrato é pequeno e vive em `http-feedback.gateway.ts` (`classify` traduz o status HTTP para a linguagem da tela). Uma mudança no `POST /api/feedbacks` do backend exige um PR aqui. Um contrato formal (OpenAPI) é uma etapa futura da migração.

## Histórico

Este repositório nasceu da pasta `feedback-form/` do [feedlens](https://github.com/IannCarvalho/feedlens), com o histórico de git preservado (`git filter-repo`). Referências como `IannCarvalho/feedlens#43` nas mensagens de commit apontam para PRs do repositório original.

## Licença

[MIT](LICENSE)

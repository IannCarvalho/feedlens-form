// Gera public/config.json a partir de variaveis de ambiente, ANTES do build
// (hook `prebuild`). Assim o mesmo config de runtime chega a qualquer alvo de
// deploy que rode `npm run build` -- incluindo os estaticos (Vercel, Netlify,
// Render Static), que nao executam o entrypoint do contentor.
//
// As variaveis sao as MESMAS do caminho Docker/nginx (docker/40-feedlens-config.sh),
// entao nao ha dois conjuntos de nomes para manter:
//   API_BASE_URL  -> apiBaseUrl   (origem da API, sem barra final)
//   USE_MOCK      -> useMock      ('true' | 'false')
//   PRODUCT_NAME  -> productName  (nome citado nos textos, na voz do cliente)
//
// Regra de ouro: se NENHUMA das tres estiver definida, o arquivo NAO e tocado.
// Isso preserva:
//   - o dev local (`ng serve` sem env) com o public/config.json do repo (mock);
//   - o caminho Docker, onde o entrypoint do nginx ainda reescreve o config.json
//     no start do contentor a partir das env vars do runtime (comportamento
//     intocado -- este script so prepara um default no estagio de build).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const target = join(scriptDir, '..', 'public', 'config.json')

const hasApi = process.env.API_BASE_URL !== undefined
const hasMock = process.env.USE_MOCK !== undefined
const hasName = process.env.PRODUCT_NAME !== undefined

if (!hasApi && !hasMock && !hasName) {
  console.log('gen-config: nenhuma env (API_BASE_URL/USE_MOCK/PRODUCT_NAME) definida; public/config.json mantido.')
  process.exit(0)
}

// Partimos do config atual do repo para nao perder um campo que a env nao cobre.
let current = { apiBaseUrl: '', useMock: true, productName: 'o nosso produto' }
try {
  current = { ...current, ...JSON.parse(readFileSync(target, 'utf8')) }
} catch {
  // Sem arquivo (ou invalido): seguimos com os defaults acima.
}

// USE_MOCK e booleano: aceita so 'true'/'false', como o script do Docker.
let useMock = current.useMock
if (hasMock) {
  const raw = String(process.env.USE_MOCK).trim()
  if (raw !== 'true' && raw !== 'false') {
    console.error(`gen-config: USE_MOCK deve ser 'true' ou 'false' (recebido: '${raw}').`)
    process.exit(1)
  }
  useMock = raw === 'true'
}

const config = {
  // Sem barra final, como o app espera (ver src/app/core/app-config.ts).
  apiBaseUrl: hasApi ? String(process.env.API_BASE_URL).replace(/\/+$/, '') : current.apiBaseUrl,
  useMock,
  productName: hasName
    ? String(process.env.PRODUCT_NAME).trim() || current.productName
    : current.productName,
}

writeFileSync(target, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf8' })
console.log(`gen-config: public/config.json gerado (useMock=${config.useMock}, apiBaseUrl="${config.apiBaseUrl}").`)

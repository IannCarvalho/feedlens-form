// Valida o vercel.json de headers de segurança (node --test).
//
// O vercel.json deste repositório existe por UM único motivo: declarar
// headers de resposta. A configuração de build (buildCommand, outputDirectory,
// framework) e de rotas (rewrites/redirects) continua na UI do Vercel, para não
// sobrepor o deploy vivo. Este teste trava essa fronteira: falha se alguém
// acrescentar outra chave de topo ao arquivo, ou se qualquer header de
// segurança obrigatório sumir.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const vercelJsonPath = join(scriptDir, '..', 'vercel.json')
const config = JSON.parse(readFileSync(vercelJsonPath, 'utf8'))

// Cada header obrigatório com o valor exato esperado no deploy.
const REQUIRED_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
}

test('vercel.json tem SOMENTE a chave headers', () => {
  assert.deepEqual(
    Object.keys(config),
    ['headers'],
    'vercel.json não pode conter nada além de "headers" (build/rotas ficam na UI do Vercel)',
  )
})

test('headers é um array com uma regra aplicada a todas as rotas', () => {
  assert.ok(Array.isArray(config.headers), 'headers deve ser um array')
  assert.equal(config.headers.length, 1, 'esperava uma única regra de headers')
  assert.equal(config.headers[0].source, '/(.*)', 'a regra deve cobrir todas as rotas')
})

test('cada header de segurança obrigatório está presente com o valor esperado', () => {
  const headers = config.headers[0].headers
  assert.ok(Array.isArray(headers), 'a regra deve ter um array headers')
  const byKey = new Map(headers.map((h) => [h.key, h.value]))
  for (const [key, value] of Object.entries(REQUIRED_HEADERS)) {
    assert.ok(byKey.has(key), `header obrigatório ausente: ${key}`)
    assert.equal(byKey.get(key), value, `valor inesperado para ${key}`)
  }
})

test('a CSP não restringe script-src nem style-src (o build injeta CSS/JS inline)', () => {
  const csp = new Map(config.headers[0].headers.map((h) => [h.key, h.value])).get(
    'Content-Security-Policy',
  )
  // O Angular (beasties) injeta um <style> e um <script> inline no index.html;
  // restringir script-src/style-src sem 'unsafe-inline' derrubaria o app.
  assert.doesNotMatch(csp, /script-src/, 'CSP não deve declarar script-src')
  assert.doesNotMatch(csp, /style-src/, 'CSP não deve declarar style-src')
})

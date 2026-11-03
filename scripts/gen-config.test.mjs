// Testa scripts/gen-config.mjs com `node --test`, SEM tocar no
// public/config.json real: cada caso roda o script como processo filho,
// apontando a saída para um arquivo num diretório temporário próprio
// (GEN_CONFIG_TARGET, override que só o teste usa).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const script = join(scriptDir, 'gen-config.mjs')

/** Roda gen-config.mjs com um env limpo + os overrides dados. */
function run(env, target) {
  // Env mínimo: sem herdar API_BASE_URL/USE_MOCK/PRODUCT_NAME do ambiente de CI.
  const clean = { PATH: process.env.PATH }
  if (target) clean.GEN_CONFIG_TARGET = target
  return spawnSync(process.execPath, [script], {
    env: { ...clean, ...env },
    encoding: 'utf8',
  })
}

/** Cria um diretório temporário isolado e garante sua remoção. */
function withTempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'gen-config-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

test('sem nenhuma das três envs: não toca no arquivo de saída', (t) => {
  const dir = withTempDir(t)
  const target = join(dir, 'config.json')
  // Pré-condição: o arquivo não existe.
  const result = run({}, target)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(existsSync(target), false, 'não deveria criar o arquivo sem env')
  assert.match(result.stdout, /nenhuma env/)
})

test('sem envs: preserva um arquivo de saída já existente', (t) => {
  const dir = withTempDir(t)
  const target = join(dir, 'config.json')
  const original = '{"apiBaseUrl":"x","useMock":true,"productName":"y"}\n'
  writeFileSync(target, original, 'utf8')
  const result = run({}, target)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(readFileSync(target, 'utf8'), original, 'arquivo não deve mudar')
})

test('com as três envs: gera config.json correto (barra final removida)', (t) => {
  const dir = withTempDir(t)
  const target = join(dir, 'config.json')
  const result = run(
    {
      API_BASE_URL: 'https://feedlens.onrender.com//',
      USE_MOCK: 'false',
      PRODUCT_NAME: '  o FeedLens  ',
    },
    target,
  )
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(readFileSync(target, 'utf8')), {
    apiBaseUrl: 'https://feedlens.onrender.com',
    useMock: false,
    productName: 'o FeedLens',
  })
})

test("USE_MOCK='true' vira booleano true", (t) => {
  const dir = withTempDir(t)
  const target = join(dir, 'config.json')
  const result = run({ USE_MOCK: 'true' }, target)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(readFileSync(target, 'utf8')).useMock, true)
})

test('USE_MOCK inválido: sai com erro e não grava', (t) => {
  const dir = withTempDir(t)
  const target = join(dir, 'config.json')
  const result = run({ USE_MOCK: 'talvez' }, target)
  assert.notEqual(result.status, 0, 'deveria falhar com USE_MOCK inválido')
  assert.equal(existsSync(target), false, 'não deveria gravar com valor inválido')
  assert.match(result.stderr, /USE_MOCK/)
})

test('só API_BASE_URL definido: mantém os defaults dos outros campos', (t) => {
  const dir = withTempDir(t)
  const target = join(dir, 'config.json')
  const result = run({ API_BASE_URL: 'https://api.exemplo.com' }, target)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(readFileSync(target, 'utf8')), {
    apiBaseUrl: 'https://api.exemplo.com',
    useMock: true,
    productName: 'o nosso produto',
  })
})

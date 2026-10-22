const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const test = require('node:test')
const { createHash } = require('node:crypto')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const resolve = Module._resolveFilename
Module._resolveFilename = function(request, ...args) { return resolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, ...args) }
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file)

// All filesystem responses are synthetic. These tests never read local import
// workbooks, the prepared private JSON, or a real access capability.
const token = 'a'.repeat(64)
const batchId = 'school-files-synthetic-access-test'
const summary = { staffRows: 0, departments: {}, jobs: 0, places: 0, areas: {}, placeKinds: {}, suggestedSubjects: {}, duplicateNameRows: 0, multiUsePlaces: 0, ignoredLayoutMarkers: 0 }
const bundle = () => ({ schema: 1, batchId, staff: [], departments: [], jobs: [], places: [], summary: structuredClone(summary) })
let prepared = bundle()
let capability = {}
let reads = []
let missing = false
const load = Module._load
Module._load = function(request, parent, isMain) {
  if (request === 'server-only') return {}
  if (request === 'node:fs/promises') return { readFile: async (file, encoding) => {
    assert.equal(encoding, 'utf8')
    const name = path.basename(file)
    assert(['current.json', 'capability.json'].includes(name), 'only the fixed private bundle paths may be read')
    assert.equal(path.dirname(file), path.join(root, '.local-artifacts', 'private-school-import'))
    reads.push(name)
    if (missing) throw new Error('synthetic missing file')
    return JSON.stringify(name === 'capability.json' ? capability : prepared)
  } }
  return load.call(this, request, parent, isMain)
}
const originalEnv = process.env.NODE_ENV
const { readAuthorizedLocalSchoolImport, readLocalSchoolImportMetadata } = require('../lib/school/local-import-server.ts')
const { POST } = require('../app/api/local-school-import/route.ts')
test.beforeEach(() => {
  process.env.NODE_ENV = 'development'
  prepared = bundle()
  capability = { batchId, expiresAt: Date.now() / 1000 + 3600, digest: createHash('sha256').update(token).digest('hex') }
  reads = []
  missing = false
})
test.after(() => {
  Module._load = load
  Module._resolveFilename = resolve
  if (originalEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalEnv
})
const request = (headers = {}) => new Request('http://localhost:3109/api/local-school-import', {
  method: 'POST', headers: { host: 'localhost:3109', origin: 'http://localhost:3109', authorization: `Bearer ${token}`, ...headers },
})
const denied = async req => {
  const response = await POST(req)
  assert.equal(response.status, 404)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(await response.text(), '')
}

test('development loopback host and valid unexpired capability return the prepared bundle', async () => {
  for (const host of ['localhost:3109', '127.0.0.1:3109', '[::1]:3109']) {
    assert.deepEqual(await readAuthorizedLocalSchoolImport(host, token), prepared)
  }
  assert.equal(reads.filter(name => name === 'current.json').length, 3)
})

test('missing, malformed and wrong capability tokens return no records', async () => {
  for (const value of ['', 'a'.repeat(63), 'not-a-capability', 'A'.repeat(64)]) {
    assert.equal(await readAuthorizedLocalSchoolImport('localhost:3109', value), null)
  }
  assert.deepEqual(reads, [])
  assert.equal(await readAuthorizedLocalSchoolImport('localhost:3109', 'b'.repeat(64)), null)
  assert.deepEqual(reads, ['capability.json'])
})

test('expired capability and a capability for a different batch cannot read records', async () => {
  capability.expiresAt = Date.now() / 1000 - 1
  assert.equal(await readAuthorizedLocalSchoolImport('localhost:3109', token), null)
  assert.deepEqual(reads, ['capability.json'])
  capability.expiresAt = Date.now() / 1000 + 100
  capability.batchId = 'school-files-different-synthetic-batch'
  assert.equal(await readAuthorizedLocalSchoolImport('localhost:3109', token), null)
})

test('non-loopback hosts and production deny records and metadata without reading files', async () => {
  for (const host of [null, 'school.example', 'localhost.evil.example', '127.0.0.1.evil.example', 'localhost:3109,school.example']) {
    assert.equal(await readAuthorizedLocalSchoolImport(host, token), null)
    assert.equal(await readLocalSchoolImportMetadata(host), null)
  }
  process.env.NODE_ENV = 'production'
  assert.equal(await readAuthorizedLocalSchoolImport('localhost:3109', token), null)
  assert.equal(await readLocalSchoolImportMetadata('localhost:3109'), null)
  assert.deepEqual(reads, [])
})

test('metadata contains only batch and aggregate summary, with no personnel or place records', async () => {
  const metadata = await readLocalSchoolImportMetadata('localhost:3109')
  assert.deepEqual(Object.keys(metadata).sort(), ['batchId', 'summary'])
  assert.deepEqual(metadata, { batchId, summary })
  for (const key of ['staff', 'places', 'departments', 'jobs']) assert.equal(Object.hasOwn(metadata, key), false)
  assert.deepEqual(reads, ['current.json'])
})

test('missing and invalid prepared data return no records or parse excerpts', async () => {
  missing = true
  assert.equal(await readAuthorizedLocalSchoolImport('localhost:3109', token), null)
  assert.equal(await readLocalSchoolImportMetadata('localhost:3109'), null)
  missing = false
  prepared = { ...bundle(), schema: 99 }
  assert.equal(await readAuthorizedLocalSchoolImport('localhost:3109', token), null)
  assert.equal(await readLocalSchoolImportMetadata('localhost:3109'), null)
})

test('authorized same-origin POST sends private no-store content and varies on authorization', async () => {
  const response = await POST(request())
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store, private')
  assert.equal(response.headers.get('vary'), 'Authorization, Cookie')
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Path=\//)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(await response.json(), prepared)
})

test('POST without a capability or with the wrong capability is denied with no-store', async () => {
  await denied(request({ authorization: '' }))
  await denied(request({ authorization: 'Bearer ' + 'b'.repeat(64) }))
})

test('cross-site, different-host, different-port and malformed-origin POSTs are denied before filesystem access', async () => {
  await denied(request({ 'sec-fetch-site': 'cross-site' }))
  await denied(request({ origin: 'http://school.example' }))
  await denied(request({ origin: 'http://localhost:3110' }))
  await denied(request({ origin: 'invalid origin' }))
  await denied(request({ host: 'school.example' }))
  assert.deepEqual(reads, [])
})

test('a different origin scheme is cross-origin even when the host and port match', async () => {
  await denied(request({ origin: 'https://localhost:3109' }))
  assert.deepEqual(reads, [])
})

test('production POST cannot return a prepared private bundle even with a valid capability', async () => {
  process.env.NODE_ENV = 'production'
  await denied(request())
  assert.deepEqual(reads, [])
})

test('an existing owner capability establishes a protected cookie and later private loads need no fragment', async () => {
  const response = await POST(request())
  const cookie = response.headers.get('set-cookie').split(';')[0]
  const next = new Request('http://localhost:3109/api/local-school-import', { method: 'POST', headers: { host: 'localhost:3109', origin: 'http://localhost:3109', cookie } })
  const restored = await POST(next)
  assert.equal(restored.status, 200)
  assert.deepEqual(await restored.json(), prepared)
  assert.equal(restored.headers.get('set-cookie'), null)
  capability.expiresAt = Date.now() / 1000 - 1
  await denied(next)
})

test('a wrong or duplicate owner cookie never grants private data', async () => {
  for (const cookie of [`tgs-local-school-access=${'b'.repeat(64)}`, `tgs-local-school-access=${token}; tgs-local-school-access=${token}`]) {
    await denied(new Request('http://localhost:3109/api/local-school-import', { method: 'POST', headers: { host: 'localhost:3109', origin: 'http://localhost:3109', cookie } }))
  }
})

const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const assert = require('node:assert/strict')
const resolve = Module._resolveFilename
Module._resolveFilename = function (name, parent, ...rest) { return resolve.call(this, name.startsWith('@/') ? path.join(process.cwd(), name.slice(2)) : name, parent, ...rest) }
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, file)
const { SYSTEM_TEMPLATES, validTemplate, canRead, readReport, reportDiff, visibleBlocks, reportFilename } = require('../lib/mt/reports.ts')
let count = 0
const test = (name, fn) => { fn(); count++; console.log(`PASS ${name}`) }
const template = SYSTEM_TEMPLATES[0]
const report = { key: 'personal-a', kind: 'personal', audience: 'parent', studentId: 'a', name: '合成学生', scope: '合成班 P1', period: '第5周', teacher: '合成教师', cutoff: '2026-10-04', template: structuredClone(template), eligibleStudents: ['a'], blocks: [{ key: 'teaching', title: '教学介绍', lines: ['本周实际内容'] }] }
const guardian = { id: 'g', name: '合成家长', studentIds: ['a', 'b'], active: true, verified: true }
const pub = { id: 'p', reports: [report], week: 5, revision: 1 }
const biz = { clock: '2026-10-04T12:00:00Z', publications: [pub], reporting: { deliveries: { p: [{ reportKey: report.key, guardian: 'g', status: 'sent' }] }, links: { p: [{ token: 't', reportKey: report.key, expires: '2026-10-05T12:00:00Z', disabled: false }] } } }
test('8 templates with 4 distinct layouts per kind', () => { assert.equal(SYSTEM_TEMPLATES.length, 8); for (const kind of ['personal', 'class']) assert.equal(new Set(SYSTEM_TEMPLATES.filter(t => t.kind === kind).map(t => t.layout)).size, 4); SYSTEM_TEMPLATES.forEach(t => assert.ok(validTemplate(t))) })
test('malicious fields rejected', () => { assert.equal(validTemplate({ ...template, modules: ['internalMemo'] }), false); assert.equal(validTemplate({ ...template, color: 'url(javascript:alert(1))' }), false) })
test('class template cannot read personal comment', () => assert.equal(validTemplate({ ...SYSTEM_TEMPLATES[4], modules: ['comment'] }), false))
test('known verified guardian can read own child', () => assert.ok(canRead(report, guardian)))
test('unrelated child, expired relation, unverified rejected', () => { assert.equal(canRead(report, { ...guardian, studentIds: ['c'] }), false); assert.equal(canRead(report, { ...guardian, active: false }), false); assert.equal(canRead(report, { ...guardian, verified: false }), false) })
test('internal projection never delivered to parent', () => assert.equal(canRead({ ...report, audience: 'internal' }, guardian), false))
test('inbox requires actual simulated delivery', () => { assert.ok(readReport(biz, 'g', [guardian], 'p', report.key).report); assert.ok(readReport(biz, 'unknown', [guardian], 'p', report.key).error) })
test('valid token still requires relationship', () => { assert.ok(readReport(biz, 'g', [guardian], 'p', report.key, 't').report); assert.ok(readReport(biz, 'g', [{ ...guardian, studentIds: [] }], 'p', report.key, 't').error) })
test('disabled and expired links denied', () => { const b = structuredClone(biz); b.reporting.links.p[0].disabled = true; assert.ok(readReport(b, 'g', [guardian], 'p', report.key, 't').error); b.reporting.links.p[0].disabled = false; b.clock = '2026-10-06T12:00:00Z'; assert.ok(readReport(b, 'g', [guardian], 'p', report.key, 't').error) })
test('withdrawal denies old links and inbox', () => { const b = structuredClone(biz); b.publications[0].withdrawn = true; assert.ok(readReport(b, 'g', [guardian], 'p', report.key, 't').error); assert.ok(readReport(b, 'g', [guardian], 'p', report.key).error) })
test('read projection is detached immutable copy', () => { const r = readReport(biz, 'g', [guardian], 'p', report.key).report; r.blocks[0].lines[0] = 'changed'; assert.equal(report.blocks[0].lines[0], '本周实际内容') })
test('real diff detects template and content changes', () => { const next = structuredClone(report); next.blocks[0].lines = ['修订']; next.template.name = '新版'; assert.equal(reportDiff([report], [next]).length, 2); assert.equal(reportDiff([report], [report]).length, 0) })
test('same-name files do not overwrite', () => assert.notEqual(reportFilename(pub, report, 1), reportFilename(pub, { ...report, key: 'personal-b' }, 1)))
test('canonical teaching headings cannot be renamed', () => assert.equal(validTemplate({ ...template, titles: { teaching: '备注' } }), false))
test('empty optional blocks omitted', () => assert.deepEqual(visibleBlocks({ ...report, blocks: [{ key: 'comment', title: '评语', lines: [] }] }), []))
console.log(`${count} tests passed`)

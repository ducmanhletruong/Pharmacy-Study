import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyAudit } from './audit-report.mjs'
const finding = () => ({
  module_name: 'picomatch',
  severity: 'high',
  url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf',
  vulnerable_versions: '<=4.0.7',
  findings: [
    { dev: true, version: '2.3.2' },
    { dev: true, version: '4.0.7' },
  ],
})
const report = (advisory) => ({
  metadata: { vulnerabilities: { high: 1, critical: 0 } },
  advisories: { synthetic: advisory },
})
test('only the exact patched development finding is classified as handled', () => {
  const result = classifyAudit(report(finding()))
  assert.equal(result.locally_patched_dev_advisories.length, 1)
  assert.equal(result.unmitigated.length, 0)
  assert.equal(result.raw_vulnerabilities.high, 1)
})
test('new advisories, runtime paths, versions or changed affected ranges remain blocked', () => {
  for (const change of [
    { url: 'https://github.com/advisories/GHSA-unknown' },
    { module_name: 'other' },
    { findings: [{ dev: false, version: '4.0.7' }] },
    { findings: [{ dev: true, version: '5.0.0' }] },
    { vulnerable_versions: '<=5.0.0' },
  ])
    assert.equal(
      classifyAudit(report({ ...finding(), ...change })).unmitigated.length,
      1,
    )
})
test('critical findings cannot use the development mitigation', () => {
  const data = report({ ...finding(), severity: 'critical' })
  data.metadata.vulnerabilities = { high: 0, critical: 1 }
  assert.equal(classifyAudit(data).unmitigated.length, 1)
})
test('registry failures and unclassified counts fail closed', () => {
  for (const data of [
    { error: 'offline' },
    {},
    {
      metadata: { vulnerabilities: { high: 2, critical: 0 } },
      advisories: { known: finding() },
    },
  ])
    assert.throws(() => classifyAudit(data))
})

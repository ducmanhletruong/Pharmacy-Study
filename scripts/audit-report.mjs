// Pure classification only. The caller must verify installed patches first.
export function classifyAudit(report) {
  if (
    !report ||
    typeof report !== 'object' ||
    report.error ||
    !report.metadata?.vulnerabilities ||
    !report.advisories
  )
    throw new Error('Registry audit unavailable; fail closed')
  const counts = report.metadata.vulnerabilities
  if (
    !counts ||
    typeof counts !== 'object' ||
    Array.isArray(counts) ||
    !report.advisories ||
    typeof report.advisories !== 'object' ||
    Array.isArray(report.advisories)
  )
    throw new Error('Malformed audit report; fail closed')
  for (const severity of ['high', 'critical'])
    if (!Number.isSafeInteger(counts[severity]) || counts[severity] < 0)
      throw new Error('Malformed severity counts; fail closed')
  for (const entry of Object.values(report.advisories))
    if (
      !entry ||
      typeof entry !== 'object' ||
      !['info', 'low', 'moderate', 'high', 'critical'].includes(entry.severity)
    )
      throw new Error('Malformed advisory; fail closed')
  const blocked = [],
    mitigated = []
  const severe = Object.values(report.advisories).filter((a) =>
    ['high', 'critical'].includes(a.severity),
  )
  for (const severity of ['high', 'critical'])
    if (
      report.metadata.vulnerabilities[severity] !==
      severe.filter((a) => a.severity === severity).length
    )
      throw new Error('Unclassified severe finding; fail closed')
  for (const advisory of severe) {
    const known =
      advisory.module_name === 'picomatch' &&
      advisory.severity === 'high' &&
      advisory.url === 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf' &&
      advisory.vulnerable_versions === '<=4.0.7' &&
      Array.isArray(advisory.findings) &&
      advisory.findings.length > 0 &&
      advisory.findings.every(
        (f) => f.dev === true && ['2.3.2', '4.0.7'].includes(f.version),
      )
    if (known) mitigated.push(advisory.url)
    else
      blocked.push({
        module: advisory.module_name,
        severity: advisory.severity,
        url: advisory.url,
      })
  }
  return {
    raw_vulnerabilities: report.metadata.vulnerabilities,
    locally_patched_dev_advisories: mitigated,
    unmitigated: blocked,
  }
}

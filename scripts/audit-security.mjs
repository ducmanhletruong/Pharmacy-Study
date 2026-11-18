import { classifyAudit } from './audit-report.mjs'
import { spawnSync } from 'node:child_process'
import { verifyGlobHardening } from './check-glob-hardening.mjs'

await verifyGlobHardening()
const result = spawnSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['audit', '--json'],
  {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 60000,
    maxBuffer: 8 * 1024 * 1024,
  },
)
if (
  result.error ||
  result.signal ||
  result.status === null ||
  ![0, 1].includes(result.status)
)
  throw new Error('Registry audit failed; no advisory was ignored')
let report
try {
  report = JSON.parse(result.stdout)
} catch {
  throw new Error('Invalid registry audit report; fail closed')
}
if (
  result.status === 0 &&
  (report.metadata?.vulnerabilities?.high > 0 ||
    report.metadata?.vulnerabilities?.critical > 0)
)
  throw new Error('Inconsistent audit exit status; fail closed')
const outcome = classifyAudit(report)
console.log(JSON.stringify(outcome, null, 2))
if (outcome.unmitigated.length) process.exitCode = 1

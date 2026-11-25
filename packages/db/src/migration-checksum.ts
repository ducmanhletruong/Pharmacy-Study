import { createHash } from 'node:crypto'

// These checkout variants had mixed line endings. Accept a legacy hash only
// when the entire current migration still equals its canonical text digest.
const historical: Record<string, { canonical: string; mixed: string }> = {
  '0009_learner_workflows.sql': {
    canonical:
      '5582fc5f6d21a77caff5578708e130c3f899604e623da81de72c1210b0e858a9',
    mixed: '8326f6f5d7351d40660b88955c63795a485abd0b0236b93194fa781d6772b4ce',
  },
  '0010_private_written_exams.sql': {
    canonical:
      '00f224ca69a1b12c9c60b6999a427803757413ef118794ae40c2e028629be278',
    mixed: 'bf70f7a6c013f290f88d247a7d8cdfd69f26150c1a406e3a9bead5607cc50fdf',
  },
}

function digest(text: string) {
  return createHash('sha256').update(text).digest('hex')
}

export function migrationIdentity(name: string, raw: string) {
  const sql = raw.replace(/\r\n/g, '\n')
  const hash = digest(sql)
  const prior = new Set([hash, digest(raw), digest(sql.replace(/\n/g, '\r\n'))])
  const recorded = historical[name]
  if (recorded?.canonical === hash) prior.add(recorded.mixed)
  return {
    sql,
    hash,
    matches: (previousHash: string) => prior.has(previousHash),
  }
}

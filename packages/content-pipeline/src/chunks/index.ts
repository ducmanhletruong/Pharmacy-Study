import { sha256 } from '../bundle'
import type { Source } from '../knowledge'

export type Chunk = {
  id: string
  source_ref: string
  section: number
  content_sha256: string
  source_fingerprint?: string
  topic_codes: string[]
  status: 'unmapped' | 'mapped'
}

export function sourceFingerprint(source: {
  kind?: string
  title: string
  locator: string
  license: string
}) {
  return sha256(
    JSON.stringify([
      source.kind ?? 'manual',
      source.title,
      source.locator,
      source.license,
    ]),
  )
}

export function chunkLedger(
  sources: readonly Source[],
  assignments: Record<string, string[]> = {},
): Chunk[] {
  const mapped = new Set<string>()
  const chunks = sources.flatMap((source) => {
    const fingerprint = sourceFingerprint(source)
    const parts = source.text
      .normalize('NFC')
      .replace(/\r\n?/g, '\n')
      .split(/(?=^#{1,6}[ \t]+\S)/m)
      .map((part) => part.trim())
      .filter(Boolean)
    return parts.map((part, index) => {
      const section = index + 1
      const key = `${source.ref}:${section}`
      mapped.add(key)
      const content_sha256 = sha256(part)
      const id = sha256(JSON.stringify([source.ref, section, content_sha256]))
      const topic_codes = [...new Set(assignments[key] ?? [])].sort()
      return {
        id,
        source_ref: source.ref,
        section,
        content_sha256,
        source_fingerprint: fingerprint,
        topic_codes,
        status: topic_codes.length ? 'mapped' : 'unmapped',
      } satisfies Chunk
    })
  })
  if (Object.keys(assignments).some((key) => !mapped.has(key)))
    throw Error('Assignments refer to an unknown section')
  return chunks
}

export type ReviewedQuestion = {
  id: string
  revision_id?: string
  subject: string
  type: string
  status:
    'draft' | 'verified' | 'approved' | 'under_review' | 'hidden' | 'retired'
  topic_codes: string[]
  chunk_ids: string[]
  source_fingerprints?: string[]
  minimum_tier?: 1 | 2 | 3 | null
}

type ReportAudience = 'public' | 'class'

function approvedQuestions(
  questions: readonly ReviewedQuestion[],
  subject: string,
  audience?: ReportAudience,
) {
  const approved = questions.filter(
    (q) => q.status === 'approved' && q.subject === subject,
  )
  if (new Set(approved.map((q) => q.id)).size !== approved.length)
    throw Error('Duplicate approved question ID')
  if (!audience) return approved
  if (approved.some((q) => q.minimum_tier === undefined))
    throw Error('Regenerate the review index with audience metadata')
  const maximum = audience === 'public' ? 1 : 2
  return approved.filter(
    (q) => q.minimum_tier != null && q.minimum_tier <= maximum,
  )
}

export function coverage(
  chunks: readonly Chunk[],
  questions: readonly ReviewedQuestion[],
  subject: string,
  taxonomy: readonly string[],
  requireSourceMatch = false,
  audience?: ReportAudience,
) {
  const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]))
  if (chunksById.size !== chunks.length) throw Error('Duplicate chunk ID')
  const approved = approvedQuestions(questions, subject, audience)
  for (const question of approved) {
    const sources = question.source_fingerprints
      ? new Set(question.source_fingerprints)
      : undefined
    for (const id of question.chunk_ids) {
      const chunk = chunksById.get(id)
      if (!chunk) throw Error('Approved question refers to an unknown chunk')
      if (requireSourceMatch || sources) {
        if (!chunk.source_fingerprint || !sources)
          throw Error('Regenerate the evidence with source fingerprints')
        if (!sources.has(chunk.source_fingerprint))
          throw Error(
            'Evidence chunk is not from a source cited by the revision',
          )
      }
    }
  }
  const totals = new Map(
    [...new Set(taxonomy)].sort().map((topic) => [
      topic,
      {
        approved: 0,
        byType: new Map<string, number>(),
        eligible: new Set<string>(),
        covered: new Set<string>(),
      },
    ]),
  )
  for (const chunk of chunks) {
    for (const topic of chunk.topic_codes)
      totals.get(topic)?.eligible.add(chunk.id)
  }
  for (const q of approved) {
    for (const topic of new Set(q.topic_codes)) {
      const total = totals.get(topic)
      if (!total) continue
      total.approved++
      total.byType.set(q.type, (total.byType.get(q.type) ?? 0) + 1)
      for (const id of q.chunk_ids) {
        if (total.eligible.has(id)) total.covered.add(id)
      }
    }
  }
  const byTopic = [...totals].map(([topic, total]) => ({
    topic,
    approved: total.approved,
    by_type: Object.fromEntries([...total.byType].sort()),
    chunks: total.eligible.size,
    covered_chunks: total.covered.size,
    coverage_pct: total.eligible.size
      ? Math.round((total.covered.size / total.eligible.size) * 10000) / 100
      : null,
  }))
  const topicCount = byTopic.length
  const coveredTopics = byTopic.filter(
    (topic) => topic.covered_chunks > 0,
  ).length
  const targetPct = 90
  return {
    subject,
    ...(audience ? { audience } : {}),
    approved: approved.length,
    taxonomy_coverage: {
      total_topics: topicCount,
      covered_topics: coveredTopics,
      coverage_pct: topicCount
        ? Math.round((coveredTopics / topicCount) * 10000) / 100
        : null,
      target_pct: targetPct,
      meets_target:
        topicCount > 0 && 100 * coveredTopics >= targetPct * topicCount,
    },
    unmapped_chunks: chunks.filter((chunk) => chunk.status === 'unmapped')
      .length,
    topics: byTopic,
  }
}

export function auditSample(
  questions: readonly ReviewedQuestion[],
  subject: string,
  count: number,
  seed: string,
  decisions?: readonly { id: string; revision_id: string; correct: boolean }[],
  audience?: ReportAudience,
) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 1000 || !seed)
    throw Error('Invalid sample count or seed')
  const eligible = approvedQuestions(questions, subject, audience)
  const ranked = eligible.map((q) => ({
    q,
    rank: sha256(JSON.stringify([seed, q.id])),
  }))
  ranked.sort(
    (a, b) => a.rank.localeCompare(b.rank) || a.q.id.localeCompare(b.q.id),
  )
  const sample = ranked.slice(0, count).map(({ q }) => q)
  const revisions = Object.fromEntries(
    sample.flatMap(({ id, revision_id }) =>
      revision_id ? [[id, revision_id]] : [],
    ),
  )
  const result = {
    subject,
    ...(audience ? { audience } : {}),
    requested: count,
    available: eligible.length,
    seed,
    items: sample.map(({ id }) => id),
    revisions,
  }
  if (!decisions) return { ...result, review: undefined }
  const seen = new Set<string>()
  const sampleIds = new Set(result.items)
  let reviewed = 0,
    correct = 0,
    stale = 0
  for (const decision of decisions) {
    if (seen.has(decision.id) || !sampleIds.has(decision.id))
      throw Error('Audit decisions must identify distinct sampled questions')
    seen.add(decision.id)
    if (
      revisions[decision.id]?.toLowerCase() !==
      decision.revision_id.toLowerCase()
    ) {
      stale++
      continue
    }
    reviewed++
    if (decision.correct) correct++
  }
  return {
    ...result,
    review: {
      reviewed,
      correct,
      stale,
      accuracy_pct: reviewed
        ? Math.round((correct / reviewed) * 10000) / 100
        : null,
      target_pct: 98,
      meets_sample_target: count === 100 && reviewed === count && correct >= 98,
    },
  }
}

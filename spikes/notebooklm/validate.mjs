import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const text = (value) => typeof value === 'string' && value.trim().length > 0
const dayKey = (timestamp) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp))

export function validateCapture(capture, now = Date.now()) {
  const errors = []
  if (capture?.schema_version !== 1) errors.push('schema_version must be 1')
  if (capture?.synthetic !== false)
    errors.push('Synthetic data is not live evidence')
  if (!text(capture?.server?.name) || !text(capture?.server?.version)) {
    errors.push('Record the actual MCP server name and version')
  }
  if (!['stdio', 'https'].includes(capture?.server?.transport)) {
    errors.push('Record stdio or https transport without credentials')
  }
  if (
    capture?.source_permission?.confirmed !== true ||
    !text(capture?.source_permission?.basis)
  ) {
    errors.push('Source-use rights have not been confirmed')
  }
  const review = capture?.terms_review
  const reviewedAt = Date.parse(review?.reviewed_at)
  if (
    !Number.isFinite(reviewedAt) ||
    reviewedAt > now ||
    !text(review?.reviewer) ||
    !text(review?.notes)
  ) {
    errors.push('Record an actual terms review with date, reviewer and notes')
  }
  const topics = Array.isArray(capture?.topics) ? capture.topics : []
  const topicIds = new Set(topics.map((topic) => topic?.id).filter(text))
  if (
    topicIds.size !== 5 ||
    topics.length !== 5 ||
    topics.some((topic) => !text(topic?.label))
  ) {
    errors.push('Exactly five distinct real topics are required')
  }
  const days = new Map()
  const observations = Array.isArray(capture?.observations)
    ? capture.observations
    : []
  for (const [index, observation] of observations.entries()) {
    if (!observation || typeof observation !== 'object') {
      errors.push(`Observation ${index}: expected an object`)
      continue
    }
    const timestamp = Date.parse(observation.observed_at)
    if (!Number.isFinite(timestamp) || timestamp > now) {
      errors.push(`Observation ${index}: invalid or future timestamp`)
      continue
    }
    if (!topicIds.has(observation.topic_id)) {
      errors.push(`Observation ${index}: unknown topic`)
      continue
    }
    const hasCitation =
      Array.isArray(observation.citations) &&
      observation.citations.length > 0 &&
      observation.citations.every(
        (item) => text(item?.source_ref) && text(item?.location),
      )
    if (
      observation.response_ok !== true ||
      observation.grounded_verified !== true ||
      !hasCitation ||
      !/^[a-f0-9]{64}$/.test(observation.excerpt_sha256 ?? '') ||
      !Number.isSafeInteger(observation.excerpt_chars) ||
      observation.excerpt_chars < 1
    ) {
      errors.push(
        `Observation ${index}: missing successful, grounded excerpt and source locator`,
      )
      continue
    }
    const day = dayKey(timestamp)
    if (!days.has(day)) days.set(day, new Set())
    days.get(day).add(observation.topic_id)
  }
  const completeDays = [...days.entries()]
    .filter(([, observedTopics]) => observedTopics.size === 5)
    .map(([day]) => day)
    .sort()
  const consecutive = completeDays.some((day, index) =>
    [1, 2].every(
      (offset) =>
        Date.parse(`${completeDays[index + offset]}T00:00:00Z`) -
          Date.parse(`${day}T00:00:00Z`) ===
        offset * 86_400_000,
    ),
  )
  if (!consecutive)
    errors.push('Need five topics on each of three consecutive observed days')
  return {
    gate_passed: errors.length === 0,
    observation_count: observations.length,
    complete_days: completeDays,
    errors,
    limitation:
      'Checks recorded evidence, not remote truth; an admin must verify grounding and attestations.',
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (!process.argv[2])
    throw new Error('Usage: node validate.mjs <private-capture.json>')
  const report = validateCapture(
    JSON.parse(await readFile(process.argv[2], 'utf8')),
  )
  console.log(JSON.stringify(report, null, 2))
  if (!report.gate_passed) process.exitCode = 2
}

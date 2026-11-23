export type ExamSlot = { topic_id?: string; difficulty?: number; count: number }
export type Candidate = {
  id: string
  revision_id: string
  topic_ids: string[]
  difficulty: number
}
export class InsufficientQuestions extends Error {}
// Seeded ordering plus bipartite matching avoids starving overlapping topic slots.
export function assembleExam(
  candidates: Candidate[],
  slots: ExamSlot[],
  seed: string,
) {
  function rank(id: string) {
    let value = 2166136261
    for (const char of seed + ':' + id)
      value = Math.imul(value ^ char.charCodeAt(0), 16777619)
    return value >>> 0
  }
  const unique = [...new Map(candidates.map((c) => [c.id, c])).values()]
  const ranks = new Map(unique.map((c) => [c.id, rank(c.id)]))
  unique.sort(
    (a, b) => ranks.get(a.id)! - ranks.get(b.id)! || a.id.localeCompare(b.id),
  )
  const positions = slots.flatMap((slot) =>
    Array.from({ length: slot.count }, () => slot),
  )
  const eligible = new Map<ExamSlot, Candidate[]>()
  const options = positions.map((slot) => {
    let group = eligible.get(slot)
    if (!group) {
      group = unique.filter(
        (c) =>
          (!slot.topic_id || c.topic_ids.includes(slot.topic_id)) &&
          (!slot.difficulty || c.difficulty === slot.difficulty),
      )
      eligible.set(slot, group)
    }
    return group
  })
  const assigned = new Map<string, number>()
  const selected = new Map<number, Candidate>()
  function place(position: number, seen: Set<string>): boolean {
    // Prefer a free candidate before searching augmenting paths. Common broad
    // slots then avoid repeatedly moving every previously selected question.
    for (const candidate of options[position]!) {
      if (!seen.has(candidate.id) && !assigned.has(candidate.id)) {
        assigned.set(candidate.id, position)
        selected.set(position, candidate)
        return true
      }
    }
    for (const candidate of options[position]!) {
      if (seen.has(candidate.id)) continue
      seen.add(candidate.id)
      const prior = assigned.get(candidate.id)
      if (prior === undefined || place(prior, seen)) {
        assigned.set(candidate.id, position)
        selected.set(position, candidate)
        return true
      }
    }
    return false
  }
  for (const [index] of positions.entries()) {
    if (!place(index, new Set()))
      throw new InsufficientQuestions('insufficient_questions')
  }
  return positions.map((_, index) => selected.get(index)!)
}

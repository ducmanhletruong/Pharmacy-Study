import type { Source } from '../knowledge'
import { validateGenerated } from '../llm'
export function verify(raw: unknown, sources: Source[]) {
  const checked = validateGenerated(raw),
    known = new Map(sources.map((s) => [s.ref, s]))
  const stems = new Set<string>(),
    ids = new Set<string>()
  return checked.map(({ question, citations }) => {
    const stem = question.stem
      .normalize('NFC')
      .trim()
      .toLocaleLowerCase('vi')
      .replace(/\s+/g, ' ')
    if (stems.has(stem) || ids.has(question.external_id))
      throw Error('Duplicate question')
    stems.add(stem)
    ids.add(question.external_id)
    const correct = question.choices.find((c) => c.is_correct)!.text
    // This mode deliberately accepts extractive facts only. Semantic/negative
    // questions still require human review; exact evidence is not a truth proof.
    if (!citations.some((c) => c.quote.includes(correct)))
      throw Error('Correct answer conflicts with extractive evidence')
    for (const citation of citations) {
      const source = known.get(citation.source_ref)
      if (!source || !source.text.includes(citation.quote))
        throw Error('Citation is not present in source')
    }
    if (
      !question.sources.length ||
      question.sources.some(
        (s) =>
          !known.has(s.source_ref) ||
          !citations.some((c) => c.source_ref === s.source_ref),
      )
    )
      throw Error('Missing question source linkage')
    return question
  })
}

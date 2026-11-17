const nonempty = (value) => typeof value === 'string' && value.trim().length > 0
const normalize = (value) =>
  value.trim().normalize('NFC').toLocaleLowerCase('vi')

export function evaluateCandidates(fixtures, candidates) {
  const issues = []
  const knownIds = new Set(fixtures.map((item) => item.id))
  if (!Array.isArray(candidates))
    throw new Error('Candidates must be a JSON array')
  for (const candidate of candidates) {
    if (!knownIds.has(candidate?.fixture_id))
      issues.push('Unknown or missing fixture_id')
  }
  const results = fixtures.map((fixture) => {
    const matches = candidates.filter((item) => item?.fixture_id === fixture.id)
    const errors = []
    if (matches.length !== 1) {
      return {
        fixture_id: fixture.id,
        passed: false,
        errors: ['Need exactly one candidate for this fixture'],
      }
    }
    const candidate = matches[0]
    const choices = Array.isArray(candidate.choices) ? candidate.choices : []
    const validChoices =
      choices.length === 4 &&
      ['A', 'B', 'C', 'D'].every(
        (key) => choices.filter((choice) => choice?.key === key).length === 1,
      ) &&
      choices.every((choice) => nonempty(choice?.text))
    if (!validChoices)
      errors.push('Need four A/B/C/D choices with nonempty text')
    if (
      validChoices &&
      new Set(choices.map((choice) => normalize(choice.text))).size !== 4
    ) {
      errors.push('Duplicate answer text')
    }
    if (!nonempty(candidate.stem) || !nonempty(candidate.explanation)) {
      errors.push('Missing stem or explanation')
    }
    const selected = choices.find(
      (choice) => choice?.key === candidate.correct_answer,
    )
    if (
      !nonempty(selected?.text) ||
      normalize(selected.text) !== normalize(fixture.expected_answer)
    ) {
      errors.push('Selected answer does not match the synthetic source fact')
    }
    const validCitations =
      Array.isArray(candidate.citations) &&
      candidate.citations.length > 0 &&
      candidate.citations.every(
        (citation) =>
          citation?.source_id === fixture.source_id &&
          citation?.location === fixture.source_location &&
          nonempty(citation?.quote) &&
          fixture.source_text.includes(citation.quote),
      )
    const grounded =
      validCitations &&
      candidate.citations.some((citation) =>
        citation.quote.includes(fixture.expected_answer),
      )
    if (!grounded)
      errors.push(
        'Missing exact source quotation and locator supporting the answer',
      )
    return { fixture_id: fixture.id, passed: errors.length === 0, errors }
  })
  return {
    fixture_count: fixtures.length,
    passed_count: results.filter((result) => result.passed).length,
    passed: issues.length === 0 && results.every((result) => result.passed),
    issues,
    results,
    limitation:
      'Synthetic extraction benchmark only; does not establish pharmacology accuracy, difficulty, or a real model/API entitlement.',
  }
}

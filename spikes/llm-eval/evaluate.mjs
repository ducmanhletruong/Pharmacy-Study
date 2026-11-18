const nonempty = (value) => typeof value === 'string' && value.trim().length > 0
const normalize = (value) =>
  value.trim().normalize('NFC').toLocaleLowerCase('vi')

const identifier = (value) => nonempty(value) && !/\s/u.test(value)

export function validateFixtures(fixtures) {
  if (!Array.isArray(fixtures) || fixtures.length === 0)
    throw new Error('Fixtures must be a nonempty JSON array')
  const ids = new Set()
  for (const fixture of fixtures) {
    if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture))
      throw new Error('Each fixture must be an object')
    if (!identifier(fixture.id) || !identifier(fixture.source_id))
      throw new Error(
        'Fixture and source IDs must be nonempty identifiers without whitespace',
      )
    if (ids.has(fixture.id)) throw new Error('Fixture IDs must be unique')
    ids.add(fixture.id)
    for (const field of [
      'subject',
      'source_location',
      'source_text',
      'task',
      'expected_answer',
    ])
      if (!nonempty(fixture[field]))
        throw new Error(`Fixture requires a nonempty ${field}`)
    if (
      !Array.isArray(fixture.distractors) ||
      fixture.distractors.length !== 3 ||
      !fixture.distractors.every(nonempty)
    )
      throw new Error('Fixture requires three nonempty distractors')
    if (
      new Set([fixture.expected_answer, ...fixture.distractors].map(normalize))
        .size !== 4
    )
      throw new Error('Fixture answer and distractors must be distinct')
    if (!fixture.source_text.includes(fixture.expected_answer))
      throw new Error(
        'Fixture source must contain the expected answer verbatim',
      )
  }
}

export function evaluateCandidates(fixtures, candidates) {
  validateFixtures(fixtures)
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

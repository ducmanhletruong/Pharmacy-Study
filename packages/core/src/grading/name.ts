function normalizeTypography(value: string): string {
  return value
    .trim()
    .replace(/[\u2010\u2011\u2012\u2013\u2212]/g, '-')
    .replace(/\s+/gu, ' ')
    .replace(/\s*([,\-])\s*/gu, '$1')
    .replace(/\(\s+/gu, '(')
    .replace(/\s+\)/gu, ')')
}

// Keep the existing normalization for stored answer keys and content hashes.
export function normalizeChemicalName(value: string): string {
  return normalizeTypography(value.normalize('NFC').toLowerCase())
}

export function chemicalNameGradingKey(value: string): string {
  const stereodescriptors =
    /(\((?:\d+[a-z]?)?[RrSsMmPpEZez](?:,(?:\d+[a-z]?)?[RrSsMmPpEZez])*\)(?=-))/gu
  return normalizeTypography(value.normalize('NFC'))
    .split(stereodescriptors)
    .map((part, index) =>
      index % 2 === 0
        ? part.toLowerCase()
        : part.replace(/[EZ]/gu, (letter) => letter.toLowerCase()),
    )
    .join('')
}

// Accepted names are authored individually. Do not infer synonyms or strip stereochemistry.
export function gradeChemicalName(
  submitted: string,
  acceptedNames: readonly string[],
): boolean {
  const normalized = chemicalNameGradingKey(submitted)
  return (
    normalized.length > 0 &&
    acceptedNames.some((name) => chemicalNameGradingKey(name) === normalized)
  )
}

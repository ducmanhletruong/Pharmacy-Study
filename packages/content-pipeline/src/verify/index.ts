import type { Source } from '../knowledge'
import { generatedItems, validateGeneratedItem } from '../llm'
import { bundleTopicLimit } from '@pharmacy/api-contract/bundle'

const normalized = (value: string) =>
  value.normalize('NFC').trim().toLocaleLowerCase('vi').replace(/\s+/g, ' ')
const word = /[\p{L}\p{M}\p{N}\p{Pc}]/u
const numberLiteral = /^[+\-−]?\p{Nd}+(?:[.,]\p{Nd}+)?$/u

function containsLiteral(
  text: string,
  literal: string,
  ignoreCase = false,
): boolean {
  const normalize = ignoreCase
    ? normalized
    : (value: string) => value.normalize('NFC')
  const escaped = normalize(literal).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const boundary = '[\\p{L}\\p{M}\\p{N}\\p{Pc}]'
  const numeric = numberLiteral.test(literal)
  const prefix = numeric ? '(?<![+\\-−])(?<!\\p{Nd}[.,])' : ''
  const suffix = numeric ? '(?![.,]\\p{Nd})' : ''
  return new RegExp(
    '(?<!' +
      boundary +
      ')' +
      prefix +
      escaped +
      '(?!' +
      boundary +
      ')' +
      suffix,
    'u',
  ).test(normalize(text))
}

type Checked = ReturnType<typeof validateGeneratedItem>
type Rejection =
  | 'invalid_question'
  | 'duplicate_question'
  | 'answer_too_short'
  | 'answer_in_stem'
  | 'unverified_citation'
  | 'missing_source_linkage'
  | 'answer_not_supported'
  | 'topic_mismatch'
  | 'topic_limit'

export function verify(
  raw: unknown,
  sources: Source[],
  topicRules?: { allowed: ReadonlySet<string> } | { defaultCode: string },
) {
  const known = new Map(
    sources.map((source) => [source.ref, source.text.normalize('NFC')]),
  )
  const stems = new Set<string>(),
    ids = new Set<string>()
  const topics =
    topicRules && 'allowed' in topicRules ? topicRules.allowed : null
  const flatTopics = new Set(
    topicRules && 'defaultCode' in topicRules ? [topicRules.defaultCode] : [],
  )
  const accepted: Checked['question'][] = []
  const rejected: { index: number; reason: Rejection }[] = []
  for (const [index, item] of generatedItems(raw).entries()) {
    let checked: Checked
    try {
      checked = validateGeneratedItem(item)
    } catch {
      rejected.push({ index: index + 1, reason: 'invalid_question' })
      continue
    }
    const { question, citations } = checked
    const stem = normalized(question.stem)
    const correct = question.choices
      .find((choice) => choice.is_correct)!
      .text.trim()
    const linked = new Set(question.sources.map((source) => source.source_ref))
    const newTopics = topics
      ? []
      : question.topic_codes.filter((code) => !flatTopics.has(code))
    const rejection: Rejection | undefined =
      stems.has(stem) || ids.has(question.external_id)
        ? 'duplicate_question'
        : [...normalized(correct)].filter((char) => word.test(char)).length <
              2 &&
            !numberLiteral.test(correct) &&
            !/^\p{N}+$/u.test(correct)
          ? 'answer_too_short'
          : containsLiteral(question.stem, correct, true)
            ? 'answer_in_stem'
            : citations.some(
                  (citation) =>
                    !known
                      .get(citation.source_ref)
                      ?.includes(citation.quote.normalize('NFC')),
                )
              ? 'unverified_citation'
              : !linked.size ||
                  [...linked].some(
                    (ref) =>
                      !citations.some(
                        (citation) => citation.source_ref === ref,
                      ),
                  )
                ? 'missing_source_linkage'
                : !citations.some(
                      (citation) =>
                        linked.has(citation.source_ref) &&
                        containsLiteral(citation.quote, correct),
                    )
                  ? 'answer_not_supported'
                  : topics &&
                      question.topic_codes.some((code) => !topics.has(code))
                    ? 'topic_mismatch'
                    : flatTopics.size + newTopics.length > bundleTopicLimit
                      ? 'topic_limit'
                      : undefined
    if (rejection) {
      rejected.push({ index: index + 1, reason: rejection })
      continue
    }
    stems.add(stem)
    ids.add(question.external_id)
    for (const code of newTopics) flatTopics.add(code)
    accepted.push(question)
  }
  return { accepted, rejected }
}

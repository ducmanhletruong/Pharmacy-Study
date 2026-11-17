export const labels = ['A', 'B', 'C', 'D'] as const
export type Label = (typeof labels)[number]
export type Choice = { label: Label; text: string; is_correct: boolean }

export function validateChoices(choices: readonly Choice[]) {
  if (
    choices.length !== 4 ||
    labels.some(
      (label) =>
        choices.filter((choice) => choice.label === label).length !== 1,
    ) ||
    choices.some((choice) => !choice.text.trim()) ||
    new Set(
      choices.map((choice) =>
        choice.text.trim().normalize('NFC').toLocaleLowerCase('vi'),
      ),
    ).size !== 4 ||
    choices.filter((choice) => choice.is_correct).length !== 1
  ) {
    throw new Error(
      'MCQ requires four distinct choices and exactly one correct answer',
    )
  }
}
export function gradeMcq(choices: readonly Choice[], answer: Label) {
  validateChoices(choices)
  if (!labels.includes(answer)) throw new Error('Invalid answer label')
  const correct = choices.find((choice) => choice.is_correct)!
  return { is_correct: answer === correct.label, correct_answer: correct.label }
}

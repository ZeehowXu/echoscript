/** Normalize user spelling input for comparison. */
export function normalizeDictationAnswer(value: string): string {
  let answer = value.trim().toLowerCase().replace(/\s+/g, " ");
  answer = answer.replace(/[''`]/g, "'");
  answer = answer.replace(/^[^a-z0-9\s'-]+|[^a-z0-9\s'-]+/g, "");
  return answer.trim().replace(/\s+/g, " ");
}

export function dictationAnswersMatch(
  userInput: string,
  targetText: string,
): boolean {
  return (
    normalizeDictationAnswer(userInput) === normalizeDictationAnswer(targetText)
  );
}

/** Build spaced letter blanks: letters → `_`, keep space / hyphen / apostrophe. */
export function buildLetterHintDisplay(text: string): string {
  const words = text.trim().split(/\s+/);
  return words
    .map((word) =>
      [...word]
        .map((char) => (/[a-zA-Z]/.test(char) ? "_" : char))
        .join(" "),
    )
    .join("   ");
}

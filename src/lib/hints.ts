export function generateWordHint(
  correctText: string,
  revealedCount: number,
): string {
  const words = correctText.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  const revealed = Math.min(Math.max(revealedCount, 0), words.length);
  const parts = words.map((word, index) =>
    index < revealed ? word : "_",
  );
  return parts.join(" ");
}

export function getWordCount(correctText: string): number {
  return correctText.trim().split(/\s+/).filter(Boolean).length;
}

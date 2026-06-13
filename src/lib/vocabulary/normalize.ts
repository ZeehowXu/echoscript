/** Normalize vocabulary text for duplicate matching (import + library lookup). */
export function normalizeVocabularyKey(text: string): string {
  let key = text.trim().toLowerCase().replace(/\s+/g, " ");
  key = key.replace(/[''`]/g, "'");
  key = key.replace(/^[^a-z0-9\s'-]+|[^a-z0-9\s'-]+/g, "");
  return key.trim().replace(/\s+/g, " ");
}

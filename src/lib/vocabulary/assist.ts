import type { VocabularyAssist } from "../../types/vocabulary";
import { VOCABULARY_DICTIONARY } from "../vocabularyDictionary";

export const PLACEHOLDER_MEANING_ZH = "中文释义待生成";
export const TYPO_MEANING_ZH = "中文释义待生存";

export function normalizeVocabularyText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function generateVocabularyAssist(itemText: string): VocabularyAssist {
  const normalized = normalizeVocabularyText(itemText);
  const meaningZh = VOCABULARY_DICTIONARY[normalized];

  return {
    meaningZh: meaningZh || PLACEHOLDER_MEANING_ZH,
    meaningEn: "",
    exampleSentence: "",
  };
}

export function hasDictionaryMeaning(itemText: string): boolean {
  const normalized = normalizeVocabularyText(itemText);
  return Boolean(VOCABULARY_DICTIONARY[normalized]);
}

/** Display text for Show Meaning; never shows the typo placeholder. */
export function getDisplayMeaningZh(meaningZh?: string | null): string {
  const trimmed = meaningZh?.trim() ?? "";
  if (!trimmed || trimmed === TYPO_MEANING_ZH) {
    return PLACEHOLDER_MEANING_ZH;
  }
  return trimmed;
}

export function isPlaceholderMeaning(meaningZh?: string | null): boolean {
  const trimmed = meaningZh?.trim() ?? "";
  return (
    !trimmed ||
    trimmed === PLACEHOLDER_MEANING_ZH ||
    trimmed === TYPO_MEANING_ZH
  );
}

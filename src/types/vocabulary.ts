export type VocabularyItemType = "word" | "phrase" | "collocation";
export type VocabularyReviewResult = "remembered" | "fuzzy" | "forgot";
export type VocabularyLearningStatus =
  | "new"
  | "fuzzy"
  | "remembered"
  | "forgot";
export interface VocabularyExample {
  en: string;
  zh: string;
}

export const VOCABULARY_CATEGORIES = [
  "Economics & Finance",
  "Business & Work",
  "Daily Conversation",
  "Academic & Formal",
  "Fixed Expressions",
  "Emotions & Attitudes",
  "Technology",
  "Other",
] as const;

export type VocabularyCategory = (typeof VOCABULARY_CATEGORIES)[number];

export interface VocabularyItem {
  id: string;
  text: string;
  type: VocabularyItemType;
  category: VocabularyCategory;
  status: VocabularyLearningStatus;
  phonetic?: string;
  meaningZh: string;
  meaningEn?: string;
  examples: VocabularyExample[];
  audio?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VocabularyBatch {
  id: string;
  rawInput: string;
  itemCount: number;
  createdAt: string;
}

/** @deprecated Use VocabularyStatusStats from lib/vocabulary/status */
export interface VocabularyStats {
  total: number;
  newCount: number;
  learning: number;
  remembered: number;
  dueNow: number;
  categories: number;
}

export interface VocabularyAssist {
  meaningZh: string;
  meaningEn?: string;
  exampleSentence?: string;
}

export interface VocabularyClassification {
  type: VocabularyItemType;
  category: VocabularyCategory;
}

export interface VocabularyMemoryState {
  vocabularyId: string;
  reviewCount: number;
  rememberedCount: number;
  fuzzyCount: number;
  forgotCount: number;
  consecutiveRemembered: number;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  memoryStrength: number;
  lastResult?: VocabularyReviewResult;
  createdAt: string;
  updatedAt: string;
}

export interface VocabularyReviewEvent {
  vocabularyId: string;
  result: VocabularyReviewResult;
  replayCount: number;
  reviewedAt: string;
}

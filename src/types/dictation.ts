export type DictationStatus = "pending" | "correct" | "incorrect";

export interface DictationProgressEntry {
  status: DictationStatus;
  attempts: number;
  correctCount: number;
  incorrectCount: number;
  lastAttemptAt?: string;
  updatedAt: string;
}

export type VocabularyDictationProgressMap = Record<
  string,
  DictationProgressEntry
>;

export interface DictationStatusStats {
  total: number;
  pending: number;
  correct: number;
  incorrect: number;
}

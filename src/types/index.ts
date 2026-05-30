export type SentenceStatus = "not_started" | "completed" | "wrong";
export type WrongResult = "wrong" | "correct_after_review";
export type TtsStatus = "idle" | "generating" | "ready" | "failed";
export type TTSProvider = "browser" | "cloud";

export interface Lesson {
  id: string;
  title: string;
  rawText: string;
  sentenceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Sentence {
  id: string;
  lessonId: string;
  order: number;
  textEn: string;
  textZh: string;
  grammarExplanation: string[];
  status: SentenceStatus;
  createdAt: string;
  audioUrl?: string;
  ttsStatus?: TtsStatus;
  voice?: string;
}

export interface Attempt {
  id: string;
  sentenceId: string;
  lessonId: string;
  userInput: string;
  isCorrect: boolean;
  wrongParts: string[];
  hintUsedCount: number;
  replayCount: number;
  createdAt: string;
}

export interface WrongSentence {
  id: string;
  sentenceId: string;
  lessonId: string;
  lessonTitle: string;
  textEn: string;
  textZh: string;
  grammarExplanation: string[];
  latestUserInput: string;
  wrongCount: number;
  lastPracticedAt: string;
  lastResult: WrongResult;
}

export interface CompareResult {
  isCorrect: boolean;
  userTokens: Array<{
    text: string;
    status: "correct" | "wrong" | "extra" | "missing";
  }>;
  wrongParts: string[];
}

export interface SentenceAssist {
  translation_zh: string;
  grammar_explanation: string[];
}

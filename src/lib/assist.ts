import type { SentenceAssist } from "../types";

const PLACEHOLDER_ZH = "中文翻译将在后续版本生成";
const PLACEHOLDER_GRAMMAR = "语法解释将在后续版本生成";

export function generateSentenceAssist(sentenceText: string): SentenceAssist {
  void sentenceText; // reserved for future AI API
  return {
    translation_zh: PLACEHOLDER_ZH,
    grammar_explanation: [PLACEHOLDER_GRAMMAR],
  };
}

export const PLACEHOLDER_TRANSLATION = PLACEHOLDER_ZH;
export const PLACEHOLDER_GRAMMAR_ITEMS = [PLACEHOLDER_GRAMMAR];

import type { Lesson, Sentence } from "../types";
import { generateSentenceAssist } from "./assist";
import { generateId } from "./ids";
import { saveLesson, saveSentences } from "./storage";
import { cleanText, splitTextToTrainingUnits } from "./textUtils";

export function createLessonFromText(
  rawText: string,
  title?: string,
): { lesson: Lesson; sentences: Sentence[] } {
  const cleaned = cleanText(rawText);
  const units = splitTextToTrainingUnits(cleaned);

  if (units.length === 0) {
    throw new Error("NO_UNITS");
  }

  const now = new Date().toISOString();
  const lessonId = generateId();
  const lessonTitle =
    title?.trim() ||
    `训练 ${new Date().toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}`;

  const lesson: Lesson = {
    id: lessonId,
    title: lessonTitle,
    rawText: cleaned,
    sentenceCount: units.length,
    createdAt: now,
    updatedAt: now,
  };

  const sentences: Sentence[] = units.map((textEn, index) => {
    const assist = generateSentenceAssist(textEn);
    return {
      id: generateId(),
      lessonId,
      order: index + 1,
      textEn,
      textZh: assist.translation_zh,
      grammarExplanation: assist.grammar_explanation,
      status: "not_started",
      createdAt: now,
    };
  });

  saveLesson(lesson);
  saveSentences(sentences);

  return { lesson, sentences };
}

import type { Attempt, Lesson, Sentence, WrongSentence } from "../types";

const KEYS = {
  lessons: "english_dictation_lessons",
  sentences: "english_dictation_sentences",
  attempts: "english_dictation_attempts",
  wrongBook: "english_dictation_wrong_book",
} as const;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getLessons(): Lesson[] {
  const lessons = readJson<Lesson[]>(KEYS.lessons, []);
  return lessons.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function saveLesson(lesson: Lesson): void {
  const lessons = readJson<Lesson[]>(KEYS.lessons, []);
  const index = lessons.findIndex((l) => l.id === lesson.id);
  if (index >= 0) {
    lessons[index] = lesson;
  } else {
    lessons.push(lesson);
  }
  writeJson(KEYS.lessons, lessons);
}

export function getLessonById(id: string): Lesson | undefined {
  return readJson<Lesson[]>(KEYS.lessons, []).find((l) => l.id === id);
}

function getAllSentences(): Sentence[] {
  return readJson<Sentence[]>(KEYS.sentences, []);
}

export function getSentencesByLessonId(lessonId: string): Sentence[] {
  return getAllSentences()
    .filter((s) => s.lessonId === lessonId)
    .sort((a, b) => a.order - b.order);
}

export function saveSentences(sentences: Sentence[]): void {
  const all = getAllSentences();
  const ids = new Set(sentences.map((s) => s.id));
  const merged = [...all.filter((s) => !ids.has(s.id)), ...sentences];
  writeJson(KEYS.sentences, merged);
}

export function updateSentence(sentence: Sentence): void {
  const all = getAllSentences();
  const index = all.findIndex((s) => s.id === sentence.id);
  if (index >= 0) {
    all[index] = sentence;
  } else {
    all.push(sentence);
  }
  writeJson(KEYS.sentences, all);
}

export function getSentenceById(id: string): Sentence | undefined {
  return getAllSentences().find((s) => s.id === id);
}

function getAllAttempts(): Attempt[] {
  return readJson<Attempt[]>(KEYS.attempts, []);
}

export function saveAttempt(attempt: Attempt): void {
  const attempts = getAllAttempts();
  attempts.push(attempt);
  writeJson(KEYS.attempts, attempts);
}

export function getAttemptsBySentenceId(sentenceId: string): Attempt[] {
  return getAllAttempts()
    .filter((a) => a.sentenceId === sentenceId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export function getWrongSentences(): WrongSentence[] {
  const items = readJson<WrongSentence[]>(KEYS.wrongBook, []);
  return items.sort(
    (a, b) =>
      new Date(b.lastPracticedAt).getTime() -
      new Date(a.lastPracticedAt).getTime(),
  );
}

export function upsertWrongSentence(wrongSentence: WrongSentence): void {
  const items = readJson<WrongSentence[]>(KEYS.wrongBook, []);
  const index = items.findIndex((w) => w.sentenceId === wrongSentence.sentenceId);
  if (index >= 0) {
    items[index] = wrongSentence;
  } else {
    items.push(wrongSentence);
  }
  writeJson(KEYS.wrongBook, items);
}

export function updateWrongSentence(wrongSentence: WrongSentence): void {
  upsertWrongSentence(wrongSentence);
}

export function getWrongSentenceBySentenceId(
  sentenceId: string,
): WrongSentence | undefined {
  return getWrongSentences().find((w) => w.sentenceId === sentenceId);
}

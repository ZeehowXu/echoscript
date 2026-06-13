import type { VocabularyItem } from "../../types/vocabulary";
import type {
  DictationProgressEntry,
  DictationStatus,
  DictationStatusStats,
  VocabularyDictationProgressMap,
} from "../../types/dictation";
import {
  collectLocalDictationProgressNotInCloud,
  loadDictationProgressFromCloud,
  mergeLocalAndCloudDictationProgress,
  upsertDictationProgressToCloud,
} from "./dictationCloudSync";
import { getVocabularyItems } from "../vocabularyStorage";

const KEY = "echoscript_vocabulary_dictation_progress";

function nowIso(): string {
  return new Date().toISOString();
}

function readProgressMap(): VocabularyDictationProgressMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as VocabularyDictationProgressMap;
  } catch {
    return {};
  }
}

function writeProgressMap(map: VocabularyDictationProgressMap): void {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function getDictationProgressMap(): VocabularyDictationProgressMap {
  return readProgressMap();
}

export function getDictationProgress(
  vocabularyId: string,
): DictationProgressEntry | undefined {
  return readProgressMap()[vocabularyId];
}

export function getEffectiveDictationStatus(
  vocabularyId: string,
): DictationStatus {
  return getDictationProgress(vocabularyId)?.status ?? "pending";
}

export function recordDictationAttempt(
  vocabularyId: string,
  correct: boolean,
): DictationProgressEntry {
  const map = readProgressMap();
  const prev = map[vocabularyId];
  const now = nowIso();

  const next: DictationProgressEntry = {
    status: correct ? "correct" : "incorrect",
    attempts: (prev?.attempts ?? 0) + 1,
    correctCount: (prev?.correctCount ?? 0) + (correct ? 1 : 0),
    incorrectCount: (prev?.incorrectCount ?? 0) + (correct ? 0 : 1),
    lastAttemptAt: now,
    updatedAt: now,
  };

  map[vocabularyId] = next;
  writeProgressMap(map);
  return next;
}

export function getDictationStatusStats(
  items: VocabularyItem[],
): DictationStatusStats {
  const map = readProgressMap();
  const stats = { pending: 0, correct: 0, incorrect: 0 };

  for (const item of items) {
    const status = map[item.id]?.status ?? "pending";
    stats[status] += 1;
  }

  return {
    total: items.length,
    ...stats,
  };
}

const DICTATION_PRIORITY: Record<DictationStatus, number> = {
  incorrect: 0,
  pending: 1,
  correct: 2,
};

export function getDictationPracticeQueue(
  items: VocabularyItem[],
): VocabularyItem[] {
  const map = readProgressMap();

  return [...items].sort((a, b) => {
    const sa = map[a.id]?.status ?? "pending";
    const sb = map[b.id]?.status ?? "pending";
    const pa = DICTATION_PRIORITY[sa];
    const pb = DICTATION_PRIORITY[sb];
    if (pa !== pb) return pa - pb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function formatDictationPercent(count: number, total: number): string {
  if (total === 0) return "0%";
  return `${((count / total) * 100).toFixed(1)}%`;
}

/** Load cloud dictation progress, merge into localStorage (cloud wins). */
export async function syncDictationProgressFromCloud(
  userId: string,
): Promise<void> {
  const cloudProgress = await loadDictationProgressFromCloud(userId);
  const localProgress = readProgressMap();
  const items = getVocabularyItems();

  const merged = mergeLocalAndCloudDictationProgress(
    localProgress,
    cloudProgress,
    items,
  );

  writeProgressMap(merged);

  const toUpload = collectLocalDictationProgressNotInCloud(
    merged,
    cloudProgress,
    items,
  );

  await Promise.all(
    toUpload.map((entry) =>
      upsertDictationProgressToCloud({ userId, ...entry }),
    ),
  );
}

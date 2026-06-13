import type { VocabularyItem } from "../../types/vocabulary";
import type {
  DictationProgressEntry,
  DictationStatus,
  VocabularyDictationProgressMap,
} from "../../types/dictation";
import { supabase } from "../supabase";
import { normalizeVocabularyKey } from "./normalize";

export interface DictationProgress {
  vocabulary_key: string;
  status: DictationStatus;
  attempts: number;
  correct_count: number;
  incorrect_count: number;
  last_attempt_at: string | null;
}

export interface UpsertDictationProgressParams {
  userId: string;
  vocabulary_key: string;
  status: DictationStatus;
  attempts: number;
  correct_count: number;
  incorrect_count: number;
  last_attempt_at: string | null;
}

type CloudDictationRow = {
  vocabulary_key: string;
  status: string;
  attempts: number;
  correct_count: number;
  incorrect_count: number;
  last_attempt_at: string | null;
};

function normalizeDictationStatus(value: string): DictationStatus {
  if (value === "correct" || value === "incorrect" || value === "pending") {
    return value;
  }
  return "pending";
}

function rowToDictationProgress(row: CloudDictationRow): DictationProgress {
  return {
    vocabulary_key: row.vocabulary_key,
    status: normalizeDictationStatus(row.status),
    attempts: row.attempts,
    correct_count: row.correct_count,
    incorrect_count: row.incorrect_count,
    last_attempt_at: row.last_attempt_at,
  };
}

function cloudToLocalEntry(cloud: DictationProgress): DictationProgressEntry {
  const updatedAt = cloud.last_attempt_at ?? new Date().toISOString();
  return {
    status: cloud.status,
    attempts: cloud.attempts,
    correctCount: cloud.correct_count,
    incorrectCount: cloud.incorrect_count,
    lastAttemptAt: cloud.last_attempt_at ?? undefined,
    updatedAt,
  };
}

export async function loadDictationProgressFromCloud(
  userId: string,
): Promise<Record<string, DictationProgress>> {
  const { data, error } = await supabase
    .from("vocabulary_dictation_progress")
    .select(
      "vocabulary_key, status, attempts, correct_count, incorrect_count, last_attempt_at",
    )
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  const map: Record<string, DictationProgress> = {};
  for (const row of (data ?? []) as CloudDictationRow[]) {
    map[row.vocabulary_key] = rowToDictationProgress(row);
  }
  return map;
}

export async function upsertDictationProgressToCloud(
  params: UpsertDictationProgressParams,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("vocabulary_dictation_progress").upsert(
    {
      user_id: params.userId,
      vocabulary_key: params.vocabulary_key,
      status: params.status,
      attempts: params.attempts,
      correct_count: params.correct_count,
      incorrect_count: params.incorrect_count,
      last_attempt_at: params.last_attempt_at,
      updated_at: now,
    },
    { onConflict: "user_id,vocabulary_key" },
  );

  if (error) {
    throw error;
  }
}

export function mergeLocalAndCloudDictationProgress(
  localProgress: VocabularyDictationProgressMap,
  cloudProgress: Record<string, DictationProgress>,
  items: VocabularyItem[],
): VocabularyDictationProgressMap {
  const merged: VocabularyDictationProgressMap = { ...localProgress };

  for (const item of items) {
    const key = normalizeVocabularyKey(item.text);
    const cloud = cloudProgress[key];
    if (!cloud) continue;
    merged[item.id] = cloudToLocalEntry(cloud);
  }

  return merged;
}

export function collectLocalDictationProgressNotInCloud(
  localProgress: VocabularyDictationProgressMap,
  cloudProgress: Record<string, DictationProgress>,
  items: VocabularyItem[],
): Omit<UpsertDictationProgressParams, "userId">[] {
  const uploads: Omit<UpsertDictationProgressParams, "userId">[] = [];

  for (const item of items) {
    const key = normalizeVocabularyKey(item.text);
    if (cloudProgress[key]) continue;

    const local = localProgress[item.id];
    if (!local || local.status === "pending") continue;

    uploads.push({
      vocabulary_key: key,
      status: local.status,
      attempts: local.attempts,
      correct_count: local.correctCount,
      incorrect_count: local.incorrectCount,
      last_attempt_at: local.lastAttemptAt ?? null,
    });
  }

  return uploads;
}

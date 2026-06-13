import type {
  VocabularyItem,
  VocabularyLearningStatus,
  VocabularyMemoryState,
  VocabularyReviewResult,
} from "../../types/vocabulary";
import { supabase } from "../supabase";
import { normalizeVocabularyKey } from "./normalize";
import { normalizeVocabularyStatus } from "./status";

export interface ReviewProgress {
  vocabulary_key: string;
  status: VocabularyLearningStatus;
  review_count: number;
  last_reviewed_at: string | null;
}

export interface UpsertReviewProgressParams {
  userId: string;
  vocabulary_key: string;
  status: VocabularyLearningStatus;
  review_count: number;
  last_reviewed_at: string | null;
}

type CloudReviewRow = {
  vocabulary_key: string;
  status: string;
  review_count: number;
  last_reviewed_at: string | null;
};

function rowToReviewProgress(row: CloudReviewRow): ReviewProgress {
  return {
    vocabulary_key: row.vocabulary_key,
    status: normalizeVocabularyStatus(row.status),
    review_count: row.review_count,
    last_reviewed_at: row.last_reviewed_at,
  };
}

export async function loadReviewProgressFromCloud(
  userId: string,
): Promise<Record<string, ReviewProgress>> {
  const { data, error } = await supabase
    .from("vocabulary_review_progress")
    .select("vocabulary_key, status, review_count, last_reviewed_at")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  const map: Record<string, ReviewProgress> = {};
  for (const row of (data ?? []) as CloudReviewRow[]) {
    map[row.vocabulary_key] = rowToReviewProgress(row);
  }
  return map;
}

export async function upsertReviewProgressToCloud(
  params: UpsertReviewProgressParams,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("vocabulary_review_progress").upsert(
    {
      user_id: params.userId,
      vocabulary_key: params.vocabulary_key,
      status: params.status,
      review_count: params.review_count,
      last_reviewed_at: params.last_reviewed_at,
      updated_at: now,
    },
    { onConflict: "user_id,vocabulary_key" },
  );

  if (error) {
    throw error;
  }
}

function defaultMemoryStateForItem(
  item: VocabularyItem,
  existing?: VocabularyMemoryState,
): VocabularyMemoryState {
  const now = new Date().toISOString();
  return (
    existing ?? {
      vocabularyId: item.id,
      reviewCount: 0,
      rememberedCount: 0,
      fuzzyCount: 0,
      forgotCount: 0,
      consecutiveRemembered: 0,
      memoryStrength: 0,
      createdAt: now,
      updatedAt: now,
    }
  );
}

export function mergeLocalAndCloudReviewProgress(
  localItems: VocabularyItem[],
  localMemoryStates: VocabularyMemoryState[],
  cloudProgress: Record<string, ReviewProgress>,
): { items: VocabularyItem[]; memoryStates: VocabularyMemoryState[] } {
  const memoryById = new Map(
    localMemoryStates.map((state) => [state.vocabularyId, state]),
  );

  const items = localItems.map((item) => {
    const key = normalizeVocabularyKey(item.text);
    const cloud = cloudProgress[key];
    if (!cloud) return item;

    return {
      ...item,
      status: cloud.status,
      updatedAt: cloud.last_reviewed_at ?? item.updatedAt,
    };
  });

  for (const item of items) {
    const key = normalizeVocabularyKey(item.text);
    const cloud = cloudProgress[key];
    if (!cloud) continue;

    const prev = defaultMemoryStateForItem(item, memoryById.get(item.id));
    const lastResult =
      cloud.status === "new"
        ? undefined
        : (cloud.status as VocabularyReviewResult);

    memoryById.set(item.id, {
      ...prev,
      reviewCount: cloud.review_count,
      lastReviewedAt: cloud.last_reviewed_at ?? undefined,
      lastResult,
      updatedAt: cloud.last_reviewed_at ?? prev.updatedAt,
    });
  }

  return {
    items,
    memoryStates: [...memoryById.values()],
  };
}

export function collectLocalReviewProgressNotInCloud(
  localItems: VocabularyItem[],
  localMemoryStates: VocabularyMemoryState[],
  cloudProgress: Record<string, ReviewProgress>,
): Omit<UpsertReviewProgressParams, "userId">[] {
  const memoryById = new Map(
    localMemoryStates.map((state) => [state.vocabularyId, state]),
  );
  const uploads: Omit<UpsertReviewProgressParams, "userId">[] = [];

  for (const item of localItems) {
    const key = normalizeVocabularyKey(item.text);
    if (item.status === "new") continue;
    if (cloudProgress[key]) continue;

    const memory = memoryById.get(item.id);
    uploads.push({
      vocabulary_key: key,
      status: item.status,
      review_count: memory?.reviewCount ?? 1,
      last_reviewed_at: memory?.lastReviewedAt ?? null,
    });
  }

  return uploads;
}

import type {
  VocabularyBatch,
  VocabularyCategory,
  VocabularyItem,
  VocabularyMemoryState,
  VocabularyReviewEvent,
  VocabularyReviewResult,
  VocabularyStats,
} from "../types/vocabulary";
import type { VocabularyDictationProgressMap } from "../types/dictation";
import {
  generateVocabularyAssist,
  isPlaceholderMeaning,
  PLACEHOLDER_MEANING_ZH,
  TYPO_MEANING_ZH,
} from "./vocabulary/assist";
import { normalizeVocabularyKey } from "./vocabulary/normalize";
import {
  mergeBuiltInCardsWithLocalState,
  remapDictationProgressForBuiltInItems,
} from "./vocabulary/builtinMerge";
import type { ParsedVocabularyCard } from "./vocabulary/service";
import {
  collectLocalReviewProgressNotInCloud,
  loadReviewProgressFromCloud,
  mergeLocalAndCloudReviewProgress,
  upsertReviewProgressToCloud,
} from "./vocabulary/reviewCloudSync";
import {
  getVocabularyStatusStats,
  normalizeVocabularyStatus,
  statusReviewPriority,
  type VocabularyLearningStatus,
} from "./vocabulary/status";

const KEYS = {
  items: "echoscript_vocabulary_items",
  batches: "echoscript_vocabulary_batches",
  memoryStates: "echoscript_vocabulary_memory_states",
  reviewEvents: "echoscript_vocabulary_review_events",
  dictationProgress: "echoscript_vocabulary_dictation_progress",
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

function nowIso(): string {
  return new Date().toISOString();
}

function clampMemoryStrength(value: number): number {
  return Math.max(0, Math.min(5, value));
}

function addMinutes(baseIso: string, minutes: number): string {
  const d = new Date(baseIso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function addDays(baseIso: string, days: number): string {
  const d = new Date(baseIso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function rememberedIntervalDays(consecutiveRemembered: number): number {
  if (consecutiveRemembered <= 1) return 1;
  if (consecutiveRemembered === 2) return 3;
  if (consecutiveRemembered === 3) return 7;
  if (consecutiveRemembered === 4) return 14;
  return 30;
}

function resolveItemStatus(
  rawStatus: unknown,
  memory?: VocabularyMemoryState,
): VocabularyLearningStatus {
  if (
    rawStatus !== undefined &&
    rawStatus !== null &&
    (typeof rawStatus !== "string" || rawStatus.trim() !== "")
  ) {
    return normalizeVocabularyStatus(rawStatus);
  }
  if (memory && memory.reviewCount > 0 && memory.lastResult) {
    return normalizeVocabularyStatus(memory.lastResult);
  }
  return "new";
}

function repairVocabularyItem(item: VocabularyItem): {
  item: VocabularyItem;
  changed: boolean;
} {
  let meaningZh = item.meaningZh?.trim() ?? "";
  let changed = false;

  if (meaningZh === TYPO_MEANING_ZH) {
    meaningZh = PLACEHOLDER_MEANING_ZH;
    changed = true;
  }

  if (isPlaceholderMeaning(meaningZh)) {
    const assist = generateVocabularyAssist(item.text);
    if (!isPlaceholderMeaning(assist.meaningZh)) {
      meaningZh = assist.meaningZh;
      changed = true;
    } else if (!meaningZh) {
      meaningZh = PLACEHOLDER_MEANING_ZH;
      changed = true;
    }
  }

  const normalizedExamples = Array.isArray(item.examples)
    ? item.examples
        .map((example) => {
          if (typeof example === "string") {
            return { en: example, zh: "" };
          }
          if (
            example &&
            typeof example === "object" &&
            "en" in example &&
            "zh" in example
          ) {
            return { en: String(example.en), zh: String(example.zh) };
          }
          return null;
        })
        .filter((e): e is { en: string; zh: string } => e !== null)
    : [];

  if (
    !changed &&
    meaningZh === item.meaningZh &&
    normalizedExamples.length === item.examples.length
  ) {
    return { item, changed: false };
  }

  return {
    item: {
      ...item,
      meaningZh,
      examples: normalizedExamples,
      updatedAt: nowIso(),
    },
    changed: true,
  };
}

function loadAndRepairItems(): VocabularyItem[] {
  const raw = readJson<Array<VocabularyItem & { status?: unknown }>>(KEYS.items, []);
  const memoryById = new Map(
    readJson<VocabularyMemoryState[]>(KEYS.memoryStates, []).map((s) => [
      s.vocabularyId,
      s,
    ]),
  );
  let anyChanged = false;

  const repaired = raw.map((rawItem) => {
    const normalizedExamples = Array.isArray(rawItem.examples)
      ? rawItem.examples
      : [];
    const status = resolveItemStatus(rawItem.status, memoryById.get(rawItem.id));
    const item: VocabularyItem = {
      id: rawItem.id,
      text: rawItem.text,
      type: rawItem.type,
      category: rawItem.category,
      status,
      phonetic: rawItem.phonetic,
      meaningZh: rawItem.meaningZh,
      meaningEn: rawItem.meaningEn,
      examples: normalizedExamples,
      audio: rawItem.audio,
      createdAt: rawItem.createdAt,
      updatedAt: rawItem.updatedAt,
    };
    const { item: fixed, changed: meaningChanged } = repairVocabularyItem(item);
    const statusChanged = fixed.status !== status;
    if (meaningChanged || statusChanged) anyChanged = true;
    return fixed;
  });

  if (anyChanged) {
    writeJson(KEYS.items, repaired);
  }
  return repaired;
}

export function readVocabularyItemsRaw(): VocabularyItem[] {
  return loadAndRepairItems();
}

export function readVocabularyMemoryStatesRaw(): VocabularyMemoryState[] {
  return readJson<VocabularyMemoryState[]>(KEYS.memoryStates, []);
}

export function reconcileVocabularyWithBuiltInSource(
  builtInCards: ParsedVocabularyCard[],
): number {
  const previousItems = loadAndRepairItems();
  const previousMemory = readJson<VocabularyMemoryState[]>(KEYS.memoryStates, []);
  const previousDictation = readJson<VocabularyDictationProgressMap>(
    KEYS.dictationProgress,
    {},
  );

  const { items, memoryStates } = mergeBuiltInCardsWithLocalState(
    builtInCards,
    previousItems,
    previousMemory,
  );

  writeJson(KEYS.items, items);
  writeJson(KEYS.memoryStates, memoryStates);

  const remappedDictation = remapDictationProgressForBuiltInItems(
    items,
    previousItems,
    previousDictation,
  );
  writeJson(KEYS.dictationProgress, remappedDictation);

  return items.length;
}

function defaultMemoryState(vocabularyId: string): VocabularyMemoryState {
  const now = nowIso();
  return {
    vocabularyId,
    reviewCount: 0,
    rememberedCount: 0,
    fuzzyCount: 0,
    forgotCount: 0,
    consecutiveRemembered: 0,
    memoryStrength: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function getVocabularyItems(): VocabularyItem[] {
  return loadAndRepairItems().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function saveVocabularyItems(items: VocabularyItem[]): void {
  writeJson(KEYS.items, items);
}

export function createVocabularyItems(items: VocabularyItem[]): void {
  const existing = getVocabularyItems();
  saveVocabularyItems([...existing, ...items]);
}

export function getVocabularyByNormalizedText(
  text: string,
): VocabularyItem | undefined {
  const key = normalizeVocabularyKey(text);
  return getVocabularyItems().find(
    (item) => normalizeVocabularyKey(item.text) === key,
  );
}

export function getVocabularyItemById(id: string): VocabularyItem | undefined {
  return getVocabularyItems().find((item) => item.id === id);
}

export function updateVocabularyItem(item: VocabularyItem): void {
  const items = getVocabularyItems();
  const index = items.findIndex((i) => i.id === item.id);
  if (index >= 0) items[index] = item;
  else items.push(item);
  saveVocabularyItems(items);
}

export function addVocabularyItems(
  newItems: VocabularyItem[],
): { added: VocabularyItem[]; skipped: number } {
  const existing = loadAndRepairItems();
  const existingKeys = new Set(
    existing.map((i) => normalizeVocabularyKey(i.text)),
  );

  const added: VocabularyItem[] = [];
  let skipped = 0;

  for (const item of newItems) {
    const key = normalizeVocabularyKey(item.text);
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    existingKeys.add(key);
    added.push(item);
  }

  if (added.length > 0) {
    saveVocabularyItems([...existing, ...added]);
    const states = getVocabularyMemoryStates();
    for (const item of added) {
      states.push(defaultMemoryState(item.id));
    }
    saveVocabularyMemoryStates(states);
  }

  return { added, skipped };
}

export function bulkUpsertVocabularyFromImport(
  newItems: VocabularyItem[],
  updatedItems: VocabularyItem[],
): void {
  const existing = loadAndRepairItems();
  const byId = new Map(existing.map((item) => [item.id, item]));

  for (const item of updatedItems) {
    byId.set(item.id, item);
  }

  saveVocabularyItems([...byId.values(), ...newItems]);
}

export function getVocabularyItemsByCategory(
  category: VocabularyCategory,
): VocabularyItem[] {
  return getVocabularyItems().filter((item) => item.category === category);
}

export function getVocabularyBatches(): VocabularyBatch[] {
  return readJson<VocabularyBatch[]>(KEYS.batches, []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function addVocabularyBatch(batch: VocabularyBatch): void {
  const batches = getVocabularyBatches();
  batches.push(batch);
  writeJson(KEYS.batches, batches);
}

export function getVocabularyMemoryStates(): VocabularyMemoryState[] {
  const items = getVocabularyItems();
  const raw = readJson<VocabularyMemoryState[]>(KEYS.memoryStates, []);
  const byId = new Map(raw.map((s) => [s.vocabularyId, s]));
  let changed = false;

  for (const item of items) {
    if (!byId.has(item.id)) {
      byId.set(item.id, defaultMemoryState(item.id));
      changed = true;
    }
  }

  const validIds = new Set(items.map((i) => i.id));
  for (const id of byId.keys()) {
    if (!validIds.has(id)) {
      byId.delete(id);
      changed = true;
    }
  }

  const normalized = [...byId.values()].map((state) => {
    if (!state.createdAt || !state.updatedAt) {
      changed = true;
      const now = nowIso();
      return {
        ...state,
        createdAt: state.createdAt ?? now,
        updatedAt: state.updatedAt ?? now,
      };
    }
    return state;
  });

  if (changed) writeJson(KEYS.memoryStates, normalized);
  return normalized;
}

export function saveVocabularyMemoryStates(
  states: VocabularyMemoryState[],
): void {
  writeJson(KEYS.memoryStates, states);
}

export function createMemoryStateForVocabulary(vocabularyId: string): void {
  const states = getVocabularyMemoryStates();
  if (states.some((s) => s.vocabularyId === vocabularyId)) return;
  states.push(defaultMemoryState(vocabularyId));
  saveVocabularyMemoryStates(states);
}

export function getVocabularyMemoryStateById(
  vocabularyId: string,
): VocabularyMemoryState {
  return (
    getVocabularyMemoryStates().find((s) => s.vocabularyId === vocabularyId) ??
    defaultMemoryState(vocabularyId)
  );
}

export function upsertVocabularyMemoryState(state: VocabularyMemoryState): void {
  const states = getVocabularyMemoryStates();
  const index = states.findIndex((s) => s.vocabularyId === state.vocabularyId);
  if (index >= 0) states[index] = state;
  else states.push(state);
  saveVocabularyMemoryStates(states);
}

export function getVocabularyReviewEvents(): VocabularyReviewEvent[] {
  return readJson<VocabularyReviewEvent[]>(KEYS.reviewEvents, []).sort(
    (a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime(),
  );
}

export function saveVocabularyReviewEvent(event: VocabularyReviewEvent): void {
  const events = getVocabularyReviewEvents();
  events.push(event);
  writeJson(KEYS.reviewEvents, events);
}

export function recordVocabularyReview(
  vocabularyId: string,
  result: VocabularyReviewResult,
  replayCount: number,
): VocabularyMemoryState {
  const now = nowIso();
  const prev = getVocabularyMemoryStateById(vocabularyId);
  const next: VocabularyMemoryState = {
    ...prev,
    reviewCount: prev.reviewCount + 1,
    rememberedCount:
      prev.rememberedCount + (result === "remembered" ? 1 : 0),
    fuzzyCount: prev.fuzzyCount + (result === "fuzzy" ? 1 : 0),
    forgotCount: prev.forgotCount + (result === "forgot" ? 1 : 0),
    consecutiveRemembered:
      result === "remembered" ? prev.consecutiveRemembered + 1 : 0,
    lastReviewedAt: now,
    lastResult: result,
    updatedAt: now,
    memoryStrength:
      result === "remembered"
        ? clampMemoryStrength(prev.memoryStrength + 1)
        : result === "fuzzy"
          ? clampMemoryStrength(prev.memoryStrength - 0.5)
          : clampMemoryStrength(prev.memoryStrength - 1),
  };

  if (result === "forgot") next.nextReviewAt = addMinutes(now, 1);
  else if (result === "fuzzy") next.nextReviewAt = addMinutes(now, 5);
  else {
    next.nextReviewAt = addDays(
      now,
      rememberedIntervalDays(next.consecutiveRemembered),
    );
  }

  upsertVocabularyMemoryState(next);

  const item = getVocabularyItemById(vocabularyId);
  if (item) {
    updateVocabularyItem({
      ...item,
      status: normalizeVocabularyStatus(result),
      updatedAt: now,
    });
  }

  saveVocabularyReviewEvent({
    vocabularyId,
    result,
    replayCount,
    reviewedAt: now,
  });
  return next;
}

/** @deprecated Use getVocabularyStatusStats from ./vocabulary/status */
export function getVocabularyStats(): VocabularyStats {
  const statusStats = getVocabularyStatusStats(getVocabularyItems());
  return {
    total: statusStats.total,
    newCount: statusStats.new,
    learning: statusStats.fuzzy,
    remembered: statusStats.remembered,
    dueNow: statusStats.forgot + statusStats.fuzzy,
    categories: 0,
  };
}

export { getVocabularyStatusStats } from "./vocabulary/status";

export function getReviewQueue(): VocabularyItem[] {
  const items = getVocabularyItems();

  return [...items].sort((a, b) => {
    const pa = statusReviewPriority(normalizeVocabularyStatus(a.status));
    const pb = statusReviewPriority(normalizeVocabularyStatus(b.status));
    if (pa !== pb) return pa - pb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function getVocabularyMemoryStateMap(): Map<string, VocabularyMemoryState> {
  return new Map(getVocabularyMemoryStates().map((s) => [s.vocabularyId, s]));
}

export function groupItemsByCategory(
  items: VocabularyItem[],
): Map<VocabularyCategory, VocabularyItem[]> {
  const map = new Map<VocabularyCategory, VocabularyItem[]>();
  for (const item of items) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  return map;
}

/** Load cloud review progress, merge into localStorage (cloud wins). */
export async function syncReviewProgressFromCloud(userId: string): Promise<void> {
  const cloudProgress = await loadReviewProgressFromCloud(userId);
  const localItems = loadAndRepairItems();
  const localMemory = readJson<VocabularyMemoryState[]>(KEYS.memoryStates, []);

  const { items, memoryStates } = mergeLocalAndCloudReviewProgress(
    localItems,
    localMemory,
    cloudProgress,
  );

  saveVocabularyItems(items);
  saveVocabularyMemoryStates(memoryStates);

  const toUpload = collectLocalReviewProgressNotInCloud(
    items,
    memoryStates,
    cloudProgress,
  );

  await Promise.all(
    toUpload.map((entry) =>
      upsertReviewProgressToCloud({ userId, ...entry }),
    ),
  );
}

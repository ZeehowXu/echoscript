import type {
  VocabularyBatch,
  VocabularyCategory,
  VocabularyItem,
  VocabularyMemoryState,
  VocabularyReviewEvent,
  VocabularyReviewResult,
  VocabularyStats,
} from "../types/vocabulary";
import {
  generateVocabularyAssist,
  isPlaceholderMeaning,
  PLACEHOLDER_MEANING_ZH,
  TYPO_MEANING_ZH,
} from "./vocabulary/assist";
import { normalizeVocabularyKey } from "./vocabulary/normalize";

const KEYS = {
  items: "echoscript_vocabulary_items",
  batches: "echoscript_vocabulary_batches",
  memoryStates: "echoscript_vocabulary_memory_states",
  reviewEvents: "echoscript_vocabulary_review_events",
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
  const raw = readJson<VocabularyItem[]>(KEYS.items, []);
  let anyChanged = false;

  const repaired = raw.map((rawItem) => {
    const normalizedExamples = Array.isArray((rawItem as VocabularyItem).examples)
      ? (rawItem as VocabularyItem).examples
      : [];
    const item: VocabularyItem = {
      id: rawItem.id,
      text: rawItem.text,
      type: rawItem.type,
      category: rawItem.category,
      phonetic: (rawItem as VocabularyItem).phonetic,
      meaningZh: rawItem.meaningZh,
      meaningEn: rawItem.meaningEn,
      examples: normalizedExamples,
      audio: rawItem.audio,
      createdAt: rawItem.createdAt,
      updatedAt: rawItem.updatedAt,
    };
    const { item: fixed, changed } = repairVocabularyItem(item);
    if (changed) anyChanged = true;
    return fixed;
  });

  if (anyChanged) {
    writeJson(KEYS.items, repaired);
  }
  return repaired;
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
  saveVocabularyReviewEvent({
    vocabularyId,
    result,
    replayCount,
    reviewedAt: now,
  });
  return next;
}

export function getVocabularyStats(): VocabularyStats {
  const items = getVocabularyItems();
  const states = getVocabularyMemoryStates();
  const categories = new Set(items.map((i) => i.category));
  const stateMap = new Map(states.map((s) => [s.vocabularyId, s]));
  const now = Date.now();

  let newCount = 0;
  let learning = 0;
  let remembered = 0;
  let dueNow = 0;

  for (const item of items) {
    const state = stateMap.get(item.id) ?? defaultMemoryState(item.id);
    if (state.reviewCount === 0) {
      newCount += 1;
    }
    if (state.nextReviewAt && new Date(state.nextReviewAt).getTime() <= now) {
      dueNow += 1;
    }
    if (state.consecutiveRemembered >= 2) {
      remembered += 1;
    } else if (
      state.reviewCount > 0 &&
      state.fuzzyCount + state.forgotCount >= state.rememberedCount
    ) {
      learning += 1;
    }
  }

  return {
    total: items.length,
    newCount,
    learning,
    remembered,
    dueNow,
    categories: categories.size,
  };
}

export function getReviewQueue(): VocabularyItem[] {
  const items = getVocabularyItems();
  const states = getVocabularyMemoryStates();
  const stateMap = new Map(states.map((s) => [s.vocabularyId, s]));
  const now = Date.now();

  const bucket = (state: VocabularyMemoryState): number => {
    const nextAt = state.nextReviewAt ? new Date(state.nextReviewAt).getTime() : 0;
    if (state.nextReviewAt && nextAt <= now) return 0;
    if (state.reviewCount === 0) return 1;
    if (state.forgotCount + state.fuzzyCount > state.rememberedCount) return 2;
    return 3;
  };

  return [...items].sort((a, b) => {
    const sa = stateMap.get(a.id) ?? defaultMemoryState(a.id);
    const sb = stateMap.get(b.id) ?? defaultMemoryState(b.id);
    const ba = bucket(sa);
    const bb = bucket(sb);
    if (ba !== bb) return ba - bb;
    if ((sa.memoryStrength ?? 0) !== (sb.memoryStrength ?? 0)) {
      return (sa.memoryStrength ?? 0) - (sb.memoryStrength ?? 0);
    }
    const na = sa.nextReviewAt ? new Date(sa.nextReviewAt).getTime() : 0;
    const nb = sb.nextReviewAt ? new Date(sb.nextReviewAt).getTime() : 0;
    if (na !== nb) return na - nb;
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

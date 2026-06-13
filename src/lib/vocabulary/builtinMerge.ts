import type { VocabularyItem, VocabularyMemoryState } from "../../types/vocabulary";
import type { VocabularyDictationProgressMap } from "../../types/dictation";
import { generateId } from "../ids";
import { normalizeVocabularyKey } from "./normalize";
import type { ParsedVocabularyCard } from "./service";
import { normalizeVocabularyStatus } from "./status";

function nowIso(): string {
  return new Date().toISOString();
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

function resolveLocalItemStatus(
  item: VocabularyItem | undefined,
  memory: VocabularyMemoryState | undefined,
): VocabularyItem["status"] {
  if (item) {
    return normalizeVocabularyStatus(item.status);
  }
  if (memory && memory.reviewCount > 0 && memory.lastResult) {
    return normalizeVocabularyStatus(memory.lastResult);
  }
  return "new";
}

export function mergeBuiltInCardsWithLocalState(
  builtInCards: ParsedVocabularyCard[],
  localItems: VocabularyItem[],
  localMemoryStates: VocabularyMemoryState[],
): { items: VocabularyItem[]; memoryStates: VocabularyMemoryState[] } {
  const localByKey = new Map<string, VocabularyItem>();
  for (const item of localItems) {
    localByKey.set(normalizeVocabularyKey(item.text), item);
  }

  const memoryById = new Map(
    localMemoryStates.map((state) => [state.vocabularyId, state]),
  );

  const now = nowIso();
  const items: VocabularyItem[] = [];
  const memoryStates: VocabularyMemoryState[] = [];

  for (const card of builtInCards) {
    const existing = localByKey.get(card.normalizedText);
    const memory = existing ? memoryById.get(existing.id) : undefined;
    const status = resolveLocalItemStatus(existing, memory);

    const item: VocabularyItem = {
      id: existing?.id ?? generateId(),
      text: card.text,
      type: card.type,
      category: card.category,
      status,
      phonetic: card.phonetic,
      meaningZh: card.meaningZh,
      meaningEn: existing?.meaningEn ?? "",
      examples: card.examples,
      audio: existing?.audio ?? "",
      createdAt: existing?.createdAt ?? now,
      updatedAt: existing?.updatedAt ?? now,
    };

    items.push(item);
    memoryStates.push(
      memory
        ? { ...memory, vocabularyId: item.id }
        : defaultMemoryState(item.id),
    );
  }

  return { items, memoryStates };
}

export function remapDictationProgressForBuiltInItems(
  newItems: VocabularyItem[],
  previousItems: VocabularyItem[],
  previousProgress: VocabularyDictationProgressMap,
): VocabularyDictationProgressMap {
  const oldIdToKey = new Map(
    previousItems.map((item) => [
      item.id,
      normalizeVocabularyKey(item.text),
    ]),
  );
  const newKeyToId = new Map(
    newItems.map((item) => [normalizeVocabularyKey(item.text), item.id]),
  );

  const remapped: VocabularyDictationProgressMap = {};

  for (const [oldId, progress] of Object.entries(previousProgress)) {
    const key = oldIdToKey.get(oldId);
    if (!key) continue;
    const newId = newKeyToId.get(key);
    if (!newId) continue;
    remapped[newId] = progress;
  }

  return remapped;
}

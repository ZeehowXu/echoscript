import type { VocabularyBatch, VocabularyItem } from "../../types/vocabulary";
import { generateId } from "../ids";
import {
  addVocabularyBatch,
  bulkUpsertVocabularyFromImport,
  createMemoryStateForVocabulary,
  getVocabularyByNormalizedText,
  getVocabularyItemById,
} from "../vocabularyStorage";
import { classifyVocabularyItem } from "./classify";
import { normalizeVocabularyKey } from "./normalize";

export interface ValidationError {
  blockIndex: number;
  message: string;
  text?: string;
}

export interface ParsedVocabularyCard {
  blockIndex: number;
  text: string;
  phonetic: string;
  meaningZh: string;
  examples: Array<{ en: string; zh: string }>;
  type: VocabularyItem["type"];
  category: VocabularyItem["category"];
  normalizedText: string;
  existingItemId?: string;
}

export interface VocabularyImportValidation {
  totalCards: number;
  newCards: ParsedVocabularyCard[];
  existingCardsToUpdate: ParsedVocabularyCard[];
  duplicateInFileErrors: ValidationError[];
  invalidFormatErrors: ValidationError[];
  canImport: boolean;
}

export interface VocabularyImportResult {
  newCount: number;
  updatedCount: number;
  batch: VocabularyBatch;
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function splitStructuredBlocks(rawInput: string): string[] {
  const normalized = normalizeLineEndings(rawInput).trim();
  if (!normalized) return [];
  return normalized.split(/\n\s*\n+/);
}

export function estimateCardBlockCount(rawInput: string): number {
  return splitStructuredBlocks(rawInput).length;
}

function firstNonEmptyLine(block: string): string {
  return (
    block
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ""
  );
}

function parseBlockToCard(
  block: string,
  blockIndex: number,
):
  | { ok: true; card: Omit<ParsedVocabularyCard, "blockIndex" | "existingItemId"> }
  | { ok: false; error: ValidationError } {
  const hintText = firstNonEmptyLine(block);
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const withHint = (message: string): ValidationError => ({
    blockIndex,
    message,
    text: hintText || undefined,
  });

  if (lines.length !== 7) {
    return {
      ok: false,
      error: withHint(
        `Block ${blockIndex}: expected 7 lines, got ${lines.length}.`,
      ),
    };
  }

  const [text, phonetic, meaningZh, example1En, example1Zh, example2En, example2Zh] =
    lines;

  if (
    !text ||
    !phonetic ||
    !meaningZh ||
    !example1En ||
    !example1Zh ||
    !example2En ||
    !example2Zh
  ) {
    return {
      ok: false,
      error: withHint(`Block ${blockIndex}: one or more required lines are empty.`),
    };
  }

  const normalizedText = normalizeVocabularyKey(text);
  const { type, category } = classifyVocabularyItem(text);

  return {
    ok: true,
    card: {
      text: text.trim(),
      phonetic: phonetic.trim(),
      meaningZh: meaningZh.trim(),
      examples: [
        { en: example1En.trim(), zh: example1Zh.trim() },
        { en: example2En.trim(), zh: example2Zh.trim() },
      ],
      type,
      category,
      normalizedText,
    },
  };
}

export function parseBuiltInVocabularyCards(rawInput: string): {
  cards: ParsedVocabularyCard[];
  invalidFormatErrors: ValidationError[];
  duplicateInFileErrors: ValidationError[];
} {
  const blocks = splitStructuredBlocks(rawInput);
  const cards: ParsedVocabularyCard[] = [];
  const duplicateInFileErrors: ValidationError[] = [];
  const invalidFormatErrors: ValidationError[] = [];
  const seenInInput = new Set<string>();

  blocks.forEach((block, index) => {
    const blockIndex = index + 1;
    const parsed = parseBlockToCard(block, blockIndex);

    if (!parsed.ok) {
      invalidFormatErrors.push(parsed.error);
      return;
    }

    const { normalizedText } = parsed.card;

    if (seenInInput.has(normalizedText)) {
      duplicateInFileErrors.push({
        blockIndex,
        message: `Block ${blockIndex}: duplicate vocabulary item "${parsed.card.text}".`,
        text: parsed.card.text,
      });
      return;
    }

    seenInInput.add(normalizedText);
    cards.push({
      blockIndex,
      ...parsed.card,
    });
  });

  return { cards, invalidFormatErrors, duplicateInFileErrors };
}

export function validateVocabularyImport(
  rawInput: string,
): VocabularyImportValidation {
  const blocks = splitStructuredBlocks(rawInput);
  const newCards: ParsedVocabularyCard[] = [];
  const existingCardsToUpdate: ParsedVocabularyCard[] = [];
  const duplicateInFileErrors: ValidationError[] = [];
  const invalidFormatErrors: ValidationError[] = [];
  const seenInInput = new Set<string>();

  blocks.forEach((block, index) => {
    const blockIndex = index + 1;
    const parsed = parseBlockToCard(block, blockIndex);

    if (!parsed.ok) {
      invalidFormatErrors.push(parsed.error);
      return;
    }

    const { normalizedText } = parsed.card;

    if (seenInInput.has(normalizedText)) {
      duplicateInFileErrors.push({
        blockIndex,
        message: `Block ${blockIndex}: duplicate vocabulary item "${parsed.card.text}".`,
        text: parsed.card.text,
      });
      return;
    }
    seenInInput.add(normalizedText);

    const existing = getVocabularyByNormalizedText(normalizedText);
    const card: ParsedVocabularyCard = {
      blockIndex,
      ...parsed.card,
      ...(existing ? { existingItemId: existing.id } : {}),
    };

    if (existing) {
      existingCardsToUpdate.push(card);
    } else {
      newCards.push(card);
    }
  });

  const canImport =
    duplicateInFileErrors.length === 0 &&
    invalidFormatErrors.length === 0 &&
    (newCards.length > 0 || existingCardsToUpdate.length > 0);

  return {
    totalCards: blocks.length,
    newCards,
    existingCardsToUpdate,
    duplicateInFileErrors,
    invalidFormatErrors,
    canImport,
  };
}

export function getImportButtonLabel(
  newCount: number,
  updateCount: number,
): string {
  if (newCount > 0 && updateCount > 0) {
    return `Import ${newCount} New Cards and Update ${updateCount} Existing Cards`;
  }
  if (updateCount > 0) {
    return `Update ${updateCount} Existing Cards`;
  }
  if (newCount > 0) {
    return `Import ${newCount} New Cards`;
  }
  return "Import";
}

export function getImportSuccessMessage(
  newCount: number,
  updatedCount: number,
): string {
  if (newCount > 0 && updatedCount > 0) {
    return `Import completed.\n${newCount} new cards imported.\n${updatedCount} existing cards updated.`;
  }
  if (updatedCount > 0) {
    return `Update completed.\n${updatedCount} existing cards updated.`;
  }
  return `Import completed.\n${newCount} new cards imported.`;
}

function cardToNewItem(card: ParsedVocabularyCard, now: string): VocabularyItem {
  return {
    id: generateId(),
    text: card.text,
    type: card.type,
    category: card.category,
    status: "new",
    phonetic: card.phonetic,
    meaningZh: card.meaningZh,
    meaningEn: "",
    examples: card.examples,
    audio: "",
    createdAt: now,
    updatedAt: now,
  };
}

function cardToUpdatedItem(
  existing: VocabularyItem,
  card: ParsedVocabularyCard,
  now: string,
): VocabularyItem {
  return {
    ...existing,
    text: card.text,
    phonetic: card.phonetic,
    meaningZh: card.meaningZh,
    examples: card.examples,
    type: card.type,
    category: card.category,
    updatedAt: now,
  };
}

export function executeVocabularyImport(
  rawInput: string,
): VocabularyImportResult {
  const validation = validateVocabularyImport(rawInput);
  if (!validation.canImport) {
    throw new Error("Import blocked by validation errors");
  }

  const now = new Date().toISOString();
  const newItems: VocabularyItem[] = validation.newCards.map((card) =>
    cardToNewItem(card, now),
  );

  const updatedItems: VocabularyItem[] = [];
  for (const card of validation.existingCardsToUpdate) {
    const existingId = card.existingItemId;
    if (!existingId) continue;
    const existing =
      getVocabularyItemById(existingId) ??
      getVocabularyByNormalizedText(card.normalizedText);
    if (!existing) continue;
    updatedItems.push(cardToUpdatedItem(existing, card, now));
  }

  bulkUpsertVocabularyFromImport(newItems, updatedItems);

  for (const item of newItems) {
    createMemoryStateForVocabulary(item.id);
  }

  const batch: VocabularyBatch = {
    id: generateId(),
    rawInput,
    itemCount: newItems.length + updatedItems.length,
    createdAt: now,
  };
  addVocabularyBatch(batch);

  return {
    newCount: newItems.length,
    updatedCount: updatedItems.length,
    batch,
  };
}

/** @deprecated Use validateVocabularyImport */
export function parseVocabularyCardBlocks(rawInput: string) {
  const v = validateVocabularyImport(rawInput);
  return {
    cards: [...v.newCards, ...v.existingCardsToUpdate],
    errors: [...v.invalidFormatErrors, ...v.duplicateInFileErrors],
    stats: {
      totalBlocks: v.totalCards,
      validCount: v.newCards.length,
      errorCount:
        v.invalidFormatErrors.length + v.duplicateInFileErrors.length,
      duplicateInFileCount: v.duplicateInFileErrors.length,
      alreadyExistsCount: v.existingCardsToUpdate.length,
    },
  };
}

export type ParsedStructuredCard = ParsedVocabularyCard;

export function isTxtFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".txt") || file.type === "text/plain";
}

export async function readTxtFileContent(file: File): Promise<string> {
  return file.text();
}

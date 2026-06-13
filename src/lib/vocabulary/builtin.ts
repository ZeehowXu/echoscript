import {
  readVocabularyItemsRaw,
  reconcileVocabularyWithBuiltInSource,
} from "../vocabularyStorage";
import { parseBuiltInVocabularyCards } from "./service";

export const BUILTIN_VOCABULARY_URL = "/data/P1_vocabulary_801.txt";
export const BUILTIN_SOURCE_VERSION = "P1_801_v1";
export const BUILTIN_SOURCE_VERSION_KEY =
  "echoscript_vocabulary_builtin_source_version";

/** @deprecated Use syncBuiltInVocabularyFromSource */
export const BUILTIN_INIT_KEY = "echoscript_builtin_vocabulary_initialized";

export type BuiltinVocabularySyncResult =
  | { status: "success"; itemCount: number; migrated: boolean }
  | { status: "validation_failed" }
  | { status: "fetch_failed"; message: string };

/** @deprecated Use BuiltinVocabularySyncResult */
export type BuiltinVocabularyInitResult = BuiltinVocabularySyncResult;

function readBuiltinSourceVersion(): string | null {
  try {
    return localStorage.getItem(BUILTIN_SOURCE_VERSION_KEY);
  } catch {
    return null;
  }
}

function writeBuiltinSourceVersion(version: string): void {
  localStorage.setItem(BUILTIN_SOURCE_VERSION_KEY, version);
}

export async function syncBuiltInVocabularyFromSource(): Promise<BuiltinVocabularySyncResult> {
  const migrated = readBuiltinSourceVersion() !== BUILTIN_SOURCE_VERSION;

  let rawText: string;
  try {
    const response = await fetch(BUILTIN_VOCABULARY_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    rawText = await response.text();
  } catch (error) {
    console.error("Failed to fetch built-in vocabulary:", error);
    return {
      status: "fetch_failed",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }

  const { cards, invalidFormatErrors, duplicateInFileErrors } =
    parseBuiltInVocabularyCards(rawText);

  if (
    duplicateInFileErrors.length > 0 ||
    invalidFormatErrors.length > 0 ||
    cards.length === 0
  ) {
    console.error("Built-in vocabulary validation failed:", {
      invalidFormat: invalidFormatErrors.length,
      duplicateInFile: duplicateInFileErrors.length,
      cardCount: cards.length,
    });
    return { status: "validation_failed" };
  }

  try {
    const itemCount = reconcileVocabularyWithBuiltInSource(cards);
    writeBuiltinSourceVersion(BUILTIN_SOURCE_VERSION);
    return { status: "success", itemCount, migrated };
  } catch (error) {
    console.error("Built-in vocabulary reconcile failed:", error);
    return { status: "validation_failed" };
  }
}

/** @deprecated Use syncBuiltInVocabularyFromSource */
export async function initializeBuiltInVocabularyIfNeeded(): Promise<BuiltinVocabularySyncResult> {
  if (readVocabularyItemsRaw().length > 0 && !readBuiltinSourceVersion()) {
    writeBuiltinSourceVersion(BUILTIN_SOURCE_VERSION);
  }
  return syncBuiltInVocabularyFromSource();
}

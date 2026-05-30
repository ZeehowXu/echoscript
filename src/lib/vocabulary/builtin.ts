import { getVocabularyItems } from "../vocabularyStorage";
import { executeVocabularyImport, validateVocabularyImport } from "./service";

export const BUILTIN_VOCABULARY_URL = "/data/P1_vocabulary_801.txt";
const BUILTIN_INIT_KEY = "echoscript_builtin_vocabulary_initialized";

export type BuiltinVocabularyInitResult =
  | { status: "skipped" }
  | { status: "success"; newCount: number; updatedCount: number }
  | { status: "validation_failed" }
  | { status: "fetch_failed"; message: string };

export async function initializeBuiltInVocabularyIfNeeded(): Promise<BuiltinVocabularyInitResult> {
  if (getVocabularyItems().length > 0) {
    return { status: "skipped" };
  }

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

  const validation = validateVocabularyImport(rawText);
  if (
    validation.duplicateInFileErrors.length > 0 ||
    validation.invalidFormatErrors.length > 0
  ) {
    console.error("Built-in vocabulary validation failed:", {
      invalidFormat: validation.invalidFormatErrors.length,
      duplicateInFile: validation.duplicateInFileErrors.length,
    });
    return { status: "validation_failed" };
  }

  if (!validation.canImport) {
    console.error("Built-in vocabulary: no cards to import");
    return { status: "validation_failed" };
  }

  try {
    const result = executeVocabularyImport(rawText);
    localStorage.setItem(BUILTIN_INIT_KEY, "true");
    return {
      status: "success",
      newCount: result.newCount,
      updatedCount: result.updatedCount,
    };
  } catch (error) {
    console.error("Built-in vocabulary import failed:", error);
    return { status: "validation_failed" };
  }
}

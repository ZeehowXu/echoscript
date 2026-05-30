export type VocabularyLearningStatus =
  | "new"
  | "fuzzy"
  | "remembered"
  | "forgot";

export interface VocabularyStatusStats {
  total: number;
  new: number;
  fuzzy: number;
  remembered: number;
  forgot: number;
}

export function normalizeVocabularyStatus(status: unknown): VocabularyLearningStatus {
  const value = typeof status === "string" ? status.trim().toLowerCase() : "";

  switch (value) {
    case "":
    case "new":
      return "new";
    case "fuzzy":
    case "learning":
      return "fuzzy";
    case "remembered":
    case "known":
    case "mastered":
      return "remembered";
    case "forgot":
      return "forgot";
    default:
      return "new";
  }
}

export function getVocabularyStatusStats(
  items: Array<{ status?: unknown }>,
): VocabularyStatusStats {
  const stats = {
    new: 0,
    fuzzy: 0,
    remembered: 0,
    forgot: 0,
  };

  for (const item of items) {
    const status = normalizeVocabularyStatus(item.status);
    stats[status] += 1;
  }

  return {
    total: items.length,
    ...stats,
  };
}

export function statusReviewPriority(status: VocabularyLearningStatus): number {
  switch (status) {
    case "forgot":
      return 0;
    case "fuzzy":
      return 1;
    case "new":
      return 2;
    case "remembered":
      return 3;
  }
}

export function formatStatusPercent(count: number, total: number): string {
  if (total === 0) return "0%";
  return `${((count / total) * 100).toFixed(1)}%`;
}

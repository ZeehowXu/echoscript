import type { CompareResult } from "../types";

export function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[.!?…]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  const normalized = normalizeForCompare(text);
  if (!normalized) return [];
  return normalized.match(/[a-z0-9']+/gi) ?? [];
}

function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

type DiffOp =
  | { type: "match"; token: string }
  | { type: "user_only"; token: string }
  | { type: "correct_only"; token: string };

function buildDiffOps(userTokens: string[], correctTokens: string[]): DiffOp[] {
  const dp = lcsTable(userTokens, correctTokens);
  const ops: DiffOp[] = [];
  let i = userTokens.length;
  let j = correctTokens.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && userTokens[i - 1] === correctTokens[j - 1]) {
      ops.unshift({ type: "match", token: userTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: "correct_only", token: correctTokens[j - 1] });
      j--;
    } else {
      ops.unshift({ type: "user_only", token: userTokens[i - 1] });
      i--;
    }
  }

  return ops;
}

function extractDisplayTokens(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/);
}

export function compareAnswer(
  userInput: string,
  correctText: string,
): CompareResult {
  const userNorm = tokenize(userInput);
  const correctNorm = tokenize(correctText);

  const isCorrect =
    userNorm.length === correctNorm.length &&
    userNorm.every((t, idx) => t === correctNorm[idx]);

  const displayTokens = extractDisplayTokens(userInput);

  if (isCorrect) {
    return {
      isCorrect: true,
      userTokens: displayTokens.map((text) => ({
        text,
        status: "correct" as const,
      })),
      wrongParts: [],
    };
  }

  const ops = buildDiffOps(userNorm, correctNorm);
  const userTokens: CompareResult["userTokens"] = [];
  const wrongParts: string[] = [];
  let displayIdx = 0;

  for (const op of ops) {
    if (op.type === "match") {
      const text =
        displayIdx < displayTokens.length
          ? displayTokens[displayIdx++]
          : op.token;
      const status =
        normalizeForCompare(text) === op.token ? "correct" : "wrong";
      userTokens.push({ text, status });
      if (status === "wrong") wrongParts.push(text);
    } else if (op.type === "user_only") {
      const text =
        displayIdx < displayTokens.length
          ? displayTokens[displayIdx++]
          : op.token;
      userTokens.push({ text, status: "wrong" });
      wrongParts.push(text);
    } else {
      userTokens.push({ text: op.token, status: "missing" });
      wrongParts.push(op.token);
    }
  }

  while (displayIdx < displayTokens.length) {
    const text = displayTokens[displayIdx++];
    userTokens.push({ text, status: "extra" });
    wrongParts.push(text);
  }

  return {
    isCorrect: false,
    userTokens,
    wrongParts: [...new Set(wrongParts)],
  };
}

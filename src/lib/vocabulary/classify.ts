import type {
  VocabularyCategory,
  VocabularyClassification,
  VocabularyItemType,
} from "../../types/vocabulary";
import { VOCABULARY_CATEGORIES } from "../../types/vocabulary";

const FIXED_EXPRESSIONS = [
  "in terms of",
  "as a result of",
  "on the other hand",
  "take into account",
  "keep an eye on",
  "be likely to",
  "as well as",
  "due to",
  "in spite of",
  "with regard to",
  "figure out",
  "carry out",
  "come up with",
  "point out",
];

const PHRASE_INDICATORS = new Set([
  "a",
  "an",
  "the",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "by",
  "from",
  "as",
  "and",
  "or",
  "but",
  "into",
  "onto",
  "upon",
  "about",
  "over",
  "under",
  "through",
  "between",
  "among",
  "without",
  "within",
  "during",
  "before",
  "after",
  "against",
  "along",
  "around",
  "behind",
  "beyond",
  "despite",
  "toward",
  "towards",
  "via",
  "per",
  "than",
  "that",
  "which",
  "who",
  "whom",
  "whose",
  "where",
  "when",
  "while",
  "if",
  "unless",
  "until",
  "because",
  "since",
  "although",
  "though",
  "whether",
  "once",
  "unless",
]);

type CategoryRule = {
  category: VocabularyCategory;
  keywords: string[];
};

/** Priority: first match wins (highest priority first) */
const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "Fixed Expressions",
    keywords: [
      "in terms of",
      "as a result of",
      "on the other hand",
      "take into account",
      "keep an eye on",
      "be likely to",
      "as well as",
      "due to",
      "in spite of",
      "with regard to",
      "figure out",
      "carry out",
      "come up with",
      "point out",
      "sort of",
      "kind of",
      "make sure",
      "get along",
      "hang out",
      "pick up",
    ],
  },
  {
    category: "Economics & Finance",
    keywords: [
      "inflation",
      "economy",
      "economic",
      "monetary",
      "fiscal",
      "interest rate",
      "market",
      "price",
      "demand",
      "supply",
      "investment",
      "currency",
      "revenue",
      "profit",
      "gdp",
      "bond",
      "stock",
      "trade",
      "budget",
      "debt",
    ],
  },
  {
    category: "Business & Work",
    keywords: [
      "meeting",
      "project",
      "deadline",
      "negotiation",
      "customer",
      "productivity",
      "operation",
      "strategy",
      "management",
      "supply chain",
      "stakeholder",
      "workflow",
      "hire",
      "promotion",
      "colleague",
      "office",
      "client",
    ],
  },
  {
    category: "Academic & Formal",
    keywords: [
      "therefore",
      "however",
      "consequently",
      "significant",
      "indicate",
      "demonstrate",
      "analysis",
      "factor",
      "impact",
      "hypothesis",
      "methodology",
      "furthermore",
      "nevertheless",
      "whereas",
      "moreover",
    ],
  },
  {
    category: "Technology",
    keywords: [
      "software",
      "platform",
      "data",
      "algorithm",
      "system",
      "api",
      "database",
      "model",
      "server",
      "cloud",
      "network",
      "digital",
      "code",
      "application",
    ],
  },
  {
    category: "Daily Conversation",
    keywords: [
      "hang out",
      "pick up",
      "figure out",
      "get along",
      "make sure",
      "kind of",
      "sort of",
      "catch up",
      "show up",
      "run into",
      "look forward",
      "break up",
      "check out",
    ],
  },
  {
    category: "Emotions & Attitudes",
    keywords: [
      "happy",
      "frustrated",
      "confident",
      "worried",
      "relieved",
      "disappointed",
      "anxious",
      "grateful",
      "annoyed",
      "excited",
      "nervous",
      "proud",
      "ashamed",
      "jealous",
    ],
  },
];

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function tokenize(text: string): string[] {
  return normalizeText(text).split(/\s+/).filter(Boolean);
}

function matchesFixedExpression(text: string): boolean {
  const normalized = normalizeText(text);
  return FIXED_EXPRESSIONS.some(
    (expr) => normalized === expr || normalized.includes(expr),
  );
}

export function detectVocabularyType(text: string): VocabularyItemType {
  const tokens = tokenize(text);

  if (tokens.length === 1) {
    return "word";
  }

  if (matchesFixedExpression(text)) {
    return "collocation";
  }

  const hasPhraseIndicator = tokens.some((t) => PHRASE_INDICATORS.has(t));
  if (hasPhraseIndicator) {
    return tokens.length <= 4 && hasPhraseIndicator ? "collocation" : "phrase";
  }

  return "phrase";
}

export function classifyVocabularyCategory(text: string): VocabularyCategory {
  const normalized = normalizeText(text);

  for (const rule of CATEGORY_RULES) {
    const matched = rule.keywords.some((keyword) => {
      const kw = keyword.toLowerCase();
      if (kw.includes(" ")) {
        return normalized.includes(kw);
      }
      const tokens = normalized.split(/\s+/);
      return tokens.includes(kw) || normalized === kw;
    });
    if (matched) {
      return rule.category;
    }
  }

  return "Other";
}

export function classifyVocabularyItem(text: string): VocabularyClassification {
  const type = detectVocabularyType(text);
  let category = classifyVocabularyCategory(text);

  if (type === "collocation" && category === "Other") {
    category = "Fixed Expressions";
  }

  return { type, category };
}

export function parseVocabularyInput(raw: string): string[] {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const seen = new Set<string>();
  const unique: string[] = [];

  for (const line of lines) {
    const key = normalizeText(line);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(line);
    }
  }

  return unique;
}

export function categoryToSlug(category: VocabularyCategory): string {
  return category
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugToCategory(slug: string): VocabularyCategory | undefined {
  for (const cat of VOCABULARY_CATEGORIES) {
    if (categoryToSlug(cat) === slug) return cat;
  }
  return undefined;
}

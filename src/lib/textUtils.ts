const DIALOGUE_LINE_RE = /^[A-Za-z][A-Za-z0-9\s]*:\s*.+/;
const SENTENCE_END_RE = /[.!?]+(?:\s+|$)/g;

export function cleanText(rawText: string): string {
  return rawText
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, arr) => line.length > 0 || (index > 0 && arr[index - 1]?.length))
    .join("\n")
    .trim();
}

function splitParagraphToSentences(paragraph: string): string[] {
  const trimmed = paragraph.trim();
  if (!trimmed) return [];

  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const re = new RegExp(SENTENCE_END_RE.source, "g");
  while ((match = re.exec(trimmed)) !== null) {
    const end = match.index + match[0].length;
    const chunk = trimmed.slice(lastIndex, end).trim();
    if (chunk) parts.push(chunk);
    lastIndex = end;
  }

  const remainder = trimmed.slice(lastIndex).trim();
  if (remainder) parts.push(remainder);

  return parts.length > 0 ? parts : [trimmed];
}

function isDialogueLine(line: string): boolean {
  return DIALOGUE_LINE_RE.test(line.trim());
}

export function splitTextToTrainingUnits(rawText: string): string[] {
  const cleaned = cleanText(rawText);
  if (!cleaned) return [];

  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  const units: string[] = [];

  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const paragraph = paragraphBuffer.join(" ");
    units.push(...splitParagraphToSentences(paragraph));
    paragraphBuffer = [];
  };

  for (const line of lines) {
    if (isDialogueLine(line)) {
      flushParagraph();
      units.push(line);
    } else {
      paragraphBuffer.push(line);
    }
  }

  flushParagraph();
  return units.filter((u) => u.trim().length > 0);
}

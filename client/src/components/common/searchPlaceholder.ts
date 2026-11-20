import type { SearchSuggestionPhrase } from "../../services/searchSuggestionService";

export const SEARCH_PLACEHOLDER_FALLBACK = "Search products";
export const DEFAULT_TYPING_SPEED = 60;
export const DEFAULT_DELETING_SPEED = 40;
export const DEFAULT_DISPLAY_DURATION = 2500;

export const normalizeSearchPhrase = (phrase: string) => {
  const raw = phrase.trim();
  let term = raw.replace(/^(?:search\s+for\s+)+/i, "").trim();
  if (term !== raw && (/^".*"$|^“.*”$|^'.*'$|^‘.*’$/s.test(term))) {
    term = term.slice(1, -1).trim();
  }
  return term;
};

export const getSearchPhrases = (suggestions: readonly SearchSuggestionPhrase[]) => {
  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const suggestion of suggestions) {
    if (suggestion.isActive === false) continue;
    const phrase = normalizeSearchPhrase(suggestion.phrase);
    const key = phrase.normalize("NFC").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    phrases.push(phrase);
  }
  return phrases;
};

const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter() : undefined;

export const splitSearchPhrase = (phrase: string) => segmenter
  ? Array.from(segmenter.segment(phrase), ({ segment }) => segment)
  : Array.from(phrase);

export type TypewriterFrame = {
  index: number;
  length: number;
  phase: "hold" | "delete" | "type";
};

export const advanceTypewriter = (frame: TypewriterFrame, lengths: readonly number[]): TypewriterFrame => {
  if (frame.phase === "hold" || frame.phase === "delete") {
    const length = frame.length - 1;
    return length === 0
      ? { index: (frame.index + 1) % lengths.length, length, phase: "type" }
      : { ...frame, length, phase: "delete" };
  }

  const length = frame.length + 1;
  return { ...frame, length, phase: length === lengths[frame.index] ? "hold" : "type" };
};

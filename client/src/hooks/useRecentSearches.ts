import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "quickcart.recentSearches";
const CHANGE_EVENT = "quickcart:recent-searches-changed";
const MAX_RECENT_SEARCHES = 10;

const readRecentSearches = (): string[] => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => {
        const normalized = item.toLocaleLowerCase();
        if (!item || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      })
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
};

const writeRecentSearches = (searches: string[]) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
};

export const addRecentSearch = (query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return;
  const normalized = trimmed.toLocaleLowerCase();
  const next = [trimmed, ...readRecentSearches().filter((item) => item.toLocaleLowerCase() !== normalized)]
    .slice(0, MAX_RECENT_SEARCHES);
  writeRecentSearches(next);
};

export const useRecentSearches = () => {
  const [searches, setSearches] = useState<string[]>(readRecentSearches);

  useEffect(() => {
    const refresh = () => setSearches(readRecentSearches());
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const clearRecentSearches = useCallback(() => writeRecentSearches([]), []);
  return { searches, clearRecentSearches };
};

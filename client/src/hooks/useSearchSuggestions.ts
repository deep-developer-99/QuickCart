import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { getSearchSuggestionSnapshot, setSearchSuggestionsPaused, subscribeToSearchSuggestions } from "../services/searchSuggestionService";

export const useSearchSuggestions = () => {
  const snapshot = useSyncExternalStore(
    subscribeToSearchSuggestions,
    getSearchSuggestionSnapshot,
    getSearchSuggestionSnapshot,
  );
  const consumer = useRef(Symbol("search-suggestion-consumer"));
  const setPaused = useCallback((paused: boolean) => {
    setSearchSuggestionsPaused(consumer.current, paused);
  }, []);

  useEffect(() => () => setPaused(false), [setPaused]);

  return { ...snapshot, setPaused };
};

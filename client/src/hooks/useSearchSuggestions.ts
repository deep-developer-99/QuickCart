import { useSyncExternalStore } from "react";
import { getSearchSuggestionSnapshot, subscribeToSearchSuggestions } from "../services/searchSuggestionService";

export const useSearchSuggestions = () => useSyncExternalStore(
  subscribeToSearchSuggestions,
  getSearchSuggestionSnapshot,
  getSearchSuggestionSnapshot,
);

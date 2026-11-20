import api from "./api";
import { DEFAULT_TYPING_SPEED, DEFAULT_DELETING_SPEED, DEFAULT_DISPLAY_DURATION } from "../components/common/searchPlaceholder";

export interface SearchSuggestion { _id: string; phrase: string; order: number; isActive?: boolean; }
export interface SearchSuggestionSettings {
  isEnabled: boolean;
  rotationInterval: number;
  typingSpeedMs?: number;
  deletingSpeedMs?: number;
}
export interface SearchSuggestionConfig extends SearchSuggestionSettings { suggestions: SearchSuggestion[]; }
export interface SearchSuggestionResponse { success: boolean; message?: string; data: SearchSuggestionConfig; }

export const getPublicSearchSuggestions = async () => (await api.get<SearchSuggestionResponse>("/search-suggestions")).data;
export const getAdminSearchSuggestions = async () => (await api.get<SearchSuggestionResponse>("/admin/search-suggestions")).data;
export const createSearchSuggestion = async (input: { phrase: string; isActive: boolean }) => (await api.post("/admin/search-suggestions", input)).data;
export const updateSearchSuggestion = async (id: string, input: { phrase?: string; isActive?: boolean }) => (await api.put(`/admin/search-suggestions/${id}`, input)).data;
export const deleteSearchSuggestion = async (id: string) => (await api.delete(`/admin/search-suggestions/${id}`)).data;
export const reorderSearchSuggestions = async (ids: string[]) => (await api.patch<SearchSuggestionResponse>("/admin/search-suggestions/reorder", { ids })).data;
export const updateSearchSuggestionSettings = async (input: SearchSuggestionSettings) => (await api.patch("/admin/search-suggestions/settings", input)).data;

type StoreSnapshot = { config: SearchSuggestionConfig | null; isLoading: boolean };
const listeners = new Set<() => void>();
let snapshot: StoreSnapshot = { config: null, isLoading: false };
let pendingRequest: Promise<void> | null = null;
let retryTimer: number | undefined;
let lastFetchedAt = 0;
let refreshQueued = false;
const CACHE_TTL_MS = 30_000;
const RETRY_DELAY_MS = 15_000;
const notify = () => listeners.forEach((listener) => listener());

const parsePublicConfig = (response: SearchSuggestionResponse): SearchSuggestionConfig => {
  if (!response || response.success !== true || !response.data || typeof response.data !== "object") {
    throw new Error("Invalid public search suggestions response");
  }

  const raw = response.data as SearchSuggestionConfig;
  if (typeof raw.isEnabled !== "boolean" || !Array.isArray(raw.suggestions)) {
    throw new Error("Invalid public search suggestions data");
  }

  const suggestions = raw.suggestions.flatMap((candidate, index) => {
    if (!candidate || typeof candidate.phrase !== "string" || typeof candidate._id !== "string" || candidate.isActive === false) return [];
    const phrase = candidate.phrase.trim();
    if (!phrase) return [];
    return [{
      _id: candidate._id,
      phrase,
      order: Number.isFinite(candidate.order) ? candidate.order : index,
    }];
  }).sort((left, right) => left.order - right.order);

  const rotationInterval = Number.isInteger(raw.rotationInterval) && raw.rotationInterval >= 1000 && raw.rotationInterval <= 10000
    ? raw.rotationInterval
    : DEFAULT_DISPLAY_DURATION;

  return {
    isEnabled: raw.isEnabled,
    rotationInterval,
    typingSpeedMs: parseSpeed(raw.typingSpeedMs, DEFAULT_TYPING_SPEED),
    deletingSpeedMs: parseSpeed(raw.deletingSpeedMs, DEFAULT_DELETING_SPEED),
    suggestions,
  };
};

const parseSpeed = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isInteger(value) && value >= 20 && value <= 150 ? value : fallback;

const scheduleRetry = () => {
  if (!listeners.size || retryTimer !== undefined) return;
  retryTimer = window.setTimeout(() => {
    retryTimer = undefined;
    if (document.visibilityState === "hidden") return;
    lastFetchedAt = 0;
    void loadPublicSearchSuggestions(true);
  }, RETRY_DELAY_MS);
};

export const loadPublicSearchSuggestions = (force = false): Promise<void> => {
  if (pendingRequest) {
    if (force) refreshQueued = true;
    return pendingRequest;
  }
  if (!force && snapshot.config && Date.now() - lastFetchedAt < CACHE_TTL_MS) return Promise.resolve();
  if (retryTimer !== undefined) {
    window.clearTimeout(retryTimer);
    retryTimer = undefined;
  }
  snapshot = { ...snapshot, isLoading: true };
  notify();
  let failed = false;
  pendingRequest = getPublicSearchSuggestions().then(parsePublicConfig).then((config) => {
    snapshot = { config, isLoading: false };
    lastFetchedAt = Date.now();
  }).catch(() => {
    failed = true;
    snapshot = { config: null, isLoading: false };
  }).finally(() => {
    pendingRequest = null;
    notify();
    if (refreshQueued) {
      refreshQueued = false;
      lastFetchedAt = 0;
      if (listeners.size) void loadPublicSearchSuggestions(true);
    } else if (failed) {
      scheduleRetry();
    }
  });
  return pendingRequest;
};

export const invalidatePublicSearchSuggestions = () => {
  lastFetchedAt = 0;
  void loadPublicSearchSuggestions(true);
};

export const subscribeToSearchSuggestions = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("online", handleNetworkAvailable);
    document.addEventListener("visibilitychange", handlePageVisible);
    void loadPublicSearchSuggestions();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      retryTimer = undefined;
      refreshQueued = false;
      window.removeEventListener("online", handleNetworkAvailable);
      document.removeEventListener("visibilitychange", handlePageVisible);
    }
  };
};

const handleNetworkAvailable = () => {
  lastFetchedAt = 0;
  void loadPublicSearchSuggestions(true);
};

const handlePageVisible = () => {
  if (document.visibilityState !== "visible") return;
  if (!snapshot.config || Date.now() - lastFetchedAt >= CACHE_TTL_MS) void loadPublicSearchSuggestions();
};

export const getSearchSuggestionSnapshot = () => snapshot;

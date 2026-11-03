import api from "./api";

export interface SearchSuggestion { _id: string; phrase: string; order: number; isActive?: boolean; }
export interface SearchSuggestionConfig { isEnabled: boolean; rotationInterval: number; suggestions: SearchSuggestion[]; }
export interface SearchSuggestionResponse { success: boolean; message?: string; data: SearchSuggestionConfig; }

export const getPublicSearchSuggestions = async () => (await api.get<SearchSuggestionResponse>("/search-suggestions")).data;
export const getAdminSearchSuggestions = async () => (await api.get<SearchSuggestionResponse>("/admin/search-suggestions")).data;
export const createSearchSuggestion = async (input: { phrase: string; isActive: boolean }) => (await api.post("/admin/search-suggestions", input)).data;
export const updateSearchSuggestion = async (id: string, input: { phrase?: string; isActive?: boolean }) => (await api.put(`/admin/search-suggestions/${id}`, input)).data;
export const deleteSearchSuggestion = async (id: string) => (await api.delete(`/admin/search-suggestions/${id}`)).data;
export const reorderSearchSuggestions = async (ids: string[]) => (await api.patch<SearchSuggestionResponse>("/admin/search-suggestions/reorder", { ids })).data;
export const updateSearchSuggestionSettings = async (input: { isEnabled: boolean; rotationInterval: number }) => (await api.patch("/admin/search-suggestions/settings", input)).data;

type StoreSnapshot = { config: SearchSuggestionConfig | null; index: number; isLoading: boolean };
const listeners = new Set<() => void>();
let snapshot: StoreSnapshot = { config: null, index: 0, isLoading: false };
let pendingRequest: Promise<void> | null = null;
let rotationTimer: number | undefined;
let lastFetchedAt = 0;
const FALLBACK_INTERVAL = 2500;
const notify = () => listeners.forEach((listener) => listener());

const configureTimer = () => {
  if (rotationTimer !== undefined) window.clearInterval(rotationTimer);
  rotationTimer = undefined;
  const config = snapshot.config;
  if (listeners.size && config?.isEnabled && config.suggestions.length > 1) {
    rotationTimer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      const count = snapshot.config?.suggestions.length || 1;
      snapshot = { ...snapshot, index: (snapshot.index + 1) % count };
      notify();
    }, config.rotationInterval || FALLBACK_INTERVAL);
  }
};

export const loadPublicSearchSuggestions = (force = false): Promise<void> => {
  if (!force && (pendingRequest || (snapshot.config && Date.now() - lastFetchedAt < 60_000))) return pendingRequest || Promise.resolve();
  snapshot = { ...snapshot, isLoading: true };
  notify();
  pendingRequest = getPublicSearchSuggestions().then(({ data }) => {
    snapshot = { config: data, index: 0, isLoading: false };
    lastFetchedAt = Date.now();
  }).catch(() => {
    snapshot = { ...snapshot, isLoading: false };
  }).finally(() => {
    pendingRequest = null;
    configureTimer();
    notify();
  });
  return pendingRequest;
};

export const invalidatePublicSearchSuggestions = () => {
  lastFetchedAt = 0;
  void loadPublicSearchSuggestions(true);
};

export const subscribeToSearchSuggestions = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1) void loadPublicSearchSuggestions();
  configureTimer();
  return () => {
    listeners.delete(listener);
    if (!listeners.size && rotationTimer !== undefined) {
      window.clearInterval(rotationTimer);
      rotationTimer = undefined;
    }
  };
};

export const getSearchSuggestionSnapshot = () => snapshot;

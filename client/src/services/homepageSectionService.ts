import api from "./api";
import type { AdminHomepageSection, AdminHomepageSectionData, HomepageSectionPreview } from "../types/homepageSection";

export const HOMEPAGE_SECTIONS_CACHE_TTL_MS = 60_000;

type PublicHomepageSectionsResponse = { success: boolean; data: HomepageSectionPreview[] };
type HomepageSectionsSnapshot = { data: HomepageSectionPreview[] | null; isLoading: boolean; error: string };
const listeners = new Set<() => void>();
let snapshot: HomepageSectionsSnapshot = { data: null, isLoading: false, error: "" };
let lastFetchedAt = 0;
let pendingRequest: Promise<void> | null = null;
let lastRevalidationAttemptAt = 0;
let invalidatedWhilePending = false;

export const getHomepageSections = async (): Promise<PublicHomepageSectionsResponse> => {
  const response = await api.get("/homepage-sections");
  return response.data;
};

const notify = () => listeners.forEach((listener) => listener());
export const getHomepageSectionsSnapshot = () => snapshot;
export const subscribeToHomepageSections = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const loadHomepageSections = (options: { force?: boolean; throttleMs?: number } = {}): Promise<void> => {
  const { force = false, throttleMs = 5_000 } = options;
  if (pendingRequest) return pendingRequest;
  if (!force && snapshot.data && Date.now() - lastFetchedAt < HOMEPAGE_SECTIONS_CACHE_TTL_MS) return Promise.resolve();
  const now = Date.now();
  if (snapshot.data && now - lastRevalidationAttemptAt < throttleMs) return Promise.resolve();
  lastRevalidationAttemptAt = now;

  snapshot = { ...snapshot, isLoading: snapshot.data === null, error: "" };
  notify();
  pendingRequest = getHomepageSections().then((response) => {
    if (!response?.success || !Array.isArray(response.data)) throw new Error("Unable to load homepage product sections.");
    snapshot = { data: response.data, isLoading: false, error: "" };
    lastFetchedAt = Date.now();
  }).catch((requestError: unknown) => {
    const message = requestError instanceof Error ? requestError.message : "Unable to load homepage product sections.";
    snapshot = snapshot.data
      ? { ...snapshot, isLoading: false }
      : { data: null, isLoading: false, error: message };
    if (snapshot.data) console.warn("Homepage product sections could not be refreshed:", message);
  }).finally(() => {
    pendingRequest = null;
    notify();
    if (invalidatedWhilePending) {
      invalidatedWhilePending = false;
      void loadHomepageSections({ force: true, throttleMs: 0 });
    }
  });
  return pendingRequest;
};

export const invalidateHomepageSections = () => {
  lastFetchedAt = 0;
  lastRevalidationAttemptAt = 0;
  if (pendingRequest) invalidatedWhilePending = true;
  if (listeners.size) void loadHomepageSections({ force: true });
};

export const getAdminHomepageSections = async (): Promise<{ success: boolean; data: AdminHomepageSectionData }> => {
  const response = await api.get("/admin/homepage-sections");
  return response.data;
};

export const saveAdminHomepageSections = async (sections: AdminHomepageSection[]) => {
  const response = await api.put("/admin/homepage-sections", {
    sections: sections.map(({ subCategoryId, isActive, productLimit }) => ({ subCategoryId, isActive, productLimit })),
  });
  const result = response.data as { success: boolean; data: AdminHomepageSectionData };
  if (result.success) invalidateHomepageSections();
  return result;
};

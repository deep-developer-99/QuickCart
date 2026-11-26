import api from "./api";
import type { AdminHomepageSection, AdminHomepageSectionData, HomepageSectionPreview } from "../types/homepageSection";
import { getPublicCached, invalidatePublicCache, peekPublicCached, subscribePublicCache } from "./queryCache";

export const HOMEPAGE_SECTIONS_CACHE_TTL_MS = 60_000;

type PublicHomepageSectionsResponse = { success: boolean; data: HomepageSectionPreview[] };
type HomepageSectionsSnapshot = { data: HomepageSectionPreview[] | null; isLoading: boolean; error: string };
const listeners = new Set<() => void>();
let loadState = { isLoading: false, error: "" };
let pendingRequest: Promise<void> | null = null;
let lastRevalidationAttemptAt = 0;
let invalidatedWhilePending = false;

const getCachedData = () => peekPublicCached<PublicHomepageSectionsResponse>("/homepage-sections")?.data ?? null;

export const getHomepageSections = async (force = false): Promise<PublicHomepageSectionsResponse> => {
  return getPublicCached<PublicHomepageSectionsResponse>("/homepage-sections", {}, HOMEPAGE_SECTIONS_CACHE_TTL_MS, ["HomepageSections"], undefined, { force });
};

const notify = () => listeners.forEach((listener) => listener());
export const getHomepageSectionsSnapshot = (): HomepageSectionsSnapshot => ({ data: getCachedData(), ...loadState });
export const subscribeToHomepageSections = (listener: () => void) => {
  listeners.add(listener);
  const unsubscribeCache = subscribePublicCache("/homepage-sections", notify);
  return () => {
    listeners.delete(listener);
    unsubscribeCache();
  };
};

export const loadHomepageSections = (options: { force?: boolean; throttleMs?: number } = {}): Promise<void> => {
  const { force = false, throttleMs = 5_000 } = options;
  if (pendingRequest) return pendingRequest;
  const now = Date.now();
  if (getCachedData() && now - lastRevalidationAttemptAt < throttleMs) return Promise.resolve();
  lastRevalidationAttemptAt = now;

  loadState = { isLoading: getCachedData() === null, error: "" };
  notify();
  pendingRequest = getHomepageSections(force).then((response) => {
    if (!response?.success || !Array.isArray(response.data)) throw new Error("Unable to load homepage product sections.");
    loadState = { isLoading: false, error: "" };
  }).catch((requestError: unknown) => {
    const message = requestError instanceof Error ? requestError.message : "Unable to load homepage product sections.";
    loadState = { isLoading: false, error: getCachedData() ? "" : message };
    if (getCachedData()) console.warn("Homepage product sections could not be refreshed:", message);
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
  lastRevalidationAttemptAt = 0;
  invalidatePublicCache(["HomepageSections"]);
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
  if (result.success) {
    invalidateHomepageSections();
  }
  return result;
};

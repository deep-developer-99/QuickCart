import { store } from "../store/store";
import { createQueryCacheKey, isCacheFresh } from "./cachePolicy";
import { privateCacheApi, publicCacheApi } from "./cacheApi";
import type { CachedRequestArgs } from "./axiosQueryBase";

const currentPrivateScope = () => {
  const { user, revision } = store.getState().auth;
  return user ? `${user.role}:${user.id}:${revision}` : null;
};

const inFlightRequests = new Map<string, Promise<unknown>>();

const waitForPendingCacheEntry = <T>(cacheApi: typeof publicCacheApi | typeof privateCacheApi, args: CachedRequestArgs): Promise<T> => {
  const endpoint = cacheApi.endpoints.getCached;
  const current = endpoint.select(args)(store.getState() as never);
  if (current.data !== undefined) return Promise.resolve(current.data as T);
  return new Promise<T>((resolve, reject) => {
    const unsubscribe = store.subscribe(() => {
      const entry = endpoint.select(args)(store.getState() as never);
      if (entry.status === "pending" || entry.status === "uninitialized") return;
      unsubscribe();
      if (entry.data !== undefined) resolve(entry.data as T);
      else reject(entry.error ?? new Error("The cached request failed."));
    });
  });
};

const fetchFromCache = async <T>(
  cacheApi: typeof publicCacheApi | typeof privateCacheApi,
  args: CachedRequestArgs,
  signal?: AbortSignal,
  force = false,
): Promise<T> => {
  const endpoint = cacheApi.endpoints.getCached;
  const state = endpoint.select(args)(store.getState() as never);
  if (state.status === "pending") return waitForPendingCacheEntry<T>(cacheApi, args);
  const requestKey = `${cacheApi.reducerPath}|${args.cacheKey}`;
  const existingRequest = inFlightRequests.get(requestKey);
  if (existingRequest) return existingRequest as Promise<T>;
  const forceRefetch = !state.status.startsWith("pending") && (force || !isCacheFresh(state.fulfilledTimeStamp, args.ttlMs));
  const request = store.dispatch(endpoint.initiate(args, { subscribe: false, forceRefetch }) as never) as { unwrap: () => Promise<unknown> };
  const result = request.unwrap() as Promise<T>;
  const retainStaleOnFailure: Promise<T> = (async () => {
    try {
      return await result;
    } catch (error) {
      const lastGood = endpoint.select(args)(store.getState() as never).data;
      if (lastGood !== undefined) return lastGood as T;
      throw error;
    }
  })();
  inFlightRequests.set(requestKey, retainStaleOnFailure);
  void retainStaleOnFailure.then(
    () => { if (inFlightRequests.get(requestKey) === retainStaleOnFailure) inFlightRequests.delete(requestKey); },
    () => { if (inFlightRequests.get(requestKey) === retainStaleOnFailure) inFlightRequests.delete(requestKey); },
  );
  if (!signal) return retainStaleOnFailure;
  if (signal.aborted) throw new DOMException("The request was aborted.", "AbortError");
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("The request was aborted.", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    retainStaleOnFailure.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
};

export const getPublicCached = <T>(
  url: string,
  params: Record<string, unknown> = {},
  ttlMs: number,
  tags: string[],
  signal?: AbortSignal,
  options: { force?: boolean } = {},
) => fetchFromCache<T>(publicCacheApi, {
  url,
  params,
  ttlMs,
  tags,
  cacheKey: createQueryCacheKey(url, params),
}, signal, options.force);

export const peekPublicCached = <T>(url: string, params: Record<string, unknown> = {}) => {
  const args: CachedRequestArgs = {
    url, params, ttlMs: 0, tags: [], cacheKey: createQueryCacheKey(url, params),
  };
  return publicCacheApi.endpoints.getCached.select(args)(store.getState()).data as T | undefined;
};

/** Subscribe to successful data changes for one public cache entry. */
export const subscribePublicCache = (url: string, listener: () => void, params: Record<string, unknown> = {}) => {
  const args: CachedRequestArgs = {
    url, params, ttlMs: 0, tags: [], cacheKey: createQueryCacheKey(url, params),
  };
  let previousData = publicCacheApi.endpoints.getCached.select(args)(store.getState()).data;
  return store.subscribe(() => {
    const nextData = publicCacheApi.endpoints.getCached.select(args)(store.getState()).data;
    if (nextData === previousData) return;
    previousData = nextData;
    if (nextData !== undefined) listener();
  });
};

export const setPublicCached = (url: string, params: Record<string, unknown>, ttlMs: number, tags: string[], data: unknown) => {
  const args: CachedRequestArgs = { url, params, ttlMs, tags, cacheKey: createQueryCacheKey(url, params) };
  store.dispatch(publicCacheApi.util.upsertQueryData("getCached", args, data) as never);
};

export const getPrivateCached = <T>(
  url: string,
  params: Record<string, unknown> = {},
  ttlMs: number,
  tags: string[],
) => {
  const scope = currentPrivateScope();
  if (!scope) return Promise.reject(new Error("An authenticated customer session is required."));
  return fetchFromCache<T>(privateCacheApi, {
    url,
    params,
    ttlMs,
    tags,
    privateScope: scope,
    cacheKey: createQueryCacheKey(url, params, scope),
  });
};

export const usePrivateCachedQuery = <T>(
  scope: string | null,
  url: string,
  params: Record<string, unknown>,
  ttlMs: number,
  tags: string[],
) => {
  const cacheKey = createQueryCacheKey(url, params, scope ?? "guest");
  const args: CachedRequestArgs = {
    url, params, ttlMs, tags, privateScope: scope ?? undefined, cacheKey,
  };
  const query = privateCacheApi.useGetCachedQuery(args, {
    skip: scope === null,
    refetchOnMountOrArgChange: ttlMs / 1000,
  });
  return { ...query, data: query.data as T | undefined };
};

export const invalidatePublicCache = (tags: Array<{ type: string; id?: string }> | string[]) =>
  store.dispatch(publicCacheApi.util.invalidateTags(tags as never));

export const invalidatePrivateCache = (tags: Array<{ type: string; id?: string }> | string[]) =>
  store.dispatch(privateCacheApi.util.invalidateTags(tags as never));

export const resetPrivateCache = () => store.dispatch(privateCacheApi.util.resetApiState());

export const seedPrivateCache = (url: string, params: Record<string, unknown>, tags: string[], data: unknown) => {
  const scope = currentPrivateScope();
  if (!scope) return;
  const args: CachedRequestArgs = {
    url, params, tags, privateScope: scope, ttlMs: 60_000,
    cacheKey: createQueryCacheKey(url, params, scope),
  };
  store.dispatch(privateCacheApi.util.upsertQueryData("getCached", args, data) as never);
};

interface PublicQueryState {
  status: string;
  fulfilledTimeStamp?: number;
  originalArgs?: CachedRequestArgs;
}

let lastPublicRevalidationAt = 0;
const revalidateStalePublicQueries = () => {
  if (Date.now() - lastPublicRevalidationAt < 5_000) return;
  lastPublicRevalidationAt = Date.now();
  const queries = store.getState().publicCacheApi.queries as Record<string, PublicQueryState>;
  Object.values(queries).forEach((entry) => {
    const args = entry.originalArgs;
    if (!args || entry.status === "pending" || isCacheFresh(entry.fulfilledTimeStamp, args.ttlMs)) return;
    void store.dispatch(publicCacheApi.endpoints.getCached.initiate(args, { subscribe: false, forceRefetch: true }));
  });
};

if (typeof window !== "undefined") {
  const onVisible = () => {
    if (document.visibilityState === "visible") revalidateStalePublicQueries();
  };
  window.addEventListener("focus", revalidateStalePublicQueries);
  window.addEventListener("online", revalidateStalePublicQueries);
  document.addEventListener("visibilitychange", onVisible);
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener("focus", revalidateStalePublicQueries);
      window.removeEventListener("online", revalidateStalePublicQueries);
      document.removeEventListener("visibilitychange", onVisible);
    });
  }
}

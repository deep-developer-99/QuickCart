import { store } from "../store/store";
import {
  ScopedAccountCountCache,
  type AccountCountKind,
} from "./accountCountCacheCore";

export {
  ACCOUNT_COUNT_CACHE_TTL_MS,
  EMPTY_ACCOUNT_COUNTS,
  type AccountCountKind,
  type AccountCountScope,
  type AccountCountSnapshot,
} from "./accountCountCacheCore";

const getActiveScope = () => {
  const { user, revision } = store.getState().auth;
  return user?.role === "user" ? `${user.id}:${revision}` : null;
};
const cache = new ScopedAccountCountCache(getActiveScope);

export const getAccountCountSnapshot = cache.getSnapshot.bind(cache);
export const subscribeToAccountCounts = cache.subscribe.bind(cache);
export const loadAccountCount = cache.load.bind(cache);
export const setAccountCount = cache.set.bind(cache);
export const invalidateAccountCount = cache.invalidate.bind(cache);
export const clearAccountCountCache = () => cache.clear();

export const setCurrentAccountCount = (kind: AccountCountKind, count: number) => {
  const { user, revision } = store.getState().auth;
  if (user?.role !== "user") return;
  cache.set({ userId: user.id, revision }, kind, count);
};

export const invalidateCurrentAccountCount = (kind: AccountCountKind) => {
  const { user, revision } = store.getState().auth;
  if (user?.role !== "user") return;
  cache.invalidate({ userId: user.id, revision }, kind);
};

export const markConfirmedOrderCountStale = (orderId: string | undefined) => {
  if (!orderId) return;
  const { user, revision } = store.getState().auth;
  if (user?.role !== "user") return;
  cache.markConfirmedOrderStale({ userId: user.id, revision }, orderId);
};

let lastObservedScope = getActiveScope();
store.subscribe(() => {
  const nextScope = getActiveScope();
  if (nextScope === lastObservedScope) return;
  lastObservedScope = nextScope;
  cache.clear();
});

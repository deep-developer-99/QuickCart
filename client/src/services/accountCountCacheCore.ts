export const ACCOUNT_COUNT_CACHE_TTL_MS = 60_000;

export type AccountCountKind = "addresses" | "orders";
export interface AccountCountSnapshot {
  addresses: number | null;
  orders: number | null;
}
export interface AccountCountScope {
  userId: string;
  revision: number;
}
export const EMPTY_ACCOUNT_COUNTS: AccountCountSnapshot = { addresses: null, orders: null };

interface CountBucket {
  snapshot: AccountCountSnapshot;
  fetchedAt: Record<AccountCountKind, number>;
  versions: Record<AccountCountKind, number>;
  pending: Record<AccountCountKind, Promise<void> | null>;
  listeners: Set<() => void>;
  confirmedOrderIds: Set<string>;
}

const scopeKey = ({ userId, revision }: AccountCountScope) => `${userId}:${revision}`;
const createBucket = (): CountBucket => ({
  snapshot: EMPTY_ACCOUNT_COUNTS,
  fetchedAt: { addresses: 0, orders: 0 },
  versions: { addresses: 0, orders: 0 },
  pending: { addresses: null, orders: null },
  listeners: new Set(),
  confirmedOrderIds: new Set(),
});

export class ScopedAccountCountCache {
  private readonly buckets = new Map<string, CountBucket>();
  private readonly getActiveScopeKey: () => string | null;

  constructor(getActiveScopeKey: () => string | null) {
    this.getActiveScopeKey = getActiveScopeKey;
  }

  private bucket(scope: AccountCountScope) {
    const key = scopeKey(scope);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = createBucket();
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  private notify(bucket: CountBucket) {
    bucket.listeners.forEach((listener) => listener());
  }

  private isCurrent(scope: AccountCountScope) {
    return this.getActiveScopeKey() === scopeKey(scope);
  }

  getSnapshot(scope: AccountCountScope): AccountCountSnapshot {
    return this.isCurrent(scope) ? this.buckets.get(scopeKey(scope))?.snapshot ?? EMPTY_ACCOUNT_COUNTS : EMPTY_ACCOUNT_COUNTS;
  }

  subscribe(scope: AccountCountScope, listener: () => void) {
    const bucket = this.bucket(scope);
    bucket.listeners.add(listener);
    return () => bucket.listeners.delete(listener);
  }

  load(scope: AccountCountScope, kind: AccountCountKind, loader: () => Promise<number | null>): Promise<void> {
    if (!this.isCurrent(scope)) return Promise.resolve();
    const bucket = this.bucket(scope);
    if (bucket.snapshot[kind] !== null && Date.now() - bucket.fetchedAt[kind] < ACCOUNT_COUNT_CACHE_TTL_MS) return Promise.resolve();
    if (bucket.pending[kind]) return bucket.pending[kind]!;

    const version = bucket.versions[kind];
    const request = Promise.resolve().then(loader).then((count) => {
      if (count === null || !Number.isSafeInteger(count) || count < 0 || !this.isCurrent(scope) || bucket.versions[kind] !== version) return;
      bucket.snapshot = { ...bucket.snapshot, [kind]: count };
      bucket.fetchedAt[kind] = Date.now();
      this.notify(bucket);
    }).finally(() => {
      if (bucket.pending[kind] === request) bucket.pending[kind] = null;
    });
    bucket.pending[kind] = request;
    return request;
  }

  set(scope: AccountCountScope, kind: AccountCountKind, count: number) {
    if (!Number.isSafeInteger(count) || count < 0 || !this.isCurrent(scope)) return;
    const bucket = this.bucket(scope);
    bucket.versions[kind] += 1;
    bucket.snapshot = { ...bucket.snapshot, [kind]: count };
    bucket.fetchedAt[kind] = Date.now();
    this.notify(bucket);
  }

  invalidate(scope: AccountCountScope, kind: AccountCountKind) {
    if (!this.isCurrent(scope)) return;
    const bucket = this.bucket(scope);
    bucket.versions[kind] += 1;
    bucket.fetchedAt[kind] = 0;
    bucket.pending[kind] = null;
    bucket.snapshot = { ...bucket.snapshot };
    this.notify(bucket);
  }

  markConfirmedOrderStale(scope: AccountCountScope, orderId: string) {
    if (!this.isCurrent(scope) || !orderId) return;
    const bucket = this.bucket(scope);
    if (bucket.confirmedOrderIds.has(orderId)) return;
    bucket.confirmedOrderIds.add(orderId);
    if (bucket.confirmedOrderIds.size > 100) {
      const oldest = bucket.confirmedOrderIds.values().next().value;
      if (oldest) bucket.confirmedOrderIds.delete(oldest);
    }
    this.invalidate(scope, "orders");
  }

  clear() {
    const existing = [...this.buckets.values()];
    this.buckets.clear();
    existing.forEach((bucket) => this.notify(bucket));
  }
}

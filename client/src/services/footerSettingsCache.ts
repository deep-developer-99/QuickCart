export class FooterSettingsCache<T> {
  private value: T | null = null;
  private fetchedAt = 0;
  private lastAttemptAt = 0;
  private requestVersion = 0;
  private pending: Promise<T> | null = null;
  private readonly ttlMs: number;
  private readonly retryCooldownMs: number;
  private readonly now: () => number;

  constructor(
    ttlMs: number,
    retryCooldownMs = 15_000,
    now: () => number = Date.now,
  ) {
    this.ttlMs = ttlMs;
    this.retryCooldownMs = retryCooldownMs;
    this.now = now;
  }

  get(loader: () => Promise<T>): Promise<T> {
    const currentTime = this.now();
    if (this.value !== null && currentTime - this.fetchedAt < this.ttlMs) {
      return Promise.resolve(this.value);
    }
    if (this.pending) return this.pending;
    if (this.value !== null && currentTime - this.lastAttemptAt < this.retryCooldownMs) {
      return Promise.resolve(this.value);
    }

    const version = this.requestVersion;
    const staleValue = this.value;
    this.lastAttemptAt = currentTime;

    const request = Promise.resolve().then(loader).then((loadedValue) => {
      if (version === this.requestVersion) {
        this.value = loadedValue;
        this.fetchedAt = this.now();
      }
      return this.value ?? loadedValue;
    }).catch((error: unknown) => {
      if (version !== this.requestVersion && this.value !== null) return this.value;
      if (staleValue !== null) return staleValue;
      throw error;
    }).finally(() => {
      if (this.pending === request) this.pending = null;
    });

    this.pending = request;
    return request;
  }

  update(value: T) {
    this.requestVersion += 1;
    this.value = value;
    this.fetchedAt = this.now();
    this.lastAttemptAt = this.fetchedAt;
  }

  invalidate() {
    this.requestVersion += 1;
    this.fetchedAt = Number.NEGATIVE_INFINITY;
    this.lastAttemptAt = 0;
    this.pending = null;
  }
}

import test from "node:test";
import assert from "node:assert/strict";
import { ScopedAccountCountCache } from "../accountCountCacheCore.ts";

const scopeA = { userId: "customer-a", revision: 3 };

test("deduplicates simultaneous loads and reuses a fresh count", async () => {
  let active = "customer-a:3";
  const cache = new ScopedAccountCountCache(() => active);
  let calls = 0;
  let release;
  const loader = () => {
    calls += 1;
    return new Promise((resolve) => { release = resolve; });
  };

  const first = cache.load(scopeA, "addresses", loader);
  const second = cache.load(scopeA, "addresses", loader);
  await Promise.resolve();
  assert.equal(calls, 1);
  release(4);
  await Promise.all([first, second]);
  await cache.load(scopeA, "addresses", loader);
  assert.equal(calls, 1);
  assert.equal(cache.getSnapshot(scopeA).addresses, 4);
});

test("expired count revalidates, retaining the last count on failure", async () => {
  let active = "customer-a:3";
  const cache = new ScopedAccountCountCache(() => active);
  const originalNow = Date.now;
  let now = 1_000;
  Date.now = () => now;
  try {
    await cache.load(scopeA, "orders", async () => 7);
    now += 60_001;
    await assert.rejects(cache.load(scopeA, "orders", async () => { throw new Error("offline"); }));
    assert.equal(cache.getSnapshot(scopeA).orders, 7);
    await cache.load(scopeA, "orders", async () => 8);
    assert.equal(cache.getSnapshot(scopeA).orders, 8);
  } finally {
    Date.now = originalNow;
  }
});

test("old user responses cannot update the active user's count", async () => {
  let active = "customer-a:3";
  const cache = new ScopedAccountCountCache(() => active);
  let release;
  const pending = cache.load(scopeA, "orders", () => new Promise((resolve) => { release = resolve; }));
  await Promise.resolve();
  active = "customer-b:4";
  release(99);
  await pending;
  assert.equal(cache.getSnapshot(scopeA).orders, null);
  assert.equal(cache.getSnapshot({ userId: "customer-b", revision: 4 }).orders, null);
});

test("confirmed order invalidation is idempotent", async () => {
  let active = "customer-a:3";
  const cache = new ScopedAccountCountCache(() => active);
  await cache.load(scopeA, "orders", async () => 2);
  cache.markConfirmedOrderStale(scopeA, "order-1");
  cache.markConfirmedOrderStale(scopeA, "order-1");
  let refreshed = 0;
  await cache.load(scopeA, "orders", async () => { refreshed += 1; return 3; });
  assert.equal(refreshed, 1);
  assert.equal(cache.getSnapshot(scopeA).orders, 3);
});

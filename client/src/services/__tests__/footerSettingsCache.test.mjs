import assert from "node:assert/strict";
import test from "node:test";
import { FooterSettingsCache } from "../footerSettingsCache.ts";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

test("deduplicates concurrent reads and reuses the value until TTL expiry", async () => {
  let now = 100;
  let calls = 0;
  const cache = new FooterSettingsCache(300_000, 15_000, () => now);
  const pending = deferred();
  const loader = () => { calls += 1; return pending.promise; };

  const first = cache.get(loader);
  const second = cache.get(loader);
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  pending.resolve({ copyright: "fresh" });
  assert.deepEqual(await first, { copyright: "fresh" });

  now += 299_999;
  assert.deepEqual(await cache.get(loader), { copyright: "fresh" });
  assert.equal(calls, 1);

  now += 1;
  const refresh = deferred();
  const revalidated = cache.get(() => { calls += 1; return refresh.promise; });
  await Promise.resolve();
  assert.equal(calls, 2);
  refresh.resolve({ copyright: "updated" });
  assert.deepEqual(await revalidated, { copyright: "updated" });
});

test("retains stale successful settings on refresh failure and permits recovery", async () => {
  let now = 1_000_000;
  const cache = new FooterSettingsCache(100, 50, () => now);
  cache.update({ copyright: "last good" });
  now += 100;
  await assert.doesNotReject(cache.get(() => Promise.reject(new Error("offline"))));
  assert.deepEqual(await cache.get(() => Promise.reject(new Error("should be cooled down"))), { copyright: "last good" });
  now += 50;
  assert.deepEqual(await cache.get(async () => ({ copyright: "recovered" })), { copyright: "recovered" });
});

test("a response started before invalidation cannot overwrite newer settings", async () => {
  const cache = new FooterSettingsCache(300_000);
  const oldRequest = deferred();
  const oldResult = cache.get(() => oldRequest.promise);
  await Promise.resolve();

  cache.update({ copyright: "admin update" });
  oldRequest.resolve({ copyright: "old response" });

  assert.deepEqual(await oldResult, { copyright: "admin update" });
  assert.deepEqual(await cache.get(async () => ({ copyright: "unexpected" })), { copyright: "admin update" });
});

test("explicit invalidation starts a fresh request and fences off the old pending response", async () => {
  let now = 2_000_000;
  const cache = new FooterSettingsCache(100, 10, () => now);
  cache.update({ copyright: "initial" });
  now += 100;
  const oldRequest = deferred();
  const oldResult = cache.get(() => oldRequest.promise);
  await Promise.resolve();

  cache.invalidate();
  const freshRequest = deferred();
  const freshResult = cache.get(() => freshRequest.promise);
  await Promise.resolve();
  freshRequest.resolve({ copyright: "after invalidation" });
  assert.deepEqual(await freshResult, { copyright: "after invalidation" });

  oldRequest.resolve({ copyright: "old response" });
  assert.deepEqual(await oldResult, { copyright: "after invalidation" });
  assert.deepEqual(await cache.get(async () => ({ copyright: "unexpected" })), { copyright: "after invalidation" });
});

test("clears a rejected cold request so later calls can retry", async () => {
  const cache = new FooterSettingsCache(300_000);
  await assert.rejects(cache.get(() => Promise.reject(new Error("offline"))), /offline/);
  assert.deepEqual(await cache.get(async () => ({ copyright: "recovered" })), { copyright: "recovered" });
});

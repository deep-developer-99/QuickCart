import test from "node:test";
import assert from "node:assert/strict";
import { createQueryCacheKey, isCacheFresh, PRIVATE_CACHE_TTL_MS, PUBLIC_CACHE_TTL_MS } from "../cachePolicy.ts";

test("public and private freshness windows match the website cache policy", () => {
  assert.equal(PUBLIC_CACHE_TTL_MS.categories, 15 * 60_000);
  assert.equal(PUBLIC_CACHE_TTL_MS.banners, 10 * 60_000);
  assert.equal(PUBLIC_CACHE_TTL_MS.products, 60_000);
  assert.equal(PUBLIC_CACHE_TTL_MS.searchSuggestions, 5 * 60_000);
  assert.equal(PUBLIC_CACHE_TTL_MS.footerSettings, 5 * 60_000);
  assert.equal(PRIVATE_CACHE_TTL_MS.addresses, 60_000);
  assert.equal(PRIVATE_CACHE_TTL_MS.orders, 30_000);
  assert.equal(PRIVATE_CACHE_TTL_MS.orderDetails, 30_000);
});

test("cache freshness expires at the configured boundary", () => {
  assert.equal(isCacheFresh(1_000, 60_000, 60_999), true);
  assert.equal(isCacheFresh(1_000, 60_000, 61_000), false);
  assert.equal(isCacheFresh(undefined, 60_000, 1_000), false);
});

test("cache keys include scope and all response-affecting params in stable order", () => {
  assert.equal(createQueryCacheKey("/products", { category: "c1", page: 1 }), createQueryCacheKey("/products", { page: 1, category: "c1" }));
  assert.notEqual(createQueryCacheKey("/products", { page: 1 }), createQueryCacheKey("/products", { page: 2 }));
  assert.notEqual(createQueryCacheKey("/addresses", { page: 1 }, "user:a:1"), createQueryCacheKey("/addresses", { page: 1 }, "user:b:2"));
});

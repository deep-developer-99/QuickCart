import assert from "node:assert/strict";
import test from "node:test";
import { isPublicReadRequest, shouldCancelForAuthChange } from "../authRequestPolicy.ts";

const guestOwner = { userId: null, revision: 0 };
const guestAfterAuthCheck = { userId: null, revision: 1 };

test("a public categories response survives guest auth initialization revision changes", () => {
  assert.equal(isPublicReadRequest("get", "/categories"), true);
  assert.equal(shouldCancelForAuthChange(guestOwner, guestAfterAuthCheck, "get", "/categories"), false);
});

test("explicit public content reads survive auth changes while protected reads remain guarded", () => {
  for (const url of [
    "/api/categories/catalog",
    "/categories/65abc/subcategories",
    "/products",
    "/products/category/65abc",
    "/products/65abc",
    "/banners",
    "/promotional-banners",
    "/footer-settings",
    "/homepage-sections",
    "/search-suggestions",
    "/theme/public",
  ]) {
    assert.equal(isPublicReadRequest("GET", url), true, url);
    assert.equal(shouldCancelForAuthChange(guestOwner, guestAfterAuthCheck, "GET", url), false, url);
  }

  for (const [method, url] of [
    ["GET", "/addresses"],
    ["GET", "/orders/my-orders"],
    ["GET", "/products/vendor"],
    ["GET", "/admin/categories"],
    ["POST", "/categories"],
    ["GET", "/notifications"],
  ]) {
    assert.equal(isPublicReadRequest(method, url), false, `${method} ${url}`);
    assert.equal(shouldCancelForAuthChange(guestOwner, guestAfterAuthCheck, method, url), true, `${method} ${url}`);
  }
});

test("a request for another authenticated user is still cancelled when protected", () => {
  assert.equal(shouldCancelForAuthChange(
    { userId: "user-a", revision: 4 },
    { userId: "user-b", revision: 6 },
    "GET",
    "/addresses",
  ), true);
});


import assert from "node:assert/strict";
import test from "node:test";
import { formatIndianRupees, getCartQuantity, getCartSubtotal, hasValidCartItems } from "../hasValidCartItems.ts";
import { normalizeAuthUser } from "../normalizeAuthUser.ts";
import { normalizeCartResponse } from "../normalizeCartResponse.ts";
import authReducer, { setCredentials } from "../../store/slice/authSlice.ts";

test("normalizes MongoDB _id and frontend id while retaining account properties", () => {
  const source = {
    _id: "user-1",
    name: "QuickCart User",
    role: "user",
    isActive: true,
    phone: "1234567890",
  };

  assert.deepEqual(normalizeAuthUser(source), {
    ...source,
    id: "user-1",
  });
  assert.equal(normalizeAuthUser({ id: "user-2", role: "user" })?.id, "user-2");
  assert.equal(normalizeAuthUser({ _id: "user-3" }), null);
});

test("auth state receives the normalized identifier from /me-shaped credentials", () => {
  const next = authReducer(undefined, setCredentials({
    _id: "user-from-me",
    name: "QuickCart User",
    role: "user",
  }));

  assert.equal(next.user?.id, "user-from-me");
  assert.equal(next.user?._id, "user-from-me");
  assert.equal(next.isAuthenticated, true);
  assert.equal(next.isLoading, false);
});

test("normalizes the observed nested cart payload with string product IDs", () => {
  const cart = normalizeCartResponse({
    data: {
      id: "cart-1",
      user: "user-1",
      items: [
        { product: "product-1", quantity: 2 },
        { product: "product-2", quantity: "8" },
      ],
    },
  }, "user-1");

  assert.equal(cart?._id, "cart-1");
  assert.deepEqual(cart?.items.map(({ product, quantity }) => [product, quantity]), [
    ["product-1", 2],
    ["product-2", 8],
  ]);
});

test("normalizes populated product IDs, drops invalid entries, and merges duplicates", () => {
  const cart = normalizeCartResponse({
    success: true,
    data: {
      _id: "cart-2",
      user: "user-1",
      items: [
        { product: { id: "product-1", name: "Tea" }, quantity: 1 },
        { product: "product-1", quantity: 2 },
        { product: { _id: "product-2", name: "Coffee" }, quantity: 0 },
        { product: null, quantity: 5 },
      ],
    },
  }, "user-1");

  assert.equal(cart?.items.length, 1);
  assert.equal(cart?.items[0].quantity, 3);
  assert.equal(typeof cart?.items[0].product, "object");
  assert.equal(cart?.items[0].product._id, "product-1");
});

test("rejects a cart response belonging to another user", () => {
  assert.equal(normalizeCartResponse({
    data: { id: "cart-3", user: "user-A", items: [] },
  }, "user-B"), null);
});

test("does not treat an unsuccessful API response as an initialized cart", () => {
  assert.equal(normalizeCartResponse({
    success: false,
    data: { id: "cart-4", user: "user-1", items: [] },
  }, "user-1"), null);
});

test("shared quantity lookup matches string IDs and populated _id/id objects", () => {
  const cart = normalizeCartResponse({
    items: [
      { product: "product-1", quantity: 2 },
      { product: { id: "product-2", name: "Coffee" }, quantity: 10 },
    ],
  }, "user-1");

  assert.equal(getCartQuantity(cart, "product-1"), 2);
  assert.equal(getCartQuantity(cart, "product-2"), 10);
  assert.equal(getCartQuantity(cart, "missing"), 0);
  assert.equal(hasValidCartItems(cart), true);
  assert.equal(hasValidCartItems({ _id: "cart-empty", user: "user-1", items: [] }), false);
});

test("shared subtotal uses the cart selling-price rule and Indian rupee formatting", () => {
  const cart = normalizeCartResponse({
    items: [
      { product: { _id: "soda", name: "Diet Coke", price: 50 }, quantity: 3 },
      { product: { _id: "latte", name: "Nescafe", price: 70, discountPrice: 59 }, quantity: 5 },
    ],
  }, "user-1");

  assert.equal(getCartSubtotal(cart.items), 445);
  assert.equal(formatIndianRupees(445), "₹445");
  assert.equal(getCartSubtotal([{ product: "id-only", quantity: 1 }]), null);
});

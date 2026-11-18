import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCheckoutItems } from "../checkoutService";

test("checkout payload accepts only product, variant, and bounded quantity lines", () => {
  const lines = normalizeCheckoutItems([
    { productId: "507f1f77bcf86cd799439011", variantId: "507f1f77bcf86cd799439012", quantity: 2 },
  ]);
  assert.deepEqual(lines, [
    { productId: "507f1f77bcf86cd799439011", variantId: "507f1f77bcf86cd799439012", quantity: 2 },
  ]);
});

test("checkout payload rejects invalid quantities and duplicate variants", () => {
  const productId = "507f1f77bcf86cd799439011";
  const variantId = "507f1f77bcf86cd799439012";
  assert.throws(() => normalizeCheckoutItems([{ productId, variantId, quantity: 0 }]), /quantity must be between 1 and 99/i);
  assert.throws(() => normalizeCheckoutItems([
    { productId, variantId, quantity: 1 },
    { productId, variantId, quantity: 1 },
  ]), /duplicate product variants/i);
});

test("checkout payload rejects empty or malformed cart lines", () => {
  assert.throws(() => normalizeCheckoutItems([]), /between 1 and 50/i);
  assert.throws(() => normalizeCheckoutItems([{ productId: "bad", variantId: "bad", quantity: 1 }]), /valid product and variant/i);
});

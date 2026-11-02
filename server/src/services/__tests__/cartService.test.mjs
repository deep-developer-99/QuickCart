import assert from "node:assert/strict";
import test from "node:test";
import { addToCart, updateCartItem } from "../cartService.ts";

test("add-to-cart rejects quantities that are not positive whole numbers", async () => {
  for (const quantity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(
      addToCart("user-id", "product-id", quantity),
      /positive whole number/,
    );
  }
});

test("cart quantity updates reject quantities that are not positive whole numbers", async () => {
  for (const quantity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(
      updateCartItem("user-id", "product-id", quantity),
      /positive whole number/,
    );
  }
});

test("cart mutations reject malformed product identifiers before database access", async () => {
  await assert.rejects(addToCart("user-id", "not-an-object-id", 1), /Product not found/);
  await assert.rejects(updateCartItem("user-id", "not-an-object-id", 1), /Product not found/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { removePurchasedCartSnapshot } from "../cartOrderSnapshot.ts";

const makeItem = (productId, variantId, quantity) => ({
  product: {
    _id: productId,
    name: productId,
    variants: [{ _id: variantId, stock: 20 }],
  },
  variantId,
  quantity,
});

test("removes only the submitted quantities and preserves later cart additions", () => {
  const cart = {
    _id: "local:user-a",
    user: "user-a",
    items: [makeItem("milk", "1l", 4), makeItem("bread", "loaf", 1)],
  };

  const updated = removePurchasedCartSnapshot(cart, "user-a", [
    { productId: "milk", variantId: "1l", quantity: 2 },
  ]);

  assert.deepEqual(updated.items.map(({ product, quantity }) => [product._id, quantity]), [
    ["milk", 2],
    ["bread", 1],
  ]);
  assert.equal(cart.items[0].quantity, 4, "the submitted snapshot is not mutated");
});

test("leaves another account's cart untouched", () => {
  const cart = { _id: "local:user-b", user: "user-b", items: [makeItem("milk", "1l", 2)] };
  assert.equal(removePurchasedCartSnapshot(cart, "user-a", [
    { productId: "milk", variantId: "1l", quantity: 2 },
  ]), cart);
});

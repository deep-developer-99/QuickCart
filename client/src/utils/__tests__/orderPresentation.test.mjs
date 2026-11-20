import assert from "node:assert/strict";
import test from "node:test";
import { getOrderBill, getOrderLineAmount } from "../orderPresentation.ts";

test("the bill uses order snapshots and reconciles discounts and recorded charges in paise", () => {
  const items = [
    { price: 30, finalPrice: 19.95, discountedPrice: 20, quantity: 2 },
    { price: 22, discountedPrice: 14.1, quantity: 1 },
  ];
  assert.equal(getOrderLineAmount(items[0]), 39.9);
  assert.deepEqual(getOrderBill({ items, shippingAmount: 40, donationAmount: 1, totalAmount: 95 }), {
    itemTotal: 54, delivery: 40, donation: 1, total: 95,
  });
});

test("older orders retain their authoritative total without a reconstructed breakdown", () => {
  const items = [{ price: 100, discountPrice: 90, quantity: 1 }];
  assert.equal(getOrderLineAmount(items[0]), 90);
  assert.deepEqual(getOrderBill({ items, totalAmount: 132 }), {
    itemTotal: undefined, delivery: undefined, donation: undefined, total: 132,
  });
  assert.deepEqual(getOrderBill({ items, shippingAmount: 0, donationAmount: 0, totalAmount: 90 }), {
    itemTotal: 90, delivery: undefined, donation: undefined, total: 90,
  });
});

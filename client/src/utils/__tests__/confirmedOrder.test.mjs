import assert from "node:assert/strict";
import test from "node:test";
import { getConfirmedOrder } from "../confirmedOrder.ts";

test("accepts only an explicitly successful response containing an order", () => {
  const order = { _id: "order-1" };
  assert.equal(getConfirmedOrder({ success: true, data: { order } }, "failed"), order);
  assert.throws(() => getConfirmedOrder({ success: false, data: { order } }, "failed"), /failed/);
  assert.throws(() => getConfirmedOrder({ success: true, data: {} }, "failed"), /failed/);
});

import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "node:net";
import app from "../../app";
import User from "../../models/User";
import Vendor from "../../models/Vendor";

const stub = (target: object, key: string, value: unknown) => {
  const previous = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => previous ? Object.defineProperty(target, key, previous) : Reflect.deleteProperty(target, key);
};

test("bulk subcategory route returns 401 to guests and 403 to authenticated customers and vendors", async () => {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "isolated-test-jwt-secret";
  const restoreVendor = stub(Vendor, "findById", () => ({
    select: async () => ({ _id: "64b000000000000000000009", status: "approved", isActive: true }),
  }));
  const restoreUser = stub(User, "findById", () => ({
    select: async () => ({ _id: "64b000000000000000000008", isActive: true }),
  }));
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const url = `http://127.0.0.1:${port}/api/admin/subcategories/bulk`;
    const guest = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const vendorToken = jwt.sign({ id: "64b000000000000000000009", role: "vendor" }, process.env.JWT_SECRET);
    const customerToken = jwt.sign({ id: "64b000000000000000000008", role: "user" }, process.env.JWT_SECRET);
    const vendor = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${vendorToken}` },
      body: "{}",
    });
    const customer = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: "{}",
    });
    assert.equal(guest.status, 401);
    assert.equal(vendor.status, 403);
    assert.equal(customer.status, 403);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    restoreVendor();
    restoreUser();
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
});

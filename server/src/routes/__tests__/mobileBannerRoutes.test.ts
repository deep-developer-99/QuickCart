import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import app from "../../app";
import Banner from "../../models/Banner";
import MobileBanner from "../../models/MobileBanner";

const stub = (target: object, key: string, value: unknown) => {
  const previous = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => previous ? Object.defineProperty(target, key, previous) : Reflect.deleteProperty(target, key);
};

test("guest mobile feed is independent of website banners and Admin writes require authentication", async () => {
  const restoreMobile = stub(MobileBanner, "find", () => ({ sort() { return this; }, lean: async () => [] }));
  const restoreWebsite = stub(Banner, "findOne", () => ({ sort: async () => ({ _id: "website-only", image: "https://example.com/website.png" }) }));
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>(resolve => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const mobile = await fetch(`http://127.0.0.1:${port}/api/mobile-banners`);
    const website = await fetch(`http://127.0.0.1:${port}/api/banners`);
    const admin = await fetch(`http://127.0.0.1:${port}/api/admin/mobile-banners`, { method: "POST" });
    assert.equal(mobile.status, 200);
    assert.deepEqual((await mobile.json()).data, []);
    assert.equal((await website.json()).data.length, 1);
    assert.equal(admin.status, 401);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    restoreWebsite(); restoreMobile();
  }
});

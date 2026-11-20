import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import app from "../../app.js";
import User from "../../models/User";
import { migrateCustomerLifecycle } from "../../scripts/migrateCustomerLifecycle";
import { resolveGoogleCustomer, resolvePhoneCustomer } from "../customerIdentityService";
import { deactivateCustomer, validateDeletion } from "../accountDeletionService";
import { deletionReasons } from "../../utils/customerLifecycle";

test("deletion input rejects impersonation, invalid reasons, and excessive feedback", () => {
  for (const input of [null, [], { reason: "invalid" }, { reason: deletionReasons[0], userId: "someone-else" }, { reason: deletionReasons[0], feedback: "a".repeat(1001) }]) {
    assert.throws(() => validateDeletion(input));
  }
  assert.deepEqual(validateDeletion({ reason: deletionReasons[0], feedback: "  hello\u0000\nworld  " }), { reason: deletionReasons[0], feedback: "hello\nworld" });
});

test("customer migration, deletion, authentication, and fresh account isolation", { skip: !process.env.ACCOUNT_TEST_MONGO_URI, timeout: 60000 }, async () => {
  const uri = process.env.ACCOUNT_TEST_MONGO_URI!;
  const parsed = new URL(uri);
  assert.ok(["127.0.0.1", "localhost"].includes(parsed.hostname), "Use an isolated local MongoDB server.");
  assert.match(parsed.pathname, /^\/quickcart_lifecycle_test_[a-zA-Z0-9_-]+$/);
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 5000 });
  assert.equal(await User.collection.countDocuments(), 0, "Use a fresh scratch database.");
  process.env.JWT_SECRET = "account-lifecycle-local-tests-only";
  process.env.CLIENT_URL = "http://localhost:5173";

  const oldId = new mongoose.Types.ObjectId();
  const secondId = new mongoose.Types.ObjectId();
  const email = "customer@example.test";
  const phone = "+919876543210";
  await User.collection.insertMany([
    { _id: oldId, name: "Legacy customer", email, phone, googleId: "old-google", role: "user", fcmTokens: ["old-device"] },
    { _id: secondId, name: "Historical account", email: "history@example.test", isActive: false, role: "user" },
  ]);
  await User.collection.createIndex({ email: 1 }, { unique: true, sparse: true });
  await User.collection.createIndex({ phone: 1 }, { unique: true, sparse: true });
  await User.collection.createIndex({ googleId: 1 }, { unique: true, sparse: true });
  await User.collection.createIndex({ name: 1 }, { name: "unrelated_name_index" });
  const backups = await mkdtemp(path.join(os.tmpdir(), "quickcart-account-backup-"));
  await migrateCustomerLifecycle();
  assert.equal((await User.collection.findOne({ _id: oldId }))?.isActive, undefined);
  await migrateCustomerLifecycle(backups, true);
  await migrateCustomerLifecycle(backups);
  assert.equal((await User.findById(oldId))?.isActive, true);
  assert.equal((await User.findById(secondId))?.isActive, false);
  assert.ok((await User.collection.indexes()).some((index) => index.name === "unrelated_name_index"));
  const snapshot = (await readdir(backups))[0];
  assert.ok((await readFile(path.join(backups, snapshot, "users.ndjson"), "utf8")).includes("Legacy customer"));

  // Historical ownership remains anchored to the old ID.
  const addressId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const itemId = new mongoose.Types.ObjectId();
  await mongoose.connection.collection("addresses").insertOne({ _id: addressId, user: oldId, fullName: "Legacy", addressLine: "Private old address" });
  await mongoose.connection.collection("orders").insertOne({ _id: orderId, user: oldId, items: [], address: addressId, status: "Delivered", paymentStatus: "PAID", totalAmount: 100 });
  await mongoose.connection.collection("carts").insertOne({ user: oldId, items: [] });
  await mongoose.connection.collection("wishlists").insertOne({ user: oldId, products: [] });
  await mongoose.connection.collection("usernotifications").insertOne({ recipient: oldId, recipientRole: "user", sender: itemId, senderRole: "admin", title: "Old private notice", campaignId: "old", deletedAt: null });

  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as import("node:net").AddressInfo).port;
  const token = jwt.sign({ id: oldId.toString(), role: "user" }, process.env.JWT_SECRET);
  const call = async (route: string, method = "GET", body?: unknown, auth = token, headers: Record<string, string> = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}/api${route}`, {
      method,
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get("set-cookie"),
      retryAfter: response.headers.get("retry-after"),
    };
  };
  try {
    assert.equal((await call("/auth/delete-account", "POST", { reason: deletionReasons[0] }, "")).status, 401);
    const csrf = await call("/auth/delete-account/confirmation", "POST", {}, "", { Cookie: `token=${token}`, Origin: "https://attacker.example" });
    assert.equal(csrf.status, 403);
    const stale = jwt.sign({ id: oldId.toString(), role: "user", iat: Math.floor(Date.now() / 1000) - 3600 }, process.env.JWT_SECRET);
    assert.equal((await call("/auth/delete-account/confirmation", "POST", {}, stale)).body.code, "REAUTH_REQUIRED");
    await User.updateOne({ _id: oldId }, { $unset: { confirmationAttemptAt: "" } });
    const context = await call("/auth/delete-account/confirmation", "POST", {});
    assert.equal(context.status, 200);
    const repeatedConfirmation = await call("/auth/delete-account/confirmation", "POST", {});
    assert.equal(repeatedConfirmation.status, 429);
    assert.equal(repeatedConfirmation.body.code, "RATE_LIMITED");
    assert.ok(Number(repeatedConfirmation.body.retryAfterSeconds) >= 1);
    assert.ok(Number(repeatedConfirmation.retryAfter) >= 1);
    const confirmationToken = context.body.confirmationToken;
    await User.updateOne({ _id: oldId }, { $set: { activeCheckoutRequests: 1 } });
    await assert.rejects(() => deactivateCustomer(oldId.toString(), { reason: deletionReasons[0] }), /checkout/);
    await User.updateOne({ _id: oldId }, { $set: { activeCheckoutRequests: 0, pendingRazorpayOrders: ["payment-pending"] } });
    await assert.rejects(() => deactivateCustomer(oldId.toString(), { reason: deletionReasons[0] }), /checkout/);
    await User.updateOne({ _id: oldId }, { $set: { pendingRazorpayOrders: [] } });

    const response = await call("/auth/delete-account", "POST", { reason: deletionReasons[2], feedback: "Thanks", confirmationToken });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.match(response.cookie ?? "", /token=;/);
    const old = await User.findById(oldId).select("+deletionReason");
    assert.equal(old?.isActive, false);
    assert.equal(old?.deletionReason, deletionReasons[2]);
    assert.ok(old?.deletedAt);
    assert.deepEqual(old?.fcmTokens, []);
    assert.equal((await User.findById(oldId).lean())?.deletionReason, undefined);
    assert.equal((await call("/auth/delete-account", "POST", { reason: deletionReasons[0], confirmationToken })).status, 401);
    await deactivateCustomer(oldId.toString(), { reason: deletionReasons[0] });
    assert.equal((await User.findById(oldId).select("+deletionReason"))?.deletionReason, deletionReasons[2]);
    for (const endpoint of ["/auth/me", "/addresses", "/orders/my-orders", "/wishlist", "/cart", "/notifications"]) {
      assert.equal((await call(endpoint)).status, 401, endpoint);
    }

    const googleAccounts = await Promise.all(Array.from({ length: 4 }, () => resolveGoogleCustomer({ googleId: "old-google", email, name: "New customer" })));
    const fresh = googleAccounts[0];
    assert.ok(!fresh._id.equals(oldId));
    assert.equal(new Set(googleAccounts.map((entry) => entry._id.toString())).size, 1);
    assert.equal((await resolveGoogleCustomer({ googleId: "old-google", email }))._id.toString(), fresh._id.toString());
    const phoneAccounts = await Promise.all(Array.from({ length: 4 }, () => resolvePhoneCustomer(phone, "Fresh phone")));
    assert.equal(new Set(phoneAccounts.map((entry) => entry._id.toString())).size, 1);
    assert.ok(!phoneAccounts[0]._id.equals(oldId));
    assert.equal(await User.countDocuments({ isActive: true, email }), 1);
    assert.equal(await User.countDocuments({ isActive: true, phone }), 1);
    await assert.rejects(() => User.create({ name: "Duplicate", email, isActive: true }), (error: unknown) => (error as { code: number }).code === 11000);

    const freshToken = jwt.sign({ id: fresh._id.toString(), role: "user" }, process.env.JWT_SECRET);
    for (const endpoint of ["/addresses", "/orders/my-orders"]) {
      const result = await call(endpoint, "GET", undefined, freshToken);
      assert.equal(result.status, 200);
      assert.deepEqual(result.body.data, []);
    }
    assert.equal((await call(`/orders/${orderId}`, "GET", undefined, freshToken)).status, 404);
    for (const collection of ["addresses", "orders", "usernotifications"]) {
      assert.equal(await mongoose.connection.collection(collection).countDocuments({ [collection === "usernotifications" ? "recipient" : "user"]: oldId }), 1);
    }
    const { getEligibleCustomers, registerFcmToken } = await import("../notificationService.js");
    assert.equal(await registerFcmToken(oldId.toString(), "user", "new-device"), null);
    const eligible = await getEligibleCustomers("admin", undefined);
    assert.ok(!eligible.data.some((customer: { _id: mongoose.Types.ObjectId }) => customer._id.equals(oldId)));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  }
});

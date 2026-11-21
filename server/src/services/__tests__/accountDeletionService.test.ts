import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware";
import { deleteAccountController } from "../../controllers/accountDeletionController";
import User from "../../models/User";
import CashfreePaymentAttempt from "../../models/CashfreePaymentAttempt";
import AccountDeletionFeedback from "../../models/AccountDeletionFeedback";
import { customerIdentityIndexes, deletionReasons } from "../../utils/customerLifecycle";
import { deactivateCustomer } from "../accountDeletionService";

const userId = "507f1f77bcf86cd799439011";
const input = { reason: deletionReasons[0], feedback: "Optional feedback" };

const mockStorage = (context: import("node:test").TestContext) => {
  let active = true;
  type IndexFixture = { key: Record<string, number>; name: string; unique: boolean; partialFilterExpression?: Record<string, unknown> };
  const indexes = context.mock.method(User.collection, "indexes", async (): Promise<IndexFixture[]> => customerIdentityIndexes);
  const missingStatus = context.mock.method(User.collection, "findOne", async (): Promise<{ _id: string } | null> => null);
  const payment = context.mock.method(CashfreePaymentAttempt, "exists", async (): Promise<{ _id: string } | null> => null);
  const write = context.mock.method(User, "updateOne", async () => {
    const matchedCount = Number(active);
    active = false;
    return { matchedCount };
  });
  const readConcern = context.mock.fn(async () => active ? null : { _id: userId });
  const read = context.mock.fn(() => ({ readConcern }));
  context.mock.method(User, "exists", () => ({ read }));
  const feedback = context.mock.method(AccountDeletionFeedback, "updateOne", async () => ({}));
  return { indexes, missingStatus, payment, write, read, readConcern, feedback, isActive: () => active, commit: () => { active = false; } };
};

test("legacy or malformed identity indexes block deletion before payments or writes", async (context) => {
  const db = mockStorage(context);
  db.indexes.mock.mockImplementationOnce(async () => [
    { key: { email: 1 }, name: "email_1", unique: true },
    { ...customerIdentityIndexes[0], partialFilterExpression: { ...customerIdentityIndexes[0]?.partialFilterExpression, tenant: "one" } },
  ]);
  await assert.rejects(deactivateCustomer(userId, input), {
    statusCode: 503, code: "MIGRATION_REQUIRED",
    indexIssues: { invalidActiveIndexes: customerIdentityIndexes.map((index) => index.name), legacyIdentityFields: ["email"] },
  });
  assert.equal(db.payment.mock.callCount(), 0);
  assert.equal(db.write.mock.callCount(), 0);
  assert.equal(db.isActive(), true);
});

test("replacement indexes alone do not make a missing status ready", async (context) => {
  const db = mockStorage(context);
  db.missingStatus.mock.mockImplementationOnce(async () => ({ _id: userId }));
  await assert.rejects(deactivateCustomer(userId, input), {
    statusCode: 503, code: "MIGRATION_REQUIRED",
    indexIssues: { invalidActiveIndexes: [], legacyIdentityFields: [], hasMissingIsActive: true },
  });
  assert.equal(db.payment.mock.callCount(), 0);
  assert.equal(db.write.mock.callCount(), 0);
});

test("index connectivity failure leaves account and feedback untouched", async (context) => {
  const db = mockStorage(context);
  const failure = new Error("Database connection lost");
  db.indexes.mock.mockImplementationOnce(async () => { throw failure; });
  await assert.rejects(deactivateCustomer(userId, input), (error) => error === failure);
  assert.equal(db.write.mock.callCount(), 0);
  assert.equal(db.feedback.mock.callCount(), 0);
  assert.equal(db.isActive(), true);
});

test("Cashfree payment and checkout safeguards prevent deactivation", async (context) => {
  const db = mockStorage(context);
  db.payment.mock.mockImplementationOnce(async () => ({ _id: userId }));
  await assert.rejects(deactivateCustomer(userId, input), { statusCode: 409, code: "PAYMENT_PENDING" });
  assert.equal(db.write.mock.callCount(), 0);
  db.write.mock.mockImplementationOnce(async () => ({ matchedCount: 0 }));
  await assert.rejects(deactivateCustomer(userId, input), { statusCode: 409, code: "PAYMENT_PENDING" });
  assert.equal(db.isActive(), true);
  assert.equal(db.feedback.mock.callCount(), 0);
});

test("successful and duplicate requests retain one deactivation and one feedback write", async (context) => {
  const db = mockStorage(context);
  await Promise.all([deactivateCustomer(userId, input), deactivateCustomer(userId, input)]);
  assert.equal(db.isActive(), false);
  assert.equal(db.feedback.mock.callCount(), 1);
});

test("write conflict or unavailable reconciliation preserves the original failure", async (context) => {
  const db = mockStorage(context);
  const conflict = Object.assign(new Error("Write conflict"), { code: 112 });
  db.write.mock.mockImplementationOnce(async () => { throw conflict; });
  await assert.rejects(deactivateCustomer(userId, input), (error) => error === conflict);
  db.write.mock.mockImplementationOnce(async () => { throw conflict; });
  db.readConcern.mock.mockImplementationOnce(async () => { throw new Error("Read unavailable"); });
  await assert.rejects(deactivateCustomer(userId, input), (error) => error === conflict);
  assert.equal(db.isActive(), true);
  assert.equal(db.feedback.mock.callCount(), 0);
});

test("a lost acknowledgement after commit succeeds only after verifying the inactive account", async (context) => {
  const db = mockStorage(context);
  db.write.mock.mockImplementationOnce(async () => {
    db.commit();
    throw new Error("Write acknowledgement lost");
  });
  await deactivateCustomer(userId, input);
  assert.deepEqual(db.read.mock.calls[0]?.arguments, ["primary"]);
  assert.deepEqual(db.readConcern.mock.calls[0]?.arguments, ["majority"]);
  assert.equal(db.isActive(), false);
  assert.equal(db.feedback.mock.callCount(), 0);
});

test("optional feedback persistence failure leaves the account inactive and retry safe", async (context) => {
  const db = mockStorage(context);
  const log = context.mock.method(console, "warn", () => undefined);
  db.feedback.mock.mockImplementationOnce(async () => { throw new Error("Feedback unavailable"); });
  await deactivateCustomer(userId, input);
  await deactivateCustomer(userId, input);
  assert.equal(db.isActive(), false);
  assert.equal(db.feedback.mock.callCount(), 1);
  assert.equal(log.mock.callCount(), 1);
});


test("the controller returns the migration 503 and logs only index issues and request metadata", async (context) => {
  const db = mockStorage(context);
  db.indexes.mock.mockImplementationOnce(async () => []);
  const logger = context.mock.method(console, "error", (_message: unknown) => undefined);
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "isolated-deletion-controller-test";
  try {
    const auth = "Bearer test-session";
    const confirmationToken = jwt.sign({
      purpose: "delete-account", sub: userId, session: createHash("sha256").update(auth).digest("hex"),
    }, process.env.JWT_SECRET, { expiresIn: "5m", audience: "quickcart-account-deletion" });
    const response = {
      locals: { requestId: "test-request" },
      statusCode: 200,
      body: undefined as unknown,
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; return this; },
    };
    await deleteAccountController({
      user: { id: userId, role: "user", authenticatedAt: Date.now() / 1000 },
      headers: { authorization: auth },
      body: { ...input, confirmationToken },
    } as AuthenticatedRequest, response as unknown as Response);
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, {
      success: false, code: "MIGRATION_REQUIRED",
      message: "Account deletion is temporarily unavailable. Please try again later.",
    });
    assert.equal(db.write.mock.callCount(), 0);
    const entry = String(logger.mock.calls[0]?.arguments[0]);
    assert.deepEqual(JSON.parse(entry).indexIssues.invalidActiveIndexes, customerIdentityIndexes.map((index) => index.name));
    assert.equal(JSON.parse(entry).requestId, "test-request");
    for (const privateValue of [userId, auth, confirmationToken, input.feedback]) assert.ok(!entry.includes(privateValue));
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

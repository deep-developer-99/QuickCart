import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync } from "node:crypto";
import { Types } from "mongoose";
import UserNotification from "../../models/UserNotification";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.FIREBASE_PROJECT_ID = "quickcart-history-test";
process.env.FIREBASE_CLIENT_EMAIL = "history-test@example.invalid";
process.env.FIREBASE_PRIVATE_KEY = privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();
const loadHistoryService = () => import("../notificationService.js");

const setModelMethod = (
  name: string,
  value: unknown,
  model: object = UserNotification,
) => {
  const original = Object.getOwnPropertyDescriptor(model, name);
  Object.defineProperty(model, name, {
    configurable: true,
    writable: true,
    value,
  });
  return () => {
    if (original) Object.defineProperty(model, name, original);
    else Reflect.deleteProperty(model, name);
  };
};

test("vendor history aggregates by campaign and matches the authenticated ObjectId", async () => {
  const vendorId = "64b000000000000000000001";
  const pipelines: any[][] = [];
  const restore = setModelMethod("aggregate", async (pipeline: any[]) => {
    pipelines.push(pipeline);
    return [
      {
        data: [
          {
            _id: "campaign-1",
            title: "Vendor update",
            message: "A message",
            category: "announcement",
            sender: new Types.ObjectId(vendorId),
            senderRole: "vendor",
            recipientCount: 3,
            stored: 3,
            attempted: 2,
            accepted: 1,
            failed: 1,
            skipped: 1,
            statuses: ["accepted", "failed", "no_devices"],
          },
        ],
        total: [{ count: 1 }],
      },
    ];
  });

  try {
    const { getManagedNotificationHistory } = await loadHistoryService();
    const result = await getManagedNotificationHistory(
      vendorId,
      "vendor",
      1,
      20,
    );
    const match = pipelines[0][0].$match;
    const group = pipelines[0][1].$group;

    assert.ok(match.sender instanceof Types.ObjectId);
    assert.equal(match.sender.toString(), vendorId);
    assert.equal(match.senderRole, "vendor");
    assert.equal(match.deletedAt, null);
    assert.equal(group._id, "$campaignId");
    assert.deepEqual(group.recipientCount, { $sum: 1 });
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].recipientCount, 3);
    assert.equal(result.data[0].dispatchStatus, "partial");
    assert.equal(result.pagination.totalItems, 1);
  } finally {
    restore();
  }
});

test("admin history can filter by sender role without being restricted to a vendor ID", async () => {
  let match: Record<string, unknown> | undefined;
  const restore = setModelMethod("aggregate", async (pipeline: any[]) => {
    match = pipeline[0].$match;
    return [{ data: [], total: [] }];
  });

  try {
    const { getManagedNotificationHistory } = await loadHistoryService();
    await getManagedNotificationHistory(
      "64b000000000000000000002",
      "admin",
      1,
      20,
      { senderRole: "vendor" },
    );
    assert.equal(match?.senderRole, "vendor");
    assert.equal(Object.hasOwn(match ?? {}, "sender"), false);
  } finally {
    restore();
  }
});

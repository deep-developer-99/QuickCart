import CashfreePaymentAttempt from "../models/CashfreePaymentAttempt";
import User from "../models/User";
import AccountDeletionFeedback from "../models/AccountDeletionFeedback";
import { activeCustomerFilter, customerIdentityFields, customerIdentityIndexes, deletionReasons } from "../utils/customerLifecycle";

export class AccountDeletionError extends Error {
  constructor(message: string, public statusCode = 400, public code = "INVALID_DELETION") {
    super(message);
  }
}

export const validateDeletion = (body: unknown) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AccountDeletionError("Choose a deletion reason.");
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["reason", "feedback", "confirmationToken"].includes(key))) {
    throw new AccountDeletionError("The request contains unsupported fields.");
  }
  if (typeof input.reason !== "string" || !deletionReasons.some((reason) => reason === input.reason)) {
    throw new AccountDeletionError("Choose one of the listed deletion reasons.");
  }
  if (input.feedback !== undefined && (typeof input.feedback !== "string" || input.feedback.length > 1000)) {
    throw new AccountDeletionError("Feedback must be at most 1,000 characters.");
  }
  const feedback = typeof input.feedback === "string"
    ? input.feedback.replace(/[\p{Cc}\p{Cf}]/gu, (character) => character === "\n" || character === "\t" ? character : "").trim()
    : "";
  return { reason: input.reason, feedback };
};

export const assertCustomerIndexesReady = async () => {
  const indexes = await User.collection.indexes();
  for (const expected of customerIdentityIndexes) {
    const actual = indexes.find((index) => index.name === expected.name);
    const field = Object.keys(expected.key)[0];
    if (!actual?.unique || Object.keys(actual.key).length !== 1 || actual.key[field] !== 1 ||
        actual.partialFilterExpression?.isActive !== true ||
        actual.partialFilterExpression?.[field]?.$type !== "string") {
      throw new AccountDeletionError("Account deletion is temporarily unavailable. Please try again later.", 503, "MIGRATION_REQUIRED");
    }
  }
  if (indexes.some((index) => index.unique && !index.partialFilterExpression &&
      Object.keys(index.key).length === 1 && customerIdentityFields.some((field) => index.key[field] === 1))) {
    throw new AccountDeletionError("Account deletion is temporarily unavailable. Please try again later.", 503, "MIGRATION_REQUIRED");
  }
};

export const deactivateCustomer = async (userId: string, body: unknown) => {
  const { reason, feedback } = validateDeletion(body);
  await assertCustomerIndexesReady();
  const unsettled = await CashfreePaymentAttempt.exists({
    user: userId,
    $or: [{ status: { $in: ["created", "pending"] } }, { status: "paid", fulfillmentStatus: { $ne: "fulfilled" } }],
  });
  if (unsettled) throw new AccountDeletionError("Please finish your pending payment or contact support before closing your account.", 409, "PAYMENT_PENDING");
  const deletedAt = new Date();
  const result = await User.updateOne(
    { _id: userId, ...activeCustomerFilter,
      $and: [
        { $or: [{ activeCheckoutRequests: { $exists: false } }, { activeCheckoutRequests: 0 }] },
        { $or: [{ pendingRazorpayOrders: { $exists: false } }, { pendingRazorpayOrders: { $size: 0 } }] },
      ],
    },
    { $set: { isActive: false, deletedAt, deletionReason: reason, fcmTokens: [] } },
    { runValidators: true },
  );
  if (!result.matchedCount) {
    const previous = await User.exists({ _id: userId, isActive: false });
    if (!previous) throw new AccountDeletionError("Please finish your open checkout or contact support before closing your account.", 409, "PAYMENT_PENDING");
    return;
  }

  // Deactivation is final even if optional feedback cannot be stored.
  if (feedback) {
    try {
      await AccountDeletionFeedback.updateOne(
        { user: userId },
        { $setOnInsert: { user: userId, feedback, expiresAt: new Date(deletedAt.getTime() + 30 * 86400000) } },
        { upsert: true, runValidators: true },
      );
    } catch {
      console.warn("Optional account deletion feedback could not be stored.");
    }
  }
};

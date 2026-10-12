import PaymentAttempt, { PaytmPaymentStatus } from "../models/PaymentAttempt";
import {
  fetchPaytmTransactionStatus,
  getPaytmWebhookVerificationConfig,
} from "./paytmPaymentService";
import { finalizePaidPaytmAttempt } from "./paytmOrderFinalizationService";

export type ReconciledPaytmStatus = {
  status: "pending" | "failed" | "paid" | "paid_needs_review";
  paymentId: string;
  providerOrderId: string;
  amount: number;
  transactionId?: string;
  order?: unknown;
  message?: string;
};

const centsMatch = (left: number, right: number) =>
  Number.isFinite(left) &&
  Number.isFinite(right) &&
  Math.abs(left - right) < 0.01;

export const reconcilePaytmAttempt = async (
  paymentAttemptId: string,
  ownerUserId?: string,
): Promise<ReconciledPaytmStatus> => {
  const attemptQuery = PaymentAttempt.findById(paymentAttemptId);
  const attempt = ownerUserId
    ? await attemptQuery.where({ user: ownerUserId })
    : await attemptQuery;
  if (!attempt) throw new Error("Payment session not found");

  if (attempt.order && attempt.fulfillmentStatus === "fulfilled") {
    return {
      status: "paid",
      paymentId: attempt._id.toString(),
      providerOrderId: attempt.paytmOrderId,
      amount: attempt.amount,
      transactionId: attempt.paymentId,
      order: attempt.order.toString(),
    };
  }

  // A payment already confirmed as paid must never be downgraded by a stale
  // or temporarily inconsistent status response. Retry order finalization first.
  if (attempt.status === "paid") {
    if (!attempt.paymentId) {
      return {
        status: "paid_needs_review",
        paymentId: attempt._id.toString(),
        providerOrderId: attempt.paytmOrderId,
        amount: attempt.amount,
        message:
          "Payment is recorded as successful but has no provider transaction ID; manual reconciliation is required.",
      };
    }
    const finalization = await finalizePaidPaytmAttempt(
      attempt._id.toString(),
      attempt.paymentId,
    );
    if (finalization.status === "fulfilled") {
      return {
        status: "paid",
        paymentId: attempt._id.toString(),
        providerOrderId: attempt.paytmOrderId,
        amount: attempt.amount,
        transactionId: attempt.paymentId,
        order: finalization.order,
      };
    }
    return {
      status: "paid_needs_review",
      paymentId: attempt._id.toString(),
      providerOrderId: attempt.paytmOrderId,
      amount: attempt.amount,
      transactionId: attempt.paymentId,
      message: "Payment is confirmed, but the order still needs review.",
    };
  }

  const providerStatus = await fetchPaytmTransactionStatus(
    attempt.paytmOrderId,
  );
  if (
    !providerStatus.orderId ||
    providerStatus.orderId !== attempt.paytmOrderId
  ) {
    throw new Error("Paytm order ID does not match the stored payment session");
  }

  const { mid } = getPaytmWebhookVerificationConfig();
  if (!providerStatus.mid || providerStatus.mid !== mid) {
    throw new Error("Paytm merchant ID does not match the configured merchant");
  }

  if (providerStatus.status === "pending") {
    attempt.status = "pending";
    attempt.lastProviderStatus = providerStatus.rawStatus;
    await attempt.save();
    return {
      status: "pending",
      paymentId: attempt._id.toString(),
      providerOrderId: attempt.paytmOrderId,
      amount: attempt.amount,
    };
  }

  if (providerStatus.status === "failed") {
    // Don't downgrade a transaction that has already been confirmed as paid.
    if ((attempt.status as PaytmPaymentStatus) !== "paid") {
      attempt.status = "failed";
      attempt.lastProviderStatus = providerStatus.rawStatus;
      await attempt.save();
    }
    if ((attempt.status as PaytmPaymentStatus) === "paid") {
      return {
        status:
          attempt.fulfillmentStatus === "fulfilled"
            ? "paid"
            : "paid_needs_review",
        paymentId: attempt._id.toString(),
        providerOrderId: attempt.paytmOrderId,
        amount: attempt.amount,
        transactionId: attempt.paymentId,
        message:
          "A previous successful payment is already recorded; it will not be downgraded.",
      };
    }
    return {
      status: "failed",
      paymentId: attempt._id.toString(),
      providerOrderId: attempt.paytmOrderId,
      amount: attempt.amount,
    };
  }

  // Paytm says paid. Persist that fact even if later fulfilment needs manual review.
  if (!providerStatus.transactionId) {
    attempt.status = "paid";
    attempt.fulfillmentStatus = "needs_review";
    attempt.lastProviderStatus = providerStatus.rawStatus || "TXN_SUCCESS";
    await attempt.save();
    return {
      status: "paid_needs_review",
      paymentId: attempt._id.toString(),
      providerOrderId: attempt.paytmOrderId,
      amount: attempt.amount,
      message:
        "Paytm reported success without a transaction ID. Manual reconciliation is required.",
    };
  }

  if (
    providerStatus.amount === undefined ||
    !centsMatch(providerStatus.amount, attempt.amount)
  ) {
    attempt.status = "paid";
    attempt.fulfillmentStatus = "needs_review";
    attempt.paymentId = providerStatus.transactionId || attempt.paymentId;
    attempt.lastProviderStatus = providerStatus.rawStatus || "TXN_SUCCESS";
    await attempt.save();
    return {
      status: "paid_needs_review",
      paymentId: attempt._id.toString(),
      providerOrderId: attempt.paytmOrderId,
      amount: attempt.amount,
      transactionId: providerStatus.transactionId,
      message:
        "Paytm confirmed payment but the amount did not match the stored checkout. Manual reconciliation is required.",
    };
  }

  if (
    providerStatus.currency &&
    providerStatus.currency.toUpperCase() !== "INR"
  ) {
    attempt.status = "paid";
    attempt.fulfillmentStatus = "needs_review";
    attempt.paymentId = providerStatus.transactionId || attempt.paymentId;
    attempt.lastProviderStatus = providerStatus.rawStatus || "TXN_SUCCESS";
    await attempt.save();
    return {
      status: "paid_needs_review",
      paymentId: attempt._id.toString(),
      providerOrderId: attempt.paytmOrderId,
      amount: attempt.amount,
      transactionId: providerStatus.transactionId,
      message:
        "Paytm confirmed payment in an unexpected currency. Manual reconciliation is required.",
    };
  }

  const finalized = await finalizePaidPaytmAttempt(
    attempt._id.toString(),
    providerStatus.transactionId,
  );
  if (finalized.status === "needs_review") {
    return {
      status: "paid_needs_review",
      paymentId: attempt._id.toString(),
      providerOrderId: attempt.paytmOrderId,
      amount: attempt.amount,
      transactionId: providerStatus.transactionId,
      message:
        "Payment succeeded, but the order needs manual review (for example, because stock or the saved address changed).",
    };
  }

  return {
    status: "paid",
    paymentId: attempt._id.toString(),
    providerOrderId: attempt.paytmOrderId,
    amount: attempt.amount,
    transactionId: providerStatus.transactionId,
    order: finalized.order,
  };
};

export const reconcilePaytmAttemptByOrderId = async (paytmOrderId: string) => {
  const attempt = await PaymentAttempt.findOne({ paytmOrderId });
  if (!attempt)
    throw new Error("No QuickCart payment attempt exists for this Paytm order");
  return reconcilePaytmAttempt(attempt._id.toString());
};

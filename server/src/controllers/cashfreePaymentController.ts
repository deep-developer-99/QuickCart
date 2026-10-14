import crypto from "crypto";
import { Response } from "express";
import { Types } from "mongoose";
import Address from "../models/Address";
import Product from "../models/Product";
import User from "../models/User";
import CashfreePaymentAttempt, {
  ICashfreePaymentAttempt,
  ICashfreePaymentAttemptItem,
} from "../models/CashfreePaymentAttempt";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { calculateCheckout } from "../services/checkoutService";
import {
  createCashfreeOrder,
  fetchCashfreePaymentStatus,
  CashfreePaymentMethod,
} from "../services/cashfreePaymentService";
import { finalizePaidCashfreeAttempt } from "../services/cashfreeOrderFinalizationService";

const getShippingAmount = (subtotal: number) =>
  subtotal > 0 && subtotal <= 99 ? 40 : 0;
const allowedMethods: CashfreePaymentMethod[] = [
  "UPI_GPAY",
  "UPI_PHONEPE",
  "UPI_PAYTM",
  "UPI_OTHER",
  "CARD",
  "WALLET",
];
const toSnapshotItem = (
  product: any,
  quantity: number,
): ICashfreePaymentAttemptItem => ({
  product: new Types.ObjectId(product._id.toString()),
  vendor: new Types.ObjectId(product.vendor.toString()),
  name: String(product.name),
  image: String(product.image || ""),
  price: Number(product.price),
  discountedPrice: Number(product.discountPrice ?? product.price),
  quantity,
});

const sendStatus = (res: Response, data: any) => {
  const code =
    data.status === "pending" || data.status === "paid_needs_review"
      ? 202
      : 200;
  res.status(code).json({
    success: true,
    message: data.message || `Cashfree payment ${data.status}`,
    data,
  });
};

export const createCashfreeSessionController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  let attempt: ICashfreePaymentAttempt | undefined;
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }
    const {
      addressId,
      checkoutMode = "cart",
      productId,
      quantity = 1,
      paymentMethod,
    } = req.body as {
      addressId?: string;
      checkoutMode?: "cart" | "buyNow";
      productId?: string;
      quantity?: number;
      paymentMethod?: CashfreePaymentMethod;
    };
    if (!addressId || !Types.ObjectId.isValid(addressId)) {
      res
        .status(400)
        .json({ success: false, message: "A valid address ID is required" });
      return;
    }
    if (checkoutMode !== "cart" && checkoutMode !== "buyNow") {
      res
        .status(400)
        .json({ success: false, message: "Invalid checkout mode" });
      return;
    }
    if (!paymentMethod || !allowedMethods.includes(paymentMethod)) {
      res.status(400).json({
        success: false,
        message: "Select a supported online payment method",
      });
      return;
    }

    const address = await Address.findOne({
      _id: addressId,
      user: req.user.id,
    });
    if (!address) {
      res.status(400).json({ success: false, message: "Address not found" });
      return;
    }

    let itemsSnapshot: ICashfreePaymentAttemptItem[];
    let resolvedProductId: string | undefined;
    let resolvedQuantity: number | undefined;
    if (checkoutMode === "buyNow") {
      if (!productId || !Types.ObjectId.isValid(productId)) {
        res.status(400).json({
          success: false,
          message: "A valid product ID is required for Buy Now",
        });
        return;
      }
      const parsedQuantity = Number(quantity);
      if (
        !Number.isInteger(parsedQuantity) ||
        parsedQuantity < 1 ||
        parsedQuantity > 99
      ) {
        res.status(400).json({
          success: false,
          message: "Quantity must be between 1 and 99",
        });
        return;
      }
      const product = await Product.findOne({ _id: productId, isActive: true });
      if (!product) {
        res.status(400).json({
          success: false,
          message: "Product not found or is no longer available",
        });
        return;
      }
      if (product.stock < parsedQuantity) {
        res.status(409).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });
        return;
      }
      itemsSnapshot = [toSnapshotItem(product, parsedQuantity)];
      resolvedProductId = product._id.toString();
      resolvedQuantity = parsedQuantity;
    } else {
      const checkout = await calculateCheckout(req.user.id);
      itemsSnapshot = checkout.items.map((item) =>
        toSnapshotItem(item.product, item.quantity),
      );
    }

    const subtotal = itemsSnapshot.reduce(
      (sum, item) => sum + item.discountedPrice * item.quantity,
      0,
    );
    const shippingAmount = getShippingAmount(subtotal);
    const totalAmount = Number((subtotal + shippingAmount).toFixed(2));
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      res
        .status(400)
        .json({ success: false, message: "Invalid checkout total" });
      return;
    }

    const cashfreeOrderId = `QC_CF_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    attempt = await CashfreePaymentAttempt.create({
      user: new Types.ObjectId(req.user.id),
      address: new Types.ObjectId(addressId),
      checkoutMode,
      product: resolvedProductId
        ? new Types.ObjectId(resolvedProductId)
        : undefined,
      quantity: resolvedQuantity,
      itemsSnapshot,
      cashfreeOrderId,
      selectedPaymentMethod: paymentMethod,
      amount: totalAmount,
      shippingAmount,
      status: "created",
      fulfillmentStatus: "pending",
    });

    try {
      const user = await User.findById(req.user.id).select("name email");
      const session = await createCashfreeOrder({
        orderId: cashfreeOrderId,
        amount: totalAmount,
        customerId: req.user.id,
        customerName: user?.name || address.fullName,
        customerEmail: user?.email,
        customerPhone: address.phone,
        paymentMethod,
      });
      attempt.paymentSessionId = session.paymentSessionId;
      await attempt.save();
      res.status(201).json({
        success: true,
        data: {
          paymentId: attempt._id.toString(),
          orderId: session.orderId,
          paymentSessionId: session.paymentSessionId,
          amount: session.amount,
          currency: session.currency,
          environment: session.environment,
        },
      });
    } catch (providerError) {
      attempt.status = "failed";
      attempt.lastProviderStatus = "INITIATION_FAILED";
      await attempt.save();
      throw providerError;
    }
  } catch (error) {
    console.error(
      "Create Cashfree session error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    res.status(502).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create Cashfree payment session",
      ...(attempt ? { paymentId: attempt._id.toString() } : {}),
    });
  }
};

const reconcileCashfreeAttempt = async (
  paymentId: string,
  ownerUserId: string,
) => {
  const attempt = await CashfreePaymentAttempt.findOne({
    _id: paymentId,
    user: ownerUserId,
  });
  if (!attempt) throw new Error("Cashfree payment session not found");
  if (attempt.order && attempt.fulfillmentStatus === "fulfilled") {
    return {
      status: "paid",
      paymentId: attempt._id.toString(),
      providerOrderId: attempt.cashfreeOrderId,
      amount: attempt.amount,
      transactionId: attempt.paymentId,
      order: attempt.order.toString(),
    };
  }
  if (attempt.status === "paid" && attempt.paymentId) {
    const finalized = await finalizePaidCashfreeAttempt(
      attempt._id.toString(),
      attempt.paymentId,
    );
    if (finalized.status === "fulfilled")
      return {
        status: "paid",
        paymentId: attempt._id.toString(),
        providerOrderId: attempt.cashfreeOrderId,
        amount: attempt.amount,
        transactionId: attempt.paymentId,
        order: finalized.order,
      };
    return {
      status: "paid_needs_review",
      paymentId: attempt._id.toString(),
      providerOrderId: attempt.cashfreeOrderId,
      amount: attempt.amount,
      transactionId: attempt.paymentId,
      message: "Payment confirmed, but the order requires review.",
    };
  }
  const provider = await fetchCashfreePaymentStatus(attempt.cashfreeOrderId);
  if (provider.orderId !== attempt.cashfreeOrderId)
    throw new Error(
      "Cashfree order ID does not match the stored payment attempt",
    );
  if (provider.currency && provider.currency !== "INR")
    throw new Error("Cashfree returned an unexpected currency");
  if (
    provider.amount !== undefined &&
    Math.abs(provider.amount - attempt.amount) >= 0.01
  )
    throw new Error(
      "Cashfree payment amount does not match the checkout amount",
    );
  attempt.lastProviderStatus = provider.rawStatus;
  if (provider.status === "pending") {
    attempt.status = "pending";
    await attempt.save();
    return {
      status: "pending",
      paymentId: attempt._id.toString(),
      providerOrderId: attempt.cashfreeOrderId,
      amount: attempt.amount,
      transactionId: provider.transactionId,
    };
  }
  if (provider.status === "failed") {
    attempt.status = "failed";
    await attempt.save();
    return {
      status: "failed",
      paymentId: attempt._id.toString(),
      providerOrderId: attempt.cashfreeOrderId,
      amount: attempt.amount,
      transactionId: provider.transactionId,
    };
  }
  attempt.status = "paid";
  attempt.paymentId = provider.transactionId;
  await attempt.save();
  const finalized = await finalizePaidCashfreeAttempt(
    attempt._id.toString(),
    provider.transactionId,
  );
  if (finalized.status === "fulfilled")
    return {
      status: "paid",
      paymentId: attempt._id.toString(),
      providerOrderId: attempt.cashfreeOrderId,
      amount: attempt.amount,
      transactionId: provider.transactionId,
      order: finalized.order,
    };
  return {
    status: "paid_needs_review",
    paymentId: attempt._id.toString(),
    providerOrderId: attempt.cashfreeOrderId,
    amount: attempt.amount,
    transactionId: provider.transactionId,
    message: "Payment confirmed, but the order requires review.",
  };
};

export const verifyCashfreePaymentController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }
    const { paymentId } = req.body as { paymentId?: string };
    if (!paymentId || !Types.ObjectId.isValid(paymentId)) {
      res
        .status(400)
        .json({ success: false, message: "A valid payment ID is required" });
      return;
    }
    sendStatus(res, await reconcileCashfreeAttempt(paymentId, req.user.id));
  } catch (error) {
    console.error(
      "Verify Cashfree payment error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    res.status(502).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to verify Cashfree payment right now",
    });
  }
};

export const getCashfreePaymentStatusController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res
        .status(401)
        .json({ success: false, message: "Authentication required" });
      return;
    }
    const paymentId = Array.isArray(req.params.paymentId)
      ? req.params.paymentId[0]
      : req.params.paymentId;
    if (!paymentId || !Types.ObjectId.isValid(paymentId)) {
      res
        .status(400)
        .json({ success: false, message: "A valid payment ID is required" });
      return;
    }
    sendStatus(res, await reconcileCashfreeAttempt(paymentId, req.user.id));
  } catch (error) {
    console.error(
      "Get Cashfree payment status error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    res.status(502).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to check Cashfree payment status",
    });
  }
};

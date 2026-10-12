import crypto from "crypto";
import { Response } from "express";
import { Types } from "mongoose";

import Address from "../models/Address";
import Product from "../models/Product";
import PaymentAttempt, {
  IPaymentAttempt,
  IPaymentAttemptItem,
} from "../models/PaymentAttempt";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { calculateCheckout } from "../services/checkoutService";
import { createPaytmTransaction } from "../services/paytmPaymentService";
import { reconcilePaytmAttempt } from "../services/paytmReconciliationService";

const getShippingAmount = (subtotal: number) =>
  subtotal > 0 && subtotal < 500 ? 40 : 0;

const toSnapshotItem = (
  product: any,
  quantity: number,
): IPaymentAttemptItem => {
  const discountedPrice = Number(product.discountPrice ?? product.price);
  return {
    product: new Types.ObjectId(product._id.toString()),
    vendor: new Types.ObjectId(product.vendor.toString()),
    name: String(product.name),
    image: String(product.image || ""),
    price: Number(product.price),
    discountedPrice,
    quantity,
  };
};

const sendReconciledStatus = (
  res: Response,
  result: Awaited<ReturnType<typeof reconcilePaytmAttempt>>,
) => {
  if (result.status === "pending") {
    res.status(202).json({
      success: true,
      message: "Payment is still processing",
      data: result,
    });
    return;
  }
  if (result.status === "failed") {
    res.status(200).json({
      success: true,
      message: "Payment was not completed",
      data: result,
    });
    return;
  }
  if (result.status === "paid_needs_review") {
    res.status(202).json({
      success: true,
      message: result.message || "Payment received; order requires review",
      data: result,
    });
    return;
  }
  res
    .status(200)
    .json({ success: true, message: "Paytm payment verified", data: result });
};

/** Creates a Paytm transaction token for the authenticated mobile user. */
export const createPaytmSessionController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  let attempt: IPaymentAttempt | undefined;
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
    } = req.body as {
      addressId?: string;
      checkoutMode?: "cart" | "buyNow";
      productId?: string;
      quantity?: number;
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

    const address = await Address.findOne({
      _id: addressId,
      user: req.user.id,
    });
    if (!address) {
      res.status(400).json({ success: false, message: "Address not found" });
      return;
    }

    let itemsSnapshot: IPaymentAttemptItem[];
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

    // Persist the immutable checkout snapshot before calling Paytm. This lets
    // us reconcile a transaction if the app closes or Paytm responds slowly.
    const paytmOrderId = `QC_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
    attempt = await PaymentAttempt.create({
      user: new Types.ObjectId(req.user.id),
      address: new Types.ObjectId(addressId),
      checkoutMode,
      product: resolvedProductId
        ? new Types.ObjectId(resolvedProductId)
        : undefined,
      quantity: resolvedQuantity,
      itemsSnapshot,
      paytmOrderId,
      amount: totalAmount,
      shippingAmount,
      status: "created",
      fulfillmentStatus: "pending",
    });

    try {
      const session = await createPaytmTransaction({
        orderId: paytmOrderId,
        amount: totalAmount,
        customerId: req.user.id,
        address: [
          address.addressLine,
          address.city,
          address.state,
          address.pincode,
        ]
          .filter(Boolean)
          .join(", "),
        mobile: address.phone,
        firstName: address.fullName,
      });

      attempt.txnToken = session.txnToken;
      await attempt.save();

      res.status(201).json({
        success: true,
        data: {
          paymentId: attempt._id.toString(),
          mid: session.mid,
          orderId: session.orderId,
          txnToken: session.txnToken,
          amount: session.amount,
          callbackUrl: session.callbackUrl,
          isStaging: session.isStaging,
          currency: "INR",
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
      "Create Paytm session error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    res.status(502).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create Paytm payment session",
      ...(attempt ? { paymentId: attempt._id.toString() } : {}),
    });
  }
};

/** Never trusts the React Native SDK callback as proof of payment. */
export const verifyPaytmPaymentController = async (
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
    const result = await reconcilePaytmAttempt(paymentId, req.user.id);
    sendReconciledStatus(res, result);
  } catch (error) {
    console.error(
      "Verify Paytm payment error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    res.status(502).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to verify Paytm payment right now",
    });
  }
};

export const getPaytmPaymentStatusController = async (
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
    const paymentIdParam = req.params.paymentId;
    const paymentId = Array.isArray(paymentIdParam)
      ? paymentIdParam[0]
      : paymentIdParam;
    if (!paymentId || !Types.ObjectId.isValid(paymentId)) {
      res
        .status(400)
        .json({ success: false, message: "A valid payment ID is required" });
      return;
    }
    const result = await reconcilePaytmAttempt(paymentId, req.user.id);
    sendReconciledStatus(res, result);
  } catch (error) {
    console.error(
      "Get Paytm status error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    res.status(502).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to check payment status",
    });
  }
};

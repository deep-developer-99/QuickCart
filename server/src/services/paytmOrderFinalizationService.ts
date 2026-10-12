import mongoose, { Types } from "mongoose";
import Address from "../models/Address";
import Cart from "../models/Cart";
import Order from "../models/Order";
import PaymentAttempt, { IPaymentAttemptItem } from "../models/PaymentAttempt";
import Product from "../models/Product";
import { notifyVendorsAboutNewOrder } from "./notificationService";

export type PaytmFinalizationResult =
  | { status: "fulfilled"; order: any }
  | { status: "needs_review"; order?: undefined };

const sameCartAsSnapshot = (
  cartItems: Array<{ product: Types.ObjectId; quantity: number }>,
  snapshot: IPaymentAttemptItem[],
) => {
  if (cartItems.length !== snapshot.length) return false;
  const left = cartItems
    .map((item) => `${item.product.toString()}:${item.quantity}`)
    .sort();
  const right = snapshot
    .map((item) => `${item.product.toString()}:${item.quantity}`)
    .sort();
  return left.every((value, index) => value === right[index]);
};

/**
 * Finalizes a Paytm-paid checkout from the immutable server-side payment
 * snapshot. Payment status is fetched from Paytm before this function runs.
 * Order creation, stock decrements and attempt fulfillment are transactional.
 */
export const finalizePaidPaytmAttempt = async (
  paymentAttemptId: string,
  transactionId?: string,
): Promise<PaytmFinalizationResult> => {
  if (!Types.ObjectId.isValid(paymentAttemptId))
    throw new Error("Invalid payment attempt ID");

  const session = await mongoose.startSession();
  let createdOrder: any;
  const attemptObjectId = new Types.ObjectId(paymentAttemptId);

  try {
    session.startTransaction();

    const attempt =
      await PaymentAttempt.findById(attemptObjectId).session(session);
    if (!attempt) throw new Error("Payment attempt not found");

    const existingOrder = await Order.findOne({
      paymentAttemptId: attemptObjectId,
    }).session(session);
    if (existingOrder) {
      attempt.status = "paid";
      attempt.fulfillmentStatus = "fulfilled";
      attempt.paymentId = transactionId || attempt.paymentId;
      attempt.order = existingOrder._id as Types.ObjectId;
      await attempt.save({ session });
      await session.commitTransaction();
      return { status: "fulfilled", order: existingOrder };
    }

    if (!attempt.itemsSnapshot?.length) {
      attempt.status = "paid";
      attempt.fulfillmentStatus = "needs_review";
      attempt.paymentId = transactionId || attempt.paymentId;
      attempt.lastProviderStatus = "TXN_SUCCESS";
      await attempt.save({ session });
      await session.commitTransaction();
      return { status: "needs_review" };
    }

    const calculatedAmount = Number(
      (
        attempt.itemsSnapshot.reduce(
          (sum, item) => sum + item.discountedPrice * item.quantity,
          0,
        ) + attempt.shippingAmount
      ).toFixed(2),
    );

    if (Math.abs(calculatedAmount - attempt.amount) > 0.009) {
      attempt.status = "paid";
      attempt.fulfillmentStatus = "needs_review";
      attempt.paymentId = transactionId || attempt.paymentId;
      attempt.lastProviderStatus = "TXN_SUCCESS";
      await attempt.save({ session });
      await session.commitTransaction();
      return { status: "needs_review" };
    }

    const address = await Address.findOne({
      _id: attempt.address,
      user: attempt.user,
    }).session(session);
    if (!address) {
      attempt.status = "paid";
      attempt.fulfillmentStatus = "needs_review";
      attempt.paymentId = transactionId || attempt.paymentId;
      attempt.lastProviderStatus = "TXN_SUCCESS";
      await attempt.save({ session });
      await session.commitTransaction();
      return { status: "needs_review" };
    }

    // Validate all products before changing any stock. Prices are the values
    // captured when the Paytm transaction was initiated; current price changes
    // must not alter the amount the customer already paid.
    for (const item of attempt.itemsSnapshot) {
      const product = await Product.findOne({
        _id: item.product,
        isActive: true,
      }).session(session);
      if (!product || product.stock < item.quantity) {
        attempt.status = "paid";
        attempt.fulfillmentStatus = "needs_review";
        attempt.paymentId = transactionId || attempt.paymentId;
        attempt.lastProviderStatus = "TXN_SUCCESS";
        await attempt.save({ session });
        await session.commitTransaction();
        return { status: "needs_review" };
      }
    }

    for (const item of attempt.itemsSnapshot) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: item.product, isActive: true, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true, session },
      );
      if (!updatedProduct) {
        // Throw to abort any earlier stock decrements in this transaction.
        throw new Error("Stock changed while finalizing a paid Paytm order");
      }
    }

    const [order] = await Order.create(
      [
        {
          user: attempt.user,
          items: attempt.itemsSnapshot.map((item) => ({
            product: item.product,
            vendor: item.vendor,
            name: item.name,
            image: item.image,
            price: item.price,
            discountedPrice: item.discountedPrice,
            quantity: item.quantity,
          })),
          address: attempt.address,
          paymentMethod: "PAYTM",
          paymentStatus: "PAID",
          paymentId: transactionId,
          paytmOrderId: attempt.paytmOrderId,
          paymentAttemptId: attempt._id,
          shippingAmount: attempt.shippingAmount,
          totalAmount: attempt.amount,
          status: "Placed",
        },
      ],
      { session },
    );

    attempt.status = "paid";
    attempt.fulfillmentStatus = "fulfilled";
    attempt.paymentId = transactionId || attempt.paymentId;
    attempt.lastProviderStatus = "TXN_SUCCESS";
    attempt.order = order._id as Types.ObjectId;
    await attempt.save({ session });

    // Do not clear a cart that the customer changed while the Paytm app was open.
    if (attempt.checkoutMode === "cart") {
      const cart = await Cart.findOne({ user: attempt.user }).session(session);
      if (cart && sameCartAsSnapshot(cart.items, attempt.itemsSnapshot)) {
        cart.items = [];
        await cart.save({ session });
      }
    }

    await session.commitTransaction();
    createdOrder = order;
  } catch (error: any) {
    if (session.inTransaction()) await session.abortTransaction();
    if (error?.code === 11000) {
      const existingOrder = await Order.findOne({
        paymentAttemptId: attemptObjectId,
      });
      if (existingOrder) {
        await PaymentAttempt.findByIdAndUpdate(attemptObjectId, {
          $set: {
            status: "paid",
            fulfillmentStatus: "fulfilled",
            paymentId: transactionId,
            order: existingOrder._id,
            lastProviderStatus: "TXN_SUCCESS",
          },
        });
        return { status: "fulfilled", order: existingOrder };
      }
    }
    // If Paytm has confirmed payment but stock raced during finalization, keep
    // the paid attempt visible for manual resolution/refund rather than losing it.
    await PaymentAttempt.findByIdAndUpdate(attemptObjectId, {
      $set: {
        status: "paid",
        fulfillmentStatus: "needs_review",
        paymentId: transactionId,
        lastProviderStatus: "TXN_SUCCESS",
      },
    });
    throw error;
  } finally {
    await session.endSession();
  }

  try {
    await notifyVendorsAboutNewOrder(
      createdOrder.items.map((item: { vendor: Types.ObjectId }) =>
        item.vendor.toString(),
      ),
      createdOrder._id.toString(),
      createdOrder.items.reduce(
        (sum: number, item: { quantity: number }) => sum + item.quantity,
        0,
      ),
    );
  } catch (notificationError) {
    console.error("Paytm order notification error:", notificationError);
  }

  return { status: "fulfilled", order: createdOrder };
};

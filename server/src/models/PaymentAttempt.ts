import mongoose, { Document, Schema, Types } from "mongoose";

export type PaytmCheckoutMode = "cart" | "buyNow";
export type PaytmPaymentStatus = "created" | "pending" | "paid" | "failed";
export type PaytmFulfillmentStatus = "pending" | "fulfilled" | "needs_review";

export interface IPaymentAttemptItem {
  product: Types.ObjectId;
  vendor: Types.ObjectId;
  name: string;
  image: string;
  price: number;
  discountedPrice: number;
  quantity: number;
}

export interface IPaymentAttempt extends Document {
  user: Types.ObjectId;
  address: Types.ObjectId;
  checkoutMode: PaytmCheckoutMode;
  product?: Types.ObjectId;
  quantity?: number;
  itemsSnapshot: IPaymentAttemptItem[];
  paytmOrderId: string;
  txnToken?: string;
  amount: number;
  shippingAmount: number;
  status: PaytmPaymentStatus;
  fulfillmentStatus: PaytmFulfillmentStatus;
  paymentId?: string;
  lastProviderStatus?: string;
  order?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const paymentAttemptItemSchema = new Schema<IPaymentAttemptItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    discountedPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const paymentAttemptSchema = new Schema<IPaymentAttempt>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    address: { type: Schema.Types.ObjectId, ref: "Address", required: true },
    checkoutMode: { type: String, enum: ["cart", "buyNow"], required: true },
    product: { type: Schema.Types.ObjectId, ref: "Product" },
    quantity: { type: Number, min: 1 },
    itemsSnapshot: {
      type: [paymentAttemptItemSchema],
      required: true,
      validate: {
        validator: (items: IPaymentAttemptItem[]) => items.length > 0,
        message: "Payment must contain at least one item",
      },
    },
    paytmOrderId: { type: String, required: true, unique: true, index: true },
    txnToken: { type: String, select: false },
    amount: { type: Number, required: true, min: 0.01 },
    shippingAmount: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["created", "pending", "paid", "failed"],
      default: "created",
      index: true,
    },
    fulfillmentStatus: {
      type: String,
      enum: ["pending", "fulfilled", "needs_review"],
      default: "pending",
      index: true,
    },
    paymentId: { type: String },
    lastProviderStatus: { type: String },
    order: { type: Schema.Types.ObjectId, ref: "Order" },
  },
  { timestamps: true },
);

paymentAttemptSchema.index({ user: 1, createdAt: -1 });
paymentAttemptSchema.index({ status: 1, fulfillmentStatus: 1, updatedAt: 1 });

const PaymentAttempt = mongoose.model<IPaymentAttempt>(
  "PaymentAttempt",
  paymentAttemptSchema,
);
export default PaymentAttempt;

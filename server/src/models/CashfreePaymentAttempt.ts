import mongoose, { Document, Schema, Types } from "mongoose";

export type CashfreePaymentStatus = "created" | "pending" | "paid" | "failed";
export type CashfreeFulfillmentStatus =
  | "pending"
  | "fulfilled"
  | "needs_review";

export interface ICashfreePaymentAttemptItem {
  product: Types.ObjectId;
  vendor: Types.ObjectId;
  name: string;
  image: string;
  price: number;
  discountedPrice: number;
  quantity: number;
}

export interface ICashfreePaymentAttempt extends Document {
  user: Types.ObjectId;
  address: Types.ObjectId;
  checkoutMode: "cart" | "buyNow";
  product?: Types.ObjectId;
  quantity?: number;
  itemsSnapshot: ICashfreePaymentAttemptItem[];
  cashfreeOrderId: string;
  paymentSessionId?: string;
  selectedPaymentMethod: string;
  amount: number;
  shippingAmount: number;
  status: CashfreePaymentStatus;
  fulfillmentStatus: CashfreeFulfillmentStatus;
  paymentId?: string;
  lastProviderStatus?: string;
  order?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<ICashfreePaymentAttemptItem>(
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

const schema = new Schema<ICashfreePaymentAttempt>(
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
      type: [itemSchema],
      required: true,
      validate: {
        validator: (items: ICashfreePaymentAttemptItem[]) => items.length > 0,
        message: "Payment must contain at least one item",
      },
    },
    cashfreeOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paymentSessionId: { type: String, select: false },
    selectedPaymentMethod: { type: String, required: true },
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

schema.index({ user: 1, createdAt: -1 });
schema.index({ status: 1, fulfillmentStatus: 1, updatedAt: 1 });

export default mongoose.model<ICashfreePaymentAttempt>(
  "CashfreePaymentAttempt",
  schema,
);

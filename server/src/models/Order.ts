import mongoose, { Document, Schema, Types } from "mongoose";

interface IOrderItem {
  product: Types.ObjectId;
  vendor: Types.ObjectId;
  name: string;
  image: string;
  price: number;
  discountedPrice?: number;
  quantity: number;
}

export interface IOrder extends Document {
  user: Types.ObjectId;
  items: IOrderItem[];
  address: Types.ObjectId;
  paymentMethod: "COD" | "RAZORPAY" | "PAYTM" | "CASHFREE";
  paymentStatus: "PENDING" | "PAID" | "FAILED";
  paymentId?: string;
  razorpayOrderId?: string;
  paytmOrderId?: string;
  cashfreeOrderId?: string;
  cashfreePaymentAttemptId?: Types.ObjectId;
  paymentAttemptId?: Types.ObjectId;
  shippingAmount?: number;
  totalAmount: number;
  status: "Placed" | "Accepted" | "Out for Delivery" | "Delivered";
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    vendor: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    image: {
      type: String,
      required: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    discountedPrice: {
      type: Number,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items: IOrderItem[]) => items.length > 0,
        message: "Order must contain at least one item",
      },
    },

    address: {
      type: Schema.Types.ObjectId,
      ref: "Address",
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["COD", "RAZORPAY", "PAYTM", "CASHFREE"],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: function (this: IOrder) {
        return this.paymentMethod === "COD" ? "PENDING" : "PAID";
      },
      index: true,
    },

    paymentId: {
      type: String,
    },

    razorpayOrderId: {
      type: String,
    },

    paytmOrderId: { type: String, index: true },
    cashfreeOrderId: { type: String, index: true },
    cashfreePaymentAttemptId: {
      type: Schema.Types.ObjectId,
      ref: "CashfreePaymentAttempt",
      unique: true,
      sparse: true,
    },

    paymentAttemptId: {
      type: Schema.Types.ObjectId,
      ref: "PaymentAttempt",
      unique: true,
      sparse: true,
    },

    shippingAmount: { type: Number, default: 0, min: 0 },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["Placed", "Accepted", "Out for Delivery", "Delivered"],
      default: "Placed",
    },
  },
  {
    timestamps: true,
  },
);

const Order = mongoose.model<IOrder>("Order", orderSchema);

export default Order;

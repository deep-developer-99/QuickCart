import type { Address } from "./address";

export type PaymentMethod = "COD" | "RAZORPAY";

export type OrderStatus =
  | "Placed"
  | "Accepted"
  | "Out for Delivery"
  | "Delivered";

export interface OrderItem {
  variantId?: string;
  variantQuantity?: number;
  variantUnit?: string;
  product:
    | string
    | {
        _id: string;
        name: string;
        image: string;
        price: number;
        discountPrice?: number;
      };

  vendor:
    | string
    | {
        _id: string;
        name?: string;
        shopName?: string;
      };

  name: string;
  image: string;
  price: number;
  discountedPrice?: number;
  discountPrice?: number;
  finalPrice?: number;
  quantity: number;
}

export interface Order {
  _id: string;
  user: string;
  items: OrderItem[];
  address: Address | string | null;
  paymentMethod: PaymentMethod | "PAYTM" | "CASHFREE";
  paymentStatus?: "PENDING" | "PAID" | "FAILED";
  paymentId?: string;
  razorpayOrderId?: string;
  shippingAmount?: number;
  donationAmount?: number;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

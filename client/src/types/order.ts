import type { Address } from "./address";

export type PaymentMethod = "COD" | "RAZORPAY";

export type OrderStatus =
  | "Placed"
  | "Accepted"
  | "Out for Delivery"
  | "Delivered";

export interface OrderItem {
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
  quantity: number;
}

export interface Order {
  _id: string;
  user: string;
  items: OrderItem[];
  address: Address | string;
  paymentMethod: PaymentMethod;
  paymentId?: string;
  razorpayOrderId?: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

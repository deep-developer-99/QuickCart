import type { Product } from "./product";

export interface CartItem {
  // Cart responses may contain only a product id; populated cart responses
  // include the full product object.
  product: Product | string;
  variantId?: string;
  quantity: number;
}

export interface Cart {
  _id: string;
  user: string;
  items: CartItem[];
}

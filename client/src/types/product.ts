export interface Category {
  _id: string;
  name: string;
  parentCategory?: string | Pick<Category, "_id" | "name"> | null;
  normalizedName?: string;
  description?: string;
  image?: string;
  imagePublicId?: string;
  isActive: boolean;
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  image: string;
  imagePublicId?: string;
  /** Deprecated API fields; consumers should use variant pricing and stock. */
  price: number;
  discountPrice?: number;
  stock: number;
  variants?: ProductVariant[];
  category: Category | string;
  subCategory?: Category | string | null;
  vendor:
    | {
        _id: string;
        name?: string;
        shopName?: string;
      }
    | string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductVariant {
  _id: string;
  quantity: number;
  unit: "g" | "kg" | "ml" | "L" | "pcs" | "pc" | "set" | "pack" | "m" | "cm" | "dozen" | "pair";
  price: number;
  discountPrice?: number;
  stock: number;
  isActive: boolean;
}

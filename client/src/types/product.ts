export interface Category {
  _id: string;
  name: string;
  parentCategory?: string | Pick<Category, "_id" | "name"> | null;
  normalizedName?: string;
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
  price: number;
  discountPrice?: number;
  stock: number;
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

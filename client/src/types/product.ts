export interface Category {
  _id: string;
  name: string;
  image?: string;
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

export type BannerRedirectType = "category" | "product";

export interface Banner {
  _id: string;
  image: string;
  imagePublicId?: string;
  redirectType?: BannerRedirectType;
  redirectValue?: string;
  order: number;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

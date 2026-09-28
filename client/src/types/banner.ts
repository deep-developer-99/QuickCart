export type BannerRedirectType = "category" | "product" | "url";

export interface Banner {
  _id: string;
  title: string;
  subtitle?: string;
  image: string;
  imagePublicId?: string;
  buttonText?: string;
  redirectType: BannerRedirectType;
  redirectValue?: string;
  order: number;
  backgroundColor?: string;
  textColor?: string;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

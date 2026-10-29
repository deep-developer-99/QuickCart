export type PromotionalRedirectType = "category" | "product";

export interface PromotionalBanner {
  _id: string;
  image: string;
  imagePublicId?: string;
  redirectType?: PromotionalRedirectType;
  redirectValue?: string;
  order: number;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
}

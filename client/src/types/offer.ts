export type OfferRedirectType = "category" | "product";
export type OfferStatus = "draft" | "published";

export interface Offer {
  _id: string;
  title: string;
  message: string;
  redirectType: OfferRedirectType;
  redirectValue: string;
  status: OfferStatus;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

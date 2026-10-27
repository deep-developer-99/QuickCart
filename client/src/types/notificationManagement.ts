export interface PageInfo {
  currentPage: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface CustomerRecipient {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface DispatchSummary {
  stored: number;
  attempted: number;
  accepted: number;
  failed: number;
  skipped: number;
  completedAt?: string;
}

export interface ManagedOffer {
  _id: string;
  title: string;
  message: string;
  redirectType: "category" | "product";
  redirectValue: string;
  status: "draft" | "published";
  audience?: "all" | "vendor_customers";
  ownerRole?: "admin" | "vendor";
  lastDispatch?: DispatchSummary;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export type ManagedDispatchStatus =
  | "stored"
  | "accepted"
  | "partial"
  | "failed"
  | "no_devices";

export interface ManagedNotification {
  /** Campaign ID returned as _id by the backend campaign summary. */
  _id: string;
  title: string;
  message: string;
  category: "offer" | "announcement";
  type: string;
  relatedId?: string;
  action?: { type: "offer" | "order" | "none"; id?: string; redirectType?: "category" | "product"; redirectValue?: string };
  sender: string;
  senderRole: "admin" | "vendor";
  recipientCount: number;
  stored: number;
  attempted: number;
  accepted: number;
  failed: number;
  skipped: number;
  dispatchStatus: ManagedDispatchStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationHistoryFilters {
  search?: string;
  category?: "offer" | "announcement" | "";
  senderRole?: "admin" | "vendor" | "";
  campaignId?: string;
  from?: string;
  to?: string;
}

export interface CampaignResendResult {
  duplicate: boolean;
  campaignId: string;
  recipients: number;
  attempted: number;
  accepted: number;
  failed: number;
  skipped: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PageInfo;
}

export interface ManualNotificationResult {
  campaignId: string;
  duplicate?: boolean;
  attempted: number;
  accepted: number;
  failed: number;
  skipped: number;
  recipients: number;
  stored: number;
}

export interface ResendResult {
  duplicate: boolean;
  stored: number;
  attempted: number;
  accepted: number;
  failed: number;
  skipped: number;
  completedAt?: string;
}

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
  _id: string;
  title: string;
  message: string;
  category?: string;
  type: string;
  relatedId?: string;
  dispatchStatus: ManagedDispatchStatus;
  acceptedCount: number;
  failedCount: number;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PageInfo;
}

export interface ManualNotificationResult {
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

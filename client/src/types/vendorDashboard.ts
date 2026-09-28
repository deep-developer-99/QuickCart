export interface VendorDashboardData {
  totalProducts: number;
  totalOrders: number;
  totalItemsSold: number;
  totalSales: number;
}

export type VendorSalesPeriod = "7d" | "30d";

export interface VendorSalesPoint {
  date: string;
  sales: number;
}

export interface VendorSalesOverviewResponse {
  period: VendorSalesPeriod;
  sales: VendorSalesPoint[];
}

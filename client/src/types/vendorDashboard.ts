export interface VendorDashboardData {
  totalProducts: number;
  totalOrders: number;
  totalItemsSold: number;
  totalSales: number;
}

export type VendorSalesPeriod = "7d" | "30d" | "90d";

export type VendorSalesMetric = "sales" | "itemsSold" | "orders";

export interface VendorSalesPoint {
  date: string;
  sales: number;
  itemsSold: number;
  orders: number;
}

export interface VendorSalesOverviewResponse {
  period: VendorSalesPeriod;
  sales: VendorSalesPoint[];
  data: VendorSalesPoint[];
}

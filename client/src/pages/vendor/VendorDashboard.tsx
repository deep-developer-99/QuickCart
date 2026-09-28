import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

import api from "../../services/api";
import { logout } from "../../services/authService";
import { getVendorSalesOverview } from "../../services/orderService";
import { logoutUser } from "../../store/slice/authSlice";
import { useAppDispatch } from "../../hooks/reduxHooks";
import SalesChart from "../../components/vendor/SalesChart";
import type {
  VendorDashboardData,
  VendorSalesMetric,
  VendorSalesOverviewResponse,
  VendorSalesPeriod,
} from "../../types/vendorDashboard";

import "./VendorDashboard.css";

const VendorDashboard = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [dashboard, setDashboard] = useState<VendorDashboardData | null>(null);
  const [salesOverview, setSalesOverview] =
    useState<VendorSalesOverviewResponse | null>(null);
  const [salesPeriod, setSalesPeriod] = useState<VendorSalesPeriod>("30d");
  const [salesMetric, setSalesMetric] = useState<VendorSalesMetric>("sales");
  const [isLoading, setIsLoading] = useState(true);
  const [isSalesLoading, setIsSalesLoading] = useState(true);
  const [error, setError] = useState("");
  const [salesError, setSalesError] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setIsLoading(true);
        setError("");

        const response = await api.get("/orders/vendor/dashboard");

        if (response.data?.success) {
          setDashboard(response.data.data);
        } else {
          setError("Failed to load dashboard.");
        }
      } catch (error) {
        console.error("Vendor dashboard error:", error);

        if (axios.isAxiosError(error)) {
          setError(
            error.response?.data?.message || "Failed to load dashboard.",
          );
        } else {
          setError("Failed to load dashboard.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    void fetchDashboard();
  }, []);

  useEffect(() => {
    const fetchSalesOverview = async () => {
      try {
        setIsSalesLoading(true);
        setSalesError("");

        const response = await getVendorSalesOverview(salesPeriod);

        if (response?.success) {
          setSalesOverview(response.data ?? null);
        } else {
          setSalesOverview(null);
          setSalesError("Failed to load performance overview.");
        }
      } catch (error) {
        console.error("Vendor performance overview error:", error);
        setSalesOverview(null);
        setSalesError("Performance overview is currently unavailable.");
      } finally {
        setIsSalesLoading(false);
      }
    };

    void fetchSalesOverview();
  }, [salesPeriod]);

  const chartData = useMemo(() => {
    if (!salesOverview) return [];

    return salesOverview.data.map((item) => ({
      date: item.date,
      value: item[salesMetric],
    }));
  }, [salesOverview, salesMetric]);

  const chartTotal = useMemo(
    () => chartData.reduce((total, item) => total + item.value, 0),
    [chartData],
  );

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      dispatch(logoutUser());
      navigate("/vendor/login", { replace: true });
    }
  };

  if (isLoading) {
    return (
      <div className="vendor-dashboard-page">
        <div className="vendor-dashboard-loading">Loading dashboard...</div>
      </div>
    );
  }

  const metricLabel =
    salesMetric === "sales"
      ? "Total Sales"
      : salesMetric === "itemsSold"
        ? "Items Sold"
        : "Orders";

  return (
    <div className="vendor-dashboard-page">
      <div className="vendor-dashboard-container">
        <div className="vendor-dashboard-header">
          <div>
            <span className="vendor-dashboard-eyebrow">
              QUICKCART VENDOR PANEL
            </span>
            <h1>Vendor Dashboard</h1>
            <p>Monitor your store performance and manage your business.</p>
          </div>

          <button
            type="button"
            className="vendor-logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>

        {error && <div className="vendor-dashboard-error">{error}</div>}

        <div className="vendor-stats-grid">
          <div className="vendor-stat-card">
            <div className="vendor-stat-icon vendor-products-icon">📦</div>
            <div>
              <p>Total Products</p>
              <h2>{dashboard?.totalProducts ?? 0}</h2>
              <span>Your active catalogue</span>
            </div>
          </div>

          <div className="vendor-stat-card">
            <div className="vendor-stat-icon vendor-orders-icon">🛒</div>
            <div>
              <p>Total Orders</p>
              <h2>{dashboard?.totalOrders ?? 0}</h2>
              <span>Orders received</span>
            </div>
          </div>

          <div className="vendor-stat-card">
            <div className="vendor-stat-icon vendor-items-icon">📊</div>
            <div>
              <p>Items Sold</p>
              <h2>{dashboard?.totalItemsSold ?? 0}</h2>
              <span>Units sold</span>
            </div>
          </div>

          <div className="vendor-stat-card vendor-sales-card">
            <div className="vendor-stat-icon vendor-sales-icon">💰</div>
            <div>
              <p>Total Sales</p>
              <h2>₹{(dashboard?.totalSales ?? 0).toLocaleString("en-IN")}</h2>
              <span>Overall revenue</span>
            </div>
          </div>
        </div>

        <section className="vendor-chart-section">
          <div className="vendor-chart-header">
            <div>
              <span className="vendor-chart-eyebrow">ANALYTICS</span>
              <h2>Store Performance</h2>
              <p>Track your sales, orders and items sold over time.</p>
            </div>

            <div className="vendor-chart-controls">
              <label>
                <span>Metric</span>
                <select
                  value={salesMetric}
                  onChange={(event) =>
                    setSalesMetric(event.target.value as VendorSalesMetric)
                  }
                >
                  <option value="sales">Total Sales</option>
                  <option value="itemsSold">Items Sold</option>
                  <option value="orders">Orders</option>
                </select>
              </label>

              <label>
                <span>Period</span>
                <select
                  value={salesPeriod}
                  onChange={(event) =>
                    setSalesPeriod(event.target.value as VendorSalesPeriod)
                  }
                >
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                </select>
              </label>
            </div>
          </div>

          <div className="vendor-chart-summary">
            <div>
              <span>{metricLabel}</span>
              <strong>
                {salesMetric === "sales"
                  ? `₹${chartTotal.toLocaleString("en-IN")}`
                  : chartTotal.toLocaleString("en-IN")}
              </strong>
            </div>
            <span className="vendor-chart-period">
              Last {salesPeriod === "7d" ? 7 : salesPeriod === "30d" ? 30 : 90}{" "}
              days
            </span>
          </div>

          <SalesChart
            data={chartData}
            metric={salesMetric}
            isLoading={isSalesLoading}
          />

          {salesError && <p className="vendor-sales-error">{salesError}</p>}
        </section>

        <section className="vendor-actions-section">
          <div>
            <span className="vendor-chart-eyebrow">MANAGEMENT</span>
            <h2>Quick Actions</h2>
          </div>

          <div className="vendor-dashboard-actions">
            <Link to="/vendor/products">
              <span>📦</span>
              Manage Products
            </Link>
            <Link to="/vendor/orders">
              <span>🛒</span>
              Manage Orders
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default VendorDashboard;

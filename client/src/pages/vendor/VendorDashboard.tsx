import { useEffect, useState } from "react";
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
  VendorSalesOverviewResponse,
  VendorSalesPeriod,
} from "../../types/vendorDashboard";

import "./VendorDashboard.css";

const VendorDashboard = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [dashboard, setDashboard] = useState<VendorDashboardData | null>(null);
  const [sales, setSales] = useState<VendorSalesOverviewResponse["sales"]>([]);
  const [salesPeriod, setSalesPeriod] = useState<VendorSalesPeriod>("7d");
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

    fetchDashboard();
  }, []);

  useEffect(() => {
    const fetchSalesOverview = async () => {
      try {
        setIsSalesLoading(true);
        setSalesError("");

        const response = await getVendorSalesOverview(salesPeriod);

        if (response?.success) {
          setSales(response.data?.sales ?? []);
        } else {
          setSales([]);
          setSalesError("Failed to load sales overview.");
        }
      } catch (error) {
        console.error("Vendor sales overview error:", error);
        setSales([]);
        setSalesError("Sales overview is currently unavailable.");
      } finally {
        setIsSalesLoading(false);
      }
    };

    fetchSalesOverview();
  }, [salesPeriod]);

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

  return (
    <div className="vendor-dashboard-page">
      <div className="vendor-dashboard-container">
        <div className="vendor-dashboard-header">
          <div>
            <p className="vendor-dashboard-eyebrow">QUICKCART VENDOR PANEL</p>
            <h1>Vendor Dashboard</h1>
            <p>Manage your products, orders and sales from here.</p>
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
            <div className="vendor-stat-icon">📦</div>
            <div>
              <p>Total Products</p>
              <h2>{dashboard?.totalProducts ?? 0}</h2>
            </div>
          </div>

          <div className="vendor-stat-card">
            <div className="vendor-stat-icon">🛒</div>
            <div>
              <p>Total Orders</p>
              <h2>{dashboard?.totalOrders ?? 0}</h2>
            </div>
          </div>

          <div className="vendor-stat-card">
            <div className="vendor-stat-icon">📊</div>
            <div>
              <p>Items Sold</p>
              <h2>{dashboard?.totalItemsSold ?? 0}</h2>
            </div>
          </div>

          <div className="vendor-stat-card">
            <div className="vendor-stat-icon">💰</div>
            <div>
              <p>Total Sales</p>
              <h2>₹{(dashboard?.totalSales ?? 0).toLocaleString("en-IN")}</h2>
            </div>
          </div>
        </div>

        <div className="vendor-dashboard-main-grid">
          <div>
            <SalesChart
              data={sales}
              period={salesPeriod}
              onPeriodChange={setSalesPeriod}
              isLoading={isSalesLoading}
            />
            {salesError && <p className="vendor-sales-error">{salesError}</p>}
          </div>

          <div className="vendor-quick-actions-card">
            <div>
              <p className="vendor-card-label">QUICK ACTIONS</p>
              <h2>Manage your store</h2>
              <p>Jump directly to the sections you use most.</p>
            </div>

            <div className="vendor-dashboard-actions">
              <Link to="/vendor/products">Manage Products</Link>
              <Link to="/vendor/orders">View Orders</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;

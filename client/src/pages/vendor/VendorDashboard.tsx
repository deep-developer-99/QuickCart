import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

import api from "../../services/api";
import { logout } from "../../services/authService";

import { logoutUser } from "../../store/slice/authSlice";
import { useAppDispatch } from "../../hooks/reduxHooks";

import "./VendorDashboard.css";

interface VendorDashboardData {
  totalProducts: number;
  totalOrders: number;
  totalItemsSold: number;
  totalSales: number;
}

const VendorDashboard = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [dashboard, setDashboard] = useState<VendorDashboardData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      dispatch(logoutUser());

      navigate("/vendor/login", {
        replace: true,
      });
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
        {/* Header */}
        <div className="vendor-dashboard-header">
          <div>
            <h1>Vendor Dashboard</h1>
            <p>Manage your products and orders from here.</p>
          </div>

          <button
            type="button"
            className="vendor-logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>

        {/* Error */}
        {error && <div className="vendor-dashboard-error">{error}</div>}

        {/* Statistics */}
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
              <h2>₹{dashboard?.totalSales ?? 0}</h2>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="vendor-dashboard-actions">
          <Link to="/vendor/products">Manage Products</Link>

          <Link to="/vendor/orders">View Orders</Link>
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;

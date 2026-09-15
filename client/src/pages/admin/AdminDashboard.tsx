import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

import api from "../../services/api";
import { logout } from "../../services/authService";

import { logoutUser } from "../../store/slice/authSlice";
import { useAppDispatch } from "../../hooks/reduxHooks";

import "./AdminDashboard.css";

interface AdminDashboardData {
  totalUsers: number;
  totalVendors: number;
  totalProducts: number;
  totalOrders: number;
  totalSales: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setIsLoading(true);
        setError("");

        const response = await api.get("/admin/dashboard");

        if (response.data?.success) {
          setDashboard(response.data.data);
        } else {
          setError("Failed to load dashboard.");
        }
      } catch (error) {
        console.error("Admin dashboard error:", error);

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

      navigate("/admin/login", {
        replace: true,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="admin-dashboard-page">
        <div className="admin-dashboard-loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-page">
      <div className="admin-dashboard-container">
        {/* Header */}
        <div className="admin-dashboard-header">
          <div>
            <h1>Admin Dashboard</h1>
            <p>Manage QuickCart from one place.</p>
          </div>

          <button
            type="button"
            className="admin-logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>

        {/* Error */}
        {error && <div className="admin-dashboard-error">{error}</div>}

        {/* Statistics */}
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-icon">👥</div>

            <div>
              <p>Total Users</p>
              <h2>{dashboard?.totalUsers ?? 0}</h2>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-icon">🏪</div>

            <div>
              <p>Total Vendors</p>
              <h2>{dashboard?.totalVendors ?? 0}</h2>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-icon">📦</div>

            <div>
              <p>Total Products</p>
              <h2>{dashboard?.totalProducts ?? 0}</h2>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-icon">🛒</div>

            <div>
              <p>Total Orders</p>
              <h2>{dashboard?.totalOrders ?? 0}</h2>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-icon">💰</div>

            <div>
              <p>Total Sales</p>
              <h2>₹{dashboard?.totalSales ?? 0}</h2>
            </div>
          </div>
        </div>

        {/* Management Links */}
        <div className="admin-dashboard-actions">
          <Link to="/admin/users">Manage Users</Link>

          <Link to="/admin/vendors">Manage Vendors</Link>

          <Link to="/admin/products">Manage Products</Link>

          <Link to="/admin/orders">Manage Orders</Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

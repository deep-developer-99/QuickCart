import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import api from "../../services/api";
import { logout } from "../../services/authService";
import { logoutUser } from "../../store/slice/authSlice";
import { useAppDispatch } from "../../hooks/reduxHooks";

import "./AdminDashboard.css";

interface TrendData {
  date: string;
  sales?: number;
  users?: number;
}

interface AdminDashboardData {
  totalUsers: number;
  totalVendors: number;
  totalProducts: number;
  totalOrders: number;
  totalSales: number;
  salesTrend: TrendData[];
  usersTrend: TrendData[];
  chartDays: number;
}

type ChartMetric = "sales" | "users";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [chartMetric, setChartMetric] = useState<ChartMetric>("sales");
  const [selectedDays, setSelectedDays] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setIsLoading(true);
        setError("");

        const response = await api.get(`/admin/dashboard?days=${selectedDays}`);

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

    void fetchDashboard();
  }, [selectedDays]);

  const chartData = useMemo(() => {
    if (!dashboard) return [];

    const trend =
      chartMetric === "sales" ? dashboard.salesTrend : dashboard.usersTrend;

    return trend.map((item) => ({
      date: new Date(`${item.date}T00:00:00`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      }),
      value: chartMetric === "sales" ? (item.sales ?? 0) : (item.users ?? 0),
    }));
  }, [dashboard, chartMetric]);

  const chartTotal = useMemo(
    () => chartData.reduce((sum, item) => sum + item.value, 0),
    [chartData],
  );

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      dispatch(logoutUser());
      navigate("/admin/login", { replace: true });
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
        <div className="admin-dashboard-header">
          <div>
            <span className="admin-dashboard-eyebrow">QUICKCART ADMIN</span>
            <h1>Admin Dashboard</h1>
            <p>
              Monitor your store performance and manage everything from one
              place.
            </p>
          </div>

          <button
            type="button"
            className="admin-logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>

        {error && <div className="admin-dashboard-error">{error}</div>}

        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-icon users-icon">👥</div>
            <div>
              <p>Total Users</p>
              <h2>{dashboard?.totalUsers ?? 0}</h2>
              <span>Registered users</span>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-icon vendors-icon">🏪</div>
            <div>
              <p>Total Vendors</p>
              <h2>{dashboard?.totalVendors ?? 0}</h2>
              <span>Registered vendors</span>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-icon products-icon">📦</div>
            <div>
              <p>Total Products</p>
              <h2>{dashboard?.totalProducts ?? 0}</h2>
              <span>Product catalogue</span>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-icon orders-icon">🛒</div>
            <div>
              <p>Total Orders</p>
              <h2>{dashboard?.totalOrders ?? 0}</h2>
              <span>Orders received</span>
            </div>
          </div>

          <div className="admin-stat-card sales-card">
            <div className="admin-stat-icon sales-icon">💰</div>
            <div>
              <p>Total Sales</p>
              <h2>₹{(dashboard?.totalSales ?? 0).toLocaleString("en-IN")}</h2>
              <span>Overall revenue</span>
            </div>
          </div>
        </div>

        <section className="admin-chart-section">
          <div className="admin-chart-header">
            <div>
              <span className="chart-eyebrow">ANALYTICS</span>
              <h2>Store Performance</h2>
              <p>View sales and user growth for the selected period.</p>
            </div>

            <div className="admin-chart-controls">
              <label>
                <span>Metric</span>
                <select
                  value={chartMetric}
                  onChange={(event) =>
                    setChartMetric(event.target.value as ChartMetric)
                  }
                >
                  <option value="sales">Total Sales</option>
                  <option value="users">Users Created</option>
                </select>
              </label>

              <label>
                <span>Period</span>
                <select
                  value={selectedDays}
                  onChange={(event) =>
                    setSelectedDays(Number(event.target.value))
                  }
                >
                  <option value={7}>Last 7 Days</option>
                  <option value={30}>Last 30 Days</option>
                  <option value={90}>Last 90 Days</option>
                </select>
              </label>
            </div>
          </div>

          <div className="admin-chart-summary">
            <div>
              <span>
                {chartMetric === "sales"
                  ? "Sales in selected period"
                  : "Users created in selected period"}
              </span>
              <strong>
                {chartMetric === "sales"
                  ? `₹${chartTotal.toLocaleString("en-IN")}`
                  : chartTotal.toLocaleString("en-IN")}
              </strong>
            </div>

            <span className="chart-period">Last {selectedDays} days</span>
          </div>

          <div className="admin-chart-wrapper">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 15, right: 20, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={20}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: number) =>
                      chartMetric === "sales"
                        ? `₹${value.toLocaleString("en-IN")}`
                        : value.toString()
                    }
                  />
                  <Tooltip
                    formatter={(value) => {
                      const numericValue = Number(value ?? 0);
                      return chartMetric === "sales"
                        ? [`₹${numericValue.toLocaleString("en-IN")}`, "Sales"]
                        : [numericValue, "Users"];
                    }}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#5fa653"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="admin-chart-empty">
                No data available for the selected period.
              </div>
            )}
          </div>
        </section>

        <section className="admin-actions-section">
          <div>
            <span className="chart-eyebrow">MANAGEMENT</span>
            <h2>Quick Actions</h2>
          </div>

          <div className="admin-dashboard-actions">
            <Link to="/admin/users">
              <span>👥</span>Manage Users
            </Link>
            <Link to="/admin/vendors">
              <span>🏪</span>Manage Vendors
            </Link>
            <Link to="/admin/products">
              <span>📦</span>Manage Products
            </Link>
            <Link to="/admin/categories">
              <span>🗂️</span>Manage Categories
            </Link>
            <Link to="/admin/orders">
              <span>🛒</span>Manage Orders
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;

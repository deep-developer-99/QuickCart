import { NavLink, useNavigate } from "react-router-dom";

import { logout } from "../../services/authService";
import { logoutUser } from "../../store/slice/authSlice";
import { useAppDispatch } from "../../hooks/reduxHooks";

import "./VendorSidebar.css";

const VendorSidebar = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

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

  return (
    <aside className="vendor-sidebar" aria-label="Vendor navigation">
      <div className="vendor-sidebar-brand">
        <span className="vendor-sidebar-brand-icon">⚡</span>
        <div>
          <strong>QuickCart</strong>
          <span>Vendor Panel</span>
        </div>
      </div>

      <nav className="vendor-sidebar-nav">
        <span className="vendor-sidebar-section-title">MENU</span>

        <NavLink
          to="/vendor/dashboard"
          className={({ isActive }) =>
            `vendor-sidebar-link${isActive ? " active" : ""}`
          }
        >
          <span className="vendor-sidebar-icon">▦</span>
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/vendor/products"
          className={({ isActive }) =>
            `vendor-sidebar-link${isActive ? " active" : ""}`
          }
        >
          <span className="vendor-sidebar-icon">📦</span>
          <span>Manage Products</span>
        </NavLink>

        <NavLink
          to="/vendor/orders"
          className={({ isActive }) =>
            `vendor-sidebar-link${isActive ? " active" : ""}`
          }
        >
          <span className="vendor-sidebar-icon">🛒</span>
          <span>Manage Orders</span>
        </NavLink>
      </nav>

      <div className="vendor-sidebar-footer">
        <div className="vendor-sidebar-account">
          <span className="vendor-sidebar-status-dot" />
          <div>
            <strong>Vendor account</strong>
            <span>Currently logged in</span>
          </div>
        </div>

        <button
          type="button"
          className="vendor-sidebar-logout"
          onClick={handleLogout}
        >
          <span>↪</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default VendorSidebar;

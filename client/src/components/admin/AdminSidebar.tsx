import { NavLink, useNavigate } from "react-router-dom";
import { logout } from "../../services/authService";
import { logoutUser } from "../../store/slice/authSlice";
import { useAppDispatch } from "../../hooks/reduxHooks";

import "./AdminSidebar.css";

const AdminSidebar = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Admin logout error:", error);
    } finally {
      dispatch(logoutUser());
      navigate("/admin/login", { replace: true });
    }
  };

  const navItems = [
    { to: "/admin/dashboard", label: "Dashboard", icon: "▦" },
    { to: "/admin/users", label: "Manage Users", icon: "👥" },
    { to: "/admin/vendors", label: "Manage Vendors", icon: "🏪" },
    { to: "/admin/products", label: "Manage Products", icon: "📦" },
    { to: "/admin/categories", label: "Categories", icon: "🗂️" },
    { to: "/admin/banners", label: "Banners", icon: "🖼️" },
    { to: "/admin/orders", label: "Manage Orders", icon: "🛒" },
  ];

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <div className="admin-sidebar-logo">⚡</div>
        <div>
          <strong>QuickCart</strong>
          <span>Admin Panel</span>
        </div>
      </div>

      <div className="admin-sidebar-divider" />

      <p className="admin-sidebar-label">MENU</p>

      <nav className="admin-sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/admin/dashboard"}
            className={({ isActive }) =>
              `admin-sidebar-link${isActive ? " active" : ""}`
            }
          >
            <span className="admin-sidebar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="admin-sidebar-bottom">
        <div className="admin-account">
          <span className="admin-account-dot" />
          <div>
            <strong>Admin account</strong>
            <span>Currently logged in</span>
          </div>
        </div>

        <button
          type="button"
          className="admin-sidebar-logout"
          onClick={handleLogout}
        >
          <span>↪</span>
          Logout
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;

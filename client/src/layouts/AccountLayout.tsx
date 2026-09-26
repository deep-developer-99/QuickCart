import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { logout } from "../services/authService";
import { logoutUser } from "../store/slice/authSlice";
import { useAppDispatch, useAppSelector } from "../hooks/reduxHooks";

import "./AccountLayout.css";

const AccountLayout = () => {
  const { user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      dispatch(logoutUser());
      navigate("/");
    }
  };

  const displayName = user?.name || "QuickCart User";
  const email = user?.email || "No email available";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="account-page" ref={contentRef}>
      <div className="account-shell">
        <aside className="account-sidebar" aria-label="Account navigation">
          <div className="account-user-card">
            <div className="account-user-avatar">{initial}</div>
            <div className="account-user-copy">
              <strong>{displayName}</strong>
              <span>{email}</span>
            </div>
          </div>

          <nav className="account-nav">
            <NavLink
              to="/account/profile"
              className={({ isActive }) =>
                `account-nav-item${isActive ? " active" : ""}`
              }
            >
              <span className="account-nav-icon">♙</span>
              <span>My Profile</span>
            </NavLink>

            <NavLink
              to="/account/addresses"
              className={({ isActive }) =>
                `account-nav-item${isActive ? " active" : ""}`
              }
            >
              <span className="account-nav-icon">⌖</span>
              <span>My Addresses</span>
            </NavLink>

            <NavLink
              to="/account/orders"
              className={({ isActive }) =>
                `account-nav-item${isActive ? " active" : ""}`
              }
            >
              <span className="account-nav-icon">▤</span>
              <span>My Orders</span>
            </NavLink>
          </nav>

          <button
            type="button"
            className="account-logout"
            onClick={handleLogout}
          >
            <span>↪</span>
            Logout
          </button>
        </aside>

        <main className="account-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AccountLayout;

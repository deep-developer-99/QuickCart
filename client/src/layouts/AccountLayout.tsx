import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FaBoxOpen,
  FaChevronRight,
  FaMapMarkerAlt,
  FaSignOutAlt,
  FaUser, FaShieldAlt,
} from "react-icons/fa";

import { logout, LogoutServiceError } from "../services/authService";
import { useAppSelector } from "../hooks/reduxHooks";
import { usePrivateCachedQuery } from "../services/queryCache";
import { PRIVATE_CACHE_TTL_MS } from "../services/cachePolicy";

import "./AccountLayout.css";

type PaginatedCountResponse = {
  success?: boolean;
  pagination?: {
    totalItems?: number;
  };
};

const AccountLayout = () => {
  const { user, revision } = useAppSelector((state) => state.auth);
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const [failedProfileImage, setFailedProfileImage] = useState<string | null>(null);

  const scope = useMemo(
    () => user?.role === "user" && user.id ? `user:${user.id}:${revision}` : null,
    [user, revision],
  );
  const addressCounts = usePrivateCachedQuery<PaginatedCountResponse>(scope, "/addresses", { page: 1, limit: 1 }, PRIVATE_CACHE_TTL_MS.orderCount, ["Addresses"]);
  const orderCounts = usePrivateCachedQuery<PaginatedCountResponse>(scope, "/orders/my-orders", { page: 1, limit: 1 }, PRIVATE_CACHE_TTL_MS.orderCount, ["Orders"]);
  const refetchAddressCounts = addressCounts.refetch;
  const refetchOrderCounts = orderCounts.refetch;
  const addressCount = addressCounts.data?.pagination?.totalItems;
  const orderCount = orderCounts.data?.pagination?.totalItems;

  useEffect(() => {
    if (!scope) return;
    const timer = window.setInterval(() => { void refetchAddressCounts(); }, PRIVATE_CACHE_TTL_MS.orderCount);
    return () => window.clearInterval(timer);
  }, [scope, refetchAddressCounts]);

  useEffect(() => {
    if (!scope) return;
    const timer = window.setInterval(() => { void refetchOrderCounts(); }, PRIVATE_CACHE_TTL_MS.orderCount);
    return () => window.clearInterval(timer);
  }, [scope, refetchOrderCounts]);

  useEffect(() => {
    contentRef.current?.scrollIntoView({ block: "start" });
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
      if (error instanceof LogoutServiceError && error.backendLoggedOut) navigate("/");
    }
  };

  const displayName = user?.name?.trim() || "User";
  const email = user?.phone?.trim() || user?.email?.trim() || "Contact not provided";
  const initial = displayName.charAt(0).toUpperCase() || "U";

  return (
    <div className="account-page" ref={contentRef}>
      <div className="account-shell">
        <aside className="account-sidebar" aria-label="Account navigation">
          <div className="account-user-card">
            {user?.profileImage && failedProfileImage !== user.profileImage ? (
              <img
                className="account-user-avatar"
                src={user.profileImage}
                alt={`${displayName} profile`}
                onError={() => {
                  setFailedProfileImage(user.profileImage || null);
                }}
              />
            ) : (
              <div
                className="account-user-avatar account-user-avatar-fallback"
                aria-hidden="true"
              >
                {initial}
              </div>
            )}
            <div className="account-user-copy">
              <strong>{displayName}</strong>
              <span>{email}</span>
            </div>
          </div>

          <nav className="account-nav">
            <NavLink
              to="/account/profile"
              end
              className={({ isActive }) =>
                `account-nav-item${isActive ? " active" : ""}`
              }
            >
              <span className="account-nav-icon" aria-hidden="true"><FaUser /></span>
              <span>My Profile</span>
              <span className="account-nav-meta"><FaChevronRight aria-hidden="true" /></span>
            </NavLink>

            <NavLink
              to="/account/addresses"
              end
              className={({ isActive }) =>
                `account-nav-item${isActive ? " active" : ""}`
              }
            >
              <span className="account-nav-icon" aria-hidden="true"><FaMapMarkerAlt /></span>
              <span>My Addresses</span>
              <span className="account-nav-meta">
                {typeof addressCount === "number" && (
                  <span className="account-nav-count" aria-label={`${addressCount} saved addresses`}>
                    {addressCount}
                  </span>
                )}
                <FaChevronRight aria-hidden="true" />
              </span>
            </NavLink>

            <NavLink
              to="/account/orders"
              className={({ isActive }) =>
                `account-nav-item${isActive ? " active" : ""}`
              }
            >
              <span className="account-nav-icon" aria-hidden="true"><FaBoxOpen /></span>
              <span>My Orders</span>
              <span className="account-nav-meta">
                {typeof orderCount === "number" && (
                  <span className="account-nav-count" aria-label={`${orderCount} orders`}>
                    {orderCount}
                  </span>
                )}
                <FaChevronRight aria-hidden="true" />
              </span>
            </NavLink>
            <NavLink to="/account/privacy" className={({ isActive }) =>
              `account-nav-item${isActive || location.pathname.startsWith("/account/delete-account") ? " active" : ""}`}>
              <span className="account-nav-icon"><FaShieldAlt aria-hidden="true" /></span>
              <span>Account Privacy</span>
              <span className="account-nav-meta"><FaChevronRight aria-hidden="true" /></span>
            </NavLink>
          </nav>

          <button
            type="button"
            className="account-logout"
            onClick={handleLogout}
          >
            <FaSignOutAlt aria-hidden="true" />
            Logout
          </button>
        </aside>

        <div className="account-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AccountLayout;

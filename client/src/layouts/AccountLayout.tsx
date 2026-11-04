import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FaBoxOpen,
  FaChevronRight,
  FaMapMarkerAlt,
  FaSignOutAlt,
  FaUser,
} from "react-icons/fa";

import { logout } from "../services/authService";
import { getAddresses } from "../services/addressService";
import { getMyOrders } from "../services/orderService";
import { logoutUser } from "../store/slice/authSlice";
import { useAppDispatch, useAppSelector } from "../hooks/reduxHooks";

import "./AccountLayout.css";

type PaginatedCountResponse = {
  pagination?: {
    totalItems?: number;
  };
};

const getCount = (response: PaginatedCountResponse): number | null => {
  const count = response.pagination?.totalItems;
  return typeof count === "number" && Number.isSafeInteger(count) && count >= 0
    ? count
    : null;
};

const AccountLayout = () => {
  const { user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const [addressCount, setAddressCount] = useState<number | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [failedProfileImage, setFailedProfileImage] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let isCurrent = true;

    void getAddresses(1, 1)
      .then((response: PaginatedCountResponse) => {
        if (isCurrent) setAddressCount(getCount(response));
      })
      .catch(() => {
        if (isCurrent) setAddressCount(null);
      });

    void getMyOrders(1, 1)
      .then((response: PaginatedCountResponse) => {
        if (isCurrent) setOrderCount(getCount(response));
      })
      .catch(() => {
        if (isCurrent) setOrderCount(null);
      });

    return () => {
      isCurrent = false;
    };
  }, [user?.id]);

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

  const displayName = user?.name?.trim() || "User";
  const email = user?.email?.trim() || "Email not provided";
  const initial = displayName.charAt(0).toUpperCase() || "U";

  return (
    <div className="account-page" ref={contentRef}>
      <header className="account-page-heading">
        <h1>Account Overview</h1>
        <p>
          View and manage your personal QuickCart information and active
          preferences.
        </p>
      </header>

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
                {addressCount !== null && (
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
                {orderCount !== null && (
                  <span className="account-nav-count" aria-label={`${orderCount} orders`}>
                    {orderCount}
                  </span>
                )}
                <FaChevronRight aria-hidden="true" />
              </span>
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

        <main className="account-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AccountLayout;

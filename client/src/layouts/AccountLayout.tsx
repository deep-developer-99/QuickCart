import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FaBoxOpen,
  FaChevronRight,
  FaMapMarkerAlt,
  FaSignOutAlt,
  FaUser, FaShieldAlt,
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
    let sessionExpired = false;
    const handleRequestError = (error: unknown) => {
      if (!isCurrent) return;
      if (axios.isAxiosError(error) && error.response?.status === 401 && !sessionExpired) {
        sessionExpired = true;
        dispatch(logoutUser());
        navigate("/login", { state: { from: location }, replace: true });
        return;
      }
      return null;
    };

    void getAddresses(1, 1)
      .then((response: PaginatedCountResponse) => {
        if (isCurrent) setAddressCount(getCount(response));
      })
      .catch((error: unknown) => {
        handleRequestError(error);
        if (isCurrent) setAddressCount(null);
      });

    void getMyOrders(1, 1)
      .then((response: PaginatedCountResponse) => {
        if (isCurrent) setOrderCount(getCount(response));
      })
      .catch((error: unknown) => {
        handleRequestError(error);
        if (isCurrent) setOrderCount(null);
      });

    return () => {
      isCurrent = false;
    };
  }, [dispatch, location, navigate, user?.id]);

  useEffect(() => {
    contentRef.current?.scrollIntoView({ block: "start" });
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

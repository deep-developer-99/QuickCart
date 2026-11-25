import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import axios from "axios";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FaBoxOpen,
  FaChevronRight,
  FaMapMarkerAlt,
  FaSignOutAlt,
  FaUser, FaShieldAlt,
} from "react-icons/fa";

import { logout, LogoutServiceError } from "../services/authService";
import { getAddresses } from "../services/addressService";
import { getMyOrders } from "../services/orderService";
import { finalizeLocalLogout } from "../services/authSession";
import { useAppSelector } from "../hooks/reduxHooks";
import {
  ACCOUNT_COUNT_CACHE_TTL_MS,
  EMPTY_ACCOUNT_COUNTS,
  getAccountCountSnapshot,
  loadAccountCount,
  subscribeToAccountCounts,
  type AccountCountScope,
} from "../services/accountCountCache";

import "./AccountLayout.css";

type PaginatedCountResponse = {
  success?: boolean;
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
  const { user, revision } = useAppSelector((state) => state.auth);
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  const contentRef = useRef<HTMLDivElement>(null);
  const [failedProfileImage, setFailedProfileImage] = useState<string | null>(null);

  const scope = useMemo<AccountCountScope | null>(
    () => user?.role === "user" && user.id ? { userId: user.id, revision } : null,
    [user, revision],
  );
  const subscribeCounts = useCallback(
    (listener: () => void) => scope ? subscribeToAccountCounts(scope, listener) : () => undefined,
    [scope],
  );
  const getCounts = useCallback(
    () => scope ? getAccountCountSnapshot(scope) : EMPTY_ACCOUNT_COUNTS,
    [scope],
  );
  const counts = useSyncExternalStore(subscribeCounts, getCounts, getCounts);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    if (!scope) return;

    let isCurrent = true;
    let sessionExpired = false;
    const handleRequestError = (error: unknown) => {
      if (!isCurrent) return;
      if (axios.isAxiosError(error) && error.response?.status === 401 && !sessionExpired) {
        sessionExpired = true;
        finalizeLocalLogout();
        navigate("/login", { state: { from: locationRef.current }, replace: true });
        return;
      }
      return null;
    };

    const loadCount = async (kind: "addresses" | "orders", loader: () => Promise<PaginatedCountResponse>) => {
      try {
        await loadAccountCount(scope, kind, async () => {
          const response = await loader();
          return response?.success === false ? null : getCount(response);
        });
      } catch (error) {
        handleRequestError(error);
        if (!axios.isCancel(error)) console.warn(`Unable to load account ${kind} count:`, error);
      }
    };

    void loadCount("addresses", () => getAddresses(1, 1));
    void loadCount("orders", () => getMyOrders(1, 1));

    return () => {
      isCurrent = false;
    };
  }, [navigate, scope, counts]);

  useEffect(() => {
    if (!scope || (counts.addresses === null && counts.orders === null)) return;
    const timer = window.setTimeout(() => {
      void loadAccountCount(scope, "addresses", async () => {
        const response = await getAddresses(1, 1);
        return response?.success === false ? null : getCount(response);
      }).catch((error: unknown) => {
        if (!axios.isCancel(error)) console.warn("Unable to refresh account address count:", error);
      });
      void loadAccountCount(scope, "orders", async () => {
        const response = await getMyOrders(1, 1);
        return response?.success === false ? null : getCount(response);
      }).catch((error: unknown) => {
        if (!axios.isCancel(error)) console.warn("Unable to refresh account order count:", error);
      });
    }, ACCOUNT_COUNT_CACHE_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [scope, counts]);

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
                {counts.addresses !== null && (
                  <span className="account-nav-count" aria-label={`${counts.addresses} saved addresses`}>
                    {counts.addresses}
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
                {counts.orders !== null && (
                  <span className="account-nav-count" aria-label={`${counts.orders} orders`}>
                    {counts.orders}
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

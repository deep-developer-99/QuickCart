import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { logout } from "../../services/authService";
import { logoutUser } from "../../store/slice/authSlice";
import { useAppDispatch, useAppSelector } from "../../hooks/reduxHooks";
import SearchBar from "./SearchBar";
import LocationSelector from "./LocationSelector";

import "./Navbar.css";
import { useCart } from "../../context/useCart";

const Navbar = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { cart } = useCart();
  const isCartEmpty = !cart?.items?.length;

  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const isUser = isAuthenticated && user?.role === "user";

  useEffect(() => {
    if (!isProfileOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsProfileOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isProfileOpen]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      dispatch(logoutUser());
      setIsProfileOpen(false);
      setIsMenuOpen(false);
      navigate("/");
    }
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
    setIsProfileOpen(false);
  };

  const openAccount = (path: string) => {
    setIsProfileOpen(false);
    setIsMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand-area">
          <Link to="/" className="navbar-logo" onClick={closeMenu}>
            QuickCart
          </Link>
          <LocationSelector />
        </div>

        <div className="navbar-search-desktop">
          <SearchBar />
        </div>

        <nav className="navbar-actions">
          {isUser ? (
            <>
              {isCartEmpty ? (
                <span className="navbar-cart-action navbar-cart-disabled">
                  🛒 Cart
                </span>
              ) : (
                <NavLink
                  to="/cart"
                  className={({ isActive }) =>
                    isActive
                      ? "navbar-cart-action active"
                      : "navbar-cart-action"
                  }
                >
                  🛒 Cart
                </NavLink>
              )}

              <div className="navbar-profile-wrapper" ref={profileMenuRef}>
                <button
                  type="button"
                  className={`navbar-profile-action${
                    isProfileOpen ? " active" : ""
                  }`}
                  onClick={() => setIsProfileOpen((previous) => !previous)}
                  aria-label="Open account menu"
                  aria-expanded={isProfileOpen}
                  aria-haspopup="menu"
                >
                  <span className="navbar-profile-avatar" aria-hidden="true">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </span>
                </button>

                {isProfileOpen && (
                  <div className="profile-dropdown" role="menu">
                    <div className="profile-dropdown-header">
                      <div className="profile-dropdown-avatar">
                        {user?.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                      <div>
                        <strong>{user?.name || "QuickCart User"}</strong>
                        <span>{user?.email || "My Account"}</span>
                      </div>
                    </div>

                    <div className="profile-dropdown-divider" />

                    <button
                      type="button"
                      role="menuitem"
                      className="profile-dropdown-item"
                      onClick={() => openAccount("/account/profile")}
                    >
                      <span>♙</span>
                      <span>
                        <strong>Profile</strong>
                        <small>Manage your account</small>
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className="profile-dropdown-item"
                      onClick={() => openAccount("/account/addresses")}
                    >
                      <span>⌖</span>
                      <span>
                        <strong>Saved Addresses</strong>
                        <small>Manage delivery addresses</small>
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className="profile-dropdown-item"
                      onClick={() => openAccount("/account/orders")}
                    >
                      <span>▤</span>
                      <span>
                        <strong>My Orders</strong>
                        <small>View your orders</small>
                      </span>
                    </button>

                    <div className="profile-dropdown-divider" />

                    <button
                      type="button"
                      role="menuitem"
                      className="profile-dropdown-item profile-dropdown-logout"
                      onClick={handleLogout}
                    >
                      <span>↪</span>
                      <span>
                        <strong>Logout</strong>
                        <small>Sign out of your account</small>
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <NavLink
              to="/login"
              className={({ isActive }) =>
                isActive ? "navbar-login active" : "navbar-login"
              }
            >
              Login
            </NavLink>
          )}
        </nav>

        <button
          type="button"
          className="navbar-menu-button"
          onClick={() => setIsMenuOpen((previous) => !previous)}
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className="navbar-search-mobile">
        <SearchBar />
      </div>

      {isMenuOpen && (
        <nav className="mobile-menu">
          <NavLink to="/" className="mobile-menu-link" onClick={closeMenu}>
            Home
          </NavLink>

          {isUser ? (
            <>
              <NavLink
                to="/cart"
                className={({ isActive }) =>
                  isActive ? "mobile-menu-link active" : "mobile-menu-link"
                }
                onClick={closeMenu}
              >
                🛒 Cart
              </NavLink>
              <button
                type="button"
                className="mobile-menu-link mobile-account-button"
                onClick={() => openAccount("/account/profile")}
              >
                ♙ Profile
              </button>
              <button
                type="button"
                className="mobile-menu-link mobile-account-button"
                onClick={() => openAccount("/account/addresses")}
              >
                ⌖ Saved Addresses
              </button>
              <button
                type="button"
                className="mobile-menu-link mobile-account-button"
                onClick={() => openAccount("/account/orders")}
              >
                ▤ My Orders
              </button>
              <button
                type="button"
                className="mobile-menu-logout"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <NavLink
              to="/login"
              className="mobile-menu-login"
              onClick={closeMenu}
            >
              Login
            </NavLink>
          )}
        </nav>
      )}
    </header>
  );
};

export default Navbar;

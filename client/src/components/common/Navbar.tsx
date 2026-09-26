import { useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";

import { logout } from "../../services/authService";
import { logoutUser } from "../../store/slice/authSlice";
import { useAppDispatch, useAppSelector } from "../../hooks/reduxHooks";
import SearchBar from "./SearchBar";
import LocationSelector from "./LocationSelector";

import "./Navbar.css";
import { useCart } from "../../context/useCart";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { cart } = useCart();
  const isCartEmpty = !cart?.items?.length;

  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const isUser = isAuthenticated && user?.role === "user";

  useEffect(() => {
    setIsProfileOpen(false);
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

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

  const closeMenu = () => setIsMenuOpen(false);
  const closeProfileMenu = () => setIsProfileOpen(false);

  const profileImage = user?.profileImage;
  const profileInitial = user?.name?.charAt(0).toUpperCase() || "U";

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
          {isUser && (
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
                  className={`navbar-profile-action${isProfileOpen ? " active" : ""}`}
                  onClick={() => setIsProfileOpen((previous) => !previous)}
                  aria-label="Open profile menu"
                  aria-haspopup="menu"
                  aria-expanded={isProfileOpen}
                >
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt={user?.name || "Profile"}
                      className="navbar-profile-image"
                    />
                  ) : (
                    <span className="navbar-profile-initial">
                      {profileInitial}
                    </span>
                  )}
                </button>

                {isProfileOpen && (
                  <div className="profile-dropdown" role="menu">
                    <div className="profile-dropdown-user">
                      {profileImage ? (
                        <img
                          src={profileImage}
                          alt={user?.name || "Profile"}
                          className="profile-dropdown-image"
                        />
                      ) : (
                        <span className="profile-dropdown-initial">
                          {profileInitial}
                        </span>
                      )}
                      <div>
                        <strong>{user?.name || "QuickCart User"}</strong>
                        <span>{user?.email || user?.phone || "Account"}</span>
                      </div>
                    </div>

                    <div className="profile-dropdown-links">
                      <NavLink
                        to="/me"
                        onClick={closeProfileMenu}
                        role="menuitem"
                      >
                        <span>👤</span>
                        Profile
                      </NavLink>
                      <NavLink
                        to="/saved-addresses"
                        onClick={closeProfileMenu}
                        role="menuitem"
                      >
                        <span>📍</span>
                        Saved Addresses
                      </NavLink>
                      <NavLink
                        to="/my-orders"
                        onClick={closeProfileMenu}
                        role="menuitem"
                      >
                        <span>📦</span>
                        My Orders
                      </NavLink>
                    </div>

                    <div className="profile-dropdown-footer">
                      <button
                        type="button"
                        onClick={handleLogout}
                        role="menuitem"
                      >
                        <span>🚪</span>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {!isUser && (
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
              <NavLink
                to="/me"
                className={({ isActive }) =>
                  isActive ? "mobile-menu-link active" : "mobile-menu-link"
                }
                onClick={closeMenu}
              >
                👤 Profile
              </NavLink>
              <NavLink
                to="/saved-addresses"
                className={({ isActive }) =>
                  isActive ? "mobile-menu-link active" : "mobile-menu-link"
                }
                onClick={closeMenu}
              >
                📍 Saved Addresses
              </NavLink>
              <NavLink
                to="/my-orders"
                className={({ isActive }) =>
                  isActive ? "mobile-menu-link active" : "mobile-menu-link"
                }
                onClick={closeMenu}
              >
                📦 My Orders
              </NavLink>
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

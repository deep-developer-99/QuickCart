import { useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";

import { logout } from "../../services/authService";
import { logoutUser } from "../../store/slice/authSlice";
import { useAppDispatch, useAppSelector } from "../../hooks/reduxHooks";
import SearchBar from "./SearchBar";
import LocationSelector from "./LocationSelector";

import "./Navbar.css";

const Navbar = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const isUser = isAuthenticated && user?.role === "user";

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      dispatch(logoutUser());
      setIsMenuOpen(false);
      navigate("/");
    }
  };

  const closeMenu = () => setIsMenuOpen(false);

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
              <NavLink
                to="/my-orders"
                className={({ isActive }) =>
                  isActive ? "navbar-action active" : "navbar-action"
                }
              >
                Orders
              </NavLink>

              <NavLink
                to="/cart"
                className={({ isActive }) =>
                  isActive ? "navbar-cart-action active" : "navbar-cart-action"
                }
              >
                🛒 Cart
              </NavLink>

              <NavLink
                to="/me"
                className={({ isActive }) =>
                  isActive
                    ? "navbar-profile-action active"
                    : "navbar-profile-action"
                }
                aria-label="Profile"
              >
                👤
              </NavLink>

              <button
                type="button"
                className="navbar-logout"
                onClick={handleLogout}
              >
                Logout
              </button>
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
                to="/my-orders"
                className={({ isActive }) =>
                  isActive ? "mobile-menu-link active" : "mobile-menu-link"
                }
                onClick={closeMenu}
              >
                My Orders
              </NavLink>
              <NavLink
                to="/me"
                className={({ isActive }) =>
                  isActive ? "mobile-menu-link active" : "mobile-menu-link"
                }
                onClick={closeMenu}
              >
                Profile
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

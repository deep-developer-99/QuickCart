import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { logout } from "../../services/authService";
import { logoutUser } from "../../store/slice/authSlice";
import { useAppDispatch, useAppSelector } from "../../hooks/reduxHooks";

import "./Navbar.css";

const Navbar = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

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

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <Link to="/" className="navbar-logo" onClick={closeMenu}>
          QuickCart
        </Link>

        {/* Desktop Navigation */}
        <nav className="navbar-links">
          <Link to="/" className="navbar-link">
            Home
          </Link>

          <Link to="/products" className="navbar-link">
            Products
          </Link>

          {isAuthenticated && user?.role === "user" ? (
            <>
              <Link to="/cart" className="navbar-link">
                Cart
              </Link>

              <Link to="/my-orders" className="navbar-link">
                My Orders
              </Link>

              <Link to="/me" className="navbar-link">
                Profile
              </Link>

              <button
                type="button"
                className="navbar-logout"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="navbar-login">
              Login
            </Link>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="navbar-menu-button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <nav className="mobile-menu">
          <Link to="/" className="mobile-menu-link" onClick={closeMenu}>
            Home
          </Link>

          <Link to="/products" className="mobile-menu-link" onClick={closeMenu}>
            Products
          </Link>

          {isAuthenticated && user?.role === "user" ? (
            <>
              <Link to="/cart" className="mobile-menu-link" onClick={closeMenu}>
                Cart
              </Link>

              <Link
                to="/my-orders"
                className="mobile-menu-link"
                onClick={closeMenu}
              >
                My Orders
              </Link>

              <Link to="/me" className="mobile-menu-link" onClick={closeMenu}>
                Profile
              </Link>

              <button
                type="button"
                className="mobile-menu-logout"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="mobile-menu-login" onClick={closeMenu}>
              Login
            </Link>
          )}
        </nav>
      )}
    </header>
  );
};

export default Navbar;

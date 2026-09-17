import { useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";

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
        <Link to="/" className="navbar-logo" onClick={closeMenu}>
          QuickCart
        </Link>

        <nav className="navbar-links">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive ? "navbar-link active" : "navbar-link"
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/products"
            className={({ isActive }) =>
              isActive ? "navbar-link active" : "navbar-link"
            }
          >
            Products
          </NavLink>

          {isAuthenticated && user?.role === "user" ? (
            <>
              <NavLink
                to="/cart"
                className={({ isActive }) =>
                  isActive ? "navbar-link active" : "navbar-link"
                }
              >
                Cart
              </NavLink>

              <NavLink
                to="/my-orders"
                className={({ isActive }) =>
                  isActive ? "navbar-link active" : "navbar-link"
                }
              >
                My Orders
              </NavLink>

              <NavLink
                to="/me"
                className={({ isActive }) =>
                  isActive ? "navbar-link active" : "navbar-link"
                }
              >
                Profile
              </NavLink>

              <button
                type="button"
                className="navbar-logout"
                onClick={handleLogout}
              >
                Logout
              </button>
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
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {isMenuOpen && (
        <nav className="mobile-menu">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive ? "mobile-menu-link active" : "mobile-menu-link"
            }
            onClick={closeMenu}
          >
            Home
          </NavLink>

          <NavLink
            to="/products"
            className={({ isActive }) =>
              isActive ? "mobile-menu-link active" : "mobile-menu-link"
            }
            onClick={closeMenu}
          >
            Products
          </NavLink>

          {isAuthenticated && user?.role === "user" ? (
            <>
              <NavLink
                to="/cart"
                className={({ isActive }) =>
                  isActive ? "mobile-menu-link active" : "mobile-menu-link"
                }
                onClick={closeMenu}
              >
                Cart
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
              className={({ isActive }) =>
                isActive ? "mobile-menu-login active" : "mobile-menu-login"
              }
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

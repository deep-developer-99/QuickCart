import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { logout } from "../../services/authService";
import { logoutUser } from "../../store/slice/authSlice";
import { useAppDispatch, useAppSelector } from "../../hooks/reduxHooks";
import SearchBar from "./SearchBar";
import LocationSelector from "./LocationSelector";

import "./Navbar.css";
import { useCart } from "../../context/useCart";
import { useCartDrawer } from "../../context/useCartDrawer";
import { useLoginModal } from "../../context/LoginModalContext";
import {
  formatIndianRupees,
  getCartSubtotal,
  getValidCartItems,
} from "../../utils/hasValidCartItems";

const Navbar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isCartActive = pathname === "/cart";
  const dispatch = useAppDispatch();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const mobileProfileMenuRef = useRef<HTMLDivElement>(null);
  const {
    cart,
    isLoading: isCartLoading,
    isCartReady,
    cartError,
    refreshCart,
  } = useCart();
  const { openCart } = useCartDrawer();
  const { openLoginModal } = useLoginModal();
  const validCartItems = getValidCartItems(cart);
  const totalItems = validCartItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const cartTotal = getCartSubtotal(validCartItems);
  const formattedCartTotal =
    cartTotal === null ? "—" : formatIndianRupees(cartTotal);

  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const contactInfo = user?.phone?.trim() || user?.email?.trim() || "";
  const isUser = isAuthenticated && user?.role === "user";
  const canOpenCart = isUser && isCartReady && validCartItems.length > 0;
  const canRetryCart =
    isUser && !canOpenCart && !isCartLoading && Boolean(cartError);
  const handleOpenCart = () => {
    if (canOpenCart) openCart();
    else if (canRetryCart) void refreshCart();
    else if (!isUser) openLoginModal();
  };

  useEffect(() => {
    if (!isProfileOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !profileMenuRef.current?.contains(target) &&
        !mobileProfileMenuRef.current?.contains(target)
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

  const desktopAccountDropdown = (
    <div className="profile-dropdown profile-dropdown--desktop" role="menu">
      <div className="profile-dropdown-desktop-header">
        <strong>My Account</strong>
        {contactInfo && <span>{contactInfo}</span>}
      </div>

      <div className="profile-dropdown-divider" />

      <button
        type="button"
        role="menuitem"
        className="profile-dropdown-desktop-item"
        onClick={() => openAccount("/account/orders")}
      >
        My Orders
      </button>
      <button
        type="button"
        role="menuitem"
        className="profile-dropdown-desktop-item"
        onClick={() => openAccount("/account/addresses")}
      >
        Saved Addresses
      </button>
      <span
        className="profile-dropdown-desktop-item profile-dropdown-desktop-item--unavailable"
        role="menuitem"
        aria-disabled="true"
      >
        My Prescriptions
      </span>
      <span
        className="profile-dropdown-desktop-item profile-dropdown-desktop-item--unavailable"
        role="menuitem"
        aria-disabled="true"
      >
        E-Gift Cards
      </span>
      <span
        className="profile-dropdown-desktop-item profile-dropdown-desktop-item--unavailable"
        role="menuitem"
        aria-disabled="true"
      >
        FAQ's
      </span>
      <span
        className="profile-dropdown-desktop-item profile-dropdown-desktop-item--unavailable"
        role="menuitem"
        aria-disabled="true"
      >
        Account Privacy
      </span>
      <button
        type="button"
        role="menuitem"
        className="profile-dropdown-desktop-item"
        onClick={handleLogout}
      >
        Log Out
      </button>
    </div>
  );

  const accountDropdown = (
    <div className="profile-dropdown" role="menu">
      <div className="profile-dropdown-header">
        <div className="profile-dropdown-avatar">
          {user?.name?.charAt(0).toUpperCase() || "U"}
        </div>
        <div>
          <strong>{user?.name || "QuickCart User"}</strong>
          <span>{user?.phone || "Phone number not provided"}</span>
        </div>
      </div>

      <div className="profile-dropdown-divider" />

      <button
        type="button"
        role="menuitem"
        className="profile-dropdown-item"
        onClick={() => openAccount("/account/profile")}
      >
        <span aria-hidden="true">♙</span>
        <span>
          <strong>My Account</strong>
          <small>Manage your profile</small>
        </span>
      </button>

      <button
        type="button"
        role="menuitem"
        className="profile-dropdown-item"
        onClick={() => openAccount("/account/orders")}
      >
        <span aria-hidden="true">▤</span>
        <span>
          <strong>My Orders</strong>
          <small>View your orders</small>
        </span>
      </button>

      <button
        type="button"
        role="menuitem"
        className="profile-dropdown-item"
        onClick={() => openAccount("/account/addresses")}
      >
        <span aria-hidden="true">⌖</span>
        <span>
          <strong>Saved Addresses</strong>
          <small>Manage delivery addresses</small>
        </span>
      </button>

      <div className="profile-dropdown-divider" />

      <button
        type="button"
        role="menuitem"
        className="profile-dropdown-item profile-dropdown-logout"
        onClick={handleLogout}
      >
        <span aria-hidden="true">↪</span>
        <span>
          <strong>Log Out</strong>
          <small>Sign out of your account</small>
        </span>
      </button>
    </div>
  );

  return (
    <>
      <header
        className={`navbar${pathname === "/search" ? " navbar--search-page" : ""}`}
      >
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
              <div className="navbar-profile-wrapper" ref={profileMenuRef}>
                <button
                  type="button"
                  className={`navbar-profile-action${isProfileOpen ? " active" : ""}`}
                  onClick={() => setIsProfileOpen((previous) => !previous)}
                  aria-label="Open Account menu"
                  aria-expanded={isProfileOpen}
                  aria-haspopup="menu"
                >
                  <span>Account</span>
                  <span className="navbar-profile-arrow" aria-hidden="true">
                    ⌄
                  </span>
                </button>
                {isProfileOpen && desktopAccountDropdown}
              </div>
            ) : (
              <button
                type="button"
                className="navbar-login"
                onClick={() => openLoginModal()}
              >
                Login
              </button>
            )}

            {canOpenCart || canRetryCart ? (
              <button
                type="button"
                className={`navbar-cart-action${canOpenCart ? " navbar-cart-action--has-items" : ""}${isCartActive ? " active" : ""}`}
                onClick={handleOpenCart}
                aria-label={
                  canRetryCart
                    ? "Retry loading My Cart"
                    : `My Cart, ${totalItems} ${totalItems === 1 ? "item" : "items"}, total ${formattedCartTotal}`
                }
              >
                <svg
                  className="navbar-cart-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4L22 8H6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="10" cy="20" r="1.4" fill="currentColor" />
                  <circle cx="18" cy="20" r="1.4" fill="currentColor" />
                </svg>
                <span className="navbar-cart-copy">
                  <strong>
                    {canOpenCart
                      ? `${totalItems} ${totalItems === 1 ? "Item" : "Items"}`
                      : "My Cart"}
                  </strong>
                  {canOpenCart && <span>{formattedCartTotal}</span>}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!isUser}
                className={`navbar-cart-action${!isUser ? " navbar-cart-disabled" : " navbar-cart-guest"}`}
                aria-label={
                  !isUser ? "My Cart disabled - Please login" : "My Cart"
                }
                title={!isUser ? "Please login to use My Cart" : undefined}
              >
                <svg
                  className="navbar-cart-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.4L22 8H6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="10" cy="20" r="1.4" fill="currentColor" />
                  <circle cx="18" cy="20" r="1.4" fill="currentColor" />
                </svg>
                <span className="navbar-cart-copy">
                  <strong>My Cart</strong>
                </span>
              </button>
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
                {!canOpenCart && !canRetryCart ? (
                  <button
                    type="button"
                    className="mobile-menu-link mobile-cart-button navbar-cart-disabled"
                    onClick={() => {
                      closeMenu();
                      handleOpenCart();
                    }}
                    aria-label="My Cart"
                  >
                    🛒 My Cart
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`mobile-menu-link mobile-cart-button${canOpenCart ? " mobile-cart-button--has-items" : ""}`}
                    onClick={() => {
                      closeMenu();
                      handleOpenCart();
                    }}
                    aria-label={`Cart with ${totalItems} ${
                      totalItems === 1 ? "item" : "items"
                    }, total ${formattedCartTotal}`}
                  >
                    🛒 {totalItems} {totalItems === 1 ? "Item" : "Items"} ·{" "}
                    {formattedCartTotal}
                  </button>
                )}
                <div
                  ref={mobileProfileMenuRef}
                  className="mobile-account-section"
                >
                  <button
                    type="button"
                    className="mobile-menu-link mobile-account-button"
                    onClick={() => setIsProfileOpen((previous) => !previous)}
                    aria-expanded={isProfileOpen}
                  >
                    Account <span className="mobile-account-arrow">⌄</span>
                  </button>
                  {isProfileOpen && (
                    <div className="mobile-profile-dropdown">
                      {accountDropdown}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  className="mobile-menu-link mobile-cart-button navbar-cart-disabled"
                  aria-label="My Cart disabled - Please login"
                  title="Please login to use My Cart"
                >
                  🛒 My Cart
                </button>
                <button
                  type="button"
                  className="mobile-menu-login"
                  onClick={() => {
                    closeMenu();
                    openLoginModal();
                  }}
                >
                  Login
                </button>
              </>
            )}
          </nav>
        )}
      </header>
      {isProfileOpen && (
        <button
          type="button"
          className="navbar-overlay"
          aria-label="Close Account menu"
          onClick={() => setIsProfileOpen(false)}
        />
      )}
    </>
  );
};

export default Navbar;

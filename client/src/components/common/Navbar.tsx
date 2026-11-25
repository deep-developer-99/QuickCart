import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import UserProfileIcon from "../../assets/icons8-user-profile-100.png";

import { logout, LogoutServiceError } from "../../services/authService";
import { useAppSelector } from "../../hooks/reduxHooks";
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
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

  const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);
  const contactInfo = user?.phone?.trim() || user?.email?.trim() || "";
  const isUser = isAuthenticated && user?.role === "user";
  const canOpenCart = isUser && isCartReady && validCartItems.length > 0;
  const canRetryCart =
    isUser && !canOpenCart && !isCartLoading && Boolean(cartError);
  const isCartDisabled = !canOpenCart && !canRetryCart;
  const cartLabel = canOpenCart
    ? `My Cart, ${totalItems} ${totalItems === 1 ? "item" : "items"}, total ${formattedCartTotal}`
    : canRetryCart
      ? "Retry loading My Cart"
      : isUser ? "My Cart" : "My Cart disabled - Please login";
  const handleOpenCart = () => {
    if (canOpenCart) openCart();
    else if (canRetryCart) void refreshCart();
    else if (!isUser) openLoginModal();
  };

  useEffect(() => {
    if (!isProfileOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!profileMenuRef.current?.contains(target)) {
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
      setIsProfileOpen(false);
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
      if (error instanceof LogoutServiceError && error.backendLoggedOut) {
        setIsProfileOpen(false);
        navigate("/");
      }
    }
  };

  const closeMenu = () => {
    setIsProfileOpen(false);
  };

  const openAccount = (path: string) => {
    setIsProfileOpen(false);
    navigate(path);
  };

  const handleMobileAvatar = () => {
    if (isUser) {
      navigate("/account/privacy", { state: { from: pathname } });
      return;
    }
    openLoginModal({ returnTo: "/account/privacy" });
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
      <button type="button" role="menuitem" className="profile-dropdown-desktop-item" onClick={() => openAccount("/account/privacy")}>Account Privacy</button>
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

            <button
              type="button"
              className={`navbar-cart-action${canOpenCart ? " navbar-cart-action--has-items" : ""}${isCartDisabled ? " navbar-cart-disabled" : ""}${!isCartDisabled && isCartActive ? " active" : ""}`}
              disabled={isCartDisabled}
              onClick={handleOpenCart}
              aria-label={cartLabel}
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
              <span className="navbar-cart-copy" aria-hidden="true">
                <strong>
                  {canOpenCart ? `${totalItems} ${totalItems === 1 ? "Item" : "Items"}` : "My Cart"}
                </strong>
                {canOpenCart && <span>{formattedCartTotal}</span>}
              </span>
              {canOpenCart && (
                <span className="navbar-cart-badge" aria-hidden="true">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </button>
          </nav>

          <button
            type="button"
            className="navbar-mobile-avatar"
            onClick={handleMobileAvatar}
            aria-label={isUser ? "Open your account" : "Log in to your account"}
            disabled={isLoading}
          >
            <img src={UserProfileIcon} alt="" />
          </button>
        </div>

        <div className="navbar-search-mobile">
          <SearchBar />
        </div>

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

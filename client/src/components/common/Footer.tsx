import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaLinkedinIn } from "react-icons/fa";

import { getCategories } from "../../services/productService";
import {
  defaultFooterSettings,
  getFooterSettings,
} from "../../services/footerService";
import type { FooterSettings } from "../../types/footer";
import type { Category } from "../../types/product";
import { useAppSelector } from "../../hooks/reduxHooks";
import "./Footer.css";

const CATEGORIES_PER_COLUMN = 10;
const SOCIAL_LINKS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/18.deep_/",
    Icon: FaInstagram,
    className: "footer-social-link--instagram",
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/share/1LexHT99ej/",
    Icon: FaFacebookF,
    className: "footer-social-link--facebook",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/deepanshu-rawat-69b795261/",
    Icon: FaLinkedinIn,
    className: "footer-social-link--linkedin",
  },
];

const Footer = () => {
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const [settings, setSettings] = useState<FooterSettings>(
    defaultFooterSettings,
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryError, setCategoryError] = useState("");
  const [showPortalWarning, setShowPortalWarning] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const openFrame = useRef<number | null>(null);
  const okayButtonRef = useRef<HTMLButtonElement>(null);

  const closePortalWarning = useCallback(() => {
    if (openFrame.current !== null) {
      window.cancelAnimationFrame(openFrame.current);
      openFrame.current = null;
    }
    setWarningVisible(false);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setShowPortalWarning(false);
      closeTimer.current = null;
    }, 180);
  }, []);

  const handlePortalClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isAuthenticated || user?.role !== "user") return;
    event.preventDefault();
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setShowPortalWarning(true);
    openFrame.current = window.requestAnimationFrame(() => {
      openFrame.current = null;
      setWarningVisible(true);
    });
  };

  useEffect(() => {
    if (!showPortalWarning) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePortalWarning();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showPortalWarning, closePortalWarning]);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      if (openFrame.current !== null)
        window.cancelAnimationFrame(openFrame.current);
    },
    [],
  );

  useEffect(() => {
    getFooterSettings()
      .then((footer) => setSettings(footer))
      .catch((error) => console.warn("Failed to load footer settings:", error));

    getCategories()
      .then((response) => {
        if (!response?.success) {
          setCategoryError("Unable to load categories.");
          return;
        }

        setCategories(response.data || []);
      })
      .catch((error) => {
        console.error("Failed to load footer categories:", error);
        setCategoryError("Unable to load categories.");
      });
  }, []);

  const categoryColumns = useMemo(() => {
    const columns: Category[][] = [];

    for (
      let index = 0;
      index < categories.length;
      index += CATEGORIES_PER_COLUMN
    ) {
      columns.push(categories.slice(index, index + CATEGORIES_PER_COLUMN));
    }

    return columns;
  }, [categories]);

  const configuredLinks = settings.usefulLinks
    .filter((link) => link.isActive)
    .sort((a, b) => a.order - b.order);
  const findConfiguredLink = (label: string) =>
    configuredLinks.find(
      (link) => link.label.toLowerCase() === label.toLowerCase(),
    );
  const renderConfiguredLink = (label: string) => {
    const link = findConfiguredLink(label);

    if (!link) return null;

    const isContactPage = label.toLowerCase() === "contact us";

    if (isContactPage) {
      return (
        <Link
          to="/contact"
          key={link.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {label}
        </Link>
      );
    }

    return /^https?:\/\//i.test(link.href) ? (
      <a href={link.href} key={link.href}>
        {label}
      </a>
    ) : (
      <Link to={link.href} key={link.href}>
        {label}
      </Link>
    );
  };
  const copyright = settings.copyright.replace("{year}", "2026");

  return (
    <footer className="footer">
      <div className="footer-top">
        <section className="footer-link-group">
          <h3>Useful Links</h3>
          <div className="footer-link-columns">
            <div>
              <Link to="/">Home</Link>
              {renderConfiguredLink("About Us")}
              {renderConfiguredLink("Contact Us")}
            </div>
            <div>
              {renderConfiguredLink("Privacy Policy")}
              {renderConfiguredLink("Terms & Conditions")}
              {renderConfiguredLink("Refund Policy")}
              {renderConfiguredLink("Shipping Policy")}
            </div>
          </div>
        </section>

        <section className="footer-link-group footer-portals">
          <h3>QuickCart Portals</h3>
          <Link to="/vendor/login" onClick={handlePortalClick}>
            Vendor Login
          </Link>
          <Link to="/vendor/register" onClick={handlePortalClick}>
            Vendor Registration
          </Link>
          <Link to="/admin/login" onClick={handlePortalClick}>
            Admin Login
          </Link>
        </section>

        <section className="footer-categories">
          <div className="footer-category-heading">
            <h3>Categories</h3>
          </div>
          {categoryError ? (
            <p className="footer-category-status" role="status">
              {categoryError}
            </p>
          ) : categories.length === 0 ? (
            <p className="footer-category-status" role="status">
              No categories available.
            </p>
          ) : (
            <div className="footer-category-columns">
              {categoryColumns.map((column, columnIndex) => (
                <div className="footer-category-column" key={columnIndex}>
                  {column.map((category) => (
                    <Link to={`/category/${category._id}`} key={category._id}>
                      {category.name}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="footer-divider" />

      <div className="footer-bottom-main">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            QuickCart
          </Link>
          <p>Your everyday shopping, delivered fast.</p>
        </div>

        <div className="footer-app-links">
          <h3>Download App</h3>
          <div className="footer-app-badges">
            <img
              className="footer-app-badge"
              src="/images/app-badges/app-store.svg"
              alt="Download on the App Store"
            />
            <img
              className="footer-app-badge"
              src="/images/app-badges/play-store.svg"
              alt="Get it on Google Play"
            />
          </div>
        </div>

        <div className="footer-social-section">
          <div className="footer-social-row">
            <h3>Follow Us</h3>
            <div
              className="footer-socials"
              aria-label="Follow QuickCart on social media"
            >
              {SOCIAL_LINKS.map(({ label, href, Icon, className }) => (
                <a
                  className={className}
                  href={href}
                  key={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                >
                  <Icon aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="footer-divider" />

      <div className="footer-copyright">
        <p>{copyright}</p>
        <p>
          Made with <span aria-label="love">♥</span> in India
        </p>
      </div>

      {showPortalWarning && (
        <div
          className={`footer-auth-modal${warningVisible ? " is-visible" : ""}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePortalWarning();
          }}
        >
          <section
            className="footer-auth-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="footer-auth-modal-title"
            aria-describedby="footer-auth-modal-description"
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                event.preventDefault();
                okayButtonRef.current?.focus();
              }
            }}
          >
            <div className="footer-auth-modal-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M12 11v5m0-8h.01"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 id="footer-auth-modal-title">Please first logout as a user</h2>
            <p id="footer-auth-modal-description">
              Please logout from your user account before accessing Admin or
              Vendor services.
            </p>
            <button
              ref={okayButtonRef}
              type="button"
              autoFocus
              onClick={closePortalWarning}
            >
              Okay
            </button>
          </section>
        </div>
      )}
    </footer>
  );
};

export default Footer;

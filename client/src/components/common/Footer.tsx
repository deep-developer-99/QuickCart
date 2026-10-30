import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getCategories } from "../../services/productService";
import {
  defaultFooterSettings,
  getFooterSettings,
} from "../../services/footerService";
import type { FooterSettings } from "../../types/footer";
import type { Category } from "../../types/product";
import "./Footer.css";

const CATEGORIES_PER_COLUMN = 10;

const Footer = () => {
  const [settings, setSettings] = useState<FooterSettings>(defaultFooterSettings);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryError, setCategoryError] = useState("");

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

    for (let index = 0; index < categories.length; index += CATEGORIES_PER_COLUMN) {
      columns.push(categories.slice(index, index + CATEGORIES_PER_COLUMN));
    }

    return columns;
  }, [categories]);

  const configuredLinks = settings.usefulLinks
    .filter((link) => link.isActive)
    .sort((a, b) => a.order - b.order);
  const findConfiguredLink = (label: string) =>
    configuredLinks.find((link) => link.label.toLowerCase() === label.toLowerCase());
  const renderConfiguredLink = (label: string) => {
    const link = findConfiguredLink(label);

    if (!link) return null;

    return /^https?:\/\//i.test(link.href) ? (
      <a href={link.href} key={link.href}>{label}</a>
    ) : (
      <Link to={link.href} key={link.href}>{label}</Link>
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
              <Link to="/search">All Categories</Link>
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
          <Link to="/vendor/login">Vendor Login</Link>
          <Link to="/vendor/register">Vendor Registration</Link>
          <Link to="/admin/login">Admin Login</Link>
        </section>

        <section className="footer-categories">
          <div className="footer-category-heading">
            <h3>Categories</h3>
            <Link to="/search">see all</Link>
          </div>
          {categoryError ? (
            <p className="footer-category-status" role="status">{categoryError}</p>
          ) : categories.length === 0 ? (
            <p className="footer-category-status" role="status">No categories available.</p>
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
          <Link to="/" className="footer-logo">QuickCart</Link>
          <p>Your everyday shopping, delivered fast.</p>
        </div>

        <div className="footer-app-links">
          <h3>Download App</h3>
          <div>
            {settings.appLinks.googlePlay && (
              <a href={settings.appLinks.googlePlay} target="_blank" rel="noreferrer">
                Google Play
              </a>
            )}
            {settings.appLinks.appStore && (
              <a href={settings.appLinks.appStore} target="_blank" rel="noreferrer">
                App Store
              </a>
            )}
          </div>
        </div>

        <div className="footer-social-section">
          <h3>Follow Us</h3>
          <div className="footer-socials" aria-label="Social media">
            {settings.socialLinks.filter((link) => link.isActive).map((link) => (
              <a
                href={link.href}
                key={link.href}
                target="_blank"
                rel="noreferrer"
                aria-label={link.label}
                title={link.label}
              >
                {link.label.charAt(0).toUpperCase()}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="footer-divider" />

      <div className="footer-copyright">
        <p>{copyright}</p>
        <p>Made with <span aria-label="love">♥</span> in India</p>
      </div>
    </footer>
  );
};

export default Footer;

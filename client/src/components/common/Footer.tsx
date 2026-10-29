import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppSelector } from "../../hooks/reduxHooks";
import { getCategories } from "../../services/productService";
import { defaultFooterSettings, getFooterSettings } from "../../services/footerService";
import type { FooterSettings } from "../../types/footer";
import type { Category } from "../../types/product";
import "./Footer.css";

const Footer = () => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [settings, setSettings] = useState<FooterSettings>(defaultFooterSettings);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    Promise.all([getFooterSettings(), getCategories()])
      .then(([footer, categoryResponse]) => {
        setSettings(footer);
        if (categoryResponse?.success) setCategories(categoryResponse.data || []);
      })
      .catch((error) => console.warn("Failed to load footer settings:", error));
  }, []);

  const copyright = settings.copyright.replace("{year}", String(new Date().getFullYear()));
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">QuickCart</Link>
          <p>Your everyday essentials, delivered quickly to your doorstep.</p>
        </div>
        <div className="footer-section">
          <h3>{settings.headings.usefulLinks}</h3>
          {settings.usefulLinks.filter((link) => link.isActive).sort((a, b) => a.order - b.order).map((link) => (
            /^https?:\/\//i.test(link.href) ? <a href={link.href} key={link.href}>{link.label}</a> : <Link to={link.href} key={link.href}>{link.label}</Link>
          ))}
        </div>
        <div className="footer-section">
          <h3>{settings.headings.categories}</h3>
          {categories.slice(0, 8).map((category) => <Link to={`/category/${category._id}`} key={category._id}>{category.name}</Link>)}
        </div>
        <div className="footer-section">
          <h3>{settings.headings.portals}</h3>
          <Link to="/vendor/login">Vendor Login</Link>
          <Link to="/vendor/register">Vendor Registration</Link>
          <Link to="/admin/login">Admin Login</Link>
        </div>
        <div className="footer-section">
          <h3>Account</h3>
          {!isAuthenticated && <Link to="/login">Login</Link>}
          {isAuthenticated && <Link to="/account/profile">Profile</Link>}
          {isAuthenticated && <Link to="/account/orders">My Orders</Link>}
          <p>support@quickcart.com</p>
        </div>
      </div>
      <div className="footer-bottom">
        <div><p>{copyright}</p><small>{settings.disclaimer}</small></div>
        <div className="footer-socials">
          {settings.socialLinks.filter((link) => link.isActive).map((link) => <a href={link.href} key={link.href} target="_blank" rel="noreferrer">{link.label}</a>)}
          {settings.appLinks.appStore && <a href={settings.appLinks.appStore}>App Store</a>}
          {settings.appLinks.googlePlay && <a href={settings.appLinks.googlePlay}>Google Play</a>}
        </div>
      </div>
    </footer>
  );
};

export default Footer;

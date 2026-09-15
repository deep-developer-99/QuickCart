import { Link } from "react-router-dom";

import { useAppSelector } from "../../hooks/reduxHooks";

import "./Footer.css";

const Footer = () => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Brand */}
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            QuickCart
          </Link>

          <p>Your everyday essentials, delivered quickly to your doorstep.</p>
        </div>

        {/* Quick Links */}
        <div className="footer-section">
          <h3>Quick Links</h3>

          <Link to="/">Home</Link>
          <Link to="/products">Products</Link>
          <Link to="/cart">Cart</Link>
          <Link to="/my-orders">My Orders</Link>
        </div>

        {/* Account */}
        <div className="footer-section">
          <h3>Account</h3>

          {isAuthenticated ? "" : <Link to="/login">Login</Link>}

          <Link to="/me">Profile</Link>
        </div>

        <div className="footer-section">
          <h3>Vendor</h3>

          <Link to="/vendor/register">Become a Vendor</Link>

          <Link to="/vendor/login">Vendor Login</Link>
        </div>

        {isAuthenticated ? (
          ""
        ) : (
          <div className="footer-section">
            <h3>Admin</h3>

            <Link to="/admin/login">Admin Login</Link>
          </div>
        )}

        {/* Contact */}
        <div className="footer-section">
          <h3>Contact</h3>

          <p>support@quickcart.com</p>
          <p>Available 24/7</p>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} QuickCart. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBoxOpen,
  FaChevronRight,
  FaMapMarkerAlt,
  FaSignOutAlt,
  FaUser, FaShieldAlt,
} from "react-icons/fa";

import { useAppDispatch, useAppSelector } from "../../hooks/reduxHooks";
import { logout } from "../../services/authService";
import { logoutUser } from "../../store/slice/authSlice";

import "./AccountHome.css";

const AccountHome = () => {
  const { user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [imageFailed, setImageFailed] = useState(false);
  const name = user?.name?.trim();
  const contact = user?.phone?.trim() || user?.email?.trim();
  const initial = name?.charAt(0).toUpperCase() || "U";

  const options = [
    { label: "Account Privacy", path: "/account/privacy", Icon: FaShieldAlt },
    { label: "My Account", path: "/account/profile", Icon: FaUser },
    { label: "My Orders", path: "/account/orders", Icon: FaBoxOpen },
    { label: "Saved Addresses", path: "/account/addresses", Icon: FaMapMarkerAlt },
  ];

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      dispatch(logoutUser());
      navigate("/", { replace: true });
    }
  };

  return (
    <section className="account-home" aria-labelledby="account-home-title">
      <div className="account-home-main">
        <div className="account-home-customer">
          {user?.profileImage && !imageFailed ? (
            <img src={user.profileImage} alt="" onError={() => setImageFailed(true)} />
          ) : (
            <span className="account-home-initial" aria-hidden="true">{initial}</span>
          )}
          <div className="account-home-customer-copy">
            <h1 id="account-home-title">{name || "Your Account"}</h1>
            {contact && <p>{contact}</p>}
          </div>
        </div>

        <h2>Your Information</h2>
        <nav className="account-home-links" aria-label="Your information">
          {options.map(({ label, path, Icon }) => (
            <button type="button" key={path} onClick={() => navigate(path)}>
              <span className="account-home-option-icon"><Icon aria-hidden="true" /></span>
              <span>{label}</span>
              <FaChevronRight className="account-home-chevron" aria-hidden="true" />
            </button>
          ))}
          <button type="button" className="account-home-logout" onClick={handleLogout}>
            <span className="account-home-option-icon"><FaSignOutAlt aria-hidden="true" /></span>
            <span>Log Out</span>
            <FaChevronRight className="account-home-chevron" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </section>
  );
};

export default AccountHome;

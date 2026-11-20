import { useState } from "react";
import { Link } from "react-router-dom";
import { FaChevronDown, FaChevronRight, FaTrashAlt } from "react-icons/fa";
import { privacyInformation } from "./accountPrivacyContent";
import "./AccountPrivacy.css";

export default function AccountPrivacy() {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="account-privacy">
      <h1>Account privacy and policy</h1>
      <p>QuickCart uses your account information to help you sign in, shop, and receive your orders. Learn about the information used by our services and the choices available to you.</p>
      <button className="privacy-read-more" type="button" aria-expanded={expanded} aria-controls="privacy-details" onClick={() => setExpanded(!expanded)}>
        {expanded ? "Read less" : "Read more"} <FaChevronDown aria-hidden="true" className={expanded ? "is-expanded" : ""} />
      </button>
      <div id="privacy-details" hidden={!expanded}>
        {privacyInformation.map(({ heading, text }) => <section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}
        <Link to="/contact">Contact QuickCart support</Link>
      </div>
      <Link to="/account/delete-account" className="privacy-delete-card">
        <FaTrashAlt aria-hidden="true" />
        <span><strong>Request to delete account</strong><small>Request to close your account</small></span>
        <FaChevronRight aria-hidden="true" />
      </Link>
    </section>
  );
}

import { Link } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa";
import { accountDeletionReasons } from "./accountPrivacyContent";
import "./AccountPrivacy.css";

export default function DeleteAccount() {
  return (
    <section className="account-privacy">
      <Link className="privacy-back" to="/account/privacy">‹ Account privacy</Link>
      <h1>Delete my account</h1>
      <p>Why would you like to delete your account?</p>
      <ul className="privacy-reasons">
        {accountDeletionReasons.map(({ label }, index) => (
          <li key={label}><Link to={`/account/delete-account-feedback?reason=${index}`}>
            <span>{label}</span><FaChevronRight aria-hidden="true" />
          </Link></li>
        ))}
      </ul>
    </section>
  );
}

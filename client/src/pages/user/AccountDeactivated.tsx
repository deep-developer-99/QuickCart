import { Link } from "react-router-dom";
import "./AccountPrivacy.css";

export default function AccountDeactivated() {
  return <main className="account-privacy privacy-complete">
    <h1>Your account has been deactivated</h1>
    <p>You have been signed out. If you sign up again, you will receive a fresh account.</p>
    <p>Existing orders and payment processing continue. Contact support if you need help.</p>
    <Link className="privacy-primary" to="/">Continue shopping</Link>
    <Link className="privacy-back" to="/contact">Contact support</Link>
  </main>;
}

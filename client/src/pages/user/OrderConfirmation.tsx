import { Link } from "react-router-dom";

import "./OrderConfirmation.css";

const OrderConfirmation = () => {
  return (
    <div className="order-confirmation">
      <div className="confirmation-card">
        <div className="confirmation-icon">✓</div>

        <p className="confirmation-label">QUICKCART</p>

        <h1>Order Placed Successfully!</h1>

        <p>
          Thank you for shopping with QuickCart. Your order has been placed
          successfully.
        </p>

        <div className="confirmation-actions">
          <Link to="/my-orders">View My Orders</Link>

          <Link to="/" className="secondary-action">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;

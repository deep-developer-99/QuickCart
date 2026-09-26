import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getOrderById } from "../../services/orderService";
import type { Order, OrderStatus } from "../../types/order";
import "./MyOrderDetails.css";

const statuses: OrderStatus[] = [
  "Placed",
  "Accepted",
  "Out for Delivery",
  "Delivered",
];

const MyOrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) {
        setError("Order ID is missing.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        const response = await getOrderById(id);
        if (response?.success && response.data) setOrder(response.data);
        else setError("Order not found.");
      } catch (requestError) {
        console.error("Failed to fetch order:", requestError);
        setError("Failed to load order details.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchOrder();
  }, [id]);

  if (isLoading) {
    return (
      <section className="account-section order-details-section">
        <div className="order-details-state">Loading order details...</div>
      </section>
    );
  }

  if (error || !order) {
    return (
      <section className="account-section order-details-section">
        <div className="order-details-state error">
          <h2>Order Not Found</h2>
          <p>{error || "Unable to find this order."}</p>
          <button type="button" onClick={() => navigate("/account/orders")}>
            Back to My Orders
          </button>
        </div>
      </section>
    );
  }

  const currentIndex = statuses.indexOf(order.status);

  return (
    <section className="account-section order-details-section">
      <Link to="/account/orders" className="order-details-back">
        ← Back to My Orders
      </Link>

      <div className="account-section-header order-details-heading">
        <div>
          <p className="account-eyebrow">ORDER DETAILS</p>
          <h1>#{order._id.slice(-8).toUpperCase()}</h1>
          <p className="account-section-subtitle">
            Ordered on{" "}
            {new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <span
          className={`order-details-status ${getStatusClass(order.status)}`}
        >
          {order.status}
        </span>
      </div>

      <section className="order-details-panel">
        <div className="order-details-panel-heading">
          <h2>Order Status</h2>
          <span>Track your order</span>
        </div>
        <div className="order-progress">
          {statuses.map((status, index) => (
            <div
              className={`order-progress-step${index <= currentIndex ? " completed" : ""}`}
              key={status}
            >
              <div className="order-progress-dot">
                {index <= currentIndex ? "✓" : index + 1}
              </div>
              <span>{status}</span>
              {index < statuses.length - 1 && (
                <div
                  className={`order-progress-line${index < currentIndex ? " completed" : ""}`}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="order-details-panel">
        <div className="order-details-panel-heading">
          <h2>Order Items</h2>
          <span>
            {order.items.length} item{order.items.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="order-detail-items">
          {order.items.map((item, index) => {
            const sellingPrice = item.discountedPrice ?? item.price;
            const hasDiscount =
              item.discountedPrice !== undefined &&
              item.discountedPrice < item.price;
            return (
              <div
                className="order-detail-item"
                key={`${item.product}-${index}`}
              >
                <div className="detail-item-image">
                  {item.image ? (
                    <img src={item.image} alt={item.name} />
                  ) : (
                    <span>No Image</span>
                  )}
                </div>
                <div className="detail-item-info">
                  <h3>{item.name}</h3>
                  <div className="detail-item-price">
                    <strong>₹{sellingPrice}</strong>
                    {hasDiscount && <span>₹{item.price}</span>}
                    <em>× {item.quantity}</em>
                  </div>
                </div>
                <strong className="detail-item-total">
                  ₹{sellingPrice * item.quantity}
                </strong>
              </div>
            );
          })}
        </div>
      </section>

      <div className="order-details-two-column">
        <section className="order-details-panel">
          <div className="order-details-panel-heading">
            <h2>Delivery Address</h2>
          </div>
          {typeof order.address === "object" ? (
            <div className="order-info-content">
              <strong>{order.address.fullName}</strong>
              <p>{order.address.addressLine}</p>
              <p>
                {order.address.city}, {order.address.state}
              </p>
              <p>PIN: {order.address.pincode}</p>
              <p>Phone: {order.address.phone}</p>
            </div>
          ) : (
            <p className="order-info-muted">Address information unavailable.</p>
          )}
        </section>

        <section className="order-details-panel">
          <div className="order-details-panel-heading">
            <h2>Payment Information</h2>
          </div>
          <div className="payment-content">
            <div>
              <span>Payment Method</span>
              <strong>{order.paymentMethod}</strong>
            </div>
            {order.paymentId && (
              <div>
                <span>Payment ID</span>
                <strong>{order.paymentId}</strong>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="order-details-panel order-summary-panel">
        <div className="order-details-panel-heading">
          <h2>Order Summary</h2>
        </div>
        <div className="summary-row">
          <span>Items</span>
          <strong>
            {order.items.reduce((total, item) => total + item.quantity, 0)}
          </strong>
        </div>
        <div className="summary-row">
          <span>Payment</span>
          <strong>{order.paymentMethod}</strong>
        </div>
        <div className="summary-total">
          <span>Total Amount</span>
          <strong>₹{order.totalAmount}</strong>
        </div>
      </section>
    </section>
  );
};

const getStatusClass = (status: OrderStatus) => {
  switch (status) {
    case "Placed":
      return "status-placed";
    case "Accepted":
      return "status-accepted";
    case "Out for Delivery":
      return "status-delivery";
    case "Delivered":
      return "status-delivered";
    default:
      return "";
  }
};

export default MyOrderDetails;

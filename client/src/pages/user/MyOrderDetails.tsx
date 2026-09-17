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

        if (response?.success && response.data) {
          setOrder(response.data);
        } else {
          setError("Order not found.");
        }
      } catch (error) {
        console.error("Failed to fetch order:", error);

        setError("Failed to load order details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  if (isLoading) {
    return (
      <div className="my-order-details-page">
        <div className="order-details-loading">Loading order details...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="my-order-details-page">
        <div className="order-details-error">
          <h2>Order Not Found</h2>

          <p>{error || "Unable to find this order."}</p>

          <button type="button" onClick={() => navigate("/my-orders")}>
            Back to My Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-order-details-page">
      <div className="my-order-details-container">
        <Link to="/my-orders" className="back-to-orders">
          ← Back to My Orders
        </Link>

        <div className="order-details-header">
          <div>
            <p className="order-details-label">ORDER ID</p>

            <h1>#{order._id.slice(-8).toUpperCase()}</h1>

            <p className="order-date">
              Ordered on{" "}
              {new Date(order.createdAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <span className={`detail-status ${getStatusClass(order.status)}`}>
            {order.status}
          </span>
        </div>

        <section className="order-status-section">
          <h2>Order Status</h2>

          <div className="status-progress">
            {statuses.map((status, index) => {
              const currentIndex = statuses.indexOf(order.status);

              const completed = index <= currentIndex;

              return (
                <div
                  className={`status-step ${completed ? "completed" : ""}`}
                  key={status}
                >
                  <div className="status-circle">
                    {completed ? "✓" : index + 1}
                  </div>

                  <span>{status}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="order-items-section">
          <h2>Order Items</h2>

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
                    </div>

                    <p>Quantity: {item.quantity}</p>
                  </div>

                  <div className="detail-item-total">
                    ₹{sellingPrice * item.quantity}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="order-details-grid">
          <section className="order-info-section">
            <h2>Delivery Address</h2>

            {typeof order.address === "object" ? (
              <div className="address-details">
                <strong>{order.address.fullName}</strong>

                <p>{order.address.addressLine}</p>

                <p>
                  {order.address.city}, {order.address.state}
                </p>

                <p>PIN: {order.address.pincode}</p>

                <p>Phone: {order.address.phone}</p>
              </div>
            ) : (
              <p>Address information unavailable.</p>
            )}
          </section>

          <section className="order-info-section">
            <h2>Payment Information</h2>

            <div className="payment-details">
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

        <section className="order-summary-section">
          <h2>Order Summary</h2>

          <div className="summary-row">
            <span>Items</span>

            <span>
              {order.items.reduce((total, item) => total + item.quantity, 0)}
            </span>
          </div>

          <div className="summary-row">
            <span>Payment</span>

            <span>{order.paymentMethod}</span>
          </div>

          <div className="summary-total">
            <span>Total Amount</span>

            <strong>₹{order.totalAmount}</strong>
          </div>
        </section>
      </div>
    </div>
  );
};

const getStatusClass = (status: OrderStatus): string => {
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

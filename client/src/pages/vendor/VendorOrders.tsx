import { useEffect, useState } from "react";

import {
  getVendorOrders,
  updateOrderStatus,
} from "../../services/orderService";

import type { Order, OrderStatus } from "../../types/order";

import "./VendorOrders.css";

const statuses: OrderStatus[] = [
  "Placed",
  "Accepted",
  "Out for Delivery",
  "Delivered",
];

const VendorOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ==============================
  // Fetch Vendor Orders
  // ==============================

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getVendorOrders();

      if (response?.success) {
        setOrders(response.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch vendor orders:", error);

      setError("Failed to load orders.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // ==============================
  // Update Order Status
  // ==============================

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    try {
      setUpdatingId(orderId);
      setError("");
      setSuccess("");

      const response = await updateOrderStatus(orderId, status);

      if (response?.success) {
        setSuccess("Order status updated successfully.");

        await fetchOrders();
      }
    } catch (error) {
      console.error("Status update error:", error);

      setError("Failed to update order status.");
    } finally {
      setUpdatingId(null);
    }
  };

  // ==============================
  // Loading
  // ==============================

  if (isLoading) {
    return (
      <div className="vendor-orders-page">
        <div className="vendor-orders-loading">Loading orders...</div>
      </div>
    );
  }

  // ==============================
  // UI
  // ==============================

  return (
    <div className="vendor-orders-page">
      <div className="vendor-orders-container">
        {/* Header */}

        <div className="vendor-orders-header">
          <div>
            <h1>View Orders</h1>

            <p>Manage orders containing your products.</p>
          </div>

          <div className="orders-count">
            {orders.length} {orders.length === 1 ? "Order" : "Orders"}
          </div>
        </div>

        {/* Error */}

        {error && <div className="vendor-order-error">{error}</div>}

        {/* Success */}

        {success && <div className="vendor-order-success">{success}</div>}

        {/* ==============================
            No Orders
        ============================== */}

        {orders.length === 0 ? (
          <div className="no-orders">
            <div className="no-orders-icon">🛒</div>

            <h3>No Orders Found</h3>

            <p>You don't have any orders containing your products yet.</p>
          </div>
        ) : (
          /* ==============================
             Orders
          ============================== */

          <div className="vendor-orders-list">
            {orders.map((order) => (
              <div className="vendor-order-card" key={order._id}>
                {/* Order Header */}

                <div className="order-card-header">
                  <div>
                    <p className="order-label">ORDER ID</p>

                    <h3>#{order._id.slice(-8).toUpperCase()}</h3>

                    <p className="order-date">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <span
                    className={`order-status ${getStatusClass(order.status)}`}
                  >
                    {order.status}
                  </span>
                </div>

                {/* ==============================
                    Order Items
                ============================== */}

                <div className="order-items">
                  {order.items.map((item, index) => {
                    const sellingPrice = item.discountedPrice ?? item.price;

                    const hasDiscount =
                      item.discountedPrice !== undefined &&
                      item.discountedPrice < item.price;

                    const productId =
                      typeof item.product === "string"
                        ? item.product
                        : item.product._id;

                    return (
                      <div
                        className="vendor-order-item"
                        key={`${productId}-${index}`}
                      >
                        {/* Product Image */}

                        <div className="order-item-image">
                          {item.image ? (
                            <img src={item.image} alt={item.name} />
                          ) : (
                            <span>No Image</span>
                          )}
                        </div>

                        {/* Product Info */}

                        <div className="order-item-info">
                          <h4>{item.name}</h4>

                          <p>Quantity: {item.quantity}</p>

                          <div className="vendor-order-price">
                            <span className="vendor-discounted-price">
                              ₹{sellingPrice}
                            </span>

                            {hasDiscount && (
                              <span className="vendor-original-price">
                                ₹{item.price}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Item Total */}

                        <div className="vendor-item-total">
                          ₹{sellingPrice * item.quantity}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ==============================
                    Order Footer
                ============================== */}

                <div className="order-card-footer">
                  {/* Payment */}

                  <div className="order-footer-info">
                    <span>Payment</span>

                    <strong>{order.paymentMethod}</strong>
                  </div>

                  {/* Total */}

                  <div className="order-footer-info">
                    <span>Total</span>

                    <strong className="order-total">
                      ₹{order.totalAmount}
                    </strong>
                  </div>

                  {/* Status */}

                  <div className="status-control">
                    <label htmlFor={`status-${order._id}`}>Update Status</label>

                    <select
                      id={`status-${order._id}`}
                      value={order.status}
                      disabled={
                        updatingId === order._id || order.status === "Delivered"
                      }
                      onChange={(event) =>
                        handleStatusChange(
                          order._id,
                          event.target.value as OrderStatus,
                        )
                      }
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ==============================
// Status Class
// ==============================

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

export default VendorOrders;

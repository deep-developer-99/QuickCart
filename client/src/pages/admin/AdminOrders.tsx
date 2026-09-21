import { useEffect, useState } from "react";
import axios from "axios";

import { getAdminOrders } from "../../services/adminService";

import type { OrderStatus } from "../../types/order";

import "./AdminOrders.css";

interface AdminOrderItem {
  product:
    | string
    | {
        _id: string;
        name: string;
        image: string;
      };
  vendor:
    | string
    | {
        _id: string;
        name?: string;
        shopName?: string;
      };
  name: string;
  image: string;
  price: number;
  discountedPrice?: number;
  quantity: number;
}

interface AdminOrder {
  _id: string;
  user:
    | string
    | {
        _id: string;
        name: string;
        email: string;
        phone?: string;
      };
  items: AdminOrderItem[];
  address:
    | string
    | {
        fullName: string;
        phone: string;
        addressLine: string;
        city: string;
        state: string;
        pincode: string;
      };
  paymentMethod: "COD" | "RAZORPAY";
  paymentId?: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
}

const getStatusClass = (status: OrderStatus) => {
  switch (status) {
    case "Placed":
      return "admin-status-placed";

    case "Accepted":
      return "admin-status-accepted";

    case "Out for Delivery":
      return "admin-status-delivery";

    case "Delivered":
      return "admin-status-delivered";

    default:
      return "";
  }
};

const AdminOrders = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getAdminOrders();

      if (response?.success) {
        setOrders(response.data || []);
      } else {
        setError("Failed to load orders.");
      }
    } catch (error: unknown) {
      console.error("Get admin orders error:", error);

      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.message || "Failed to load orders.");
      } else {
        setError("Failed to load orders.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  if (isLoading) {
    return (
      <div className="admin-orders-page">
        <div className="admin-orders-loading">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="admin-orders-page">
      <div className="admin-orders-container">
        <div className="admin-page-header">
          <div>
            <h1>Manage Orders</h1>
            <p>View all QuickCart customer orders.</p>
          </div>

          <div className="admin-count">
            {orders.length} {orders.length === 1 ? "Order" : "Orders"}
          </div>
        </div>

        {error && <div className="admin-page-error">{error}</div>}

        {orders.length === 0 ? (
          <div className="admin-empty">
            <div>🛒</div>
            <h3>No Orders Found</h3>
            <p>No customer orders have been placed yet.</p>
          </div>
        ) : (
          <div className="admin-orders-list">
            {orders.map((order) => {
              const customer =
                typeof order.user === "object" ? order.user : null;

              return (
                <div className="admin-order-card" key={order._id}>
                  <div className="admin-order-header">
                    <div>
                      <h3>Order #{order._id.slice(-8)}</h3>

                      <p>{new Date(order.createdAt).toLocaleString("en-IN")}</p>
                    </div>

                    <span
                      className={`admin-order-status ${getStatusClass(
                        order.status,
                      )}`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="admin-order-customer">
                    <div>
                      <span>Customer</span>
                      <strong>{customer?.name || "N/A"}</strong>
                    </div>

                    <div>
                      <span>Email</span>
                      <strong>{customer?.email || "N/A"}</strong>
                    </div>

                    <div>
                      <span>Phone</span>
                      <strong>{customer?.phone || "N/A"}</strong>
                    </div>
                  </div>

                  <div className="admin-order-items">
                    {order.items.map((item, index) => {
                      const vendor =
                        typeof item.vendor === "object" && item.vendor !== null
                          ? item.vendor.shopName || item.vendor.name || "N/A"
                          : "N/A";

                      const effectivePrice = item.discountedPrice ?? item.price;

                      return (
                        <div
                          className="admin-order-item"
                          key={`${order._id}-${index}`}
                        >
                          <img src={item.image} alt={item.name} />

                          <div className="admin-order-item-info">
                            <strong>{item.name}</strong>

                            <span>Vendor: {vendor}</span>

                            <span>Quantity: {item.quantity}</span>
                          </div>

                          <div className="admin-order-item-price">
                            <strong>₹{effectivePrice}</strong>

                            {item.discountedPrice !== undefined &&
                              item.discountedPrice < item.price && (
                                <span>₹{item.price}</span>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="admin-order-footer">
                    <div>
                      <span>Payment</span>
                      <strong>
                        {order.paymentMethod === "COD"
                          ? "Cash on Delivery"
                          : "Fake Razorpay"}
                      </strong>
                    </div>

                    <div>
                      <span>Total</span>
                      <strong className="order-total">
                        ₹{order.totalAmount}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrders;

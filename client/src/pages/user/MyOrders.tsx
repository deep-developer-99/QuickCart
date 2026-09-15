import { useState, useEffect } from "react";

import { getMyOrders } from "../../services/orderService";

import type { Order } from "../../types/order";

import OrderCard from "../../components/user/OrderCard";

import "./MyOrders.css";

const MyOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const response = await getMyOrders();

        setOrders(response.data || []);
      } catch (error) {
        console.error("Failed to load orders:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadOrders();
  }, []);

  if (isLoading) {
    return <div className="orders-message">Loading orders...</div>;
  }

  return (
    <div className="orders-page">
      <div className="orders-container">
        <div className="orders-heading">
          <p>QUICKCART</p>
          <h1>My Orders</h1>
        </div>

        {orders.length === 0 ? (
          <div className="orders-empty">
            <h2>No Orders Yet</h2>

            <p>Your placed orders will appear here.</p>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <OrderCard key={order._id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyOrders;

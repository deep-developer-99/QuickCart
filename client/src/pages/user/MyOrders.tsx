import { useEffect, useState } from "react";
import { getMyOrders } from "../../services/orderService";
import type { Order } from "../../types/order";
import OrderCard from "../../components/user/OrderCard";
import Pagination from "../../components/common/Pagination";
import "./MyOrders.css";

const MyOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        setIsLoading(true);
        setError("");
        const response = await getMyOrders(page, 10);
        setOrders(response.data || []);
        const availablePages = response.pagination?.totalPages || 1;
        setTotalPages(availablePages);
        setTotalItems(response.pagination?.totalItems || 0);
        if (page > availablePages) {
          setPage(availablePages);
        }
      } catch (requestError) {
        console.error("Failed to load orders:", requestError);
        setError("Failed to load your orders. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadOrders();
  }, [page]);

  return (
    <section className="account-section orders-section">
      <div className="account-section-header">
        <div>
          <p className="account-eyebrow">QUICKCART</p>
          <h1>My Orders</h1>
          <p className="account-section-subtitle">
            Track your recent purchases and view complete order details.
          </p>
        </div>
        {!isLoading && !error && (
          <div className="orders-count-badge">
            {totalItems} {totalItems === 1 ? "Order" : "Orders"}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="orders-state-card">
          <div className="orders-state-icon">⏳</div>
          <h2>Loading your orders</h2>
          <p>Please wait while we fetch your order history.</p>
        </div>
      ) : error ? (
        <div className="orders-state-card error-state">
          <div className="orders-state-icon">!</div>
          <h2>Couldn't load orders</h2>
          <p>{error}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="orders-state-card">
          <div className="orders-state-icon">▤</div>
          <h2>No Orders Yet</h2>
          <p>Your placed orders will appear here.</p>
        </div>
      ) : (
        <>
          <div className="orders-list">
            {orders.map((order) => (
              <OrderCard key={order._id} order={order} />
            ))}
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
};

export default MyOrders;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertCircle, FiPackage } from "react-icons/fi";
import { getMyOrders } from "../../services/orderService";
import type { Order } from "../../types/order";
import OrderCard from "../../components/user/OrderCard";
import Pagination from "../../components/common/Pagination";
import "./MyOrders.css";

type OrderPage = {
  request: string;
  orders: Order[];
  totalPages: number;
  totalItems: number;
  error?: boolean;
};

const MyOrders = () => {
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<OrderPage>();
  const request = `${page}:${retry}`;
  const current = result?.request === request ? result : undefined;

  useEffect(() => {
    let active = true;
    void getMyOrders(page, 10).then((response) => {
      if (!active) return;
      if (!response.success) throw new Error("Could not load orders");
      const totalPages = Math.max(1, response.pagination?.totalPages ?? 1);
      if (page > totalPages) {
        setPage(totalPages);
        return;
      }
      setResult({
        request, orders: response.data ?? [], totalPages,
        totalItems: response.pagination?.totalItems ?? response.data?.length ?? 0,
      });
    }).catch(() => {
      if (active) setResult({ request, orders: [], totalPages: 1, totalItems: 0, error: true });
    });
    return () => { active = false; };
  }, [page, request]);

  return (
    <section className="orders-section" aria-labelledby="orders-heading">
      <header className="orders-heading">
        <h1 id="orders-heading">My Orders</h1>
        {current && !current.error && current.totalItems > 0 && (
          <span>{current.totalItems} {current.totalItems === 1 ? "order" : "orders"}</span>
        )}
      </header>
      {!current ? (
        <div className="orders-list" role="status" aria-label="Loading orders">
          {[0, 1, 2].map((key) => <div key={key} className="orders-skeleton" aria-hidden="true"><span /><span /></div>)}
        </div>
      ) : current.error ? (
        <div className="orders-state-card">
          <FiAlertCircle aria-hidden="true" />
          <h2>Couldn't load orders</h2>
          <p>Try again to refresh your order history.</p>
          <button className="orders-action" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>
        </div>
      ) : current.orders.length === 0 ? (
        <div className="orders-state-card">
          <FiPackage aria-hidden="true" />
          <h2>No Orders Yet</h2>
          <p>Your placed orders will appear here.</p>
          <Link className="orders-action" to="/">Shop Now</Link>
        </div>
      ) : (
        <>
          <div className="orders-list">
            {current.orders.map((order) => <OrderCard key={order._id} order={order} />)}
          </div>
          <Pagination currentPage={page} totalPages={current.totalPages} totalItems={current.totalItems} onPageChange={setPage} />
        </>
      )}
    </section>
  );
};

export default MyOrders;

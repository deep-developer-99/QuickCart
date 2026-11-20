import { useEffect, useState } from "react";
import { FiArrowLeft, FiCheck, FiChevronRight, FiCopy, FiMessageCircle } from "react-icons/fi";
import { Link, useParams } from "react-router-dom";
import { OrderStatusIcon, OrderThumbnail } from "../../components/user/OrderPresentation";
import { getOrderById } from "../../services/orderService";
import type { Order } from "../../types/order";
import { formatOrderAmount, formatOrderDate, getOrderBill, getOrderLineAmount } from "../../utils/orderPresentation";
import "./MyOrderDetails.css";

const paymentNames = { COD: "Cash on delivery", RAZORPAY: "Razorpay", CASHFREE: "Cashfree", PAYTM: "Paytm" };
const paymentStatuses = { PENDING: "Pending", PAID: "Paid", FAILED: "Failed" };

const OrderDetailContent = ({ order }: { order: Order }) => {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(order._id);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };
  const bill = getOrderBill(order);
  const count = order.items.reduce((total, item) => total + item.quantity, 0);
  const address = typeof order.address === "object" ? order.address : null;

  return (
    <>
      <header className="order-detail-heading">
        <OrderStatusIcon status={order.status} />
        <div>
          <h1>{order.status}</h1>
          <p>Ordered on <time dateTime={order.createdAt}>{formatOrderDate(order.createdAt)}</time></p>
        </div>
      </header>

      <section className="order-detail-section" aria-labelledby="order-items-heading">
        <h2 id="order-items-heading">{count} {count === 1 ? "item" : "items"} in this order</h2>
        <ul className="order-detail-items">
          {order.items.map((item, index) => (
            <li key={`${item.name}-${index}`}>
              <OrderThumbnail key={item.image} src={item.image} />
              <div>
                <h3>{item.name}</h3>
                <p>{item.variantQuantity != null && item.variantUnit
                  ? `${item.variantQuantity} ${item.variantUnit} × ${item.quantity}`
                  : `Quantity ${item.quantity}`}</p>
              </div>
              <strong>{formatOrderAmount(getOrderLineAmount(item))}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="order-detail-section" aria-labelledby="order-bill-heading">
        <h2 id="order-bill-heading">Bill details</h2>
        <dl className="order-bill">
          {bill.itemTotal !== undefined && <div><dt>Item total</dt><dd>{formatOrderAmount(bill.itemTotal)}</dd></div>}
          {bill.delivery !== undefined && <div><dt>Delivery charges</dt><dd>{formatOrderAmount(bill.delivery)}</dd></div>}
          {bill.donation !== undefined && <div><dt>Donation</dt><dd>{formatOrderAmount(bill.donation)}</dd></div>}
          <div className="order-bill-total"><dt>Bill total</dt><dd>{formatOrderAmount(bill.total)}</dd></div>
        </dl>
      </section>

      <section className="order-detail-section" aria-labelledby="order-info-heading">
        <h2 id="order-info-heading">Order details</h2>
        <dl className="order-facts">
          <div>
            <dt>Order ID</dt>
            <dd className="order-id-value">
              <span>{order._id}</span>
              <button className="order-icon-control" type="button" aria-label="Copy order ID" onClick={() => void copyId()}>
                {copyStatus === "copied" ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
              </button>
            </dd>
            {copyStatus !== "idle" && <dd role="status" className="order-copy-status">{copyStatus === "copied"
              ? "Order ID copied." : "Couldn’t copy automatically. Select the order ID to copy it."}</dd>}
          </div>
          <div><dt>Payment</dt><dd>{paymentNames[order.paymentMethod] ?? order.paymentMethod}
            {order.paymentStatus && paymentStatuses[order.paymentStatus] && ` · ${paymentStatuses[order.paymentStatus]}`}
          </dd></div>
          <div><dt>Deliver to</dt><dd>{address ? (
            <>
              <strong>{address.fullName}</strong>
              <span>{address.addressLine}</span>
              <span>{[address.city, address.state, address.pincode].filter(Boolean).join(", ")}</span>
              {address.phone && <span>{address.phone}</span>}
            </>
          ) : "Address information unavailable."}</dd></div>
          <div><dt>Order placed</dt><dd><time dateTime={order.createdAt}>{formatOrderDate(order.createdAt)}</time></dd></div>
        </dl>
      </section>

      <section className="order-detail-section" aria-labelledby="order-support-heading">
        <h2 id="order-support-heading">Need help with your order?</h2>
        <Link to="/contact" className="order-support-link">
          <FiMessageCircle aria-hidden="true" />
          <span><strong>Contact Support</strong><small>Get help with issues related to your order</small></span>
          <FiChevronRight aria-hidden="true" />
        </Link>
      </section>
    </>
  );
};

type OrderResult = { request: string; order: Order | null };

const MyOrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<OrderResult>();
  const request = `${id}:${retry}`;
  const current = result?.request === request ? result : undefined;

  useEffect(() => {
    if (!id) return;
    let active = true;
    void getOrderById(id).then((response) => {
      if (active) setResult({ request, order: response?.success ? response.data ?? null : null });
    }).catch(() => {
      if (active) setResult({ request, order: null });
    });
    return () => { active = false; };
  }, [id, request]);

  return (
    <section className="order-details-section" aria-label="Order details">
      <Link to="/account/orders" className="order-icon-control order-details-back" aria-label="Back to My Orders">
        <FiArrowLeft aria-hidden="true" />
      </Link>
      {id && !current ? (
        <p className="order-details-state" role="status">Loading order details…</p>
      ) : current?.order ? (
        <OrderDetailContent key={current.order._id} order={current.order} />
      ) : (
        <div className="order-details-state">
          <h1>Order details unavailable</h1>
          <p>We couldn’t load this order.</p>
          {id && <button className="orders-action" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>}
        </div>
      )}
    </section>
  );
};

export default MyOrderDetails;

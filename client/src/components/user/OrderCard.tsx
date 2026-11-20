import { Link } from "react-router-dom";
import { FiChevronRight } from "react-icons/fi";
import type { Order } from "../../types/order";
import { formatOrderAmount, formatOrderDate } from "../../utils/orderPresentation";
import { OrderStatusIcon, OrderThumbnail } from "./OrderPresentation";

const THUMBNAIL_LIMIT = 3;

const OrderCard = ({ order }: { order: Order }) => {
  const remaining = order.items.length - THUMBNAIL_LIMIT;
  return (
    <Link to={`/account/orders/${order._id}`} className="customer-order-card">
      <div className="customer-order-card-header">
        <OrderStatusIcon status={order.status} />
        <div className="customer-order-card-summary">
          <h2>{order.status}</h2>
          <p><strong>{formatOrderAmount(order.totalAmount)}</strong><span aria-hidden="true"> · </span>
            <time dateTime={order.createdAt}>{formatOrderDate(order.createdAt)}</time>
          </p>
        </div>
        <FiChevronRight className="customer-order-card-arrow" aria-hidden="true" />
      </div>
      {order.items.length > 0 && (
        <div className="customer-order-card-items">
          {order.items.slice(0, THUMBNAIL_LIMIT).map((item, index) => (
            <OrderThumbnail key={`${item.image}-${index}`} src={item.image} />
          ))}
          {remaining > 0 && <span className="customer-order-card-more">+{remaining} more</span>}
        </div>
      )}
    </Link>
  );
};

export default OrderCard;

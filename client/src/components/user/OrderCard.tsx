import { Link } from "react-router-dom";
import { useState } from "react";

import type { Order, OrderStatus } from "../../types/order";

import "./OrderCard.css";

interface OrderCardProps {
  order: Order;
}

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

const OrderCard = ({ order }: OrderCardProps) => {
  const [showAllItems, setShowAllItems] = useState(false);

  const visibleItems = showAllItems ? order.items : order.items.slice(0, 3);

  return (
    <div className="order-card">
      <div className="order-card-header">
        <div>
          <p>Order ID</p>

          <h3>#{order._id.slice(-8).toUpperCase()}</h3>
        </div>

        <span className={`order-status ${getStatusClass(order.status)}`}>
          {order.status}
        </span>
      </div>

      <div className="order-card-items">
        {visibleItems.map((item, index) => {
          const sellingPrice = item.discountedPrice ?? item.price;

          const hasDiscount =
            item.discountedPrice !== undefined &&
            item.discountedPrice < item.price;

          return (
            <div className="order-card-item" key={`${item.name}-${index}`}>
              <img src={item.image} alt={item.name} />

              <div>
                <h4>{item.name}</h4>

                <div className="order-item-price">
                  <span className="discounted-price">₹{sellingPrice}</span>

                  {hasDiscount && (
                    <span className="original-price">₹{item.price}</span>
                  )}

                  <span className="item-quantity">× {item.quantity}</span>
                </div>
              </div>
            </div>
          );
        })}

        {order.items.length > 3 && (
          <button
            type="button"
            className="more-items"
            onClick={() => setShowAllItems((previous) => !previous)}
          >
            {showAllItems
              ? "Show less"
              : `+ ${order.items.length - 3} more item(s)`}
          </button>
        )}
      </div>

      <div className="order-card-footer">
        <div>
          <span>Total</span>

          <strong>₹{order.totalAmount}</strong>
        </div>

        <div>
          <span>Payment</span>

          <strong>{order.paymentMethod}</strong>
        </div>

        <Link
          to={`/account/orders/${order._id}`}
          className="order-details-button"
        >
          View Details
        </Link>
      </div>
    </div>
  );
};

export default OrderCard;

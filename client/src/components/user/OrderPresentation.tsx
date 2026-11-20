import { useState } from "react";
import { FiCheck, FiClock, FiPackage, FiTruck } from "react-icons/fi";
import type { OrderStatus } from "../../types/order";
import "./OrderCard.css";

const statusIcons = {
  Placed: FiClock,
  Accepted: FiPackage,
  "Out for Delivery": FiTruck,
  Delivered: FiCheck,
};

export const OrderStatusIcon = ({ status }: { status: OrderStatus }) => {
  const Icon = statusIcons[status] || FiPackage;
  return <span className="order-status-icon" data-status={status} aria-hidden="true"><Icon /></span>;
};

export const OrderThumbnail = ({ src }: { src?: string }) => {
  const [failed, setFailed] = useState(false);
  return <span className="order-thumbnail" aria-hidden="true">
    {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : <FiPackage />}
  </span>;
};

import type { Order, OrderItem } from "../types/order";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2,
});

const orderDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
});

export const formatOrderAmount = (amount: number) => currency.format(amount);
export const formatOrderDate = (date: string) => orderDate.format(new Date(date));
export const getOrderUnitPrice = (item: OrderItem) => item.finalPrice ?? item.discountedPrice ?? item.discountPrice ?? item.price;
export const getOrderLineAmount = (item: OrderItem) => getOrderUnitPrice(item) * item.quantity;

export const getOrderBill = (order: Order) => {
  const itemTotal = order.items.reduce((sum, item) => sum + getOrderLineAmount(item), 0);
  const delivery = order.shippingAmount ?? 0;
  const donation = order.donationAmount ?? 0;
  const paise = (amount: number) => Math.round(amount * 100);

  return {
    itemTotal: paise(itemTotal + delivery + donation) === paise(order.totalAmount) ? itemTotal : undefined,
    delivery: delivery > 0 ? delivery : undefined,
    donation: donation > 0 ? donation : undefined,
    total: order.totalAmount,
  };
};

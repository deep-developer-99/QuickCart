import { store } from "../store/store";
import { invalidatePrivateCache } from "./queryCache";

const confirmedOrders = new Map<string, Set<string>>();

/** Refresh order lists and count badges once after each confirmed order. */
export const markConfirmedOrderCacheStale = (orderId: string | undefined) => {
  const { user, revision } = store.getState().auth;
  if (!orderId || !user || user.role !== "user") return;
  const scope = `${user.id}:${revision}`;
  let orderIds = confirmedOrders.get(scope);
  if (!orderIds) {
    orderIds = new Set();
    confirmedOrders.set(scope, orderIds);
  }
  if (orderIds.has(orderId)) return;
  orderIds.add(orderId);
  if (orderIds.size > 100) {
    const oldest = orderIds.values().next().value;
    if (oldest) orderIds.delete(oldest);
  }
  invalidatePrivateCache(["Orders", `Order:${orderId}`]);
};

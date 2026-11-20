const deactivatedCustomers = new Set<string>();

export const isCustomerDeactivated = (id: string) => deactivatedCustomers.has(id);

export const clearDeactivatedCustomerStorage = (id: string) => {
  deactivatedCustomers.add(id);
  const keys = [
    [window.localStorage, `quickcart:cart:v1:${id}`],
    [window.localStorage, `quickcart_selected_address_${id}`],
    [window.sessionStorage, `quickcart-selected-address:${id}`],
    [window.sessionStorage, `quickcart-cart-donation:${id}`],
  ] as const;
  for (const [storage, key] of keys) {
    try { storage.removeItem(key); } catch { /* In-memory logout still proceeds when storage is unavailable. */ }
  }
  window.dispatchEvent(new CustomEvent("quickcart-account-deactivated", { detail: id }));
};

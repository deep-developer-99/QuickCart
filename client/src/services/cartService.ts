import api from "./api";

export const getCart = async () => {
  const response = await api.get("/cart");

  return response.data;
};

export const addToCart = async (productId: string, quantity: number, variantId?: string) => {
  const response = await api.post("/cart", {
    productId,
    quantity,
    ...(variantId ? { variantId } : {}),
  });

  return response.data;
};

export const updateCartItem = async (productId: string, quantity: number, variantId?: string) => {
  const response = await api.put(`/cart/${productId}`, { quantity, ...(variantId ? { variantId } : {}) }, { params: variantId ? { variantId } : undefined });

  return response.data;
};

export const removeCartItem = async (productId: string, variantId?: string) => {
  const response = await api.delete(`/cart/${productId}`, { params: variantId ? { variantId } : undefined });

  return response.data;
};

export const clearCart = async () => {
  const response = await api.delete("/cart");

  return response.data;
};

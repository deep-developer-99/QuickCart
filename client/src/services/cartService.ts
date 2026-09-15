import api from "./api";

export const getCart = async () => {
  const response = await api.get("/cart");

  return response.data;
};

export const addToCart = async (productId: string, quantity: number) => {
  const response = await api.post("/cart", {
    productId,
    quantity,
  });

  return response.data;
};

export const updateCartItem = async (productId: string, quantity: number) => {
  const response = await api.put(`/cart/${productId}`, { quantity });

  return response.data;
};

export const removeCartItem = async (productId: string) => {
  const response = await api.delete(`/cart/${productId}`);

  return response.data;
};

export const clearCart = async () => {
  const response = await api.delete("/cart");

  return response.data;
};

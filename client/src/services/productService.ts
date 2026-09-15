import api from "./api";

export const getProducts = async (search?: string, category?: string) => {
  const response = await api.get("/products", {
    params: {
      search,
      category,
    },
  });

  return response.data;
};

export const getProductById = async (id: string) => {
  const response = await api.get(`/products/${id}`);

  return response.data;
};

export const getCategories = async () => {
  const response = await api.get("/categories");

  return response.data;
};

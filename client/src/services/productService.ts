import api from "./api";

export const getProducts = async (search?: string, category?: string, page = 1, limit = 10) => {
  const response = await api.get("/products", {
    params: {
      search,
      category,
      page,
      limit,
    },
  });

  return response.data;
};

export const getVendorProducts = async (page = 1, limit = 10) => {
  const response = await api.get("/products/vendor", { params: { page, limit } });

  return response.data;
};

export const getProductById = async (id: string) => {
  const response = await api.get(`/products/${id}`);

  return response.data;
};

export const getProductsByCategory = async (id: string, page = 1, limit = 10) => {
  const response = await api.get(`/products/category/${id}`, { params: { page, limit } });

  return response.data;
};

export const getCategories = async () => {
  const response = await api.get("/categories");

  return response.data;
};

export const createProduct = async (productData: FormData) => {
  const response = await api.post("/products", productData);
  return response.data;
};

export const updateProduct = async (id: string, data: FormData) => {
  const response = await api.put(`/products/${id}`, data);

  return response.data;
};

export const deleteProduct = async (id: string) => {
  const response = await api.delete(`/products/${id}`);

  return response.data;
};

export const restoreProduct = async (id: string) => {
  const response = await api.put(`/products/${id}/restore`);

  return response.data;
};

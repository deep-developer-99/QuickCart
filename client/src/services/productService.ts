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

export const getProductsByCategory = async (id: string) => {
  const response = await api.get(`/products/category/${id}`);

  return response.data;
};

export const getCategories = async () => {
  const response = await api.get("/categories");

  return response.data;
};

// Create Data
export const createProduct = async (productData: {
  name: string;
  description: string;
  image: string;
  price: number;
  discountPrice?: number;
  stock: number;
  category: string;
}) => {
  const response = await api.post("/products", productData);
  return response.data;
};

export const updateProduct = async (
  id: string,
  data: {
    name?: string;
    description?: string;
    image?: string;
    price?: number;
    discountPrice?: number;
    stock?: number;
    category?: string;
  },
) => {
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

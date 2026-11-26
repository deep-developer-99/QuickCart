import api from "./api";
import type { Category, CategoryCatalogItem, Product } from "../types/product";
import { getPublicCached, invalidatePublicCache } from "./queryCache";
import { PUBLIC_CACHE_TTL_MS } from "./cachePolicy";

export interface PublicProductListResponse {
  success: boolean;
  data: Product[];
  pagination?: { page: number; limit: number; currentPage: number; totalPages: number; totalItems: number; hasNextPage: boolean };
}

export const getProducts = async (
  search?: string,
  category?: string,
  page = 1,
  limit = 10,
  subCategory?: string,
) => getPublicCached<PublicProductListResponse>("/products", { search, category, subCategory, page, limit }, PUBLIC_CACHE_TTL_MS.products, ["Products", "SearchResults"]);

export const getVendorProducts = async (page = 1, limit = 10) => {
  const response = await api.get("/products/vendor", { params: { page, limit } });

  return response.data;
};

export const getProductById = async (id: string) => {
  return getPublicCached<{ success: boolean; data: Product }>(`/products/${id}`, {}, PUBLIC_CACHE_TTL_MS.products, ["Products", `Product:${id}`]);
};

export const getProductsByCategory = async (id: string, page = 1, limit = 10, subCategory?: string) => {
  return getPublicCached<PublicProductListResponse>(`/products/category/${id}`, { page, limit, subCategory }, PUBLIC_CACHE_TTL_MS.products, ["Products", `Category:${id}`]);
};

export const getCategories = async (signal?: AbortSignal) => {
  return getPublicCached<{ success: boolean; data: Category[] }>("/categories", {}, PUBLIC_CACHE_TTL_MS.categories, ["Categories"], signal);
};

export const getCategoryCatalog = async (
  signal?: AbortSignal,
): Promise<{ success: boolean; data: CategoryCatalogItem[] }> => {
  return getPublicCached("/categories/catalog", {}, PUBLIC_CACHE_TTL_MS.categories, ["Categories"], signal);
};

export const getCategoryById = async (id: string) => {
  return getPublicCached<{ success: boolean; data: Category }>(`/categories/${id}`, {}, PUBLIC_CACHE_TTL_MS.categories, ["Categories", `Category:${id}`]);
};

export const getSubcategories = async (mainCategoryId: string) => {
  return getPublicCached<{ success: boolean; data: Category[] }>(`/categories/${mainCategoryId}/subcategories`, {}, PUBLIC_CACHE_TTL_MS.categories, ["Categories", `Category:${mainCategoryId}`]);
};

export const createProduct = async (productData: FormData) => {
  const response = await api.post("/products", productData);
  if (response.data?.success) invalidatePublicCache(["Products", "Categories", "HomepageSections", "SearchResults"]);
  return response.data;
};

export const updateProduct = async (id: string, data: FormData) => {
  const response = await api.put(`/products/${id}`, data);
  if (response.data?.success) invalidatePublicCache(["Products", `Product:${id}`, "HomepageSections", "SearchResults"]);
  return response.data;
};

export const deleteProduct = async (id: string) => {
  const response = await api.delete(`/products/${id}`);
  if (response.data?.success) invalidatePublicCache(["Products", `Product:${id}`, "HomepageSections", "SearchResults"]);
  return response.data;
};

export const restoreProduct = async (id: string) => {
  const response = await api.put(`/products/${id}/restore`);
  if (response.data?.success) invalidatePublicCache(["Products", `Product:${id}`, "HomepageSections", "SearchResults"]);
  return response.data;
};

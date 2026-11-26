import api from "./api";
import type { Address, CreateAddressData } from "../types/address";
import { getPrivateCached, invalidatePrivateCache, seedPrivateCache } from "./queryCache";
import { PRIVATE_CACHE_TTL_MS } from "./cachePolicy";

interface AddressListResponse {
  success: boolean;
  data: Address[];
  pagination?: { page: number; limit: number; totalPages: number; totalItems: number };
}

export const getAddresses = async (page = 1, limit = 10) => {
  const result = await getPrivateCached<AddressListResponse>("/addresses", { page, limit }, PRIVATE_CACHE_TTL_MS.addresses, ["Addresses"]);
  if (limit > 1 && result?.success && Number.isSafeInteger(result.pagination?.totalItems)) {
    const totalItems = result.pagination!.totalItems;
    seedPrivateCache("/addresses", { page: 1, limit: 1 }, ["Addresses"], {
      success: true,
      data: [],
      pagination: { page: 1, limit: 1, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / 1)) },
    });
  }
  return result;
};

export const createAddress = async (data: CreateAddressData) => {
  const response = await api.post("/addresses", data);
  const result = response.data;
  if (result?.success) invalidatePrivateCache(["Addresses", "Address"]);
  return result;
};

export const getAddressById = async (id: string) => {
  return getPrivateCached(`/addresses/${id}`, {}, PRIVATE_CACHE_TTL_MS.addresses, ["Addresses", `Address:${id}`]);
};

export const updateAddress = async (
  id: string,
  data: Partial<CreateAddressData>,
) => {
  const response = await api.put(`/addresses/${id}`, data);

  if (response.data?.success) invalidatePrivateCache(["Addresses", `Address:${id}`]);
  return response.data;
};

export const deleteAddress = async (id: string) => {
  const response = await api.delete(`/addresses/${id}`);
  const result = response.data;
  if (result?.success) invalidatePrivateCache(["Addresses", `Address:${id}`]);
  return result;
};

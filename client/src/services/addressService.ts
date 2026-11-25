import api from "./api";
import type { CreateAddressData } from "../types/address";
import { invalidateCurrentAccountCount, setCurrentAccountCount } from "./accountCountCache";

export const getAddresses = async (page = 1, limit = 10) => {
  const response = await api.get("/addresses", { params: { page, limit } });
  const result = response.data;
  if (limit > 1 && result?.success && Number.isSafeInteger(result.pagination?.totalItems)) {
    setCurrentAccountCount("addresses", result.pagination.totalItems);
  }
  return result;
};

export const createAddress = async (data: CreateAddressData) => {
  const response = await api.post("/addresses", data);
  const result = response.data;
  if (result?.success) invalidateCurrentAccountCount("addresses");
  return result;
};

export const getAddressById = async (id: string) => {
  const response = await api.get(`/addresses/${id}`);

  return response.data;
};

export const updateAddress = async (
  id: string,
  data: Partial<CreateAddressData>,
) => {
  const response = await api.put(`/addresses/${id}`, data);

  return response.data;
};

export const deleteAddress = async (id: string) => {
  const response = await api.delete(`/addresses/${id}`);
  const result = response.data;
  if (result?.success) invalidateCurrentAccountCount("addresses");
  return result;
};

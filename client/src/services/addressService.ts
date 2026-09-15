import api from "./api";
import type { CreateAddressData } from "../types/address";

export const getAddresses = async () => {
  const response = await api.get("/addresses");

  return response.data;
};

export const createAddress = async (data: CreateAddressData) => {
  const response = await api.post("/addresses", data);

  return response.data;
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

  return response.data;
};

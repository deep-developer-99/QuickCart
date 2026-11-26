import axios from "axios";
import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import api from "./api";

export interface CachedRequestArgs {
  url: string;
  params?: Record<string, unknown>;
  cacheKey: string;
  ttlMs: number;
  tags?: string[];
  privateScope?: string;
}

interface CachedRequestError {
  status: number | string;
  data: unknown;
}

interface AuthStateLike {
  auth?: { user?: { id: string; role: string } | null; revision: number };
}

export const axiosQueryBase: BaseQueryFn<CachedRequestArgs, unknown, CachedRequestError> = async (
  { url, params, privateScope },
  { getState, signal },
) => {
  if (privateScope) {
    const auth = (getState() as AuthStateLike).auth;
    if (!auth?.user || `${auth.user.role}:${auth.user.id}:${auth.revision}` !== privateScope) {
      return { error: { status: "CUSTOM_ERROR", data: "The authenticated session changed before this request started." } };
    }
  }

  try {
    const response = await api.get(url, { params, signal });
    if (privateScope) {
      const auth = (getState() as AuthStateLike).auth;
      if (!auth?.user || `${auth.user.role}:${auth.user.id}:${auth.revision}` !== privateScope) {
        return { error: { status: "CUSTOM_ERROR", data: "The authenticated session changed while this request was in progress." } };
      }
    }
    return { data: response.data };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return {
        error: {
          status: error.response?.status ?? (axios.isCancel(error) ? "CANCELLED" : "FETCH_ERROR"),
          data: error.response?.data ?? error.message,
        },
      };
    }
    return { error: { status: "CUSTOM_ERROR", data: error instanceof Error ? error.message : error } };
  }
};

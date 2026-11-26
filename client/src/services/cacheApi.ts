import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosQueryBase, type CachedRequestArgs } from "./axiosQueryBase";

const defineCachedApi = <const ReducerPath extends string, const TagTypes extends readonly string[]>(reducerPath: ReducerPath, tagTypes: TagTypes) => createApi({
  reducerPath,
  baseQuery: axiosQueryBase,
  tagTypes: [...tagTypes],
  keepUnusedDataFor: 15 * 60,
  refetchOnFocus: false,
  refetchOnReconnect: false,
  endpoints: (builder) => ({
    getCached: builder.query<unknown, CachedRequestArgs>({
      query: ({ url, params, ...cacheMetadata }) => ({ ...cacheMetadata, url, params }),
      serializeQueryArgs: ({ endpointName, queryArgs }) => `${endpointName}|${queryArgs.cacheKey}`,
      providesTags: (_result, _error, arg) => arg.tags ?? [],
      keepUnusedDataFor: 15 * 60,
    }),
  }),
});

export const publicCacheApi = defineCachedApi("publicCacheApi", [
  "Categories", "Category", "Products", "Product", "Banners", "PromotionalBanners",
  "HomepageSections", "SearchSuggestions", "SearchResults", "FooterSettings", "Theme", "ContactInformation",
] as const);

export const privateCacheApi = defineCachedApi("privateCacheApi", [
  "Addresses", "Address", "Orders", "Order", "Notifications",
] as const);

export type CachedEndpointName = "getCached";

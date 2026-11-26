import test from "node:test";
import assert from "node:assert/strict";
import { configureStore } from "@reduxjs/toolkit";
import { createApi } from "@reduxjs/toolkit/query";

test("RTK Query shares one in-flight request for the same cache key", async () => {
  let requestCount = 0;
  let resolveRequest;
  const api = createApi({
    reducerPath: "dedupTestApi",
    keepUnusedDataFor: 1,
    baseQuery: async (arg) => {
      requestCount += 1;
      await new Promise((resolve) => { resolveRequest = resolve; });
      return { data: { key: arg.key, result: 42 } };
    },
    endpoints: (builder) => ({
      item: builder.query({
        query: (arg) => arg,
        serializeQueryArgs: ({ queryArgs }) => queryArgs.key,
      }),
    }),
  });
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: (getDefault) => getDefault().concat(api.middleware),
  });
  const first = store.dispatch(api.endpoints.item.initiate({ key: "product-1", display: "card" }, { subscribe: false }));
  const second = store.dispatch(api.endpoints.item.initiate({ key: "product-1", display: "card" }, { subscribe: false }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requestCount, 1);
  resolveRequest();
  assert.deepEqual(await first.unwrap(), { key: "product-1", result: 42 });
  assert.deepEqual(api.endpoints.item.select({ key: "product-1", display: "card" })(store.getState()).data, { key: "product-1", result: 42 });
  assert.equal(requestCount, 1);
  store.dispatch(api.util.resetApiState());
});

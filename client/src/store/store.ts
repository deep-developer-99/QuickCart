import { configureStore } from "@reduxjs/toolkit";

import authReducer from "./slice/authSlice";
import { publicCacheApi, privateCacheApi } from "../services/cacheApi";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [publicCacheApi.reducerPath]: publicCacheApi.reducer,
    [privateCacheApi.reducerPath]: privateCacheApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(
    publicCacheApi.middleware,
    privateCacheApi.middleware,
  ),
});

let previousPrivateScope = (() => {
  const { user, revision } = store.getState().auth;
  return user ? `${user.role}:${user.id}:${revision}` : null;
})();
store.subscribe(() => {
  const { user, revision } = store.getState().auth;
  const nextPrivateScope = user ? `${user.role}:${user.id}:${revision}` : null;
  if (nextPrivateScope === previousPrivateScope) return;
  previousPrivateScope = nextPrivateScope;
  store.dispatch(privateCacheApi.util.resetApiState());
});

export type RootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;

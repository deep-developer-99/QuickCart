import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { AuthUser } from "../../types/auth";
import { normalizeAuthUser } from "../../utils/normalizeAuthUser";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  revision: number;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  revision: 0,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<unknown>) => {
      const user = normalizeAuthUser(action.payload);
      state.user = user;
      state.isAuthenticated = Boolean(user);
      state.isLoading = false;
      state.revision += 1;
    },

    logoutUser: (state) => {
      if (state.user?.role === "user") {
        localStorage.removeItem(`quickcart_selected_address_${state.user.id}`);
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(`quickcart-selected-address:${state.user.id}`);
          window.sessionStorage.removeItem(`quickcart_selected_location_${state.user.id}`);
          window.sessionStorage.removeItem(`quickcart-cart-donation:${state.user.id}`);
        }
      }

      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.revision += 1;
    },

    setAuthLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    resolveGuestSession: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
    },
  },
});

export const { setCredentials, logoutUser, setAuthLoading, resolveGuestSession } = authSlice.actions;

export default authSlice.reducer;

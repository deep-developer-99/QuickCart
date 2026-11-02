import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { AuthUser } from "../../types/auth";
import { normalizeAuthUser } from "../../utils/normalizeAuthUser";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
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
    },

    logoutUser: (state) => {
      if (state.user?.role === "user") {
        localStorage.removeItem(`quickcart_selected_address_${state.user.id}`);
      }

      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
    },

    setAuthLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setCredentials, logoutUser, setAuthLoading } = authSlice.actions;

export default authSlice.reducer;

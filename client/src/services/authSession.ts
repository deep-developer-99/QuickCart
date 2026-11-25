import { store } from "../store/store";
import { logoutUser } from "../store/slice/authSlice";
import { clearDeactivatedCustomerStorage } from "../utils/customerSession";
import { signOutFirebaseAuth } from "./firebaseAuthService";

const AUTH_LOGOUT_SIGNAL_KEY = "quickcart-auth-logout-signal";

export const finalizeLocalLogout = (broadcast = true, deactivatedUserId?: string) => {
  if (deactivatedUserId) clearDeactivatedCustomerStorage(deactivatedUserId);
  store.dispatch(logoutUser());
  if (broadcast && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(AUTH_LOGOUT_SIGNAL_KEY, JSON.stringify({ at: Date.now(), deactivatedUserId }));
    } catch {
      // Redux is already cleared in this tab if storage is unavailable.
    }
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== AUTH_LOGOUT_SIGNAL_KEY) return;
    let deactivatedUserId: string | undefined;
    try {
      const value = JSON.parse(event.newValue || "null") as { deactivatedUserId?: unknown } | null;
      if (typeof value?.deactivatedUserId === "string") deactivatedUserId = value.deactivatedUserId;
    } catch {
      // Older signal values still represent a normal logout.
    }
    if (deactivatedUserId) clearDeactivatedCustomerStorage(deactivatedUserId);
    finalizeLocalLogout(false);
    void signOutFirebaseAuth().catch((error: unknown) => {
      console.error("Firebase sign-out in another tab failed:", error);
    });
  });
}

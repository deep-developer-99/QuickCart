import { useEffect } from "react";
import { useStore } from "react-redux";

import { setCredentials, resolveGuestSession } from "../store/slice/authSlice";
import { getCurrentUser } from "../services/authService";
import { initializeFirebaseAuthSession } from "../config/firebase";
import { useAppDispatch, useAppSelector } from "./reduxHooks";
import type { RootState } from "../store/store";

const useAuth = () => {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();

  const { isLoading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // Agar authentication already initialize ho chuki hai,
    // to /me dobara call nahi karna.
    if (!isLoading) return;

    let active = true;
    const requestRevision = store.getState().auth.revision;
    const checkAuth = async () => {
      try {
        await initializeFirebaseAuthSession();
      } catch (error) {
        // Firebase cleanup must not prevent QuickCart cookie validation.
        console.error("Firebase session cleanup failed during startup:", error);
      }
      if (!active || store.getState().auth.revision !== requestRevision) return;
      try {
        const response = await getCurrentUser();

        if (!active || store.getState().auth.revision !== requestRevision) return;
        if (response?.success && response?.data) {
          dispatch(setCredentials(response.data));
        } else {
          dispatch(resolveGuestSession());
        }
      } catch {
        if (active && store.getState().auth.revision === requestRevision) dispatch(resolveGuestSession());
      }
    };

    void checkAuth();
    return () => {
      active = false;
    };
  }, [dispatch, isLoading, store]);

  return null;
};

export default useAuth;

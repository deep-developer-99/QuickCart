import { useEffect } from "react";

import { setCredentials, logoutUser } from "../store/slice/authSlice";
import { getCurrentUser } from "../services/authService";
import { useAppDispatch, useAppSelector } from "./reduxHooks";

const useAuth = () => {
  const dispatch = useAppDispatch();

  const { isLoading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // Agar authentication already initialize ho chuki hai,
    // to /me dobara call nahi karna.
    if (!isLoading) return;

    const checkAuth = async () => {
      try {
        const response = await getCurrentUser();

        if (response?.success && response?.data) {
          dispatch(setCredentials(response.data));
        } else {
          dispatch(logoutUser());
        }
      } catch {
        dispatch(logoutUser());
      }
    };

    checkAuth();
  }, [dispatch, isLoading]);

  return null;
};

export default useAuth;

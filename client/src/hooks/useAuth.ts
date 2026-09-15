import { useEffect } from "react";

import { setCredentials, logoutUser } from "../store/slice/authSlice";

import { getCurrentUser } from "../services/authService";
import { useAppDispatch } from "./reduxHooks";

const useAuth = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
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
  }, [dispatch]);

  return null;
};

export default useAuth;

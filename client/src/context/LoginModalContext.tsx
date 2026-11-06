import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export interface LoginModalOptions {
  returnTo?: string;
  onAuthenticated?: () => void | Promise<void>;
}

interface LoginModalContextValue {
  isLoginModalOpen: boolean;
  loginModalSession: number;
  openLoginModal: (options?: LoginModalOptions) => void;
  closeLoginModal: () => void;
  completeLoginModal: () => Promise<void>;
}

const LoginModalContext = createContext<LoginModalContextValue | null>(null);

export const LoginModalProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [options, setOptions] = useState<LoginModalOptions | null>(null);
  const [loginModalSession, setLoginModalSession] = useState(0);

  const openLoginModal = useCallback((nextOptions: LoginModalOptions = {}) => {
    setLoginModalSession((session) => session + 1);
    setOptions(nextOptions);
  }, []);

  const closeLoginModal = useCallback(() => {
    setOptions(null);
  }, []);

  const completeLoginModal = useCallback(async () => {
    const completed = options;
    try {
      await completed?.onAuthenticated?.();
    } finally {
      setOptions(null);
      if (completed?.returnTo) navigate(completed.returnTo, { replace: true });
    }
  }, [navigate, options]);

  const value = useMemo(() => ({
    isLoginModalOpen: options !== null,
    loginModalSession,
    openLoginModal,
    closeLoginModal,
    completeLoginModal,
  }), [options, loginModalSession, openLoginModal, closeLoginModal, completeLoginModal]);

  return <LoginModalContext.Provider value={value}>{children}</LoginModalContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLoginModal = () => {
  const context = useContext(LoginModalContext);
  if (!context) throw new Error("useLoginModal must be used within LoginModalProvider.");
  return context;
};

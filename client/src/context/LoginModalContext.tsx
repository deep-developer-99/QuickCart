import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export interface LoginModalOptions {
  returnTo?: string;
  onAuthenticated?: () => void | Promise<void>;
}

type LoginDialog = { kind: "login"; options: LoginModalOptions };

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
  const [dialog, setDialog] = useState<LoginDialog | null>(null);
  const [loginModalSession, setLoginModalSession] = useState(0);

  const openLoginModal = useCallback((nextOptions: LoginModalOptions = {}) => {
    setDialog((current) => {
      if (current?.kind === "login") return current;
      setLoginModalSession((session) => session + 1);
      return { kind: "login", options: nextOptions };
    });
  }, []);

  const closeLoginModal = useCallback(() => {
    setDialog(null);
  }, []);

  const completeLoginModal = useCallback(async () => {
    if (dialog?.kind !== "login") return;
    const completed = dialog.options;
    try {
      await completed.onAuthenticated?.();
    } finally {
      setDialog(null);
      if (completed.returnTo) navigate(completed.returnTo, { replace: true });
    }
  }, [navigate, dialog]);

  const value = useMemo(() => ({
    isLoginModalOpen: dialog?.kind === "login",
    loginModalSession,
    openLoginModal,
    closeLoginModal,
    completeLoginModal,
  }), [dialog, loginModalSession, openLoginModal, closeLoginModal, completeLoginModal]);

  return <LoginModalContext.Provider value={value}>{children}</LoginModalContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLoginModal = () => {
  const context = useContext(LoginModalContext);
  if (!context) throw new Error("useLoginModal must be used within LoginModalProvider.");
  return context;
};

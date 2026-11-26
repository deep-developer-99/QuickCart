import { lazy, Suspense } from "react";
import { useLoginModal } from "../context/LoginModalContext";

const Login = lazy(() => import("../pages/user/Login"));

const LoginModalHost = () => {
  const { isLoginModalOpen, loginModalSession } = useLoginModal();

  return isLoginModalOpen ? <Suspense fallback={null}><Login key={loginModalSession} /></Suspense> : null;
};

export default LoginModalHost;

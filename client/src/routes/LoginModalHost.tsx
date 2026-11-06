import Login from "../pages/user/Login";
import { useLoginModal } from "../context/LoginModalContext";

const LoginModalHost = () => {
  const { isLoginModalOpen, loginModalSession } = useLoginModal();
  return isLoginModalOpen ? <Login key={loginModalSession} /> : null;
};

export default LoginModalHost;

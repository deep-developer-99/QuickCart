import LoginRequiredPopup from "../components/common/LoginRequiredPopup";
import Login from "../pages/user/Login";
import { useLoginModal } from "../context/LoginModalContext";

const LoginModalHost = () => {
  const { isLoginRequiredOpen, loginRequiredTrigger, isLoginModalOpen, loginModalSession, closeLoginModal, openLoginModal } = useLoginModal();

  if (isLoginRequiredOpen) {
    return <LoginRequiredPopup trigger={loginRequiredTrigger} onDismiss={closeLoginModal} onConfirm={openLoginModal} />;
  }

  return isLoginModalOpen ? <Login key={loginModalSession} /> : null;
};

export default LoginModalHost;

import { useEffect, useId, useRef } from "react";
import { FiLock, FiShoppingBag, FiX } from "react-icons/fi";

import "./LoginRequiredPopup.css";

interface LoginRequiredPopupProps {
  trigger?: HTMLElement;
  onDismiss: () => void;
  onConfirm: () => void;
}

const LoginRequiredPopup = ({ trigger, onDismiss, onConfirm }: LoginRequiredPopupProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();

    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const closeDialog = (onClose: () => void) => {
    const dialog = dialogRef.current;
    if (!dialog?.open) return;
    dialog.close();
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="login-required-popup"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        closeDialog(onDismiss);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const first = event.shiftKey ? closeRef.current : confirmRef.current;
        const next = event.shiftKey ? confirmRef.current : closeRef.current;
        if (event.target === first) {
          event.preventDefault();
          next?.focus();
        }
      }}
    >
      <button ref={closeRef} type="button" className="login-required-close" aria-label="Close login notice" onClick={() => closeDialog(onDismiss)}>
        <FiX aria-hidden="true" />
      </button>
      <div className="login-required-icon" aria-hidden="true">
        <FiShoppingBag />
        <span><FiLock /></span>
      </div>
      <h2 id={titleId}>Login Required</h2>
      <p id={messageId}>To add products to your cart, you need to log in first.</p>
      <button ref={confirmRef} type="button" className="login-required-confirm" onClick={() => closeDialog(onConfirm)}>
        Okay
      </button>
    </dialog>
  );
};

export default LoginRequiredPopup;

import { useEffect, useId, useRef, type ReactNode } from "react";
import { FaXmark } from "react-icons/fa6";

interface FooterDialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export default function FooterDialog({ title, onClose, children, wide }: FooterDialogProps) {
  const headingId = useId();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    element?.querySelector<HTMLElement>('input, textarea')?.focus();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  return (
    <dialog
      className={`af-dialog${wide ? " af-dialog--wide" : ""}`}
      ref={dialog}
      aria-labelledby={headingId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <div className="af-dialog-header">
        <h2 id={headingId}>{title}</h2>
        <button className="af-button af-icon-button" type="button" onClick={onClose} aria-label="Close dialog">
          <FaXmark aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

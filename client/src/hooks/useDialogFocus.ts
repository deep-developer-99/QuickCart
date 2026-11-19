import { useEffect, useRef, type KeyboardEvent } from "react";

const focusableSelector = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled):not([type=hidden])",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[tabindex]:not([tabindex^='-'])",
].join(",");

function getFocusable(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility === "visible",
  );
}

export function useDialogFocus<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;

    const previous = document.activeElement;
    const frame = window.requestAnimationFrame(() => {
      if (!dialog.contains(document.activeElement)) {
        (dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]:not(:disabled)")
          ?? getFocusable(dialog)[0]
          ?? dialog).focus({ preventScroll: true });
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return {
    ref,
    tabIndex: -1,
    onKeyDown(event: KeyboardEvent<T>) {
      if (event.defaultPrevented) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }

      if (event.key === "Tab") {
        const focusable = getFocusable(event.currentTarget);
        const first = focusable[0];
        const last = focusable.at(-1);

        if (!first || !last) {
          event.preventDefault();
          return;
        }

        if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
  };
}

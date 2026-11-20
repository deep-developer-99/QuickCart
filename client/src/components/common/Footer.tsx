import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useAppSelector } from "../../hooks/reduxHooks";
import { useFooterCategories } from "../../hooks/useFooterCategories";
import { defaultFooterSettings, getFooterSettings } from "../../services/footerService";
import FooterContent from "./FooterContent";

const Footer = () => {
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const [settings, setSettings] = useState(defaultFooterSettings);
  const categoryData = useFooterCategories();

  const [showPortalWarning, setShowPortalWarning] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const openFrame = useRef<number | null>(null);
  const okayButtonRef = useRef<HTMLButtonElement>(null);

  const closePortalWarning = useCallback(() => {
    if (openFrame.current !== null) {
      window.cancelAnimationFrame(openFrame.current);
      openFrame.current = null;
    }
    setWarningVisible(false);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setShowPortalWarning(false);
      closeTimer.current = null;
    }, 180);
  }, []);

  const handlePortalClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isAuthenticated || user?.role !== "user") return;
    event.preventDefault();
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setShowPortalWarning(true);
    openFrame.current = window.requestAnimationFrame(() => {
      openFrame.current = null;
      setWarningVisible(true);
    });
  };

  useEffect(() => {
    if (!showPortalWarning) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePortalWarning();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showPortalWarning, closePortalWarning]);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      if (openFrame.current !== null)
        window.cancelAnimationFrame(openFrame.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    getFooterSettings()
      .then((footer) => { if (!cancelled) setSettings(footer); })
      .catch((error) => console.warn("Failed to load footer settings:", error));
    return () => { cancelled = true; };
  }, []);

  return (
    <FooterContent settings={settings} {...categoryData} onPortalClick={handlePortalClick}>
      {showPortalWarning && (
        <div
          className={`footer-auth-modal${warningVisible ? " is-visible" : ""}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePortalWarning();
          }}
        >
          <section
            className="footer-auth-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="footer-auth-modal-title"
            aria-describedby="footer-auth-modal-description"
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                event.preventDefault();
                okayButtonRef.current?.focus();
              }
            }}
          >
            <div className="footer-auth-modal-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M12 11v5m0-8h.01"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 id="footer-auth-modal-title">Please first logout as a user</h2>
            <p id="footer-auth-modal-description">
              Please logout from your user account before accessing Admin or
              Vendor services.
            </p>
            <button
              ref={okayButtonRef}
              type="button"
              autoFocus
              onClick={closePortalWarning}
            >
              Okay
            </button>
          </section>
        </div>
      )}
    </FooterContent>
  );
};

export default Footer;

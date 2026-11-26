import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import CartDrawerContext from "./CartDrawerContext";
import { useCart } from "./useCart";
import { useAppSelector } from "../hooks/reduxHooks";
import { hasValidCartItems } from "../utils/hasValidCartItems";

const CartDrawer = lazy(() => import("../components/user/CartDrawer"));

const CartDrawerProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { cart, isCartReady } = useCart();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const canOpenCart = isAuthenticated && user?.role === "user" && isCartReady && hasValidCartItems(cart);

  const openCart = useCallback(() => {
    if (!canOpenCart) return;
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setIsClosing(false);
    setHasOpened(true);
    setIsOpen(true);
  }, [canOpenCart]);
  const closeCart = useCallback((navigateTo?: string) => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    setIsClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      closeTimer.current = null;
    }, 240);
    if (navigateTo) navigate(navigateTo);
    else if (location.pathname === "/cart") navigate("/", { replace: true });
  }, [location.pathname, navigate]);
  const handleClose = useCallback(() => closeCart(), [closeCart]);
  const handleNavigate = useCallback((path: string) => closeCart(path), [closeCart]);

  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      if (isOpen) {
        const routeCloseTimer = window.setTimeout(() => {
          if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
          closeTimer.current = null;
          setIsOpen(false);
          setIsClosing(false);
        }, 0);
        return () => window.clearTimeout(routeCloseTimer);
      }
    }
  }, [isOpen, location.pathname]);

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  return (
    <CartDrawerContext.Provider value={{ openCart, closeCart }}>
      {children}
      {hasOpened && <Suspense fallback={null}><CartDrawer key={user?.id ?? "guest"} isOpen={isOpen && isAuthenticated} isClosing={isClosing} onClose={handleClose} onNavigate={handleNavigate} /></Suspense>}
    </CartDrawerContext.Provider>
  );
};

export default CartDrawerProvider;

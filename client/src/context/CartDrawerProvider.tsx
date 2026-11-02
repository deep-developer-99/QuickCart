import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import CartDrawer from "../components/user/CartDrawer";
import CartDrawerContext from "./CartDrawerContext";
import { useCart } from "./useCart";
import { useAppSelector } from "../hooks/reduxHooks";
import { hasValidCartItems } from "../utils/hasValidCartItems";

const CartDrawerProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { cart, isCartReady } = useCart();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const canOpenCart = isAuthenticated && user?.role === "user" && isCartReady && hasValidCartItems(cart);

  const openCart = useCallback(() => {
    if (canOpenCart) setIsOpen(true);
  }, [canOpenCart]);
  const closeCart = useCallback((navigateTo?: string) => {
    setIsOpen(false);
    if (navigateTo) navigate(navigateTo);
    else if (location.pathname === "/cart") navigate("/", { replace: true });
  }, [location.pathname, navigate]);
  const handleClose = useCallback(() => closeCart(), [closeCart]);
  const handleNavigate = useCallback((path: string) => closeCart(path), [closeCart]);

  return (
    <CartDrawerContext.Provider value={{ openCart, closeCart }}>
      {children}
      <CartDrawer isOpen={isOpen} onClose={handleClose} onNavigate={handleNavigate} />
    </CartDrawerContext.Provider>
  );
};

export default CartDrawerProvider;

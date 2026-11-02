import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useCartDrawer } from "../../context/useCartDrawer";
import { useCart } from "../../context/useCart";
import { useAppSelector } from "../../hooks/reduxHooks";
import { hasValidCartItems } from "../../utils/hasValidCartItems";

const CartPage = () => {
  const { openCart } = useCartDrawer();
  const { cart, isCartReady } = useCart();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!isCartReady) return;
    if (isAuthenticated && user?.role === "user" && hasValidCartItems(cart)) openCart();
    else navigate("/", { replace: true });
  }, [cart, isAuthenticated, isCartReady, navigate, openCart, user?.role]);

  return null;
};

export default CartPage;

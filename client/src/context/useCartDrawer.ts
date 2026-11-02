import { useContext } from "react";

import CartDrawerContext from "./CartDrawerContext";

export const useCartDrawer = () => {
  const value = useContext(CartDrawerContext);
  if (!value) throw new Error("useCartDrawer must be used inside CartDrawerProvider");
  return value;
};

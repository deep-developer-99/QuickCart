import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import axios from "axios";

import { useAppSelector } from "../hooks/reduxHooks";
import {
  addToCart,
  clearCart as clearCartRequest,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../services/cartService";

import type { Cart } from "../types/cart";

import { CartContext } from "./CartContext";

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const {
    user,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAppSelector((state) => state.auth);

  const [storedCart, setStoredCart] = useState<Cart | null>(null);
  const [cartOwnerId, setCartOwnerId] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestSequenceRef = useRef(0);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const isUser = isAuthenticated && user?.role === "user";
  const userId = isUser ? user?.id ?? null : null;
  const cart = userId && cartOwnerId === userId ? storedCart : null;
  const isCartReady = Boolean(userId && loadedUserId === userId);

  const refreshCart = useCallback(async () => {
    const requestId = ++requestSequenceRef.current;
    const requestUserId = userId;
    if (!requestUserId) {
      setStoredCart(null);
      setCartOwnerId(null);
      setLoadedUserId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await getCart();
      if (requestId !== requestSequenceRef.current) return;
      if (response?.success) {
        setStoredCart(response.data || null);
        setCartOwnerId(requestUserId);
        setLoadedUserId(requestUserId);
      }
    } catch (error) {
      if (requestId !== requestSequenceRef.current) return;
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setStoredCart(null);
        setCartOwnerId(requestUserId);
        setLoadedUserId(requestUserId);
      } else {
        console.error("Failed to load cart:", error);
      }
    } finally {
      if (requestId === requestSequenceRef.current) setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isUser || !userId) {
      requestSequenceRef.current += 1;
      // Clear the old user's cart synchronously so a rapid re-login cannot expose stale items.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStoredCart(null);
      setCartOwnerId(null);
      setLoadedUserId(null);
      setIsLoading(false);
      return;
    }
    void refreshCart();
  }, [isAuthLoading, isUser, refreshCart, userId]);

  const enqueueMutation = useCallback((operation: () => Promise<void>) => {
    const nextOperation = mutationQueueRef.current.then(operation, operation);
    mutationQueueRef.current = nextOperation.catch(() => undefined);
    return nextOperation;
  }, []);

  const updateLocalCart = useCallback((update: (current: Cart) => Cart) => {
    if (!userId) return;
    setStoredCart((current) => current && cartOwnerId === userId ? update(current) : current);
  }, [cartOwnerId, userId]);

  const getProductId = (product: Cart["items"][number]["product"]) => product?._id;

  const addProduct = useCallback((productId: string, quantity = 1) => enqueueMutation(async () => {
    await addToCart(productId, quantity);
    await refreshCart();
  }), [enqueueMutation, refreshCart]);

  const updateProductQuantity = useCallback((productId: string, quantity: number) => enqueueMutation(async () => {
    if (quantity < 1) {
      await removeCartItem(productId);
      updateLocalCart((current) => ({
        ...current,
        items: current.items.filter((item) => getProductId(item.product) !== productId),
      }));
    } else {
      await updateCartItem(productId, quantity);
      updateLocalCart((current) => ({
        ...current,
        items: current.items.map((item) => getProductId(item.product) === productId ? { ...item, quantity } : item),
      }));
    }
    await refreshCart();
  }), [enqueueMutation, refreshCart, updateLocalCart]);

  const removeProduct = useCallback((productId: string) => enqueueMutation(async () => {
    await removeCartItem(productId);
    updateLocalCart((current) => ({
      ...current,
      items: current.items.filter((item) => getProductId(item.product) !== productId),
    }));
    await refreshCart();
  }), [enqueueMutation, refreshCart, updateLocalCart]);

  const clearCart = useCallback(() => enqueueMutation(async () => {
    await clearCartRequest();
    updateLocalCart((current) => ({ ...current, items: [] }));
    await refreshCart();
  }), [enqueueMutation, refreshCart, updateLocalCart]);

  const getQuantity = (productId: string) => {
    const item = cart?.items.find((cartItem) => {
      return getProductId(cartItem.product) === productId;
    });
    return item?.quantity ?? 0;
  };

  const value = {
    cart,
    isLoading,
    isCartReady,
    getQuantity,
    addProduct,
    updateProductQuantity,
    removeProduct,
    clearCart,
    refreshCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

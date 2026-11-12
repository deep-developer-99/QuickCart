import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import axios from "axios";

import { useAppDispatch, useAppSelector } from "../hooks/reduxHooks";
import { logoutUser } from "../store/slice/authSlice";
import {
  addToCart,
  clearCart as clearCartRequest,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../services/cartService";

import type { Cart } from "../types/cart";
import { normalizeCartResponse } from "../utils/normalizeCartResponse";
import { getCartProductId, getCartQuantity } from "../utils/hasValidCartItems";

import { CartContext } from "./CartContext";

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const {
    user,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();

  const [storedCart, setStoredCart] = useState<Cart | null>(null);
  const [cartOwnerId, setCartOwnerId] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cartError, setCartError] = useState<{ userId: string; message: string } | null>(null);
  const requestSequenceRef = useRef(0);
  const currentUserIdRef = useRef<string | null>(null);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const isUser = isAuthenticated && user?.role === "user";
  const userId = isUser ? user?.id ?? null : null;
  useLayoutEffect(() => {
    currentUserIdRef.current = userId;
  }, [userId]);
  const cart = userId && cartOwnerId === userId ? storedCart : null;
  const isCartReady = Boolean(userId && loadedUserId === userId);
  const currentCartError = userId && cartError?.userId === userId ? cartError.message : null;
  const isCartLoading = Boolean(userId && (isLoading || (!isCartReady && !currentCartError)));

  const refreshCart = useCallback(async () => {
    const requestUserId = userId;
    if (requestUserId !== currentUserIdRef.current) return;
    const requestId = ++requestSequenceRef.current;
    if (!requestUserId) {
      setStoredCart(null);
      setCartOwnerId(null);
      setLoadedUserId(null);
      setIsLoading(false);
      setCartError(null);
      return;
    }

    setIsLoading(true);
    setCartError(null);
    try {
      const response = await getCart();
      if (requestId !== requestSequenceRef.current || requestUserId !== currentUserIdRef.current) return;
      const normalizedCart = normalizeCartResponse(response, requestUserId);
      if (normalizedCart) {
        setStoredCart(normalizedCart);
        setCartOwnerId(requestUserId);
        setLoadedUserId(requestUserId);
      } else {
        throw new Error("The cart response could not be read. Please retry.");
      }
    } catch (error) {
      if (requestId !== requestSequenceRef.current || requestUserId !== currentUserIdRef.current) return;
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        dispatch(logoutUser());
      } else {
        console.error("Failed to load cart:", error);
        setCartError({
          userId: requestUserId,
          message: error instanceof Error ? error.message : "Unable to load cart. Please retry.",
        });
      }
    } finally {
      if (requestId === requestSequenceRef.current) setIsLoading(false);
    }
  }, [dispatch, userId]);

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
      setCartError(null);
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
    if (!userId || currentUserIdRef.current !== userId) return;
    setStoredCart((current) => current && cartOwnerId === userId && currentUserIdRef.current === userId ? update(current) : current);
  }, [cartOwnerId, userId]);

  const addProduct = useCallback((productId: string, quantity = 1, variantId?: string) => enqueueMutation(async () => {
    const response = await addToCart(productId, quantity, variantId);
    if (userId && currentUserIdRef.current === userId) {
      const updatedCart = normalizeCartResponse(response, userId);
      if (updatedCart) {
        setStoredCart(updatedCart);
        setCartOwnerId(userId);
        setLoadedUserId(userId);
        setCartError(null);
      }
    }
    await refreshCart();
  }), [enqueueMutation, refreshCart, userId]);

  const updateProductQuantity = useCallback((productId: string, quantity: number, variantId?: string) => enqueueMutation(async () => {
    if (quantity < 1) {
      await removeCartItem(productId, variantId);
      updateLocalCart((current) => ({
        ...current,
        items: current.items.filter((item) => !(getCartProductId(item.product) === productId && (item.variantId ?? "") === (variantId ?? ""))),
      }));
    } else {
      await updateCartItem(productId, quantity, variantId);
      updateLocalCart((current) => ({
        ...current,
        items: current.items.map((item) => getCartProductId(item.product) === productId && (item.variantId ?? "") === (variantId ?? "") ? { ...item, quantity } : item),
      }));
    }
    await refreshCart();
  }), [enqueueMutation, refreshCart, updateLocalCart]);

  const removeProduct = useCallback((productId: string, variantId?: string) => enqueueMutation(async () => {
    await removeCartItem(productId, variantId);
    updateLocalCart((current) => ({
      ...current,
      items: current.items.filter((item) => !(getCartProductId(item.product) === productId && (item.variantId ?? "") === (variantId ?? ""))),
    }));
    await refreshCart();
  }), [enqueueMutation, refreshCart, updateLocalCart]);

  const clearCart = useCallback(() => enqueueMutation(async () => {
    await clearCartRequest();
    updateLocalCart((current) => ({ ...current, items: [] }));
    await refreshCart();
  }), [enqueueMutation, refreshCart, updateLocalCart]);

  const getQuantity = (productId: string, variantId?: string) => getCartQuantity(cart, productId, variantId);

  const value = {
    cart,
    isLoading: isCartLoading,
    isCartReady,
    cartError: currentCartError,
    getQuantity,
    addProduct,
    updateProductQuantity,
    removeProduct,
    clearCart,
    refreshCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

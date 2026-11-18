import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAppSelector } from "../hooks/reduxHooks";
import type { Cart, CartItem } from "../types/cart";
import type { Product } from "../types/product";
import { getCartProductId, getCartQuantity } from "../utils/hasValidCartItems";
import { removePurchasedCartSnapshot } from "../utils/cartOrderSnapshot";
import { CartContext } from "./CartContext";

const CART_VERSION = 1;
const MAX_QUANTITY = 99;
const storageKey = (userId: string) => `quickcart:cart:v${CART_VERSION}:${userId}`;

const parseCart = (raw: string | null, userId: string): Cart => {
  const empty: Cart = { _id: `local:${userId}`, user: userId, items: [] };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as { version?: number; userId?: string; items?: CartItem[] };
    if (parsed.version !== CART_VERSION || parsed.userId !== userId || !Array.isArray(parsed.items)) return empty;
    const items = parsed.items.filter((item) => {
      const product = item?.product;
      const variant = product && typeof product !== "string" ? product.variants?.find((entry) => entry._id === item.variantId) : undefined;
      return Boolean(product && typeof product !== "string" && product._id && item.variantId && variant && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= MAX_QUANTITY);
    });
    const unique = new Map<string, CartItem>();
    for (const item of items) {
      const key = `${getCartProductId(item.product)}:${item.variantId ?? ""}`;
      const previous = unique.get(key);
      const product = typeof item.product === "string" ? undefined : item.product;
      const stock = product?.variants?.find((entry) => entry._id === item.variantId)?.stock ?? MAX_QUANTITY;
      unique.set(key, { ...item, quantity: Math.min(MAX_QUANTITY, stock > 0 ? stock : MAX_QUANTITY, (previous?.quantity ?? 0) + item.quantity) });
    }
    return { ...empty, items: [...unique.values()] };
  } catch {
    return empty;
  }
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAppSelector((state) => state.auth);
  const isUser = isAuthenticated && user?.role === "user";
  const userId = isUser ? user?.id ?? null : null;
  const [storedCart, setStoredCart] = useState<Cart | null>(null);
  const [cartOwnerId, setCartOwnerId] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);
  const currentUserIdRef = useRef<string | null>(null);
  const storedCartRef = useRef<Cart | null>(storedCart);

  const replaceStoredCart = useCallback((next: Cart | null) => {
    storedCartRef.current = next;
    setStoredCart(next);
  }, []);

  const persistStoredCart = useCallback((ownerId: string, next: Cart) => {
    replaceStoredCart(next);
    try {
      window.localStorage.setItem(storageKey(ownerId), JSON.stringify({ version: CART_VERSION, userId: ownerId, items: next.items }));
    } catch (error) {
      console.warn("Cart changes are active in memory but could not be persisted.", error);
    }
  }, [replaceStoredCart]);

  useLayoutEffect(() => {
    currentUserIdRef.current = userId;
  }, [userId]);

  const cart = userId && cartOwnerId === userId ? storedCart : null;
  const isCartReady = Boolean(userId && loadedUserId === userId);

  const refreshCart = useCallback(async () => {
    if (!userId || userId !== currentUserIdRef.current) return;
    try {
      replaceStoredCart(parseCart(window.localStorage.getItem(storageKey(userId)), userId));
      setCartOwnerId(userId);
      setLoadedUserId(userId);
    } catch (error) {
      console.warn("Cart storage could not be read; continuing with an in-memory cart.", error);
      replaceStoredCart({ _id: `local:${userId}`, user: userId, items: [] });
      setCartOwnerId(userId);
      setLoadedUserId(userId);
    }
  }, [replaceStoredCart, userId]);

  useEffect(() => {
    if (isAuthLoading) return;
    const requestId = ++requestSequenceRef.current;
    const timer = window.setTimeout(() => {
      if (requestId !== requestSequenceRef.current || currentUserIdRef.current !== userId) return;
      if (!userId) {
        replaceStoredCart(null);
        setCartOwnerId(null);
        setLoadedUserId(null);
        return;
      }
      try {
        const restored = parseCart(window.localStorage.getItem(storageKey(userId)), userId);
        replaceStoredCart(restored);
        setCartOwnerId(userId);
        setLoadedUserId(userId);
      } catch (error) {
        console.warn("Cart storage could not be read; continuing with an in-memory cart.", error);
        replaceStoredCart({ _id: `local:${userId}`, user: userId, items: [] });
        setCartOwnerId(userId);
        setLoadedUserId(userId);
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      requestSequenceRef.current += 1;
    };
  }, [isAuthLoading, replaceStoredCart, userId]);

  useEffect(() => {
    if (!isCartReady || !userId || cartOwnerId !== userId || !cart) return;
    // An older render can have a queued persistence effect when a cart mutation
    // commits synchronously. Do not let that stale snapshot overwrite storage.
    if (storedCartRef.current !== cart) return;
    try {
      window.localStorage.setItem(storageKey(userId), JSON.stringify({ version: CART_VERSION, userId, items: cart.items }));
    } catch (error) {
      console.warn("Cart changes are active in memory but could not be persisted.", error);
    }
  }, [cart, cartOwnerId, isCartReady, userId]);

  useEffect(() => {
    if (!userId) return;
    const key = storageKey(userId);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || userId !== currentUserIdRef.current) return;
      const next = parseCart(event.newValue, userId);
      replaceStoredCart(next);
      setCartOwnerId(userId);
      setLoadedUserId(userId);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [replaceStoredCart, userId]);

  const addProduct = useCallback(async (product: Product, quantity = 1, variantId?: string) => {
    if (!userId || !isCartReady || !product?._id || !variantId || !Number.isInteger(quantity) || quantity < 1) return;
    const variant = product.variants?.find((entry) => entry._id === variantId && entry.isActive);
    if (!variant || variant.stock <= 0) return;
    const current = storedCartRef.current;
    if (!current || current.user !== userId) return;
    const key = `${product._id}:${variantId}`;
    const existing = current.items.find((item) => `${getCartProductId(item.product)}:${item.variantId ?? ""}` === key);
    const nextQuantity = Math.min(MAX_QUANTITY, variant.stock, (existing?.quantity ?? 0) + quantity);
    const nextItem: CartItem = { product, variantId, quantity: nextQuantity };
    const next = { ...current, items: existing ? current.items.map((item) => `${getCartProductId(item.product)}:${item.variantId ?? ""}` === key ? nextItem : item) : [...current.items, nextItem] };
    persistStoredCart(userId, next);
  }, [isCartReady, persistStoredCart, userId]);

  const updateProductQuantity = useCallback(async (productId: string, quantity: number, variantId?: string) => {
    if (!userId || !isCartReady || !Number.isInteger(quantity)) return;
    const current = storedCartRef.current;
    if (!current || current.user !== userId) return;
    const matches = (item: CartItem) => getCartProductId(item.product) === productId && (item.variantId ?? "") === (variantId ?? "");
    if (quantity <= 0) {
      persistStoredCart(userId, { ...current, items: current.items.filter((item) => !matches(item)) });
      return;
    }
    const items = current.items.map((item) => {
      if (!matches(item)) return item;
      const product = typeof item.product === "string" ? undefined : item.product;
      const variant = product?.variants?.find((entry) => entry._id === item.variantId);
      if (!variant || variant.stock <= 0) return item;
      return { ...item, quantity: Math.min(quantity, MAX_QUANTITY, variant.stock) };
    });
    persistStoredCart(userId, { ...current, items });
  }, [isCartReady, persistStoredCart, userId]);

  const removeProduct = useCallback(async (productId: string, variantId?: string) => {
    if (!userId || !isCartReady) return;
    const current = storedCartRef.current;
    if (!current || current.user !== userId) return;
    persistStoredCart(userId, {
      ...current,
      items: current.items.filter((item) => !(getCartProductId(item.product) === productId && (item.variantId ?? "") === (variantId ?? ""))),
    });
  }, [isCartReady, persistStoredCart, userId]);

  const removePurchasedItems = useCallback(async (purchased: Array<{ productId: string; variantId: string; quantity: number }>) => {
    if (!userId || !isCartReady || purchased.length === 0) return;
    const current = storedCartRef.current;
    if (!current || current.user !== userId) return;
    // Persist before resolving so navigation or an immediate refresh cannot
    // restore the pre-order cart snapshot.
    persistStoredCart(userId, removePurchasedCartSnapshot(current, userId, purchased));
  }, [isCartReady, persistStoredCart, userId]);

  const clearCart = useCallback(async () => {
    if (!userId || !isCartReady) return;
    const current = storedCartRef.current;
    if (!current || current.user !== userId) return;
    persistStoredCart(userId, { ...current, items: [] });
  }, [isCartReady, persistStoredCart, userId]);

  const getQuantity = (productId: string, variantId?: string) => getCartQuantity(cart, productId, variantId);
  return <CartContext.Provider value={{ cart, isLoading: Boolean(userId && !isCartReady), isCartReady, cartError: null, getQuantity, addProduct, updateProductQuantity, removeProduct, removePurchasedItems, clearCart, refreshCart }}>{children}</CartContext.Provider>;
};

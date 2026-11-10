import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";

import { useCart } from "../../context/useCart";
import { useAppSelector } from "../../hooks/reduxHooks";
import { getCartProductId, getCartSubtotal, getValidCartItems, hasValidCartItems } from "../../utils/hasValidCartItems";
import { getAddresses } from "../../services/addressService";
import { getCheckoutSummary } from "../../services/orderService";
import type { CheckoutSummary } from "../../services/orderService";
import type { Address } from "../../types/address";
import type { Order } from "../../types/order";
import CartItem from "./CartItem";
import Checkout from "../../pages/user/Checkout";

import "./CartDrawer.css";

type DrawerStage = "cart" | "checkout" | "success";

interface CartDrawerProps {
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

interface OrderSnapshot {
  order?: Order;
  address?: Address;
  cart: ReturnType<typeof useCart>["cart"];
  total: number;
}

const getAddressText = (address?: Address) => address
  ? [address.addressLine, address.city, address.state, address.pincode].filter(Boolean).join(", ")
  : "Add a delivery address to continue";

const CartDrawer = ({ isOpen, isClosing = false, onClose, onNavigate }: CartDrawerProps) => {
  const { cart, isLoading, isCartReady, refreshCart, updateProductQuantity, removeProduct } = useCart();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const isUser = isAuthenticated && user?.role === "user";
  const [stage, setStage] = useState<DrawerStage>("cart");
  const [address, setAddress] = useState<Address>();
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [summaryResult, setSummaryResult] = useState<{ key: string; data: CheckoutSummary } | null>(null);
  const [summaryFailure, setSummaryFailure] = useState<{ key: string; message: string } | null>(null);
  const [drawerError, setDrawerError] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [orderSnapshot, setOrderSnapshot] = useState<OrderSnapshot>();

  const validItems = getValidCartItems(cart);
  const validItemCount = validItems.reduce((sum, item) => sum + item.quantity, 0);
  const calculatedItemsTotal = getCartSubtotal(validItems) ?? 0;
  const cartSummaryKey = validItems.map((item) => typeof item.product === "string"
    ? `${item.product}:${item.quantity}`
    : `${item.product._id}:${item.quantity}:${item.product.price}:${item.product.discountPrice ?? ""}`).join("|");
  const checkoutSummary = summaryResult?.key === cartSummaryKey ? summaryResult.data : null;
  const summaryError = summaryFailure?.key === cartSummaryKey ? summaryFailure.message : "";
  const isLoadingSummary = Boolean(isOpen && validItems.length && !checkoutSummary && !summaryError);
  const itemsTotal = checkoutSummary?.subtotal ?? calculatedItemsTotal;
  const deliveryCharge = checkoutSummary?.shippingAmount;
  const orderTotal = checkoutSummary?.totalAmount;
  const totalLabel = orderTotal !== undefined
    ? `₹${orderTotal.toFixed(2)}`
    : isLoadingSummary ? "Calculating…" : "Unavailable";
  const handleClose = useCallback(() => {
    setStage("cart");
    setDrawerError("");
    setShareStatus("");
    onClose();
  }, [onClose]);

  const handleShare = async () => {
    const shareData = { title: "QuickCart", text: "Shop fresh essentials on QuickCart", url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareStatus("Shared");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
        setShareStatus("Link copied");
      } else {
        setShareStatus("Sharing is unavailable in this browser");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setShareStatus("Could not share this link");
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!isUser) {
      const closeTimer = window.setTimeout(handleClose, 0);
      return () => window.clearTimeout(closeTimer);
    }

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleClose, isOpen, isUser]);

  useEffect(() => {
    if (!isOpen || !isUser || !isCartReady || stage === "success") return;
    if (!hasValidCartItems(cart)) {
      const closeTimer = window.setTimeout(handleClose, 0);
      return () => window.clearTimeout(closeTimer);
    }
  }, [cart, handleClose, isCartReady, isOpen, isUser, stage]);

  useEffect(() => {
    if (!isOpen || !isUser) return;
    let active = true;
    const loadingTimer = window.setTimeout(() => {
      if (active) setIsLoadingAddresses(true);
    }, 0);
    getAddresses(1, 50).then((response) => {
      if (!active || !response?.success) return;
      const saved = (response.data || []) as Address[];
      setAddress((current) => current && saved.some((item) => item._id === current._id)
        ? saved.find((item) => item._id === current._id)
        : saved.find((item) => item.isDefault) || saved[0]);
    }).catch((error: unknown) => {
      console.error("Failed to load cart delivery addresses:", error);
      if (active) setDrawerError("Saved addresses could not be loaded. You can retry from checkout.");
    }).finally(() => {
      if (active) {
        window.clearTimeout(loadingTimer);
        setIsLoadingAddresses(false);
      }
    });
    return () => { active = false; window.clearTimeout(loadingTimer); };
  }, [isOpen, isUser]);

  useEffect(() => {
    if (!isOpen || !isUser || validItems.length === 0) return;

    let active = true;
    getCheckoutSummary().then((response) => {
      if (!active) return;
      if (!response?.success || !response.data) {
        throw new Error(response?.message || "Unable to calculate current cart total.");
      }
      setSummaryResult({ key: cartSummaryKey, data: response.data });
      setSummaryFailure(null);
    }).catch((error: unknown) => {
      if (!active) return;
      console.error("Failed to calculate cart total:", error);
      setSummaryFailure({ key: cartSummaryKey, message: error instanceof Error ? error.message : "Unable to calculate current cart total." });
    });
    return () => { active = false; };
  }, [cart, cartSummaryKey, isOpen, isUser, validItems.length]);

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) handleClose();
  };

  const handleQuantityChange = async (productId: string, quantity: number) => {
    try {
      setDrawerError("");
      await updateProductQuantity(productId, quantity);
    } catch (error) {
      console.error("Failed to update cart quantity:", error);
      setDrawerError("We couldn't update that quantity. Please try again.");
    }
  };

  const handleRemove = async (productId: string) => {
    try {
      setDrawerError("");
      await removeProduct(productId);
    } catch (error) {
      console.error("Failed to remove cart item:", error);
      setDrawerError("We couldn't remove that item. Please try again.");
    }
  };

  const handleAddressChange = useCallback((nextAddress: Address | undefined) => {
    setAddress(nextAddress);
  }, []);

  const handleOrderSuccess = useCallback((order: Order | undefined, selectedAddress: Address | undefined) => {
    setOrderSnapshot({ order, address: selectedAddress || address, cart, total: order?.totalAmount ?? orderTotal ?? itemsTotal });
    setStage("success");
    setDrawerError("");
    void refreshCart();
  }, [address, cart, itemsTotal, orderTotal, refreshCart]);

  if (!isOpen || !isUser) return null;

  const heading = stage === "cart" ? "My Cart" : stage === "checkout" ? "Checkout" : "Order placed";

  return (
    <div className={`cart-drawer-overlay${isClosing ? " cart-drawer-overlay--closing" : ""}`} onMouseDown={handleBackdropMouseDown}>
      <aside className={`cart-drawer cart-drawer--${stage}`} role="dialog" aria-modal="true" aria-label={heading}>
        <header className="cart-drawer-header">
          {stage === "cart" ? (
            <button type="button" className="cart-drawer-back" onClick={handleClose} aria-label="Back to shopping">←</button>
          ) : stage !== "success" ? (
            <button type="button" className="cart-drawer-back" onClick={() => setStage("cart")} aria-label="Back to cart">←</button>
          ) : null}
          <div className="cart-drawer-title-wrap">
            <h2>{heading}</h2>
            {stage === "cart" && validItemCount > 0 && <span>{validItemCount} {validItemCount === 1 ? "item" : "items"}</span>}
          </div>
          {stage === "cart" && <button type="button" className="cart-drawer-share" onClick={() => void handleShare()} aria-label="Share QuickCart">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7h14v-7" /></svg>
            <span>Share</span>
          </button>}
          <button type="button" className="cart-drawer-close" onClick={handleClose} aria-label="Close cart">×</button>
        </header>

        {stage === "cart" && (
          <>
            <div className="cart-drawer-content">
              {drawerError && <p className="cart-drawer-error" role="alert">{drawerError}</p>}
              {shareStatus && <p className="cart-drawer-share-status" role="status">{shareStatus}</p>}
              {isLoading && !cart ? (
                <div className="cart-drawer-loading">Loading your cart…</div>
              ) : validItems.length === 0 ? (
                <div className="cart-drawer-empty">
                  <span aria-hidden="true">🛒</span>
                  <h3>Your cart is empty</h3>
                  <p>Add items to your cart and they’ll appear here.</p>
                  <button type="button" onClick={handleClose}>Continue shopping</button>
                </div>
              ) : (
                <>
                  <section className="cart-drawer-delivery" aria-label="Delivery details">
                    <span className="cart-drawer-delivery-icon" aria-hidden="true">◷</span>
                    <div><strong>Delivery estimate</strong><span>Delivery timing and shipment details are confirmed during checkout.</span></div>
                  </section>
                  <section className="cart-drawer-items" aria-label="Cart products">
                    {validItems.map((item, index) => (
                      <div className="cart-drawer-item-wrap" key={getCartProductId(item.product) || `${index}`}>
                        {typeof item.product !== "string" && item.product.stock === 0 && <p className="cart-drawer-stock-warning">Out of stock. Remove this item to continue.</p>}
                        <CartItem item={item} onQuantityChange={handleQuantityChange} onRemove={handleRemove} />
                      </div>
                    ))}
                  </section>

                  <section className="cart-drawer-bill">
                    <h3>Bill Details</h3>
                    <div><span>Items total</span><strong>₹{itemsTotal.toFixed(2)}</strong></div>
                    <div><span>Delivery charge</span><strong>{isLoadingSummary ? "Calculating…" : deliveryCharge === undefined ? "Unavailable" : deliveryCharge > 0 ? `₹${deliveryCharge.toFixed(2)}` : "FREE"}</strong></div>
                    <div className="cart-drawer-grand-total"><span>Grand total</span><strong>{totalLabel}</strong></div>
                    {summaryError ? <p role="alert">{summaryError}</p> : null}
                  </section>
                </>
              )}
            </div>

            {validItems.length > 0 && (
              <footer className="cart-drawer-footer">
                <div className="cart-drawer-address-row">
                  <span className="cart-drawer-address-pin" aria-hidden="true">⌖</span>
                  <div>
                    <strong>{address?.isDefault ? "Home" : "Delivery to"}</strong>
                    <span>{isLoadingAddresses ? "Loading address…" : getAddressText(address)}</span>
                  </div>
                </div>
                <div className="cart-drawer-proceed-row">
                  <div><strong>{totalLabel}</strong><span>TOTAL</span></div>
                  <button type="button" onClick={() => setStage("checkout")}>Proceed <span aria-hidden="true">›</span></button>
                </div>
              </footer>
            )}
          </>
        )}

        {stage === "checkout" && (
          <div className="cart-drawer-checkout-content">
            <Checkout
              key="drawer-checkout"
              embedded
              initialSelectedAddress={address?._id}
              onBack={() => setStage("cart")}
              onAddressChange={handleAddressChange}
              onOrderSuccess={handleOrderSuccess}
            />
          </div>
        )}

        {stage === "success" && orderSnapshot && (
          <div className="cart-drawer-success">
            <span className="cart-drawer-success-icon" aria-hidden="true">✓</span>
            <h3>Order Placed Successfully</h3>
            {orderSnapshot.order?._id && <p className="cart-drawer-order-id">Order ID: {orderSnapshot.order._id}</p>}
            <strong className="cart-drawer-success-total">₹{orderSnapshot.total.toFixed(2)}</strong>
            <div className="cart-drawer-success-address">
              <strong>Delivery address</strong>
              <span>{getAddressText(orderSnapshot.address)}</span>
            </div>
            <div className="cart-drawer-success-items">
              <h4>Order summary</h4>
              {(orderSnapshot.order?.items || orderSnapshot.cart?.items || []).map((item, index) => {
                const name = "name" in item ? item.name : typeof item.product === "string" ? "Product" : item.product.name;
                const quantity = item.quantity;
                return <div key={`${name}-${index}`}><span>{name} × {quantity}</span></div>;
              })}
            </div>
            <div className="cart-drawer-success-actions">
              <button type="button" onClick={() => onNavigate("/account/orders")}>View Orders</button>
              <button type="button" className="secondary" onClick={() => onNavigate("/")}>Continue Shopping</button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

export default CartDrawer;

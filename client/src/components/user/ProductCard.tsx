import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import { useAppSelector } from "../../hooks/reduxHooks";
import { useCart } from "../../context/useCart";
import { useLoginModal } from "../../context/LoginModalContext";
import type { Product, ProductVariant } from "../../types/product";
import { getCartProductId, getValidCartItems } from "../../utils/hasValidCartItems";
import { getLowestPricedAvailableVariant, getVariantDiscountPercentage, getVariantSellingPrice, hasVariantDiscount } from "../../utils/productPricing";
import "./ProductCard.css";

interface ProductCardProps {
  product: Product;
  variant?: "category" | "compact";
}

const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const ProductCard = ({ product, variant }: ProductCardProps) => {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const { cart, getQuantity, addProduct, updateProductQuantity, removeProduct, isCartReady, isLoading: isCartLoading, cartError, refreshCart } = useCart();
  const { openLoginModal } = useLoginModal();
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>();
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [variantFeedback, setVariantFeedback] = useState("");

  const activeVariants = useMemo(() => (product.variants ?? []).filter((item) => item.isActive), [product.variants]);
  const inStockVariants = useMemo(() => activeVariants.filter((item) => Number.isFinite(Number(item.stock)) && item.stock > 0 && Number.isFinite(Number(item.price)) && item.price > 0), [activeVariants]);
  const cardVariant = useMemo(() => getLowestPricedAvailableVariant(product.variants), [product.variants]);
  const selectedVariant = inStockVariants.find((item) => item._id === selectedVariantId) ?? inStockVariants[0];
  const optionsCount = inStockVariants.length;
  const productCartItems = useMemo(
    () => getValidCartItems(cart).filter((item) => getCartProductId(item.product) === product._id),
    [cart, product._id],
  );
  const variantQuantityMap = useMemo(
    () => new Map(productCartItems.map((item) => [item.variantId ?? "", item.quantity])),
    [productCartItems],
  );
  const combinedQuantity = productCartItems.reduce((total, item) => total + item.quantity, 0);
  const selectedQuantity = selectedVariant ? variantQuantityMap.get(selectedVariant._id) ?? 0 : getQuantity(product._id);
  const variantsInCartCount = new Set(productCartItems.filter((item) => item.variantId && item.quantity > 0).map((item) => item.variantId)).size;
  const hasOtherVariantInCart = productCartItems.some((item) => item.quantity > 0 && (item.variantId ?? "") !== (selectedVariant?._id ?? ""));
  const shouldManageVariants = optionsCount > 1 || variantsInCartCount > 1 || hasOtherVariantInCart;
  const popupVariants = useMemo(
    () => (product.variants ?? []).filter((item) => (item.isActive || (variantQuantityMap.get(item._id) ?? 0) > 0)
      && (item.stock > 0 || (variantQuantityMap.get(item._id) ?? 0) > 0)),
    [product.variants, variantQuantityMap],
  );
  const isUser = isAuthenticated && user?.role === "user";
  const hasStock = optionsCount > 0;
  const description = typeof product.description === "string" ? product.description.trim() : "";
  const hasDiscount = hasVariantDiscount(cardVariant);
  const sellingPrice = getVariantSellingPrice(cardVariant);
  const originalPrice = cardVariant?.price;
  const discountPercentage = getVariantDiscountPercentage(cardVariant);

  useEffect(() => {
    if (!isVariantDialogOpen) return;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById("root");
    const previousInert = appRoot?.inert ?? false;
    const previousAriaHidden = appRoot?.getAttribute("aria-hidden");
    const focusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute("aria-hidden", "true");
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsVariantDialogOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (appRoot) {
        appRoot.inert = previousInert;
        if (previousAriaHidden == null) appRoot.removeAttribute("aria-hidden");
        else appRoot.setAttribute("aria-hidden", previousAriaHidden);
      }
      window.removeEventListener("keydown", closeOnEscape);
      focusedElement?.focus();
    };
  }, [isVariantDialogOpen]);

  const addVariant = async (chosenVariant: ProductVariant) => {
    if (chosenVariant.stock <= 0 || getVariantSellingPrice(chosenVariant) <= 0 || isUpdating) return;
    setSelectedVariantId(chosenVariant._id);
    if (!isUser) {
      openLoginModal({ onAuthenticated: async () => {
        try {
          await addProduct(product._id, 1, chosenVariant._id);
          setIsVariantDialogOpen(false);
        } catch (error) {
          console.error("Failed to add product to cart:", error);
        }
      } });
      return;
    }

    try {
      setIsUpdating(true);
      await addProduct(product._id, 1, chosenVariant._id);
      setVariantFeedback("Added to cart");
      setIsVariantDialogOpen(false);
    } catch (error) {
      console.error("Failed to add product to cart:", error);
      setVariantFeedback(axios.isAxiosError(error) ? error.response?.data?.message || "Could not add this option." : "Could not add this option.");
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        openLoginModal({ onAuthenticated: async () => {
          try { await addProduct(product._id, 1, chosenVariant._id); }
          catch (retryError) { console.error("Failed to add product to cart:", retryError); }
        } });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    await addVariant(selectedVariant);
  };

  const changeVariantQuantity = async (item: ProductVariant, nextQuantity: number) => {
    const currentQuantity = variantQuantityMap.get(item._id) ?? 0;
    if (isUpdating || nextQuantity < 0 || nextQuantity > item.stock || (nextQuantity > currentQuantity && (!item.isActive || getVariantSellingPrice(item) <= 0)) || nextQuantity === currentQuantity) return;
    try {
      setIsUpdating(true);
      setVariantFeedback("");
      if (nextQuantity === 0) await removeProduct(product._id, item._id);
      else if (nextQuantity > currentQuantity) await addProduct(product._id, nextQuantity - currentQuantity, item._id);
      else await updateProductQuantity(product._id, nextQuantity, item._id);
    } catch (error) {
      console.error("Failed to update variant quantity:", error);
      setVariantFeedback(axios.isAxiosError(error) ? error.response?.data?.message || "Could not update this option." : "Could not update this option.");
    } finally {
      setIsUpdating(false);
    }
  };

  const openVariantManager = () => {
    if (shouldManageVariants) setIsVariantDialogOpen(true);
    else if (selectedVariant && selectedQuantity < selectedVariant.stock && !isUpdating) {
      void changeVariantQuantity(selectedVariant, selectedQuantity + 1);
    }
  };

  const decreaseFromCard = () => {
    if (shouldManageVariants) {
      setIsVariantDialogOpen(true);
      return;
    }
    if (selectedVariant && selectedQuantity > 0) void changeVariantQuantity(selectedVariant, selectedQuantity - 1);
  };

  const handleRetryCart = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try { await refreshCart(); }
    finally { setIsUpdating(false); }
  };

  const handleAddClick = () => {
    if (!selectedVariant || isUpdating) return;
    setVariantFeedback("");
    if (optionsCount > 1) setIsVariantDialogOpen(true);
    else void handleAddToCart();
  };

  return (
    <>
      <article className={`product-card${variant ? ` product-card--${variant}` : ""}${!hasStock ? " product-card--unavailable" : ""}`}>
        <Link to={`/products/${product._id}`} className="product-card-main">
          <div className="product-card-image-wrapper">
            <img src={product.image} alt={product.name} className="product-card-image" onError={(event) => {
              event.currentTarget.hidden = true;
              event.currentTarget.nextElementSibling?.classList.add("product-card-image-fallback--visible");
            }} />
            <span className="product-card-image-fallback" aria-hidden="true">Image unavailable</span>
            {cardVariant && cardVariant.stock <= 5 && <span className="low-stock-badge">Only {cardVariant.stock} left</span>}
            {!hasStock && <span className="out-stock-badge">Out of Stock</span>}
          </div>
          <div className="product-card-content">
            <h3 className="product-card-name">{product.name}</h3>
            <p className={`product-card-variant-default${cardVariant ? "" : " product-card-placeholder"}`} aria-hidden={!cardVariant}>{cardVariant ? `${cardVariant.quantity} ${cardVariant.unit}` : "Variant size"}</p>
            <p className={`product-card-description${description ? "" : " product-card-placeholder"}`} aria-hidden={!description}>{description || "Product description"}</p>
          </div>
        </Link>

        <div className="product-card-footer">
          <div className="product-card-prices">
            <div className="product-card-price-line">
              <strong className="product-card-price">{cardVariant ? formatPrice(sellingPrice) : "—"}</strong>
              {hasDiscount && originalPrice != null && <del className="product-card-old-price">{formatPrice(originalPrice)}</del>}
            </div>
            {hasDiscount && <span className="product-card-discount">{discountPercentage}% off</span>}
          </div>
          <div className="product-card-action">
            {hasStock ? (
              isUser && !isCartReady ? (
                cartError ? <button type="button" className="product-add-button" onClick={handleRetryCart} disabled={isUpdating}>{isUpdating ? "..." : "Retry"}</button>
                  : <button type="button" className="product-add-button" disabled aria-label="Loading cart">{isCartLoading ? "..." : "..."}</button>
              ) : combinedQuantity > 0 ? (
                <div className="product-quantity-control" aria-label="Product quantity">
                  <button type="button" className="product-quantity-button" onClick={decreaseFromCard} disabled={isUpdating} aria-label={`Decrease ${product.name} quantity`}>−</button>
                  <span className="product-quantity-value" aria-live="polite">{combinedQuantity}</span>
                  <button type="button" className="product-quantity-button" onClick={openVariantManager} disabled={isUpdating || (!shouldManageVariants && (!selectedVariant || selectedQuantity >= selectedVariant.stock))} aria-label={`Increase ${product.name} quantity`}>+</button>
                </div>
              ) : (
                <button type="button" className="product-add-button" onClick={handleAddClick} disabled={isUpdating}>{isUpdating ? "..." : "ADD"}</button>
              )
            ) : <span className="product-unavailable">Unavailable</span>}
            {optionsCount > 1 && <small className="product-card-options-count">{optionsCount} options</small>}
          </div>
          {variantFeedback && <small className="product-variant-feedback" role="status">{variantFeedback}</small>}
        </div>
      </article>

      {isVariantDialogOpen && createPortal(
        <div className="product-variant-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsVariantDialogOpen(false); }}>
          <section className="product-variant-dialog" role="dialog" aria-modal="true" aria-labelledby={`variant-title-${product._id}`}>
            <button className="product-variant-close" type="button" onClick={() => setIsVariantDialogOpen(false)} aria-label="Close">×</button>
            <h3 id={`variant-title-${product._id}`}>{product.name}</h3>
            <div className="product-variant-list">
              {popupVariants.map((item) => {
                const itemQuantity = variantQuantityMap.get(item._id) ?? 0;
                const canIncrease = itemQuantity < item.stock;
                return (
                <div className="product-variant-choice" key={item._id}>
                  <img src={product.image} alt="" className="product-variant-image" onError={(event) => {
                    if (event.currentTarget.getAttribute("src") !== product.image) {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = product.image;
                    } else {
                      event.currentTarget.hidden = true;
                    }
                  }} />
                  <span className="product-variant-size">{item.quantity} {item.unit}{item.stock <= 0 || !item.isActive ? <small className="product-variant-stock">{item.isActive ? "Out of stock" : "Unavailable"}</small> : null}</span>
                  <div className="product-variant-pricing">
                    <strong>{formatPrice(getVariantSellingPrice(item))}</strong>
                    {hasVariantDiscount(item) && <del>{formatPrice(item.price)}</del>}
                    {hasVariantDiscount(item) && <small>{getVariantDiscountPercentage(item)}% off</small>}
                  </div>
                  {itemQuantity > 0 ? (
                    <div className="product-variant-quantity" aria-label={`${itemQuantity} ${item.quantity} ${item.unit} in cart`}>
                      <button type="button" onClick={() => void changeVariantQuantity(item, itemQuantity - 1)} disabled={isUpdating} aria-label={`Decrease ${item.quantity} ${item.unit}`}>−</button>
                      <span aria-live="polite">{itemQuantity}</span>
                      <button type="button" onClick={() => void changeVariantQuantity(item, itemQuantity + 1)} disabled={isUpdating || !canIncrease || !item.isActive} aria-label={`Increase ${item.quantity} ${item.unit}`}>+</button>
                    </div>
                  ) : (
                    <button type="button" className="product-variant-add" disabled={isUpdating || item.stock <= 0 || getVariantSellingPrice(item) <= 0} onClick={() => { setSelectedVariantId(item._id); void changeVariantQuantity(item, 1); }}>
                      {isUpdating ? "..." : "ADD"}
                    </button>
                  )}
                </div>
                );
              })}
            </div>
            {variantFeedback && <p className="product-variant-error" role="alert">{variantFeedback}</p>}
          </section>
        </div>,
        document.body,
      )}
    </>
  );
};

export default ProductCard;

import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import { useAppSelector } from "../../hooks/reduxHooks";
import { useCart } from "../../context/useCart";
import { useLoginModal } from "../../context/LoginModalContext";
import type { Product, ProductVariant } from "../../types/product";
import "./ProductCard.css";

interface ProductCardProps {
  product: Product;
  variant?: "category" | "compact";
}

const formatPrice = (price: number) => `₹${price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const ProductCard = ({ product, variant }: ProductCardProps) => {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const { getQuantity, addProduct, updateProductQuantity, removeProduct, isCartReady, isLoading: isCartLoading, cartError, refreshCart } = useCart();
  const { openLoginModal } = useLoginModal();
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>();
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [variantFeedback, setVariantFeedback] = useState("");

  const activeVariants = useMemo(() => (product.variants ?? []).filter((item) => item.isActive), [product.variants]);
  const inStockVariants = useMemo(() => activeVariants.filter((item) => item.stock > 0), [activeVariants]);
  const selectedVariant = inStockVariants.find((item) => item._id === selectedVariantId) ?? inStockVariants[0];
  const optionsCount = inStockVariants.length;
  const quantity = getQuantity(product._id, selectedVariant?._id);
  const isUser = isAuthenticated && user?.role === "user";
  const hasStock = optionsCount > 0;
  const description = typeof product.description === "string" ? product.description.trim() : "";
  const hasDiscount = Boolean(selectedVariant?.discountPrice != null && selectedVariant.discountPrice < selectedVariant.price);
  const sellingPrice = selectedVariant ? (hasDiscount ? selectedVariant.discountPrice! : selectedVariant.price) : 0;
  const originalPrice = selectedVariant?.price;

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
    if (chosenVariant.stock <= 0 || isUpdating) return;
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

  const handleDecrease = async () => {
    if (quantity <= 0 || isUpdating || !selectedVariant) return;
    try {
      setIsUpdating(true);
      if (quantity === 1) await removeProduct(product._id, selectedVariant._id);
      else await updateProductQuantity(product._id, quantity - 1, selectedVariant._id);
    } catch (error) {
      console.error("Failed to decrease product quantity:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleIncrease = async () => {
    if (!selectedVariant || quantity >= selectedVariant.stock || isUpdating) return;
    try {
      setIsUpdating(true);
      await updateProductQuantity(product._id, quantity + 1, selectedVariant._id);
    } catch (error) {
      console.error("Failed to increase product quantity:", error);
    } finally {
      setIsUpdating(false);
    }
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
            {selectedVariant && selectedVariant.stock <= 5 && <span className="low-stock-badge">Only {selectedVariant.stock} left</span>}
            {!hasStock && <span className="out-stock-badge">Out of Stock</span>}
          </div>
          <div className="product-card-content">
            <h3 className="product-card-name">{product.name}</h3>
            {selectedVariant && <p className="product-card-variant-default">{selectedVariant.quantity} {selectedVariant.unit}</p>}
            {description && <p className="product-card-description">{description}</p>}
          </div>
        </Link>

        <div className="product-card-footer">
          <div className="product-card-prices">
            <span className="product-card-price">{formatPrice(sellingPrice)}</span>
            {hasDiscount && originalPrice != null && <span className="product-card-old-price">{formatPrice(originalPrice)}</span>}
          </div>
          <div className="product-card-action">
            {hasStock ? (
              isUser && !isCartReady ? (
                cartError ? <button type="button" className="product-add-button" onClick={handleRetryCart} disabled={isUpdating}>{isUpdating ? "..." : "Retry"}</button>
                  : <button type="button" className="product-add-button" disabled aria-label="Loading cart">{isCartLoading ? "..." : "..."}</button>
              ) : quantity > 0 ? (
                <div className="product-quantity-control" aria-label="Product quantity">
                  <button type="button" className="product-quantity-button" onClick={handleDecrease} disabled={isUpdating} aria-label={`Decrease ${product.name} quantity`}>−</button>
                  <span className="product-quantity-value">{quantity}</span>
                  <button type="button" className="product-quantity-button" onClick={handleIncrease} disabled={isUpdating || !selectedVariant || quantity >= selectedVariant.stock} aria-label={`Increase ${product.name} quantity`}>+</button>
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
              {inStockVariants.map((item) => (
                <div className="product-variant-choice" key={item._id}>
                  <img src={item.image || product.image} alt="" className="product-variant-image" onError={(event) => {
                    if (event.currentTarget.getAttribute("src") !== product.image) {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = product.image;
                    } else {
                      event.currentTarget.hidden = true;
                    }
                  }} />
                  <span className="product-variant-size">{item.quantity} {item.unit}</span>
                  <strong>{formatPrice(item.discountPrice != null && item.discountPrice < item.price ? item.discountPrice : item.price)}</strong>
                  <button type="button" className="product-variant-add" disabled={isUpdating} onClick={() => void addVariant(item)}>
                    {isUpdating ? "..." : "ADD"}
                  </button>
                </div>
              ))}
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

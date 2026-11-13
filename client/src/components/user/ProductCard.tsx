import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import { useAppSelector } from "../../hooks/reduxHooks";
import { useCart } from "../../context/useCart";
import { useLoginModal } from "../../context/LoginModalContext";

import type { Product } from "../../types/product";

import "./ProductCard.css";

interface ProductCardProps {
  product: Product;
  variant?: "category" | "compact";
}

const ProductCard = ({ product, variant }: ProductCardProps) => {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const { getQuantity, addProduct, updateProductQuantity, removeProduct, isCartReady, isLoading: isCartLoading, cartError, refreshCart } =
    useCart();
  const { openLoginModal } = useLoginModal();

  const [isUpdating, setIsUpdating] = useState(false);
  const availableVariants = useMemo(() => (product.variants ?? []).filter((item) => item.isActive), [product.variants]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(() => availableVariants.find((item) => item.stock > 0)?._id);
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [variantFeedback, setVariantFeedback] = useState("");
  const selectedVariant = availableVariants.find((item) => item._id === selectedVariantId) ?? availableVariants.find((item) => item.stock > 0);

  useEffect(() => {
    if (!isVariantDialogOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsVariantDialogOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isVariantDialogOpen]);

  const quantity = getQuantity(product._id, selectedVariant?._id);
  const isUser = isAuthenticated && user?.role === "user";
  const hasStock = availableVariants.some((item) => item.stock > 0);
  const description = typeof product.description === "string" ? product.description.trim() : "";

  const hasDiscount = Boolean(selectedVariant?.discountPrice != null && selectedVariant.discountPrice < (selectedVariant?.price ?? 0));
  const sellingPrice = selectedVariant ? (hasDiscount ? selectedVariant.discountPrice! : selectedVariant.price) : 0;

  const handleAddToCart = async () => {
    if (!isUser) {
      openLoginModal({ onAuthenticated: async () => {
        try { await addProduct(product._id, 1, selectedVariant?._id); setIsVariantDialogOpen(false); }
        catch (error) { console.error("Failed to add product to cart:", error); }
      } });
      return;
    }

    try {
      setIsUpdating(true);
      await addProduct(product._id, 1, selectedVariant?._id);
      setVariantFeedback("Added to cart");
      setIsVariantDialogOpen(false);
    } catch (error) {
      console.error("Failed to add product to cart:", error);
      setVariantFeedback(axios.isAxiosError(error) ? error.response?.data?.message || "Could not add this option." : "Could not add this option.");

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        openLoginModal({ onAuthenticated: async () => {
          try { await addProduct(product._id, 1); }
          catch (retryError) { console.error("Failed to add product to cart:", retryError); }
        } });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDecrease = async () => {
    if (quantity <= 0 || isUpdating) return;

    try {
      setIsUpdating(true);

      if (quantity === 1) {
        await removeProduct(product._id);
      } else {
      await updateProductQuantity(product._id, quantity - 1, selectedVariant?._id);
      }
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
      await updateProductQuantity(product._id, quantity + 1, selectedVariant?._id);
    } catch (error) {
      console.error("Failed to increase product quantity:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRetryCart = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      await refreshCart();
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
    <article className={`product-card${variant ? ` product-card--${variant}` : ""}${!hasStock ? " product-card--unavailable" : ""}`}>
      <Link to={`/products/${product._id}`} className="product-card-main">
        <div className="product-card-image-wrapper">
          <img
            src={product.image}
            alt={product.name}
            className="product-card-image"
            onError={(event) => {
              event.currentTarget.hidden = true;
              event.currentTarget.nextElementSibling?.classList.add("product-card-image-fallback--visible");
            }}
          />
          <span className="product-card-image-fallback" aria-hidden="true">Image unavailable</span>

      {selectedVariant && selectedVariant.stock <= 5 && selectedVariant.stock > 0 && (
            <span className="low-stock-badge">Only {selectedVariant.stock} left</span>
          )}

          {!hasStock && (
            <span className="out-stock-badge">Out of Stock</span>
          )}
        </div>

        <div className="product-card-content">
          <h3 className="product-card-name">{product.name}</h3>
          {selectedVariant && <p className="product-card-variant-default">{selectedVariant.quantity} {selectedVariant.unit}</p>}
          {description && <p className="product-card-description">{description}</p>}
        </div>
      </Link>

      <div className="product-card-footer">
        <div className="product-card-prices">
          <span className="product-card-price">₹{sellingPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>

          {hasDiscount && (
            <span className="product-card-old-price">
              ₹{product.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </span>
          )}
        </div>

        {hasStock ? (
          isUser && !isCartReady ? (
            cartError ? (
              <button type="button" className="product-add-button" onClick={handleRetryCart} disabled={isUpdating}>
                {isUpdating ? "..." : "Retry"}
              </button>
            ) : (
              <button type="button" className="product-add-button" disabled aria-label="Loading cart">
                {isCartLoading ? "..." : "..."}
              </button>
            )
          ) : quantity > 0 && availableVariants.length <= 1 ? (
            <div
              className="product-quantity-control"
              aria-label="Product quantity"
            >
              <button
                type="button"
                className="product-quantity-button"
                onClick={handleDecrease}
                disabled={isUpdating}
                aria-label={`Decrease ${product.name} quantity`}
              >
                −
              </button>

              <span className="product-quantity-value">{quantity}</span>

              <button
                type="button"
                className="product-quantity-button"
                onClick={handleIncrease}
                disabled={isUpdating || !selectedVariant || quantity >= selectedVariant.stock}
                aria-label={`Increase ${product.name} quantity`}
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="product-add-button"
              onClick={() => availableVariants.length ? setIsVariantDialogOpen(true) : void handleAddToCart()}
              disabled={isUpdating}
            >
              {isUpdating ? "..." : "ADD"}
            </button>
          )
        ) : (
          <span className="product-unavailable">Unavailable</span>
        )}
        {availableVariants.length > 0 && <div className="product-card-variant-options">{availableVariants.filter((item) => item._id !== selectedVariant?._id).map((item) => <button type="button" key={item._id} disabled={item.stock <= 0} onClick={() => { setSelectedVariantId(item._id); setVariantFeedback(""); }}>{item.quantity} {item.unit}</button>)}</div>}
        {variantFeedback && !isVariantDialogOpen && <small className="product-variant-feedback" role="status">{variantFeedback}</small>}
      </div>
    </article>
    {isVariantDialogOpen && createPortal(
      <div className="product-variant-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsVariantDialogOpen(false); }}>
        <section className="product-variant-dialog" role="dialog" aria-modal="true" aria-labelledby={`variant-title-${product._id}`}>
          <button className="product-variant-close" type="button" onClick={() => setIsVariantDialogOpen(false)} aria-label="Close">{"\u00D7"}</button>
          <h3 id={`variant-title-${product._id}`}>{product.name}</h3>
          <p>Choose an option</p>
          {availableVariants.map((item) => <button type="button" key={item._id} className={`product-variant-choice${item._id === selectedVariant?._id ? " selected" : ""}`} disabled={item.stock <= 0} onClick={() => { setSelectedVariantId(item._id); setVariantFeedback(""); }}><span>{item.quantity} {item.unit}</span><strong>{"\u20B9"}{item.price.toLocaleString("en-IN")}</strong><small>{item.stock > 0 ? `${item.stock} available` : "Out of stock"}</small></button>)}
          {variantFeedback && <p className="product-variant-error" role="alert">{variantFeedback}</p>}
          <button type="button" className="product-variant-add" disabled={!selectedVariant || isUpdating} onClick={() => void handleAddToCart()}>{isUpdating ? "Adding..." : "Add to Cart"}</button>
        </section>
      </div>,
      document.body,
    )}
    </>
  );
};

export default ProductCard;

import axios from "axios";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAppSelector } from "../../hooks/reduxHooks";
import { useCart } from "../../context/useCart";

import type { Product } from "../../types/product";

import "./ProductCard.css";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const { getQuantity, addProduct, updateProductQuantity, removeProduct } =
    useCart();

  const [isUpdating, setIsUpdating] = useState(false);

  const quantity = getQuantity(product._id);
  const isUser = isAuthenticated && user?.role === "user";
  const hasStock = product.stock > 0;

  const categoryName =
    typeof product.category === "string" ? "" : product.category.name;

  const handleAddToCart = async () => {
    if (!isUser) {
      navigate("/login", {
        state: {
          from: location.pathname + location.search,
        },
      });
      return;
    }

    try {
      setIsUpdating(true);
      await addProduct(product._id, 1);
    } catch (error) {
      console.error("Failed to add product to cart:", error);

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        navigate("/login", {
          state: {
            from: location.pathname + location.search,
          },
        });
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
        await updateProductQuantity(product._id, quantity - 1);
      }
    } catch (error) {
      console.error("Failed to decrease product quantity:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleIncrease = async () => {
    if (quantity >= product.stock || isUpdating) return;

    try {
      setIsUpdating(true);
      await updateProductQuantity(product._id, quantity + 1);
    } catch (error) {
      console.error("Failed to increase product quantity:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <article className="product-card">
      <Link to={`/products/${product._id}`} className="product-card-main">
        <div className="product-card-image-wrapper">
          <img
            src={product.image}
            alt={product.name}
            className="product-card-image"
          />

          {product.stock <= 5 && product.stock > 0 && (
            <span className="low-stock-badge">Only {product.stock} left</span>
          )}

          {product.stock === 0 && (
            <span className="out-stock-badge">Out of Stock</span>
          )}
        </div>

        <div className="product-card-content">
          <p className="product-card-category">{categoryName}</p>

          <h3 className="product-card-name">{product.name}</h3>

          <p className="product-card-description">{product.description}</p>
        </div>
      </Link>

      <div className="product-card-footer">
        <div className="product-card-prices">
          <span className="product-card-price">₹{product.price}</span>

          {product.discountPrice && product.discountPrice > product.price && (
            <span className="product-card-old-price">
              ₹{product.discountPrice}
            </span>
          )}
        </div>

        {hasStock ? (
          quantity > 0 ? (
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
                disabled={isUpdating || quantity >= product.stock}
                aria-label={`Increase ${product.name} quantity`}
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="product-add-button"
              onClick={handleAddToCart}
              disabled={isUpdating}
            >
              {isUpdating ? "..." : "ADD"}
            </button>
          )
        ) : (
          <span className="product-unavailable">Unavailable</span>
        )}
      </div>
    </article>
  );
};

export default ProductCard;

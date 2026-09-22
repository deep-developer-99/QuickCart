import axios from "axios";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getProductById } from "../../services/productService";
import { addToCart } from "../../services/cartService";

import type { Product } from "../../types/product";

import "./ProductDetails.css";

const ProductDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) {
        setError("Product ID is missing.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");

        const response = await getProductById(id);

        if (response?.success && response?.data) {
          setProduct(response.data);
        } else {
          setError("Product not found.");
        }
      } catch (error) {
        console.error("Failed to fetch product:", error);

        setError(
          axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : "Failed to load product. Please try again.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleDecrease = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const handleIncrease = () => {
    if (!product) return;

    setQuantity((prev) => Math.min(product.stock, prev + 1));
  };

  const handleAddToCart = async () => {
    if (!product) return;

    try {
      setIsAdding(true);
      setError("");
      setSuccess("");

      const response = await addToCart(product._id, quantity);

      if (response?.success) {
        setSuccess("Product added to cart successfully.");
      } else {
        setError(response?.message || "Failed to add product to cart.");
      }
    } catch (error) {
      console.error("Add to cart error:", error);

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        navigate("/login", {
          state: {
            from: `/products/${product._id}`,
          },
        });
        return;
      }

      setError(
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Failed to add product to cart.",
      );
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <section className="product-details-page">
        <div className="product-details-loading">
          <div className="product-details-spinner"></div>
          <p>Loading product...</p>
        </div>
      </section>
    );
  }

  if (error && !product) {
    return (
      <section className="product-details-page">
        <div className="product-details-error">
          <h2>Product Not Found</h2>
          <p>{error}</p>

          <Link to="/" className="back-products-button">
            Back to Products
          </Link>
        </div>
      </section>
    );
  }

  if (!product) {
    return null;
  }

  const categoryName =
    typeof product.category === "string" ? "" : product.category?.name || "";

  const shopName =
    typeof product.vendor === "string" ? "" : product.vendor?.shopName || "";

  const hasDiscount =
    product.discountPrice !== undefined &&
    product.discountPrice < product.price;

  const finalPrice = hasDiscount ? product.discountPrice! : product.price;

  const discountPercentage = hasDiscount
    ? Math.round(
        ((product.price - product.discountPrice!) / product.price) * 100,
      )
    : 0;

  return (
    <section className="product-details-page">
      <div className="product-details-container">
        <Link to="/" className="product-details-back">
          ← Back to Products
        </Link>

        <div className="product-details-card">
          {/* Product Image */}
          <div className="product-details-image-section">
            <div className="product-details-image-wrapper">
              <img
                src={product.image}
                alt={product.name}
                className="product-details-image"
              />

              {hasDiscount && (
                <span className="product-discount-badge">
                  {discountPercentage}% OFF
                </span>
              )}
            </div>
          </div>

          {/* Product Information */}
          <div className="product-details-content">
            {categoryName && (
              <p className="product-details-category">{categoryName}</p>
            )}

            <h1>{product.name}</h1>

            {shopName && (
              <p className="product-details-vendor">
                Sold by <strong>{shopName}</strong>
              </p>
            )}

            <div className="product-details-price">
              <span className="current-price">₹{finalPrice}</span>

              {hasDiscount && (
                <span className="original-price">₹{product.price}</span>
              )}
            </div>

            <div className="product-details-stock">
              {product.stock > 0 ? (
                <>
                  <span className="stock-dot"></span>
                  {product.stock <= 5
                    ? `Only ${product.stock} left in stock`
                    : "In stock"}
                </>
              ) : (
                <span className="out-of-stock-text">Out of stock</span>
              )}
            </div>

            <div className="product-details-divider"></div>

            <div className="product-description">
              <h2>Description</h2>
              <p>{product.description}</p>
            </div>

            {product.stock > 0 && (
              <div className="product-purchase-section">
                <div className="quantity-section">
                  <span>Quantity</span>

                  <div className="quantity-controls">
                    <button
                      type="button"
                      onClick={handleDecrease}
                      disabled={quantity <= 1}
                    >
                      −
                    </button>

                    <span>{quantity}</span>

                    <button
                      type="button"
                      onClick={handleIncrease}
                      disabled={quantity >= product.stock}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="purchase-total">
                  Total: <strong>₹{finalPrice * quantity}</strong>
                </div>

                <button
                  type="button"
                  className="add-to-cart-button"
                  onClick={handleAddToCart}
                  disabled={isAdding}
                >
                  {isAdding ? "Adding..." : "🛒 Add to Cart"}
                </button>

                {success && (
                  <div className="product-success-message">{success}</div>
                )}

                {error && <div className="product-error-message">{error}</div>}
              </div>
            )}

            {product.stock === 0 && (
              <button
                type="button"
                className="add-to-cart-button disabled-button"
                disabled
              >
                Out of Stock
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductDetails;

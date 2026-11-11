import axios from "axios";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import ProductCard from "../../components/user/ProductCard";
import { useCart } from "../../context/useCart";
import { useLoginModal } from "../../context/LoginModalContext";
import { useAppSelector } from "../../hooks/reduxHooks";
import { getProductById, getProducts } from "../../services/productService";
import type { Product } from "../../types/product";

import "./ProductDetails.css";

const ProductDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { addProduct, getQuantity, updateProductQuantity, removeProduct } = useCart();
  const { openLoginModal } = useLoginModal();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [isUpdatingQuantity, setIsUpdatingQuantity] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let current = true;
    const fetchProduct = async () => {
      if (!id) {
        setError("Product ID is missing.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        setSuccess("");
        const response = await getProductById(id);
        if (!current) return;
        if (response?.success && response?.data) {
          setProduct(response.data as Product);
          setSelectedImage(response.data.image || "");
          setIsDetailsExpanded(false);
        } else {
          setProduct(null);
          setError("Product not found.");
        }
      } catch (requestError) {
        if (!current) return;
        console.error("Failed to fetch product:", requestError);
        setProduct(null);
        setError(
          axios.isAxiosError(requestError) && requestError.response?.data?.message
            ? requestError.response.data.message
            : "Failed to load product. Please try again.",
        );
      } finally {
        if (current) setIsLoading(false);
      }
    };

    void fetchProduct();
    return () => { current = false; };
  }, [id]);

  useEffect(() => {
    if (!product) return;
    const categoryId = typeof product.category === "string"
      ? product.category
      : product.category?._id;
    if (!categoryId) {
      setSimilarProducts([]);
      return;
    }

    let current = true;
    const subCategoryId = typeof product.subCategory === "string"
      ? product.subCategory
      : product.subCategory?._id;
    getProducts(undefined, categoryId, 1, 12, subCategoryId || undefined)
      .then((response) => {
        if (!current) return;
        const products = Array.isArray(response?.data) ? response.data as Product[] : [];
        setSimilarProducts(products.filter((item) => item._id !== product._id));
      })
      .catch((requestError: unknown) => {
        if (!current) return;
        console.warn("Failed to load similar products:", requestError);
        setSimilarProducts([]);
      });

    return () => { current = false; };
  }, [product]);

  const cartQuantity = product ? getQuantity(product._id) : 0;

  const handleDecrease = async () => {
    if (!product || cartQuantity <= 0 || isUpdatingQuantity) return;
    try {
      setIsUpdatingQuantity(true);
      setError("");
      if (cartQuantity === 1) await removeProduct(product._id);
      else await updateProductQuantity(product._id, cartQuantity - 1);
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) && requestError.response?.data?.message
        ? requestError.response.data.message
        : "Failed to update product quantity.");
    } finally {
      setIsUpdatingQuantity(false);
    }
  };

  const handleIncrease = async () => {
    if (!product || cartQuantity >= product.stock || isUpdatingQuantity) return;
    try {
      setIsUpdatingQuantity(true);
      setError("");
      await updateProductQuantity(product._id, cartQuantity + 1);
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) && requestError.response?.data?.message
        ? requestError.response.data.message
        : "Failed to update product quantity.");
    } finally {
      setIsUpdatingQuantity(false);
    }
  };

  const handleAddToCart = async () => {
    if (!product || product.stock <= 0) return;
    const isUser = isAuthenticated && user?.role === "user";
    if (!isUser) {
      openLoginModal({
        onAuthenticated: async () => {
          try {
            await addProduct(product._id, 1);
            setSuccess("Product added to cart successfully.");
          } catch (requestError) {
            setError(axios.isAxiosError(requestError) && requestError.response?.data?.message
              ? requestError.response.data.message
              : "Failed to add product to cart.");
          }
        },
      });
      return;
    }

    try {
      setIsAdding(true);
      setError("");
      setSuccess("");
      await addProduct(product._id, 1);
      setSuccess("Product added to cart successfully.");
    } catch (requestError) {
      console.error("Add to cart error:", requestError);
      if (axios.isAxiosError(requestError) && requestError.response?.status === 401) {
        openLoginModal({
          onAuthenticated: async () => {
            try {
              await addProduct(product._id, 1);
              setSuccess("Product added to cart successfully.");
            } catch (retryError) {
              setError(axios.isAxiosError(retryError) && retryError.response?.data?.message
                ? retryError.response.data.message
                : "Failed to add product to cart.");
            }
          },
        });
        return;
      }
      setError(axios.isAxiosError(requestError) && requestError.response?.data?.message
        ? requestError.response.data.message
        : "Failed to add product to cart.");
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <section className="product-details-page">
        <div className="product-details-loading">
          <div className="product-details-spinner" />
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
          <Link to="/" className="back-products-button">Back to Products</Link>
        </div>
      </section>
    );
  }

  if (!product) return null;

  const categoryName = typeof product.category === "string" ? "" : product.category?.name || "";
  const subCategoryName = typeof product.subCategory === "string" ? "" : product.subCategory?.name || "";
  const shopName = typeof product.vendor === "string" ? "" : product.vendor?.shopName || "";
  const hasDiscount = product.discountPrice !== undefined && product.discountPrice < product.price;
  const finalPrice = hasDiscount ? product.discountPrice! : product.price;
  const discountPercentage = hasDiscount
    ? Math.round(((product.price - product.discountPrice!) / product.price) * 100)
    : 0;
  const galleryImages = product.image ? [product.image] : [];

  return (
    <section className="product-details-page">
      <div className="product-details-container">
        <Link to="/" className="product-details-back">← Back to Products</Link>

        <div className="product-details-main">
          <div className="product-details-grid">
            <div className="product-details-left-column">
              <div className="product-details-gallery">
                <div className="product-details-image-wrapper">
                  {selectedImage && (
                    <img
                      src={selectedImage}
                      alt={product.name}
                      className="product-details-image"
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                        event.currentTarget.nextElementSibling?.classList.add("product-details-image-fallback--visible");
                      }}
                    />
                  )}
                  <span className="product-details-image-fallback" aria-hidden="true">Image unavailable</span>
                  {hasDiscount && <span className="product-discount-badge">{discountPercentage}% OFF</span>}
                </div>
                {galleryImages.length > 0 && (
                  <div className="product-details-thumbnails" aria-label="Product images">
                    {galleryImages.map((image, index) => (
                      <button
                        type="button"
                        key={`${image}-${index}`}
                        className={`product-details-thumbnail${selectedImage === image ? " active" : ""}`}
                        onClick={() => setSelectedImage(image)}
                        aria-label={`Show product image ${index + 1}`}
                        aria-pressed={selectedImage === image}
                      >
                        <img src={image} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <section className="product-detail-specifications" aria-labelledby="product-detail-specifications-title">
                <div className="product-detail-section-heading">
                  <h2 id="product-detail-specifications-title">Product Details</h2>
                  {categoryName && <span>{categoryName}</span>}
                </div>
                <div className={`product-detail-description${isDetailsExpanded ? " expanded" : ""}`}>
                  <div className="product-detail-description-inner">
                    <p>{product.description || "No product description is available."}</p>
                    {isDetailsExpanded && (
                      <dl className="product-detail-attributes">
                        {categoryName && <div><dt>Category</dt><dd>{categoryName}</dd></div>}
                        {subCategoryName && <div><dt>Type</dt><dd>{subCategoryName}</dd></div>}
                        {shopName && <div><dt>Sold by</dt><dd>{shopName}</dd></div>}
                        <div><dt>Availability</dt><dd>{product.stock > 0 ? "In stock" : "Out of stock"}</dd></div>
                      </dl>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="product-details-toggle"
                  onClick={() => setIsDetailsExpanded((expanded) => !expanded)}
                  aria-expanded={isDetailsExpanded}
                >
                  {isDetailsExpanded ? "View less details" : "View more details"}
                  <span aria-hidden="true">{isDetailsExpanded ? "↑" : "↓"}</span>
                </button>
              </section>
            </div>

            <aside className="product-details-content">
              {categoryName && <p className="product-details-category">{categoryName}</p>}
              <h1>{product.name}</h1>
              {shopName && <p className="product-details-vendor">Sold by <strong>{shopName}</strong></p>}
              <div className="product-summary-purchase-row">
                <div className="product-summary-price-block">
                  <div className="product-details-price">
                    <span className="current-price">{"\u20B9"}{finalPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                    {hasDiscount && <span className="original-price">{"\u20B9"}{product.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>}
                    {hasDiscount && <span className="product-details-discount">{discountPercentage}% off</span>}
                  </div>
                  <small>Inclusive of all taxes</small>
                </div>
                {product.stock <= 0 ? (
                  <button type="button" className="add-to-cart-button disabled-button" disabled>Out of Stock</button>
                ) : cartQuantity > 0 ? (
                  <div className="product-cart-stepper" aria-label={`${cartQuantity} in cart`}>
                    <button type="button" onClick={() => void handleDecrease()} disabled={isUpdatingQuantity} aria-label="Decrease quantity">−</button>
                    <span aria-live="polite">{cartQuantity}</span>
                    <button type="button" onClick={() => void handleIncrease()} disabled={isUpdatingQuantity || cartQuantity >= product.stock} aria-label="Increase quantity">+</button>
                  </div>
                ) : (
                  <button type="button" className="add-to-cart-button" onClick={handleAddToCart} disabled={isAdding}>
                    {isAdding ? "Adding..." : "Add to Cart"}
                  </button>
                )}
              </div>
              <div className="product-details-stock">
                {product.stock > 0 ? <><span className="stock-dot" />{product.stock <= 5 ? `Only ${product.stock} left in stock` : "In stock"}</> : <span className="out-of-stock-text">Out of stock</span>}
              </div>
              {product.stock > 0 && (
                <div className="product-purchase-section">
                  {cartQuantity > 0 && <div className="purchase-total">Total: <strong>{"\u20B9"}{(finalPrice * cartQuantity).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div>}
                  {success && <div className="product-success-message" role="status">{success}</div>}
                  {error && <div className="product-error-message" role="alert">{error}</div>}
                </div>
              )}
              <section className="product-shopping-info" aria-label="Shopping information">
                <div><span aria-hidden="true">?</span><p><strong>Delivery information</strong><small>Delivery options and charges are confirmed at checkout.</small></p></div>
                <h2>Why shop from QuickCart?</h2>
                <div><span aria-hidden="true">?</span><p><strong>Best prices &amp; offers</strong><small>Find great value across our product range.</small></p></div>
                <div><span aria-hidden="true">?</span><p><strong>Wide assortment</strong><small>Explore products from local sellers.</small></p></div>
              </section>
            </aside>
          </div>
        </div>

        {similarProducts.length > 0 && (
          <section className="product-details-similar" aria-labelledby="similar-products-title">
            <header><h2 id="similar-products-title">Similar Products</h2></header>
            <div className="product-details-similar-track">
              {similarProducts.map((similarProduct) => (
                <div className="product-details-similar-card" key={similarProduct._id}>
                  <ProductCard product={similarProduct} variant="compact" />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
};

export default ProductDetails;

import { Link } from "react-router-dom";

import type { Product } from "../../types/product";

import "./ProductCard.css";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const categoryName =
    typeof product.category === "string" ? "" : product.category.name;

  return (
    <Link to={`/products/${product._id}`} className="product-card">
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

        <div className="product-card-bottom">
          <div className="product-card-prices">
            <span className="product-card-price">₹{product.price}</span>

            {product.discountPrice && product.discountPrice > product.price && (
              <span className="product-card-old-price">
                ₹{product.discountPrice}
              </span>
            )}
          </div>

          <span className="product-card-unit">
            {product.stock > 0 ? "Available" : "Unavailable"}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;

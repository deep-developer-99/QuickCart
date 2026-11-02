import type { CartItem as CartItemType } from "../../types/cart";

import "./CartItem.css";

interface CartItemProps {
  item: CartItemType;
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

const CartItem = ({ item, onQuantityChange, onRemove }: CartItemProps) => {
  const { product, quantity } = item;
  const hasProductDetails = typeof product !== "string";
  const productId = hasProductDetails ? product._id : product;

  return (
    <div className="cart-item-card">
      <div className="cart-item-image-wrapper">
        {hasProductDetails ? <img src={product.image} alt={product.name} /> : <span aria-hidden="true">🛒</span>}
      </div>

      <div className="cart-item-info">
        <h3>{hasProductDetails ? product.name : "Product"}</h3>

        {hasProductDetails && <p className="cart-item-price">
          {product.discountPrice !== undefined && product.discountPrice < product.price && (
            <>
              <span className="cart-item-original-price">₹{product.price}</span>
              <span className="cart-item-discount">Save {Math.round(((product.price - product.discountPrice) / product.price) * 100)}%</span>
            </>
          )}
          <strong>₹{product.discountPrice ?? product.price}</strong>
        </p>}

        <div className="cart-item-actions">
          <div className="cart-quantity-control">
            <button
              type="button"
              onClick={() => onQuantityChange(productId, quantity - 1)}
              disabled={quantity <= 0}
            >
              −
            </button>

            <span>{quantity}</span>

            <button
              type="button"
              onClick={() => onQuantityChange(productId, quantity + 1)}
              disabled={hasProductDetails && quantity >= product.stock}
            >
              +
            </button>
          </div>

          <button
            type="button"
            className="cart-remove-button"
            onClick={() => onRemove(productId)}
          >
            Remove
          </button>
        </div>
      </div>

      {hasProductDetails && <div className="cart-item-total">
        ₹{(product.discountPrice ?? product.price) * quantity}
      </div>}
    </div>
  );
};

export default CartItem;

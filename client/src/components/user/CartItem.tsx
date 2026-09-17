import type { CartItem as CartItemType } from "../../types/cart";

import "./CartItem.css";

interface CartItemProps {
  item: CartItemType;
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

const CartItem = ({ item, onQuantityChange, onRemove }: CartItemProps) => {
  const { product, quantity } = item;

  return (
    <div className="cart-item-card">
      <div className="cart-item-image-wrapper">
        <img src={product.image} alt={product.name} />
      </div>

      <div className="cart-item-info">
        <h3>{product.name}</h3>

        <p className="cart-item-price">
          ₹{product.discountPrice ?? product.price}
        </p>

        <div className="cart-item-actions">
          <div className="cart-quantity-control">
            <button
              type="button"
              onClick={() => onQuantityChange(product._id, quantity - 1)}
              disabled={quantity <= 1}
            >
              −
            </button>

            <span>{quantity}</span>

            <button
              type="button"
              onClick={() => onQuantityChange(product._id, quantity + 1)}
              disabled={quantity >= product.stock}
            >
              +
            </button>
          </div>

          <button
            type="button"
            className="cart-remove-button"
            onClick={() => onRemove(product._id)}
          >
            Remove
          </button>
        </div>
      </div>

      <div className="cart-item-total">
        ₹{(product.discountPrice ?? product.price) * quantity}
      </div>
    </div>
  );
};

export default CartItem;

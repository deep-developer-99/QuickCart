import type { CartItem as CartItemType } from "../../types/cart";
import { getCartItemUnitPrice } from "../../utils/hasValidCartItems";
import { getVariantDiscountPercentage, hasVariantDiscount } from "../../utils/productPricing";
import "./CartItem.css";

interface CartItemProps {
  item: CartItemType;
  onQuantityChange: (productId: string, quantity: number, variantId?: string) => void;
  onRemove: (productId: string, variantId?: string) => void;
}

const CartItem = ({ item, onQuantityChange, onRemove }: CartItemProps) => {
  const { product, quantity } = item;
  const hasProductDetails = typeof product !== "string";
  const productId = hasProductDetails ? product._id : product;
  const variant = hasProductDetails && item.variantId ? product.variants?.find((entry) => entry._id === item.variantId) : undefined;
  const price = getCartItemUnitPrice(item);
  return <div className="cart-item-card">
    <div className="cart-item-image-wrapper">{hasProductDetails ? <img src={product.image} alt={product.name} /> : <span aria-hidden="true">🛒</span>}</div>
    <div className="cart-item-info">
      <h3>{hasProductDetails ? product.name : "Product"}</h3>
      {variant && <p className="cart-item-variant">{variant.quantity} {variant.unit}</p>}
      {hasProductDetails && <p className="cart-item-price"><strong>₹{price}</strong>{hasVariantDiscount(variant) && <> <del>₹{variant?.price}</del> <small>{getVariantDiscountPercentage(variant)}% off</small></>}</p>}
      <div className="cart-item-actions"><div className="cart-quantity-control">
        <button type="button" onClick={() => onQuantityChange(productId, quantity - 1, item.variantId)} aria-label="Decrease quantity">−</button>
        <span>{quantity}</span>
        <button type="button" onClick={() => onQuantityChange(productId, quantity + 1, item.variantId)} disabled={hasProductDetails && quantity >= (variant?.stock ?? 0)} aria-label="Increase quantity">+</button>
      </div><button type="button" className="cart-remove-button" onClick={() => onRemove(productId, item.variantId)}>Remove</button></div>
    </div>
    {hasProductDetails && <div className="cart-item-total">₹{price * quantity}</div>}
  </div>;
};

export default CartItem;

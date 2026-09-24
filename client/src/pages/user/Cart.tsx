import { useNavigate } from "react-router-dom";

import { useCart } from "../../context/useCart";

import CartItem from "../../components/user/CartItem";

import "./Cart.css";

const CartPage = () => {
  const navigate = useNavigate();
  const { cart, isLoading, updateProductQuantity, removeProduct } = useCart();

  if (isLoading && !cart) {
    return <div className="cart-message">Loading Cart.....</div>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="cart-empty">
        <h1>Your Cart is Empty</h1>

        <p>Looks like you haven't added anything to your cart yet.</p>

        <button type="button" onClick={() => navigate("/")}>
          Start Shopping
        </button>
      </div>
    );
  }

  const total = cart.items.reduce(
    (sum, item) =>
      sum + (item.product.discountPrice ?? item.product.price) * item.quantity,
    0,
  );

  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  const handleQuantityChange = async (productId: string, quantity: number) => {
    try {
      await updateProductQuantity(productId, quantity);
    } catch (error) {
      console.error("Failed to update quantity:", error);
    }
  };

  const handleRemove = async (productId: string) => {
    try {
      await removeProduct(productId);
    } catch (error) {
      console.error("Failed to remove item:", error);
    }
  };

  return (
    <div className="cart-page">
      <div className="cart-container">
        <div className="cart-heading">
          <p>QuickCart</p>
          <h1>Shopping Cart</h1>
        </div>

        <div className="cart-layout">
          <div className="cart-items">
            {cart.items.map((item) => (
              <CartItem
                key={item.product._id}
                item={item}
                onQuantityChange={handleQuantityChange}
                onRemove={handleRemove}
              />
            ))}
          </div>

          <aside className="cart-summary">
            <h2>Order Summary</h2>

            <div className="summary-row">
              <span>Total Items</span>
              <span>{totalItems}</span>
            </div>

            <div className="summary-row">
              <span>Subtotal</span>
              <span>₹{total}</span>
            </div>

            <div className="summary-row">
              <span>Delivery</span>
              <span>FREE</span>
            </div>

            <div className="summary-row summary-total">
              <span>Total</span>
              <strong>₹{total}</strong>
            </div>

            <button
              type="button"
              className="checkout-button"
              onClick={() => navigate("/checkout")}
            >
              Proceed to Checkout
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CartPage;

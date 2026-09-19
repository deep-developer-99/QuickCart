import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  getCart,
  updateCartItem,
  removeCartItem,
} from "../../services/cartService";

import type { Cart } from "../../types/cart";

import CartItem from "../../components/user/CartItem";

import "./Cart.css";

const CartPage = () => {
  const navigate = useNavigate();

  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const quantityTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const loadCart = async () => {
    try {
      const response = await getCart();
      setCart(response.data);
    } catch (error) {
      console.error("Failed to load cart:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCart();

    return () => {
      quantityTimers.current.forEach((timer) => clearTimeout(timer));
      quantityTimers.current.clear();
    };
  }, []);

  const handleQuantityChange = (productId: string, quantity: number) => {
    if (quantity < 1) return;

    setCart((currentCart) => {
      if (!currentCart) return currentCart;

      return {
        ...currentCart,
        items: currentCart.items.map((item) =>
          item.product._id === productId ? { ...item, quantity } : item,
        ),
      };
    });

    const existingTimer = quantityTimers.current.get(productId);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      try {
        await updateCartItem(productId, quantity);
      } catch (error) {
        console.error("Failed to update quantity:", error);
        await loadCart();
      } finally {
        quantityTimers.current.delete(productId);
      }
    }, 300);

    quantityTimers.current.set(productId, timer);
  };

  const handleRemove = async (productId: string) => {
    const existingTimer = quantityTimers.current.get(productId);

    if (existingTimer) {
      clearTimeout(existingTimer);
      quantityTimers.current.delete(productId);
    }

    try {
      await removeCartItem(productId);

      setCart((currentCart) => {
        if (!currentCart) return currentCart;

        return {
          ...currentCart,
          items: currentCart.items.filter(
            (item) => item.product._id !== productId,
          ),
        };
      });
    } catch (error) {
      console.error("Failed to remove item:", error);
      await loadCart();
    }
  };

  if (isLoading) {
    return <div className="cart-message">Loading Cart.....</div>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="cart-empty">
        <h1>Your Cart is Empty</h1>

        <p>Looks like you haven't added anything to your cart yet.</p>

        <Link to="/products">Start Shopping</Link>
      </div>
    );
  }

  const total = cart.items.reduce(
    (sum, item) =>
      sum + (item.product.discountPrice ?? item.product.price) * item.quantity,
    0,
  );

  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

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

import { useNavigate } from "react-router-dom";

import { useState, useEffect } from "react";

import { getCart } from "../../services/cartService";

import { createAddress, getAddresses } from "../../services/addressService";
import { createOrder } from "../../services/orderService";

import type { Address, CreateAddressData } from "../../types/address";
import type { Cart } from "../../types/cart";

import "./Checkout.css";

const Checkout = () => {
  const navigate = useNavigate();

  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);

  const [selectedAddress, setSelectedAddress] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<"COD" | "RAZORPAY_FAKE">(
    "COD",
  );

  const [showAddressForm, setShowAddressForm] = useState(false);

  const [addressForm, setAddressForm] = useState<CreateAddressData>({
    fullName: "",
    phone: "",
    addressLine: "",
    city: "",
    state: "",
    pincode: "",
    isDefault: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadCheckout = async () => {
      try {
        const [cartResponse, addressResponse] = await Promise.all([
          getCart(),
          getAddresses(),
        ]);

        const cartData = cartResponse.data;
        const addressData = addressResponse.data || [];

        setCart(cartData);
        setAddresses(addressData);

        const defaultAddress = addressData.find(
          (address: Address) => address.isDefault,
        );

        if (defaultAddress) {
          setSelectedAddress(defaultAddress._id);
        }
      } catch (error) {
        console.error("Failed to load checkout:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCheckout();
  }, []);

  const handleAddressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setAddressForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleCreateAddress = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    try {
      const response = await createAddress(addressForm);

      const newAddress = response.data;

      setAddresses((previous) => [...previous, newAddress]);

      setSelectedAddress(newAddress._id);
      setShowAddressForm(false);

      setAddressForm({
        fullName: "",
        phone: "",
        addressLine: "",
        city: "",
        state: "",
        pincode: "",
        isDefault: false,
      });
    } catch (error) {
      console.error("Failed to create address:", error);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      alert("Please select a delivery address.");
      return;
    }

    if (!cart || cart.items.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    try {
      setIsSubmitting(true);

      await createOrder(selectedAddress, paymentMethod);

      navigate("/order-confirmation");
    } catch (error) {
      console.error("Failed to place order:", error);
      alert("Failed to place order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="checkout-message">Loading checkout...</div>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="checkout-message">
        <h2>Your cart is empty.</h2>
      </div>
    );
  }

  const total = cart.items.reduce(
    (sum, item) =>
      sum + (item.product.discountPrice ?? item.product.price) * item.quantity,
    0,
  );

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <div className="checkout-heading">
          <p>QUICKCART</p>
          <h1>Checkout</h1>
        </div>

        <div className="checkout-layout">
          <div className="checkout-main">
            {/* Address */}
            <section className="checkout-section">
              <div className="checkout-section-header">
                <h2>Delivery Address</h2>

                <button
                  type="button"
                  onClick={() => setShowAddressForm((previous) => !previous)}
                >
                  {showAddressForm ? "Cancel" : "+ Add Address"}
                </button>
              </div>

              {showAddressForm && (
                <form className="address-form" onSubmit={handleCreateAddress}>
                  <input
                    name="fullName"
                    placeholder="Full Name"
                    value={addressForm.fullName}
                    onChange={handleAddressChange}
                    required
                  />

                  <input
                    name="phone"
                    placeholder="Phone"
                    value={addressForm.phone}
                    onChange={handleAddressChange}
                    required
                  />

                  <input
                    name="addressLine"
                    placeholder="Address"
                    value={addressForm.addressLine}
                    onChange={handleAddressChange}
                    required
                  />

                  <div className="address-form-row">
                    <input
                      name="city"
                      placeholder="City"
                      value={addressForm.city}
                      onChange={handleAddressChange}
                      required
                    />

                    <input
                      name="state"
                      placeholder="State"
                      value={addressForm.state}
                      onChange={handleAddressChange}
                      required
                    />

                    <input
                      name="pincode"
                      placeholder="Pincode"
                      value={addressForm.pincode}
                      onChange={handleAddressChange}
                      required
                    />
                  </div>

                  <button type="submit">Save Address</button>
                </form>
              )}

              <div className="address-list">
                {addresses.length === 0 ? (
                  <p>No address found.</p>
                ) : (
                  addresses.map((address) => (
                    <label
                      key={address._id}
                      className={`address-card ${
                        selectedAddress === address._id ? "selected" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        value={address._id}
                        checked={selectedAddress === address._id}
                        onChange={(event) =>
                          setSelectedAddress(event.target.value)
                        }
                      />

                      <div>
                        <strong>{address.fullName}</strong>

                        <p>
                          {address.addressLine}, {address.city}, {address.state}{" "}
                          - {address.pincode}
                        </p>

                        <span>{address.phone}</span>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </section>

            {/* Payment */}
            <section className="checkout-section">
              <h2>Payment Method</h2>

              <label className="payment-option">
                <input
                  type="radio"
                  checked={paymentMethod === "COD"}
                  onChange={() => setPaymentMethod("COD")}
                />

                <div>
                  <strong>Cash on Delivery</strong>
                  <p>Pay when your order arrives.</p>
                </div>
              </label>

              <label className="payment-option">
                <input
                  type="radio"
                  checked={paymentMethod === "RAZORPAY_FAKE"}
                  onChange={() => setPaymentMethod("RAZORPAY_FAKE")}
                />

                <div>
                  <strong>Mock Razorpay Payment</strong>
                  <p>Demo payment for the assignment.</p>
                </div>
              </label>
            </section>
          </div>

          {/* Summary */}
          <aside className="checkout-summary">
            <h2>Order Summary</h2>

            {cart.items.map((item) => (
              <div className="checkout-item" key={item.product._id}>
                <span>
                  {item.product.name} × {item.quantity}
                </span>

                <strong>
                  ₹
                  {(item.product.discountPrice ?? item.product.price) *
                    item.quantity}
                </strong>
              </div>
            ))}

            <div className="checkout-total">
              <span>Total</span>
              <strong>₹{total}</strong>
            </div>

            <button
              type="button"
              className="place-order-button"
              onClick={handlePlaceOrder}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Placing Order..." : "Place Order"}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Checkout;

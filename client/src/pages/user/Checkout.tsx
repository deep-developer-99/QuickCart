import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import { getCart } from "../../services/cartService";
import { createAddress, getAddresses } from "../../services/addressService";
import {
  createOrder,
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../../services/orderService";

import type { Address, CreateAddressData } from "../../types/address";
import type { Cart } from "../../types/cart";

import { loadRazorpayScript } from "../../utils/razorpay";

import "./Checkout.css";

const Checkout = () => {
  const navigate = useNavigate();

  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<"COD" | "RAZORPAY">("COD");

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

    if (name === "phone") {
      const phone = value.replace(/\D/g, "").slice(0, 10);

      setAddressForm((previous) => ({
        ...previous,
        phone,
      }));

      return;
    }

    setAddressForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleCreateAddress = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!/^\d{10}$/.test(addressForm.phone)) {
      alert("Phone number must be exactly 10 digits.");
      return;
    }

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

      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.message || "Failed to save address.");
      } else {
        alert("Failed to save address.");
      }
    }
  };

  const handleCodOrder = async () => {
    try {
      setIsSubmitting(true);

      await createOrder(selectedAddress, "COD");

      navigate("/order-confirmation");
    } catch (error) {
      console.error("Failed to place COD order:", error);

      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.message || "Failed to place order.");
      } else {
        alert("Failed to place order.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRazorpayPayment = async () => {
    try {
      setIsSubmitting(true);

      const isLoaded = await loadRazorpayScript();

      if (!isLoaded) {
        throw new Error("Unable to load Razorpay Checkout.");
      }

      const response = await createRazorpayOrder(selectedAddress);

      if (!response?.success || !response?.data) {
        throw new Error(
          response?.message || "Failed to create Razorpay order.",
        );
      }

      const { keyId, razorpayOrderId, amount, currency } = response.data;
      const selectedAddressData = addresses.find(
        (address) => address._id === selectedAddress,
      );

      const razorpay = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        name: "QuickCart",
        description: "QuickCart Order",
        order_id: razorpayOrderId,
        prefill: {
          name: selectedAddressData?.fullName,
          contact: selectedAddressData?.phone,
        },
        theme: {
          color: "#3f8b43",
        },
        handler: async (paymentResponse) => {
          try {
            await verifyRazorpayPayment({
              addressId: selectedAddress,
              razorpayPaymentId: paymentResponse.razorpay_payment_id,
              razorpayOrderId: paymentResponse.razorpay_order_id,
              razorpaySignature: paymentResponse.razorpay_signature,
            });

            navigate("/order-confirmation");
          } catch (error) {
            console.error("Razorpay verification failed:", error);

            if (axios.isAxiosError(error)) {
              alert(
                error.response?.data?.message || "Payment verification failed.",
              );
            } else {
              alert("Payment verification failed.");
            }
          } finally {
            setIsSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsSubmitting(false);
          },
        },
      });

      razorpay.open();
    } catch (error) {
      console.error("Razorpay payment error:", error);

      if (axios.isAxiosError(error)) {
        alert(
          error.response?.data?.message || "Unable to start Razorpay payment.",
        );
      } else {
        alert(
          error instanceof Error
            ? error.message
            : "Unable to start Razorpay payment.",
        );
      }

      setIsSubmitting(false);
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

    if (paymentMethod === "COD") {
      await handleCodOrder();
      return;
    }

    await handleRazorpayPayment();
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
                    type="tel"
                    name="phone"
                    placeholder="Phone"
                    value={addressForm.phone}
                    maxLength={10}
                    inputMode="numeric"
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
                  checked={paymentMethod === "RAZORPAY"}
                  onChange={() => setPaymentMethod("RAZORPAY")}
                />

                <div>
                  <strong>Online Payment</strong>
                  <p>Pay securely using Razorpay.</p>
                </div>
              </label>
            </section>
          </div>

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
              {isSubmitting
                ? paymentMethod === "RAZORPAY"
                  ? "Opening Razorpay..."
                  : "Placing Order..."
                : paymentMethod === "RAZORPAY"
                  ? "Pay with Razorpay"
                  : "Place Order"}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Checkout;

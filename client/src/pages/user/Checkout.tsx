import { useEffect, useState } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import axios from "axios";

import { getCart } from "../../services/cartService";

import { createAddress, getAddresses } from "../../services/addressService";

import { detectCurrentLocation } from "../../services/locationService";
import AddressMap from "../../components/common/AddressMap";

import {
  createOrder,
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../../services/orderService";

import type { Address, CreateAddressData } from "../../types/address";

import type { Cart } from "../../types/cart";

import { loadRazorpayScript } from "../../utils/razorpay";

import { useAppSelector } from "../../hooks/reduxHooks";

import "./Checkout.css";

const normalizePhone = (phone?: string) => {
  if (!phone) {
    return "";
  }

  const digits = phone.replace(/\D/g, "");

  // Supports values such as +91XXXXXXXXXX as well as XXXXXXXXXX.
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const user = useAppSelector((state) => state.auth.user);

  const [cart, setCart] = useState<Cart | null>(null);

  const [addresses, setAddresses] = useState<Address[]>([]);

  const [selectedAddress, setSelectedAddress] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<"COD" | "RAZORPAY">("COD");

  const [showAddressForm, setShowAddressForm] = useState(
    Boolean(
      (location.state as { openAddressForm?: boolean } | null | undefined)
        ?.openAddressForm,
    ),
  );

  const [addressForm, setAddressForm] = useState<CreateAddressData>({
    fullName: user?.name || "",
    phone: normalizePhone(user?.phone),
    addressLine: "",
    city: "",
    state: "",
    pincode: "",
    latitude: undefined,
    longitude: undefined,
    isDefault: false,
  });

  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keep the address form in sync with the logged-in user.
  useEffect(() => {
    if (!user) {
      return;
    }

    setAddressForm((previous) => ({
      ...previous,
      fullName: previous.fullName || user.name || "",
      phone: previous.phone || normalizePhone(user.phone),
    }));
  }, [user]);

  // Load cart and saved addresses once when Checkout mounts.
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

  /*
   * Automatically detect the user's current location when the
   * address form is opened. This matches the Blinkit-style flow:
   * the map is immediately centered on the user's current position
   * without requiring a second "Go to current location" click.
   *
   * IMPORTANT:
   * - This only fills the address form.
   * - It does NOT create/save an address automatically.
   * - The user must still click "Save Address".
   */
  useEffect(() => {
    if (isLoading || !showAddressForm) {
      return;
    }

    let cancelled = false;

    const autoDetectLocation = async () => {
      setIsGettingLocation(true);

      try {
        const detected = await detectCurrentLocation();

        if (cancelled) {
          return;
        }

        setAddressForm((previous) => ({
          ...previous,
          fullName: previous.fullName || user?.name || "",
          phone: previous.phone || normalizePhone(user?.phone),
          addressLine: detected.address.addressLine,
          city: detected.address.city,
          state: detected.address.state,
          pincode: detected.address.pincode,
          latitude: detected.latitude,
          longitude: detected.longitude,
          // The default-address decision is made when the
          // user actually saves the address.
          isDefault: false,
        }));

        setLocationAccuracy(detected.accuracy);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Automatic current location detection failed:", error);

        /*
         * Do not close the form when permission is denied
         * or location cannot be determined. The user can
         * still manually enter the address or press the
         * "Detect My Location" button again.
         */
      } finally {
        if (!cancelled) {
          setIsGettingLocation(false);
        }
      }
    };

    autoDetectLocation();

    return () => {
      cancelled = true;
    };
  }, [isLoading, showAddressForm]);

  const handleGetCurrentLocation = async () => {
    try {
      setIsGettingLocation(true);

      const detected = await detectCurrentLocation();

      // Manual detection also only fills the form.
      // It does not save anything until Save Address is clicked.
      const formData: CreateAddressData = {
        fullName: user?.name || "",
        phone: normalizePhone(user?.phone),
        addressLine: detected.address.addressLine,
        city: detected.address.city,
        state: detected.address.state,
        pincode: detected.address.pincode,
        latitude: detected.latitude,
        longitude: detected.longitude,
        isDefault: addresses.length === 0,
      };

      // Detection only fills the form.
      // The address is saved only when the
      // user clicks "Save Address".
      setAddressForm(formData);

      setLocationAccuracy(detected.accuracy);

      setShowAddressForm(true);
    } catch (error) {
      console.error("Get current location error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Unable to get your current location.",
      );
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleMapLocationChange = (
    detected: Awaited<ReturnType<typeof detectCurrentLocation>>,
  ) => {
    setAddressForm((previous) => ({
      ...previous,
      addressLine: detected.address.addressLine,
      city: detected.address.city,
      state: detected.address.state,
      pincode: detected.address.pincode,
      latitude: detected.latitude,
      longitude: detected.longitude,
      isDefault: false,
    }));

    // The map location is manually selected, so GPS accuracy is no
    // longer the relevant value. The address text itself is updated
    // immediately after reverse geocoding finishes.
    setLocationAccuracy(null);
  };

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
      const dataToSave: CreateAddressData = {
        ...addressForm,
        isDefault: addresses.length === 0,
      };

      const response = await createAddress(dataToSave);

      const newAddress = response.data as Address;

      setAddresses((previous) => [...previous, newAddress]);

      setSelectedAddress(newAddress._id);

      setShowAddressForm(false);

      setAddressForm({
        fullName: user?.name || "",
        phone: normalizePhone(user?.phone),
        addressLine: "",
        city: "",
        state: "",
        pincode: "",
        latitude: undefined,
        longitude: undefined,
        isDefault: false,
      });

      setLocationAccuracy(null);
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
                  <AddressMap
                    latitude={addressForm.latitude}
                    longitude={addressForm.longitude}
                    onDetectLocation={handleGetCurrentLocation}
                    onLocationChange={handleMapLocationChange}
                    isDetecting={isGettingLocation}
                  />

                  <button
                    type="button"
                    className="current-location-button"
                    onClick={handleGetCurrentLocation}
                    disabled={isGettingLocation}
                  >
                    {isGettingLocation
                      ? "Detecting..."
                      : "📍 Detect My Location"}
                  </button>

                  {addressForm.latitude !== undefined &&
                    addressForm.longitude !== undefined && (
                      <div className="location-captured">
                        <strong>✓ Delivery location selected</strong>

                        {addressForm.addressLine && (
                          <span>{addressForm.addressLine}</span>
                        )}

                        <small>
                          {addressForm.city}
                          {addressForm.state ? `, ${addressForm.state}` : ""}
                          {addressForm.pincode
                            ? ` - ${addressForm.pincode}`
                            : ""}
                        </small>

                        {locationAccuracy !== null && locationAccuracy > 0 && (
                          <small>
                            GPS accuracy: approximately{" "}
                            {Math.round(locationAccuracy)}m
                          </small>
                        )}
                      </div>
                    )}

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

                        {address.latitude !== undefined &&
                          address.longitude !== undefined && (
                            <small className="address-location-info">
                              📍 Location saved
                            </small>
                          )}
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

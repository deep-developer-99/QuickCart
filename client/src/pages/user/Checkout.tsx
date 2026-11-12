import { useEffect, useRef, useState } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import axios from "axios";

import { getCart } from "../../services/cartService";
import { getCheckoutSummary } from "../../services/orderService";

import { createAddress, getAddresses, updateAddress } from "../../services/addressService";

import { detectCurrentLocation } from "../../services/locationService";
import AddressMap from "../../components/common/AddressMap";

import {
  createOrder,
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../../services/orderService";

import type { Address, CreateAddressData } from "../../types/address";

import type { Cart } from "../../types/cart";
import type { Order } from "../../types/order";
import type { CheckoutSummary } from "../../services/orderService";

import { loadRazorpayScript } from "../../utils/razorpay";
import { normalizeCartResponse } from "../../utils/normalizeCartResponse";
import { getCartSubtotal } from "../../utils/hasValidCartItems";

import { useAppSelector } from "../../hooks/reduxHooks";
import { useTheme } from "../../theme/ThemeContext";

import "./Checkout.css";

const normalizePhone = (phone?: string) => {
  if (!phone) {
    return "";
  }

  const digits = phone.replace(/\D/g, "");

  // Supports values such as +91XXXXXXXXXX as well as XXXXXXXXXX.
  return digits.length > 10 ? digits.slice(-10) : digits;
};

interface CheckoutProps {
  embedded?: boolean;
  initialSelectedAddress?: string;
  onBack?: () => void;
  onAddressChange?: (address: Address | undefined) => void;
  onOrderSuccess?: (order: Order | undefined, address: Address | undefined) => void;
}

const Checkout = ({ embedded = false, initialSelectedAddress, onBack, onAddressChange, onOrderSuccess }: CheckoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { colors } = useTheme();

  const user = useAppSelector((state) => state.auth.user);

  const [cart, setCart] = useState<Cart | null>(null);
  const [checkoutSummary, setCheckoutSummary] = useState<CheckoutSummary | null>(null);

  const [addresses, setAddresses] = useState<Address[]>([]);

  const [selectedAddress, setSelectedAddress] = useState(initialSelectedAddress || "");
  const [editingAddressId, setEditingAddressId] = useState("");
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [addressError, setAddressError] = useState("");
  const addressPickerRef = useRef<HTMLDivElement>(null);

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
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const submissionLockRef = useRef(false);
  const addressSaveLockRef = useRef(false);

  useEffect(() => {
    if (!showAddressPicker) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (addressPickerRef.current && !addressPickerRef.current.contains(event.target as Node)) {
        setShowAddressPicker(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowAddressPicker(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showAddressPicker]);

  // Load cart and saved addresses once when Checkout mounts.
  useEffect(() => {
    const loadCheckout = async () => {
      try {
        setAddressError("");
        const [cartResponse, addressResponse] = await Promise.all([
          getCart(),
          getAddresses(1, 50),
        ]);

        const cartData = normalizeCartResponse(cartResponse, user?.id ?? "");

        const addressData = addressResponse.data || [];

        setCart(cartData);
        setAddresses(addressData);

        try {
          const summaryResponse = await getCheckoutSummary();
          if (summaryResponse?.success && summaryResponse.data) {
            setCheckoutSummary(summaryResponse.data);
          }
        } catch (summaryError) {
          console.error("Failed to calculate checkout summary:", summaryError);
          setCheckoutError("The order total could not be calculated. Please review your cart and try again.");
        }

        const defaultAddress = addressData.find(
          (address: Address) => address.isDefault,
        );

        if (!initialSelectedAddress && defaultAddress) {
          setSelectedAddress(defaultAddress._id);
        }
      } catch (error) {
        console.error("Failed to load checkout:", error);
        setAddressError("Unable to load saved addresses.");
      } finally {
        setIsLoading(false);
      }
    };

    loadCheckout();
  }, [initialSelectedAddress, user?.id]);

  useEffect(() => {
    onAddressChange?.(addresses.find((address) => address._id === selectedAddress));
  }, [addresses, onAddressChange, selectedAddress]);

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
    if (isLoading || !showAddressForm || editingAddressId) {
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
  }, [editingAddressId, isLoading, showAddressForm, user?.name, user?.phone]);

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

  const startEditingAddress = (address: Address) => {
    setEditingAddressId(address._id);
    setAddressForm({
      fullName: address.fullName,
      phone: normalizePhone(address.phone),
      addressLine: address.addressLine,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      latitude: address.latitude,
      longitude: address.longitude,
      isDefault: address.isDefault,
    });
    setShowAddressPicker(false);
    setShowAddressForm(true);
  };

  const handleCreateAddress = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (addressSaveLockRef.current) return;

    if (!/^\d{10}$/.test(addressForm.phone)) {
      const message = "Phone number must be exactly 10 digits.";
      if (embedded) setCheckoutError(message);
      else alert(message);
      return;
    }

    addressSaveLockRef.current = true;
    setIsSavingAddress(true);
    try {
      const dataToSave: CreateAddressData = {
        ...addressForm,
        isDefault: addressForm.isDefault || addresses.length === 0,
      };

      const response = editingAddressId
        ? await updateAddress(editingAddressId, dataToSave)
        : await createAddress(dataToSave);

      const newAddress = response.data as Address;

      setAddresses((previous) => editingAddressId
        ? previous.map((address) => address._id === editingAddressId ? newAddress : address)
        : [...previous, newAddress]);

      setSelectedAddress(newAddress._id);
      setEditingAddressId("");
      setShowAddressPicker(false);

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
      setCheckoutError("");
    } catch (error) {
      console.error("Failed to create address:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || "Failed to save address."
        : error instanceof Error ? error.message : "Failed to save address.";
      if (embedded) setCheckoutError(message);
      else alert(message);
    } finally {
      addressSaveLockRef.current = false;
      setIsSavingAddress(false);
    }
  };

  const handleCodOrder = async () => {
    try {
      setIsSubmitting(true);

      const response = await createOrder(selectedAddress, "COD");
      if (embedded && onOrderSuccess) {
        onOrderSuccess(response?.data?.order as Order | undefined, addresses.find((address) => address._id === selectedAddress));
      } else {
        navigate("/order-confirmation");
      }
      setCheckoutError("");
    } catch (error) {
      console.error("Failed to place COD order:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || "Failed to place order."
        : error instanceof Error ? error.message : "Failed to place order.";
      if (embedded) setCheckoutError(message);
      else alert(message);
    } finally {
      setIsSubmitting(false);
      submissionLockRef.current = false;
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
          color: colors.primary,
        },
        handler: async (paymentResponse) => {
          try {
            const verified = await verifyRazorpayPayment({
              addressId: selectedAddress,
              razorpayPaymentId: paymentResponse.razorpay_payment_id,
              razorpayOrderId: paymentResponse.razorpay_order_id,
              razorpaySignature: paymentResponse.razorpay_signature,
            });

            if (embedded && onOrderSuccess) {
              onOrderSuccess(verified?.data?.order as Order | undefined, selectedAddressData);
            } else {
              navigate("/order-confirmation");
            }
            setCheckoutError("");
          } catch (error) {
            console.error("Razorpay verification failed:", error);
            const message = axios.isAxiosError(error)
              ? error.response?.data?.message || "Payment verification failed."
              : error instanceof Error ? error.message : "Payment verification failed.";
            if (embedded) setCheckoutError(message);
            else alert(message);
          } finally {
            setIsSubmitting(false);
            submissionLockRef.current = false;
          }
        },
        modal: {
          ondismiss: () => {
            setIsSubmitting(false);
            submissionLockRef.current = false;
          },
        },
      });

      razorpay.open();
    } catch (error) {
      console.error("Razorpay payment error:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || "Unable to start Razorpay payment."
        : error instanceof Error ? error.message : "Unable to start Razorpay payment.";
      if (embedded) setCheckoutError(message);
      else alert(message);

      setIsSubmitting(false);
      submissionLockRef.current = false;
    }
  };

  const handlePlaceOrder = async () => {
    if (submissionLockRef.current) return;
    if (!selectedAddress) {
      setCheckoutError("Please select a delivery address.");
      return;
    }

    if (!cart || cart.items.length === 0) {
      setCheckoutError("Your cart is empty.");
      return;
    }

    setCheckoutError("");
    submissionLockRef.current = true;
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

  const cartSubtotal = getCartSubtotal(cart.items) ?? 0;
  const subtotal = checkoutSummary?.subtotal ?? cartSubtotal;
  const shippingAmount = checkoutSummary?.shippingAmount;
  const total = checkoutSummary?.totalAmount;

  const selectedAddressData = addresses.find(
    (address) => address._id === selectedAddress,
  );

  return (
    <div className={`checkout-page${embedded ? " checkout-page--drawer" : ""}`}>
      <div className="checkout-container">
        <div className="checkout-heading">
          {embedded && onBack && (
            <button type="button" className="checkout-back-button" onClick={onBack} aria-label="Back to cart">←</button>
          )}
          <div>
            <p>QUICKCART</p>
            <h1>Checkout</h1>
          </div>
        </div>

        {checkoutError && <p className="checkout-flow-error" role="alert">{checkoutError}</p>}

        <div className="checkout-layout">
          <div className="checkout-main">
            <section className="checkout-section">
              <div className="checkout-section-header">
                <h2>Delivery Address</h2>

                <button
                  type="button"
                  onClick={() => {
                    setShowAddressForm((previous) => !previous);
                    setShowAddressPicker(false);
                    setEditingAddressId("");
                    setAddressForm({
                      fullName: user?.name || "",
                      phone: normalizePhone(user?.phone),
                      addressLine: "",
                      city: "",
                      state: "",
                      pincode: "",
                      latitude: undefined,
                      longitude: undefined,
                      isDefault: addresses.length === 0,
                    });
                  }}
                >
                  {showAddressForm ? "Cancel" : "+ Add Address"}
                </button>
              </div>

              {selectedAddressData ? (
                <div className="selected-address-summary">
                  <strong>{selectedAddressData.fullName}</strong>
                  <span>
                    {selectedAddressData.addressLine}, {selectedAddressData.city},{" "}
                    {selectedAddressData.state} - {selectedAddressData.pincode}
                  </span>
                  <small>{selectedAddressData.phone}</small>
                </div>
              ) : (
                <p className="no-selected-address">
                  No delivery address selected. Add or choose an address to continue.
                </p>
              )}

              <div className="address-picker" ref={addressPickerRef}>
                <button
                  type="button"
                  className="change-address-button"
                  onClick={() => {
                    setShowAddressPicker((previous) => !previous);
                    setShowAddressForm(false);
                  }}
                  aria-expanded={showAddressPicker}
                >
                  {showAddressPicker ? "Close Address List" : "Change Delivery Address"}
                </button>

                {showAddressPicker && (
                  <div className="address-list address-picker-panel">
                    {addressError ? (
                      <p className="address-picker-message error">{addressError}</p>
                    ) : addresses.length === 0 ? (
                      <div className="address-picker-message">
                        <p>No saved address found.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddressPicker(false);
                            setShowAddressForm(true);
                          }}
                        >
                          Add Address
                        </button>
                      </div>
                    ) : (
                      addresses.map((address) => (
                        <div
                          key={address._id}
                          className={`address-card compact-address-card ${
                            selectedAddress === address._id ? "selected" : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="address"
                            value={address._id}
                            checked={selectedAddress === address._id}
                            onChange={() => {
                              setSelectedAddress(address._id);
                              setShowAddressPicker(false);
                            }}
                          />
                          <div>
                            <strong>{address.isDefault ? "Home" : "Saved address"}</strong>
                            <span className="checkout-address-name">{address.fullName}</span>
                            <p>
                              {address.addressLine}, {address.city}, {address.state} -{" "}
                              {address.pincode}
                            </p>
                            <span>{address.phone}</span>
                          </div>
                          <button type="button" className="checkout-address-edit" onClick={() => startEditingAddress(address)}>Edit</button>
                        </div>
                      ))
                    )}
                  </div>
                )}
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

                  <button type="submit" disabled={isSavingAddress}>{isSavingAddress ? "Saving address…" : editingAddressId ? "Save changes" : "Save Address"}</button>
                </form>
              )}

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
              <div className="checkout-item" key={typeof item.product === "string" ? item.product : `${item.product._id}:${item.variantId ?? ""}`}>
                <span>
                  {typeof item.product === "string" ? "Product" : item.product.name} × {item.quantity}
                </span>

                {typeof item.product !== "string" && <strong>
                  ₹
                  {((item.variantId ? item.product.variants?.find((variant) => variant._id === item.variantId)?.price : undefined) ?? item.product.discountPrice ?? item.product.price) * item.quantity}
                </strong>}
              </div>
            ))}

            <div className="checkout-total checkout-subtotal">
              <span>Items total</span>
              <strong>₹{subtotal}</strong>
            </div>

            <div className="checkout-total checkout-shipping">
              <span>Delivery</span>
              <strong>{shippingAmount === undefined ? "Unavailable" : shippingAmount > 0 ? `₹${shippingAmount}` : "FREE"}</strong>
            </div>

            <div className="checkout-total">
              <span>Total</span>

              <strong>{total === undefined ? "Unavailable" : `₹${total}`}</strong>
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

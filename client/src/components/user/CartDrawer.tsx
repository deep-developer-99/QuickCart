import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

import { useCart } from "../../context/useCart";
import { useAppSelector } from "../../hooks/reduxHooks";
import { getCartProductId, getCartSubtotal, getValidCartItems, hasValidCartItems } from "../../utils/hasValidCartItems";
import { createAddress, getAddresses, updateAddress } from "../../services/addressService";
import type { Address, CreateAddressData } from "../../types/address";
import type { Order } from "../../types/order";
import CartItem from "./CartItem";
import Checkout from "../../pages/user/Checkout";
import AddressMap from "../common/AddressMap";
import { extractAddressComponents, getCurrentLocation, reverseGeocodeFromBackend, searchLocations, type DetectedLocation, type LocationSearchResult } from "../../services/locationService";

import "./CartDrawer.css";

type DrawerStage = "cart" | "address" | "checkout" | "success";

interface CartDrawerProps {
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

interface OrderSnapshot {
  order?: Order;
  address?: Address;
  cart: ReturnType<typeof useCart>["cart"];
  total: number;
}

const getAddressText = (address?: Address) => address
  ? [address.addressLine, address.city, address.state, address.pincode].filter(Boolean).join(", ")
  : "Add a delivery address to continue";

const CartDrawer = ({ isOpen, isClosing = false, onClose, onNavigate }: CartDrawerProps) => {
  const { cart, isLoading, isCartReady, updateProductQuantity, removeProduct } = useCart();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const isUser = isAuthenticated && user?.role === "user";
  const donationStorageKey = user?.id ? `quickcart-cart-donation:${user.id}` : "";
  const [stage, setStage] = useState<DrawerStage>("cart");
  const [address, setAddress] = useState<Address>();
  const selectedAddress = address?.user === user?.id ? address : undefined;
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [editingAddress, setEditingAddress] = useState<Address>();
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<DetectedLocation>();
  const [locationError, setLocationError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressType, setAddressType] = useState<CreateAddressData["addressType"]>("Home");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationResults, setLocationResults] = useState<LocationSearchResult[]>([]);
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState("");
  const [manualSearchMode, setManualSearchMode] = useState(false);
  const [activeLocationResult, setActiveLocationResult] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [addressForm, setAddressForm] = useState<CreateAddressData>({ fullName: "", phone: "", addressLine: "", city: "", state: "", pincode: "" });
  const [addressError, setAddressError] = useState("");
  const [drawerError, setDrawerError] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [donationSelected, setDonationSelected] = useState(() => Boolean(
    donationStorageKey && typeof window !== "undefined" && window.sessionStorage.getItem(donationStorageKey) === "true",
  ));
  const [donationExpanded, setDonationExpanded] = useState(false);
  const [orderSnapshot, setOrderSnapshot] = useState<OrderSnapshot>();

  const validItems = getValidCartItems(cart);
  const validItemCount = validItems.reduce((sum, item) => sum + item.quantity, 0);
  const calculatedItemsTotal = getCartSubtotal(validItems) ?? 0;
  const itemsTotal = calculatedItemsTotal;
  const deliveryCharge = validItems.length > 0 && itemsTotal <= 99 ? 40 : 0;
  const orderTotal = itemsTotal + deliveryCharge;
  const payableTotal = orderTotal + (donationSelected ? 1 : 0);
  const totalLabel = `₹${payableTotal.toFixed(2)}`;
  const handleClose = useCallback(() => {
    setStage("cart");
    setDrawerError("");
    setShareStatus("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isCartReady && validItems.length > 0 && donationStorageKey) {
      setDonationSelected(window.sessionStorage.getItem(donationStorageKey) === "true");
    }
  }, [donationStorageKey, isCartReady, validItems.length]);

  useEffect(() => {
    if (isCartReady && validItems.length === 0 && stage !== "success") {
      setDonationSelected(false);
      if (donationStorageKey) window.sessionStorage.removeItem(donationStorageKey);
    }
  }, [donationStorageKey, isCartReady, stage, validItems.length]);

  const handleShare = async () => {
    const shareData = { title: "QuickCart", text: "Shop fresh essentials on QuickCart", url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareStatus("Shared");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
        setShareStatus("Link copied");
      } else {
        setShareStatus("Sharing is unavailable in this browser");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setShareStatus("Could not share this link");
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!isUser) {
      const closeTimer = window.setTimeout(handleClose, 0);
      return () => window.clearTimeout(closeTimer);
    }

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleClose, isOpen, isUser]);

  useEffect(() => {
    if (!isOpen || !isUser || !isCartReady || stage === "success") return;
    if (!hasValidCartItems(cart)) {
      const closeTimer = window.setTimeout(handleClose, 0);
      return () => window.clearTimeout(closeTimer);
    }
  }, [cart, handleClose, isCartReady, isOpen, isUser, stage]);

  useEffect(() => {
    if (!isOpen || !isUser || (stage !== "cart" && stage !== "address")) return;
    let active = true;
    setIsLoadingAddresses(true);
    getAddresses(1, 50).then((response) => {
      if (!active || !response?.success) return;
      const saved = (response.data || []) as Address[];
      setAddresses(saved);
      const storageKey = user?.id ? `quickcart-selected-address:${user.id}` : "";
      const storedId = storageKey ? window.sessionStorage.getItem(storageKey) : null;
      const restored = storedId ? saved.find((item) => item._id === storedId) : undefined;
      setAddress(restored);
      if (storedId && !restored && storageKey) window.sessionStorage.removeItem(storageKey);
    }).catch((error: unknown) => {
      console.error("Failed to load cart delivery addresses:", error);
      if (active) setDrawerError("Saved addresses could not be loaded. You can retry from checkout.");
    }).finally(() => { if (active) setIsLoadingAddresses(false); });
    return () => { active = false; };
  }, [isOpen, isUser, stage, user?.id]);

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) handleClose();
  };

  const handleQuantityChange = async (productId: string, quantity: number, variantId?: string) => {
    try {
      setDrawerError("");
      await updateProductQuantity(productId, quantity, variantId);
    } catch (error) {
      console.error("Failed to update cart quantity:", error);
      setDrawerError("We couldn't update that quantity. Please try again.");
    }
  };

  const handleRemove = async (productId: string, variantId?: string) => {
    try {
      setDrawerError("");
      await removeProduct(productId, variantId);
    } catch (error) {
      console.error("Failed to remove cart item:", error);
      setDrawerError("We couldn't remove that item. Please try again.");
    }
  };

  const handleAddressChange = useCallback((nextAddress: Address | undefined) => {
    setAddress(nextAddress);
  }, []);

  const handleOrderSuccess = useCallback((order: Order | undefined, selectedAddress: Address | undefined) => {
    setOrderSnapshot({ order, address: selectedAddress || address, cart, total: order?.totalAmount ?? payableTotal ?? itemsTotal });
    setStage("success");
    setDrawerError("");
  }, [address, cart, itemsTotal, payableTotal]);

  const locateCurrentPosition = async () => {
    setIsLocating(true); setLocationError("");
    try {
      const coordinates = await getCurrentLocation();
      const resolved = await reverseGeocodeFromBackend(coordinates.latitude, coordinates.longitude);
      handleSelectedLocationChange({ ...coordinates, address: resolved });
    } catch (error) { setLocationError(error instanceof Error ? error.message : "Unable to detect your location."); }
    finally { setIsLocating(false); }
  };

  const handleSelectedLocationChange = (location: DetectedLocation) => {
    setManualSearchMode(false);
    setLocationResults([]);
    setLocationSearchError("");
    setActiveLocationResult(-1);
    setSelectedLocation(location);
    setSearchQuery(location.address.displayName || "Resolving address…");
    setLocationError("");
    setAddressForm((current) => ({ ...current, city: location.address.city, state: location.address.state, pincode: location.address.pincode }));
  };

  const handleLocationSuggestionSelect = (result: LocationSearchResult) => {
    const resolved = extractAddressComponents({ display_name: result.displayName, address: result.address });
    handleSelectedLocationChange({ latitude: result.latitude, longitude: result.longitude, accuracy: 0, address: resolved });
  };

  useEffect(() => {
    if (!addressModalOpen || !manualSearchMode || searchQuery.trim().length < 3) {
      setLocationResults([]);
      setIsSearchingLocations(false);
      setLocationSearchError("");
      return;
    }
    const controller = new AbortController();
    const query = searchQuery.trim();
    const timer = window.setTimeout(async () => {
      setIsSearchingLocations(true);
      setLocationSearchError("");
      try {
        const results = await searchLocations(query, controller.signal);
        if (!controller.signal.aborted) {
          setLocationResults(results);
          setActiveLocationResult(-1);
          if (!results.length) setLocationSearchError("No matching locations found.");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLocationResults([]);
          setLocationSearchError("Location search is temporarily unavailable. Please try again shortly.");
        }
      } finally {
        if (!controller.signal.aborted) setIsSearchingLocations(false);
      }
    }, 500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [addressModalOpen, manualSearchMode, searchQuery]);

  useEffect(() => { if (addressModalOpen && !editingAddress) void locateCurrentPosition(); }, [addressModalOpen, editingAddress]);

  if (!isOpen || !isUser) return null;

  const heading = stage === "cart" ? "My Cart" : stage === "address" ? "Select delivery address" : stage === "checkout" ? "Payment" : "Order placed";

  return (
    <div className={`cart-drawer-overlay${isClosing ? " cart-drawer-overlay--closing" : ""}`} onMouseDown={handleBackdropMouseDown}>
      <aside className={`cart-drawer cart-drawer--${stage}`} role="dialog" aria-modal="true" aria-label={heading}>
        <header className="cart-drawer-header">
          {stage === "cart" ? (
            <button type="button" className="cart-drawer-back" onClick={handleClose} aria-label="Back to shopping">←</button>
          ) : stage === "address" ? (
            <button type="button" className="cart-drawer-back" onClick={() => { setAddressFormOpen(false); setStage("cart"); }} aria-label="Back to cart">←</button>
          ) : stage !== "success" ? (
            <button type="button" className="cart-drawer-back" onClick={() => setStage("cart")} aria-label="Back to cart">←</button>
          ) : null}
          <div className="cart-drawer-title-wrap">
            <h2>{heading}</h2>
            {stage === "cart" && validItemCount > 0 && <span>{validItemCount} {validItemCount === 1 ? "item" : "items"}</span>}
          </div>
          {stage === "cart" && <button type="button" className="cart-drawer-share" onClick={() => void handleShare()} aria-label="Share QuickCart">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7h14v-7" /></svg>
            <span>Share</span>
          </button>}
          <button type="button" className="cart-drawer-close" onClick={handleClose} aria-label="Close cart">×</button>
        </header>

        {stage === "cart" && (
          <>
            <div className="cart-drawer-content">
              {drawerError && <p className="cart-drawer-error" role="alert">{drawerError}</p>}
              {shareStatus && <p className="cart-drawer-share-status" role="status">{shareStatus}</p>}
              {isLoading && !cart ? (
                <div className="cart-drawer-loading">Loading your cart…</div>
              ) : validItems.length === 0 ? (
                <div className="cart-drawer-empty">
                  <span aria-hidden="true">🛒</span>
                  <h3>Your cart is empty</h3>
                  <p>Add items to your cart and they’ll appear here.</p>
                  <button type="button" onClick={handleClose}>Continue shopping</button>
                </div>
              ) : (
                <>
                  <section className="cart-drawer-items" aria-label="Cart products">
                    {validItems.map((item, index) => (
                      <div className="cart-drawer-item-wrap" key={`${getCartProductId(item.product) || index}:${item.variantId ?? ""}`}>
                        {typeof item.product !== "string" && item.product.variants?.find((variant) => variant._id === item.variantId)?.stock === 0 && <p className="cart-drawer-stock-warning">Out of stock. Remove this item to continue.</p>}
                        <CartItem item={item} onQuantityChange={handleQuantityChange} onRemove={handleRemove} hideRemove />
                      </div>
                    ))}
                  </section>

                  <section className="cart-drawer-bill">
                    <h3>Bill details</h3>
                    <div><span><i aria-hidden="true">▤</i>{donationSelected ? "Sub total" : "Items total"}</span><strong>₹{(itemsTotal + (donationSelected ? 1 : 0)).toFixed(2)}</strong></div>
                    <div><span><i aria-hidden="true">♧</i>Delivery charge</span><strong className={deliveryCharge === 0 ? "is-free" : ""}>{deliveryCharge > 0 ? `₹${deliveryCharge.toFixed(2)}` : "FREE"}</strong></div>
                    <div className="cart-drawer-grand-total"><span>Grand total</span><strong>{totalLabel}</strong></div>
                  </section>
                  <section className="cart-drawer-donation">
                    <span className="cart-drawer-donation-icon" aria-hidden="true">♡</span>
                    <div className="cart-drawer-donation-copy"><strong>Feeding India donation</strong><p>{donationExpanded ? "Optional ₹1 contribution added to your order total. QuickCart does not currently remit donations to Feeding India." : "Optional ₹1 contribution added to your order total."} <button type="button" onClick={() => setDonationExpanded((expanded) => !expanded)}>{donationExpanded ? "read less" : "read more"}</button></p></div>
                    <label className="cart-drawer-donation-toggle"><span>₹1</span><input type="checkbox" checked={donationSelected} onChange={(event) => {
                      const selected = event.target.checked;
                      setDonationSelected(selected);
                      if (donationStorageKey) {
                        if (selected) window.sessionStorage.setItem(donationStorageKey, "true");
                        else window.sessionStorage.removeItem(donationStorageKey);
                      }
                    }} aria-label="Add ₹1 donation" /></label>
                  </section>
                  <section className="cart-drawer-policy"><strong>Cancellation Policy</strong><p>Cancellation and refund requests are reviewed by QuickCart support based on the order status.</p></section>
                </>
              )}
            </div>

            {validItems.length > 0 && (
              <footer className="cart-drawer-footer">
                {selectedAddress && <div className="cart-drawer-selected-address"><span aria-hidden="true">⌖</span><div><strong>Delivering to {selectedAddress.addressType || (selectedAddress.isDefault ? "Home" : "Saved address")}</strong><small>{getAddressText(selectedAddress)}</small></div><button type="button" onClick={() => setStage("address")}>Change</button></div>}
                <button type="button" className="cart-drawer-proceed-row" disabled={isLoadingAddresses} onClick={() => {
                    if (!selectedAddress) setStage("address");
                    else {
                      window.sessionStorage.setItem(`quickcart-selected-address:${user?.id}`, selectedAddress._id);
                      window.sessionStorage.setItem(`quickcart-cart-donation:${user?.id}`, donationSelected ? "true" : "false");
                      onNavigate("/checkout");
                    }
                  }}>
                  <div><strong>{totalLabel}</strong><span>TOTAL</span></div>
                  <span className="cart-drawer-proceed-label">{isLoadingAddresses ? "Checking address…" : selectedAddress ? "Proceed To Pay" : "Proceed"}<span className="cart-drawer-proceed-arrow" aria-hidden="true">→</span></span>
                </button>
              </footer>
            )}
          </>
        )}

        {stage === "checkout" && (
          <div className="cart-drawer-checkout-content">
            <Checkout
              key="drawer-checkout"
              embedded
              initialSelectedAddress={selectedAddress?._id}
              onBack={() => setStage("cart")}
              onAddressChange={handleAddressChange}
              onOrderSuccess={handleOrderSuccess}
              donationSelected={donationSelected}
              autoStartPayment
            />
          </div>
        )}

        {stage === "address" && (
          <div className="cart-drawer-address-content">
            <button className="cart-drawer-add-address" type="button" onClick={() => { setEditingAddress(undefined); setManualSearchMode(false); setLocationResults([]); setAddressType("Home"); setSelectedLocation(undefined); setAddressForm({ fullName: user?.name ?? "", phone: user?.phone ?? "", addressLine: "", city: "", state: "", pincode: "", buildingName: "", floor: "", towerWing: "", landmark: "" }); setAddressModalOpen(true); }}>＋ Add a new address</button>
            {addressFormOpen && <form className="cart-drawer-address-form" onSubmit={async (event) => {
              event.preventDefault(); setAddressError("");
              try {
                const response = editingAddress ? await updateAddress(editingAddress._id, addressForm) : await createAddress(addressForm);
                const savedId = response?.data?.data?._id ?? response?.address?._id;
                const refreshed = await getAddresses(1, 50);
                const saved = (refreshed.data || []) as Address[];
                setAddresses(saved);
                const selected = saved.find((entry) => entry._id === savedId);
                if (selected) {
                  setAddress(selected);
                  if (user?.id) window.sessionStorage.setItem(`quickcart-selected-address:${user.id}`, selected._id);
                  setAddressFormOpen(false);
                  setEditingAddress(undefined);
                  setStage("cart");
                }
              } catch (error) { setAddressError(error instanceof Error ? error.message : "Could not save address."); }
            }}>
              {(["fullName", "phone", "addressLine", "city", "state", "pincode"] as const).map((field) => <input key={field} required value={addressForm[field] ?? ""} placeholder={field === "fullName" ? "Full name" : field === "addressLine" ? "Address" : field[0].toUpperCase() + field.slice(1)} onChange={(event) => setAddressForm((current) => ({ ...current, [field]: event.target.value }))} />)}
              <button type="submit">{editingAddress ? "Save address" : "Save and select"}</button>{addressError && <p role="alert">{addressError}</p>}
            </form>}
            <h3>Your saved address</h3>
            {addresses.map((saved) => <div className="cart-drawer-address-card" key={saved._id}>
              <button type="button" className="cart-drawer-address-select" onClick={() => { setAddress(saved); if (user?.id) window.sessionStorage.setItem(`quickcart-selected-address:${user.id}`, saved._id); setStage("cart"); }}>{saved.addressType === "Work" ? "▣" : saved.addressType === "Hotel" ? "▤" : saved.isDefault ? "⌂" : "⌖"}<span><strong>{saved.addressType || (saved.isDefault ? "Home" : "Other")}</strong><small>{getAddressText(saved)}</small></span></button>
              <button type="button" className="cart-drawer-address-edit" aria-label="Edit address" onClick={() => { setEditingAddress(saved); setManualSearchMode(false); setLocationResults([]); setAddressType(saved.addressType || "Home"); setAddressForm({ fullName: saved.fullName, phone: saved.phone || "", addressLine: saved.addressLine, city: saved.city, state: saved.state, pincode: saved.pincode, buildingName: saved.buildingName || "", floor: saved.floor || "", towerWing: saved.towerWing || "", landmark: saved.landmark || "" }); setSelectedLocation(saved.latitude !== undefined && saved.longitude !== undefined ? { latitude: saved.latitude, longitude: saved.longitude, accuracy: 0, address: { addressLine: saved.formattedAddress || saved.addressLine, city: saved.city, state: saved.state, pincode: saved.pincode, displayName: saved.formattedAddress || getAddressText(saved) } } : undefined); setSearchQuery(saved.formattedAddress || getAddressText(saved)); setAddressModalOpen(true); }}>✎</button>
            </div>)}
            {!addresses.length && !addressFormOpen && <p className="cart-drawer-address-empty">No saved addresses yet.</p>}
          </div>
        )}

        {addressModalOpen && <div className="cart-address-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddressModalOpen(false); }}>
          <section className="cart-address-modal" role="dialog" aria-modal="true" aria-label="Add new address">
            <button type="button" className="cart-address-modal-close" onClick={() => setAddressModalOpen(false)} aria-label="Close">×</button>
            <div className="cart-address-map-column">
              <form className="cart-address-search" onSubmit={(event) => event.preventDefault()}>
                <svg className="cart-address-search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.2 4.2" /></svg>
                <input ref={searchInputRef} value={searchQuery} placeholder="Search for area, street name..." onChange={(event) => { setSearchQuery(event.target.value); setManualSearchMode(true); setLocationResults([]); setLocationSearchError(""); }} onKeyDown={(event) => {
                  if (event.key === "ArrowDown" && locationResults.length) { event.preventDefault(); setActiveLocationResult((index) => (index + 1) % locationResults.length); }
                  else if (event.key === "ArrowUp" && locationResults.length) { event.preventDefault(); setActiveLocationResult((index) => (index <= 0 ? locationResults.length - 1 : index - 1)); }
                  else if (event.key === "Enter" && activeLocationResult >= 0 && locationResults[activeLocationResult]) { event.preventDefault(); handleLocationSuggestionSelect(locationResults[activeLocationResult]); }
                  else if (event.key === "Escape") { setLocationResults([]); setActiveLocationResult(-1); }
                }} aria-label="Search for an address" aria-autocomplete="list" aria-expanded={locationResults.length > 0} aria-controls="cart-address-suggestions" aria-activedescendant={activeLocationResult >= 0 ? `cart-address-result-${activeLocationResult}` : undefined} />
                {searchQuery && <button className="cart-address-search-clear" type="button" aria-label="Clear search" onClick={() => { setSearchQuery(""); setManualSearchMode(true); setLocationResults([]); setLocationSearchError(""); searchInputRef.current?.focus(); }}>×</button>}
              </form>
              {(locationResults.length > 0 || isSearchingLocations || locationSearchError) && <div id="cart-address-suggestions" className="cart-address-suggestions" role="listbox">
                {isSearchingLocations && <p className="cart-address-search-status">Searching locations…</p>}
                {!isSearchingLocations && locationResults.map((result, index) => <button id={`cart-address-result-${index}`} key={`${result.latitude}:${result.longitude}`} type="button" role="option" aria-selected={activeLocationResult === index} className={activeLocationResult === index ? "active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => handleLocationSuggestionSelect(result)}><span className="cart-address-result-icon" aria-hidden="true">⌖</span><span><strong>{result.displayName.split(",")[0]}</strong><small>{result.displayName}</small></span></button>)}
                {!isSearchingLocations && !locationResults.length && locationSearchError && <p className="cart-address-search-status" role="status">{locationSearchError}</p>}
              </div>}
              <AddressMap latitude={selectedLocation?.latitude} longitude={selectedLocation?.longitude} onDetectLocation={() => void locateCurrentPosition()} isDetecting={isLocating} onLocationChange={handleSelectedLocationChange} />
              <div className="cart-address-preview"><strong>Delivering your order to</strong>{addressForm.buildingName?.trim() && <b>{addressForm.buildingName.trim()}</b>}<span>{selectedLocation?.address.displayName || "Select a point on the map"}</span></div>
              {locationError && <p className="cart-address-location-error" role="alert">{locationError}</p>}
            </div>
            <form className="cart-address-form-column" onSubmit={async (event) => {
              event.preventDefault(); setAddressError("");
              if (!selectedLocation) { setAddressError("Select a delivery location on the map."); return; }
              if (!selectedLocation.address.displayName) { setAddressError("Wait for the address to finish updating, or choose another map location."); return; }
              const phone = addressForm.phone?.replace(/\D/g, "") ?? "";
              if (phone && !/^[6-9]\d{9}$/.test(phone)) { setAddressError("Enter a valid 10-digit Indian phone number."); return; }
              setIsSavingAddress(true);
              const resolved = selectedLocation.address;
              const payload: CreateAddressData = { ...addressForm, phone, addressType, latitude: selectedLocation.latitude, longitude: selectedLocation.longitude, formattedAddress: resolved.displayName, addressLine: [addressForm.buildingName, addressForm.floor && `Floor ${addressForm.floor}`, addressForm.towerWing, addressForm.landmark, resolved.addressLine].filter(Boolean).join(", "), city: resolved.city || addressForm.city || "", state: resolved.state || addressForm.state || "", pincode: resolved.pincode || addressForm.pincode || "" };
              try { const result = editingAddress ? await updateAddress(editingAddress._id, payload) : await createAddress(payload); const refreshed = await getAddresses(1, 50); const saved = (refreshed.data || []) as Address[]; setAddresses(saved); const created = saved.find((item) => item._id === (editingAddress?._id ?? result?.data?._id)); if (created) { setAddress(created); if (user?.id) window.sessionStorage.setItem(`quickcart-selected-address:${user.id}`, created._id); setAddressModalOpen(false); setStage("cart"); setEditingAddress(undefined); } else setAddressError("Address saved but could not be selected."); }
              catch (error) { setAddressError(error instanceof Error ? error.message : "Could not save address."); }
              finally { setIsSavingAddress(false); }
            }}>
              <h2>Enter complete address</h2><label>Save address as *</label>
              <div className="cart-address-types">{(["Home", "Work", "Hotel", "Other"] as const).map((type) => <button key={type} type="button" className={addressType === type ? "selected" : ""} onClick={() => setAddressType(type)}>{type}</button>)}</div>
              {([ ["buildingName", "Office / Building name *", true], ["floor", "Floor *", true], ["towerWing", "Tower / Wing (optional)", false], ["landmark", "Nearby landmark (optional)", false] ] as const).map(([field, placeholder, required]) => <input key={field} required={required} value={addressForm[field] ?? ""} placeholder={placeholder} onChange={(event) => setAddressForm((current) => ({ ...current, [field]: event.target.value }))} />)}
              <input required value={addressForm.city || selectedLocation?.address.city || ""} placeholder="City / locality *" onChange={(event) => setAddressForm((current) => ({ ...current, city: event.target.value }))} />
              <input required value={addressForm.state || selectedLocation?.address.state || ""} placeholder="State *" onChange={(event) => setAddressForm((current) => ({ ...current, state: event.target.value }))} />
              <input required value={addressForm.pincode || selectedLocation?.address.pincode || ""} placeholder="Postal code *" onChange={(event) => setAddressForm((current) => ({ ...current, pincode: event.target.value }))} />
              <h3>Enter your details for seamless delivery experience</h3>
              <input required value={addressForm.fullName} placeholder="Your name *" onChange={(event) => setAddressForm((current) => ({ ...current, fullName: event.target.value }))} />
              <input value={addressForm.phone ?? ""} placeholder="Your phone number (optional)" onChange={(event) => setAddressForm((current) => ({ ...current, phone: event.target.value }))} />
              {addressError && <p role="alert">{addressError}</p>}<button className="cart-address-save" disabled={isSavingAddress}>{isSavingAddress ? "Saving…" : editingAddress ? "Update Address" : "Save Address"}</button>
            </form>
          </section>
        </div>}

        {stage === "success" && orderSnapshot && (
          <div className="cart-drawer-success">
            <span className="cart-drawer-success-icon" aria-hidden="true">✓</span>
            <h3>Order Placed Successfully</h3>
            {orderSnapshot.order?._id && <p className="cart-drawer-order-id">Order ID: {orderSnapshot.order._id}</p>}
            <strong className="cart-drawer-success-total">₹{orderSnapshot.total.toFixed(2)}</strong>
            <div className="cart-drawer-success-address">
              <strong>Delivery address</strong>
              <span>{getAddressText(orderSnapshot.address)}</span>
            </div>
            <div className="cart-drawer-success-items">
              <h4>Order summary</h4>
              {(orderSnapshot.order?.items || orderSnapshot.cart?.items || []).map((item, index) => {
                const name = "name" in item ? item.name : typeof item.product === "string" ? "Product" : item.product.name;
                const quantity = item.quantity;
                return <div key={`${name}-${index}`}><span>{name} × {quantity}</span></div>;
              })}
            </div>
            <div className="cart-drawer-success-actions">
              <button type="button" onClick={() => onNavigate("/account/orders")}>View Orders</button>
              <button type="button" className="secondary" onClick={() => onNavigate("/")}>Continue Shopping</button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

export default CartDrawer;

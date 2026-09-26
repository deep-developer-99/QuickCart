import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

import {
  deleteAddress,
  getAddresses,
  updateAddress,
} from "../../services/addressService";
import {
  detectCurrentLocation,
  type DetectedLocation,
} from "../../services/locationService";
import AddressMap from "../../components/common/AddressMap";
import type { Address, CreateAddressData } from "../../types/address";

import "./SavedAddresses.css";

const emptyForm: CreateAddressData = {
  fullName: "",
  phone: "",
  addressLine: "",
  city: "",
  state: "",
  pincode: "",
  latitude: undefined,
  longitude: undefined,
  isDefault: false,
};

const SavedAddresses = () => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [form, setForm] = useState<CreateAddressData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const loadAddresses = async () => {
    try {
      setIsLoading(true);
      setError("");
      const response = await getAddresses();
      setAddresses(response?.data || []);
    } catch (requestError: unknown) {
      console.error("Load addresses error:", requestError);
      setError(
        axios.isAxiosError(requestError)
          ? requestError.response?.data?.message || "Failed to load addresses."
          : "Failed to load addresses.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAddresses();
  }, []);

  const startEditing = (address: Address) => {
    setOpenMenuId(null);
    setError("");
    setSuccess("");
    setEditingAddress(address);
    setForm({
      fullName: address.fullName,
      phone: address.phone,
      addressLine: address.addressLine,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      latitude: address.latitude,
      longitude: address.longitude,
      isDefault: address.isDefault,
    });
  };

  const closeEditor = () => {
    if (isSaving) return;
    setEditingAddress(null);
    setForm(emptyForm);
    setIsDetectingLocation(false);
    setError("");
  };

  const handleChange = (
    field: keyof CreateAddressData,
    value: string | boolean,
  ) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleMapLocationChange = (location: DetectedLocation) => {
    setError("");
    setForm((previous) => ({
      ...previous,
      addressLine: location.address.addressLine || previous.addressLine,
      city: location.address.city || previous.city,
      state: location.address.state || previous.state,
      pincode: location.address.pincode || previous.pincode,
      latitude: location.latitude,
      longitude: location.longitude,
    }));
  };

  const handleDetectLocation = async () => {
    try {
      setIsDetectingLocation(true);
      setError("");

      const detected = await detectCurrentLocation();
      handleMapLocationChange(detected);
    } catch (locationError: unknown) {
      console.error("Detect location error:", locationError);
      setError(
        locationError instanceof Error
          ? locationError.message
          : "Unable to detect your current location.",
      );
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleSave = async () => {
    if (!editingAddress) return;

    const requiredFields: Array<keyof CreateAddressData> = [
      "fullName",
      "phone",
      "addressLine",
      "city",
      "state",
      "pincode",
    ];

    const hasMissingField = requiredFields.some(
      (field) => typeof form[field] === "string" && !String(form[field]).trim(),
    );

    if (hasMissingField) {
      setError("Please fill all required address fields.");
      return;
    }

    if (!/^\+?[0-9]{10,15}$/.test(form.phone.trim())) {
      setError("Please enter a valid phone number.");
      return;
    }

    if (!/^\d{6}$/.test(form.pincode.trim())) {
      setError("Please enter a valid 6-digit pincode.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setSuccess("");

      const response = await updateAddress(editingAddress._id, {
        ...form,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        addressLine: form.addressLine.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
      });

      if (!response?.success) {
        setError(response?.message || "Failed to update address.");
        return;
      }

      setAddresses((previous) =>
        previous.map((address) =>
          address._id === editingAddress._id
            ? response.data
            : form.isDefault
              ? { ...address, isDefault: false }
              : address,
        ),
      );
      setEditingAddress(null);
      setForm(emptyForm);
      setSuccess("Address updated successfully.");
    } catch (requestError: unknown) {
      console.error("Update address error:", requestError);
      setError(
        axios.isAxiosError(requestError)
          ? requestError.response?.data?.message || "Failed to update address."
          : "Failed to update address.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (address: Address) => {
    setOpenMenuId(null);
    const shouldDelete = window.confirm(
      `Delete the address for ${address.fullName}? This action cannot be undone.`,
    );

    if (!shouldDelete) return;

    try {
      setDeletingId(address._id);
      setError("");
      setSuccess("");

      const response = await deleteAddress(address._id);

      if (!response?.success) {
        setError(response?.message || "Failed to delete address.");
        return;
      }

      setAddresses((previous) =>
        previous.filter((item) => item._id !== address._id),
      );
      setSuccess("Address deleted successfully.");
    } catch (requestError: unknown) {
      console.error("Delete address error:", requestError);
      setError(
        axios.isAxiosError(requestError)
          ? requestError.response?.data?.message || "Failed to delete address."
          : "Failed to delete address.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="saved-addresses-page">
      <div className="saved-addresses-container">
        <div className="blinkit-addresses-header">
          <h1>My addresses</h1>
          <Link to="/checkout" className="blinkit-add-address-link">
            <span>+</span> Add new address
          </Link>
        </div>

        {error && <div className="saved-addresses-alert error">{error}</div>}
        {success && (
          <div className="saved-addresses-alert success">{success}</div>
        )}

        {isLoading ? (
          <div className="saved-addresses-empty">Loading addresses...</div>
        ) : error ? (
          <div className="saved-addresses-empty saved-addresses-error-state">
            <div className="saved-addresses-empty-icon">⚠️</div>
            <h2>Could not load your addresses</h2>
            <p>Please check that the backend is running and try again.</p>
            <button
              type="button"
              className="saved-addresses-add-button"
              onClick={() => void loadAddresses()}
            >
              Try Again
            </button>
          </div>
        ) : addresses.length === 0 ? (
          <div className="saved-addresses-empty-card">
            <div className="saved-addresses-empty-icon">📍</div>
            <h2>No saved addresses yet</h2>
            <p>
              Add an address during checkout and it will appear here for quick
              access next time.
            </p>
            <Link to="/checkout" className="saved-addresses-primary-link">
              Add Your First Address
            </Link>
          </div>
        ) : (
          <div className="blinkit-address-list">
            {addresses.map((address) => (
              <article className="blinkit-address-row" key={address._id}>
                <div
                  className={`blinkit-address-icon ${address.isDefault ? "default" : ""}`}
                >
                  {address.isDefault ? "⌂" : "⌖"}
                </div>

                <div className="blinkit-address-details">
                  <div className="blinkit-address-title-line">
                    <h2>{address.city || "Saved Address"}</h2>
                    {address.isDefault && (
                      <span className="blinkit-default-badge">Default</span>
                    )}
                  </div>
                  <p>
                    {address.addressLine}, {address.city}, {address.state} -{" "}
                    {address.pincode}
                  </p>
                </div>

                <div className="blinkit-address-menu-wrap">
                  <button
                    type="button"
                    className="blinkit-address-menu-button"
                    aria-label={`Actions for ${address.city || "saved address"}`}
                    aria-expanded={openMenuId === address._id}
                    onClick={() =>
                      setOpenMenuId((current) =>
                        current === address._id ? null : address._id,
                      )
                    }
                    disabled={deletingId === address._id}
                  >
                    ⋮
                  </button>

                  {openMenuId === address._id && (
                    <div className="blinkit-address-menu">
                      <button
                        type="button"
                        onClick={() => startEditing(address)}
                      >
                        <span>✎</span> Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => void handleDelete(address)}
                      >
                        <span>⌫</span> Delete
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {editingAddress && (
        <div className="address-editor-backdrop" onMouseDown={closeEditor}>
          <div
            className="address-editor-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="address-editor-map-panel">
              <div className="address-editor-search">
                <span>⌕</span>
                <span>
                  {form.city
                    ? `${form.city}${form.pincode ? `, ${form.pincode}` : ""}`
                    : "Move map to select location"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setForm((previous) => ({ ...previous }));
                  }}
                  aria-label="Clear location text"
                >
                  ×
                </button>
              </div>

              <AddressMap
                latitude={form.latitude}
                longitude={form.longitude}
                onDetectLocation={() => void handleDetectLocation()}
                onLocationChange={handleMapLocationChange}
                isDetecting={isDetectingLocation}
              />

              <div className="address-editor-delivery-card">
                <strong>Delivering your order to</strong>
                <div className="address-editor-delivery-location">
                  <span className="address-editor-delivery-pin">●</span>
                  <div>
                    <strong>{form.city || "Selected location"}</strong>
                    <span>
                      {form.state ||
                        "Move the map to choose your delivery area"}
                      {form.pincode ? `, ${form.pincode}` : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="address-editor-form-panel">
              <div className="address-editor-header">
                <h2>Enter complete address</h2>
                <button
                  type="button"
                  className="address-editor-close"
                  onClick={closeEditor}
                  aria-label="Close edit address dialog"
                >
                  ×
                </button>
              </div>

              {error && (
                <div className="saved-addresses-alert error">{error}</div>
              )}

              <div className="address-editor-form-scroll">
                <div className="address-editor-section-label">
                  Edit address details
                </div>

                <label className="address-editor-field">
                  <span>Flat / House no / Building name *</span>
                  <input
                    value={form.addressLine}
                    onChange={(event) =>
                      handleChange("addressLine", event.target.value)
                    }
                    placeholder="D-square, Haldiram"
                  />
                </label>

                <label className="address-editor-field">
                  <span>Area / Sector / Locality *</span>
                  <input
                    value={form.city}
                    onChange={(event) =>
                      handleChange("city", event.target.value)
                    }
                    placeholder="Khora Colony, Sector 62A, Noida"
                  />
                </label>

                <div className="address-editor-two-columns">
                  <label className="address-editor-field">
                    <span>State *</span>
                    <input
                      value={form.state}
                      onChange={(event) =>
                        handleChange("state", event.target.value)
                      }
                      placeholder="Uttar Pradesh"
                    />
                  </label>

                  <label className="address-editor-field">
                    <span>Pincode *</span>
                    <input
                      value={form.pincode}
                      onChange={(event) =>
                        handleChange("pincode", event.target.value)
                      }
                      placeholder="201301"
                      inputMode="numeric"
                      maxLength={6}
                    />
                  </label>
                </div>

                <div className="address-editor-details-title">
                  Enter your details for seamless delivery
                </div>

                <label className="address-editor-field">
                  <span>Your name *</span>
                  <input
                    value={form.fullName}
                    onChange={(event) =>
                      handleChange("fullName", event.target.value)
                    }
                    placeholder="Deepanshu Rawat"
                  />
                </label>

                <label className="address-editor-field">
                  <span>Your phone number *</span>
                  <input
                    value={form.phone}
                    onChange={(event) =>
                      handleChange("phone", event.target.value)
                    }
                    placeholder="9625226196"
                    inputMode="tel"
                  />
                </label>

                <label className="address-editor-default">
                  <input
                    type="checkbox"
                    checked={Boolean(form.isDefault)}
                    onChange={(event) =>
                      handleChange("isDefault", event.target.checked)
                    }
                  />
                  <span>Set as default address</span>
                </label>
              </div>

              <div className="address-editor-save-area">
                <button
                  type="button"
                  className="address-editor-save-button"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving address..." : "Save Address"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedAddresses;

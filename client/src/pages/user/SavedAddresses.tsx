import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

import {
  deleteAddress,
  getAddresses,
  updateAddress,
} from "../../services/addressService";
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
    setError("");
  };

  const handleChange = (
    field: keyof CreateAddressData,
    value: string | boolean,
  ) => {
    setForm((previous) => ({ ...previous, [field]: value }));
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
                  {address.city?.toLowerCase().includes("home") ? "⌂" : "⌖"}
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
        <div className="address-modal-backdrop" onMouseDown={closeEditor}>
          <div
            className="address-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="address-modal-header">
              <div>
                <p>QUICKCART</p>
                <h2>Edit Address</h2>
              </div>
              <button
                type="button"
                className="address-modal-close"
                onClick={closeEditor}
                aria-label="Close edit address dialog"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="saved-addresses-alert error">{error}</div>
            )}

            <div className="address-form-grid">
              <label>
                Full Name
                <input
                  value={form.fullName}
                  onChange={(event) =>
                    handleChange("fullName", event.target.value)
                  }
                  placeholder="Enter full name"
                />
              </label>

              <label>
                Phone Number
                <input
                  value={form.phone}
                  onChange={(event) =>
                    handleChange("phone", event.target.value)
                  }
                  placeholder="Enter phone number"
                  inputMode="tel"
                />
              </label>

              <label className="address-form-full">
                Address
                <textarea
                  value={form.addressLine}
                  onChange={(event) =>
                    handleChange("addressLine", event.target.value)
                  }
                  placeholder="House / flat / street"
                  rows={3}
                />
              </label>

              <label>
                City
                <input
                  value={form.city}
                  onChange={(event) => handleChange("city", event.target.value)}
                  placeholder="City"
                />
              </label>

              <label>
                State
                <input
                  value={form.state}
                  onChange={(event) =>
                    handleChange("state", event.target.value)
                  }
                  placeholder="State"
                />
              </label>

              <label>
                Pincode
                <input
                  value={form.pincode}
                  onChange={(event) =>
                    handleChange("pincode", event.target.value)
                  }
                  placeholder="6-digit pincode"
                  inputMode="numeric"
                  maxLength={6}
                />
              </label>

              <label className="address-default-checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(form.isDefault)}
                  onChange={(event) =>
                    handleChange("isDefault", event.target.checked)
                  }
                />
                Set as default address
              </label>
            </div>

            <div className="address-modal-actions">
              <button
                type="button"
                className="address-modal-button secondary"
                onClick={closeEditor}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="address-modal-button primary"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Address"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedAddresses;

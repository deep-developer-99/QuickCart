import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getAddresses } from "../../services/addressService";
import { useAppSelector } from "../../hooks/reduxHooks";
import type { Address } from "../../types/address";
import "./LocationSelector.css";

const LocationSelector = () => {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user || user.role !== "user") {
      setAddresses([]);
      setSelectedAddress(null);
      return;
    }

    let mounted = true;

    const loadAddresses = async () => {
      try {
        const response = await getAddresses();
        if (!mounted || !response?.success) return;

        const list = (response.data || []) as Address[];
        setAddresses(list);
        setSelectedAddress(
          list.find((address) => address.isDefault) || list[0] || null,
        );
      } catch (error) {
        console.error("Failed to load delivery addresses:", error);
      }
    };

    loadAddresses();

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleOpen = () => {
    if (!user || user.role !== "user") {
      navigate("/login");
      return;
    }

    setIsOpen((previous) => !previous);
  };

  const shortAddress = selectedAddress
    ? `${selectedAddress.city}, ${selectedAddress.pincode}`
    : "Select your location";

  return (
    <div className="location-selector" ref={containerRef}>
      <button
        type="button"
        className="location-selector-button"
        onClick={handleOpen}
        aria-expanded={isOpen}
        aria-label="Select delivery location"
      >
        <span className="location-selector-icon">📍</span>
        <span className="location-selector-text">
          <small>Deliver to</small>
          <strong>{shortAddress}</strong>
        </span>
        <span className="location-selector-arrow">⌄</span>
      </button>

      {isOpen && user?.role === "user" && (
        <div className="location-selector-dropdown">
          <div className="location-selector-header">
            <div>
              <span>DELIVERY LOCATION</span>
              <h3>Where should we deliver?</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close location selector"
            >
              ×
            </button>
          </div>

          <div className="location-list">
            {addresses.length === 0 ? (
              <div className="location-empty">
                <span>📍</span>
                <p>No saved address found.</p>
              </div>
            ) : (
              addresses.map((address) => (
                <button
                  type="button"
                  key={address._id}
                  className={`location-option ${
                    selectedAddress?._id === address._id ? "selected" : ""
                  }`}
                  onClick={() => {
                    setSelectedAddress(address);
                    setIsOpen(false);
                  }}
                >
                  <span className="location-option-icon">
                    {address.isDefault ? "🏠" : "📍"}
                  </span>
                  <span className="location-option-content">
                    <strong>{address.fullName}</strong>
                    <span>
                      {address.addressLine}, {address.city}, {address.pincode}
                    </span>
                  </span>
                  {selectedAddress?._id === address._id && (
                    <span className="location-option-check">✓</span>
                  )}
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="location-add-button"
            onClick={() => {
              setIsOpen(false);
              navigate("/checkout");
            }}
          >
            + Add / Manage Address
          </button>
        </div>
      )}
    </div>
  );
};

export default LocationSelector;

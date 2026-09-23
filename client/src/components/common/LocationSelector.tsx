import { useEffect, useRef, useState } from "react";

import { getAddresses } from "../../services/addressService";
import {
  detectCurrentLocation,
  getSavedCurrentLocation,
  saveCurrentLocation,
  type DetectedLocation,
} from "../../services/locationService";

import { useAppSelector } from "../../hooks/reduxHooks";

import type { Address } from "../../types/address";

import "./LocationSelector.css";

const LocationSelector = () => {
  const user = useAppSelector((state) => state.auth.user);

  const [addresses, setAddresses] = useState<Address[]>([]);

  const [currentLocation, setCurrentLocation] =
    useState<DetectedLocation | null>(getSavedCurrentLocation());

  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);

  const [isOpen, setIsOpen] = useState(false);

  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const [locationMessage, setLocationMessage] = useState("");

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

        if (!mounted || !response?.success) {
          return;
        }

        const list = (response.data || []) as Address[];

        setAddresses(list);

        setSelectedAddress(
          list.find((address) => address.isDefault) || list[0] || null,
        );
      } catch (error) {
        console.error("Failed to load saved addresses:", error);
      }
    };

    loadAddresses();

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    const handleLocationChanged = () => {
      setCurrentLocation(getSavedCurrentLocation());
    };

    window.addEventListener(
      "quickcart:location-changed",
      handleLocationChanged,
    );

    return () => {
      window.removeEventListener(
        "quickcart:location-changed",
        handleLocationChanged,
      );
    };
  }, []);

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

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const handleOpen = () => {
    if (!user || user.role !== "user") {
      return;
    }

    setLocationMessage("");
    setIsOpen(true);
  };

  const handleDetectLocation = async () => {
    try {
      setIsGettingLocation(true);
      setLocationMessage("");

      const detected = await detectCurrentLocation();

      saveCurrentLocation(detected);

      setCurrentLocation(detected);

      setLocationMessage("Current location detected.");

      // Close the popup after location detection succeeds.
      setIsOpen(false);
    } catch (error) {
      console.error("Current location error:", error);

      setLocationMessage(
        error instanceof Error
          ? error.message
          : "Unable to get current location.",
      );
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleSelectSavedAddress = (address: Address) => {
    setSelectedAddress(address);

    const savedLocation: DetectedLocation = {
      latitude: address.latitude ?? 0,
      longitude: address.longitude ?? 0,
      accuracy: 0,
      address: {
        addressLine: address.addressLine,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        displayName: [
          address.addressLine,
          address.city,
          address.state,
          address.pincode,
        ]
          .filter(Boolean)
          .join(", "),
      },
    };

    saveCurrentLocation(savedLocation);

    setCurrentLocation(savedLocation);

    setIsOpen(false);
  };

  const locationText = currentLocation?.address?.city
    ? `${currentLocation.address.city}${
        currentLocation.address.pincode
          ? `, ${currentLocation.address.pincode}`
          : ""
      }`
    : selectedAddress
      ? `${selectedAddress.city}, ${selectedAddress.pincode}`
      : "Detect location";

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

          <strong>{locationText}</strong>
        </span>

        <span className="location-selector-arrow">▾</span>
      </button>

      {isOpen && (
        <div
          className="location-selector-backdrop"
          onMouseDown={(event) => {
            // Close when the user clicks anywhere outside the popup.
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div
            className="location-selector-dropdown"
            role="dialog"
            aria-modal="true"
          >
            <div className="location-selector-header">
              <div>
                <span>DELIVERY LOCATION</span>

                <h3>Select delivery location</h3>
              </div>

              <button
                type="button"
                className="location-close-button"
                onClick={() => setIsOpen(false)}
                aria-label="Close location selector"
              >
                ×
              </button>
            </div>

            <button
              type="button"
              className="detect-location-button"
              onClick={handleDetectLocation}
              disabled={isGettingLocation}
            >
              <span>📍</span>

              <span>
                {isGettingLocation
                  ? "Detecting your location..."
                  : "Detect my location"}
              </span>
            </button>

            {currentLocation && (
              <div className="current-location-card">
                <div className="current-location-card-icon">📍</div>

                <div>
                  <strong>Current location</strong>

                  <p>{currentLocation.address.displayName}</p>
                </div>
              </div>
            )}

            {locationMessage && (
              <div className="location-message">{locationMessage}</div>
            )}

            <div className="saved-address-section">
              <h4>Your saved addresses</h4>

              {addresses.length === 0 ? (
                <div className="location-empty">
                  <span>🏠</span>

                  <p>No saved address yet.</p>

                  <small>Add an address from Checkout.</small>
                </div>
              ) : (
                <div className="location-list">
                  {addresses.map((address) => (
                    <button
                      type="button"
                      key={address._id}
                      className={`location-option ${
                        selectedAddress?._id === address._id ? "selected" : ""
                      }`}
                      onClick={() => handleSelectSavedAddress(address)}
                    >
                      <span className="location-option-icon">
                        {address.isDefault ? "🏠" : "📍"}
                      </span>

                      <span className="location-option-content">
                        <strong>
                          {address.isDefault ? "Home" : "Saved Address"}
                        </strong>

                        <span>
                          {address.addressLine}, {address.city}, {address.state}{" "}
                          - {address.pincode}
                        </span>
                      </span>

                      {selectedAddress?._id === address._id && (
                        <span className="location-option-check">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationSelector;

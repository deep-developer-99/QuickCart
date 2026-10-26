import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

import AddressMap from "../common/AddressMap";
import {
  extractAddressComponents,
  getCurrentLocation,
  reverseGeocodeFromBackend,
  searchLocations,
} from "../../services/locationService";
import type {
  LocationSearchResult,
  ReverseGeocodedAddress,
} from "../../services/locationService";
import type { DetectedLocation } from "../../services/locationService";
import type { ShopLocationDraft } from "./ShopLocationFields";
import "./ShopLocationPicker.css";

export interface ShopCoordinates {
  latitude: number;
  longitude: number;
}

type AddressFields = Pick<ShopLocationDraft, "address" | "city" | "state" | "pincode">;

interface ShopLocationPickerProps {
  coordinates: ShopCoordinates | null;
  onChange: (coordinates: ShopCoordinates, address?: Partial<AddressFields>) => void;
  disabled?: boolean;
  enableLocationTools?: boolean;
}

const addressFieldsFromProvider = (
  address: ReverseGeocodedAddress,
): Partial<AddressFields> => ({
  ...(address.addressLine.trim() ? { address: address.addressLine.trim() } : {}),
  ...(address.city.trim() ? { city: address.city.trim() } : {}),
  ...(address.state.trim() ? { state: address.state.trim() } : {}),
  ...(address.pincode.trim() ? { pincode: address.pincode.trim() } : {}),
});

const locationErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const code = error.response?.data?.code;
    if (code === "RATE_LIMITED") {
      return "Location lookup is busy. Wait a moment and try again.";
    }
    if (code === "TIMEOUT") {
      return "The location service took too long to respond. Please try again.";
    }
    if (code === "PROVIDER_ERROR") {
      return "The location service is temporarily unavailable. Please try again.";
    }
    if (code === "NOT_FOUND") {
      return "No address details were found for these coordinates.";
    }
    if (code === "INVALID_INPUT") {
      return "The location details could not be validated. Please try another location.";
    }
    return error.response?.data?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

const ShopLocationPicker = ({
  coordinates,
  onChange,
  disabled = false,
  enableLocationTools = false,
}: ShopLocationPickerProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const debounceRef = useRef<number | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(
    () => () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      requestRef.current?.abort();
    },
    [],
  );

  const handleMapLocationChange = useCallback(
    (location: DetectedLocation) => {
      requestIdRef.current += 1;
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      requestRef.current?.abort();
      setSearchResults([]);
      setIsSearching(false);
      onChange({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      setLocationMessage("");
      setLocationError("");
    },
    [onChange],
  );

  const handleSearch = () => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchError("Enter at least 2 characters to search.");
      setSearchResults([]);
      return;
    }

    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    requestRef.current?.abort();
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    requestRef.current = controller;
    setSearchResults([]);
    setSearchError("");
    setLocationMessage("");
    setIsSearching(true);

    // Search is explicitly submitted rather than run on each keystroke. The
    // short debounce coalesces rapid submits and the request id blocks stale replies.
    debounceRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await searchLocations(query, controller.signal);
          if (requestId !== requestIdRef.current) return;
          setSearchResults(results);
          if (!results.length) {
            setSearchError("No matching locations found. Your selected location is unchanged.");
          }
        } catch (error: unknown) {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          setSearchError(
            locationErrorMessage(error, "Unable to search locations. Please try again."),
          );
        } finally {
          if (requestId === requestIdRef.current) setIsSearching(false);
        }
      })();
    }, 250);
  };

  const clearSearch = () => {
    requestIdRef.current += 1;
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    requestRef.current?.abort();
    requestRef.current = null;
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setIsSearching(false);
  };

  const selectSearchResult = (result: LocationSearchResult) => {
    requestIdRef.current += 1;
    requestRef.current?.abort();
    setSearchResults([]);
    setSearchError("");
    setSearchQuery(result.displayName);
    setLocationError("");
    setLocationMessage("Location selected. Review the address and adjust the pin before saving.");
    const address = addressFieldsFromProvider(
      extractAddressComponents({
        display_name: result.displayName,
        address: result.address,
      }),
    );
    onChange(
      { latitude: result.latitude, longitude: result.longitude },
      address,
    );
  };

  const handleUseCurrentLocation = async () => {
    requestIdRef.current += 1;
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    requestRef.current?.abort();
    setSearchResults([]);
    setIsSearching(false);
    setIsLocating(true);
    setLocationError("");
    setLocationMessage("");
    try {
      const location = await getCurrentLocation();
      onChange({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      setLocationMessage("Current location selected. Looking up address details…");

      try {
        const address = await reverseGeocodeFromBackend(
          location.latitude,
          location.longitude,
        );
        onChange(
          { latitude: location.latitude, longitude: location.longitude },
          addressFieldsFromProvider(address),
        );
        setLocationMessage(
          "Current location selected. Review the address and pin before saving.",
        );
      } catch (error: unknown) {
        setLocationError(
          `${locationErrorMessage(error, "Address details could not be looked up.")} Your coordinates are selected; existing address fields were kept.`,
        );
        setLocationMessage("");
      }
    } catch (error: unknown) {
      setLocationError(
        locationErrorMessage(error, "Unable to get the device's current location."),
      );
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div className={`shop-location-picker${disabled ? " disabled" : ""}`}>
      <p className="shop-location-picker-instruction">
        {enableLocationTools
          ? "Search for a place, use your current location, or drag the map until the center pin marks your shop entrance. Nothing is saved until you submit."
          : "Drag the map until the center pin marks your shop entrance. Nothing is saved until you submit."}
      </p>

      {enableLocationTools ? <div className="shop-location-search" role="search">
        <label className="visually-hidden" htmlFor="shop-location-search-input">
          Search address, place, city, or postal code
        </label>
        <input
          id="shop-location-search-input"
          type="search"
          autoComplete="off"
          maxLength={200}
          placeholder="Search an address, landmark, city, or postal code"
          value={searchQuery}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSearch();
            }
          }}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            requestIdRef.current += 1;
            if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
            requestRef.current?.abort();
            setSearchResults([]);
            setIsSearching(false);
            if (searchError) setSearchError("");
          }}
          disabled={disabled}
        />
        {searchQuery ? (
          <button
            type="button"
            className="shop-location-search-clear"
            aria-label="Clear location search"
            onClick={clearSearch}
            disabled={disabled}
          >
            ×
          </button>
        ) : null}
        <button
          type="button"
          className="shop-location-search-submit"
          aria-label="Search locations"
          disabled={disabled || isSearching}
          onClick={handleSearch}
        >
          {isSearching ? (
            <span className="shop-location-spinner" aria-hidden="true" />
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="10.8" cy="10.8" r="6.5" />
              <path d="m16 16 4.2 4.2" />
            </svg>
          )}
        </button>
        {searchResults.length ? (
          <ul className="shop-location-search-results" role="listbox">
            {searchResults.map((result, index) => (
              <li key={`${result.latitude}:${result.longitude}:${index}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => selectSearchResult(result)}
                  disabled={disabled}
                >
                  <span className="shop-location-result-icon" aria-hidden="true">⌖</span>
                  <span>{result.displayName}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div> : null}

      {enableLocationTools && searchError ? <p className="shop-location-feedback error" role="alert">{searchError}</p> : null}
      {enableLocationTools ? <div className="shop-location-picker-actions">
        <button
          type="button"
          className="shop-location-current-button"
          onClick={() => void handleUseCurrentLocation()}
          disabled={disabled || isLocating}
        >
          {isLocating ? <span className="shop-location-spinner" aria-hidden="true" /> : null}
          {isLocating ? "Getting Current Location…" : "Use Current Location"}
        </button>
        {isLocating ? <span role="status">Requesting device location and address…</span> : null}
      </div> : null}
      {enableLocationTools && locationError ? <p className="shop-location-feedback error" role="alert">{locationError}</p> : null}
      {enableLocationTools && locationMessage ? <p className="shop-location-feedback success" role="status">{locationMessage}</p> : null}

      <AddressMap
        latitude={coordinates?.latitude}
        longitude={coordinates?.longitude}
        onDetectLocation={() => undefined}
        onLocationChange={handleMapLocationChange}
        isDetecting={isLocating}
        reverseGeocodeOnMove={false}
        instructionLabel="Move the center pin to your shop entrance"
        emptyTitle="Select your shop entrance"
        emptyDescription="Drag the map until the pin marks the exact shop entrance."
        showCurrentLocationButton={false}
        emptyMapView={{ latitude: 22.9734, longitude: 78.6569, zoom: 5 }}
      />
      {coordinates ? (
        <p className="shop-location-picker-selected" role="status">
          Selected coordinates: {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
        </p>
      ) : (
        <p className="shop-location-picker-unselected" role="status">
          {enableLocationTools
            ? "No shop location selected yet. Select a result, use current location, or move the map pin."
            : "No shop location selected yet. Move the map pin to the shop entrance."}
        </p>
      )}
    </div>
  );
};

export default ShopLocationPicker;

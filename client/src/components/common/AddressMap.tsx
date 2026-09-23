import { useEffect, useRef, useState } from "react";

import {
  reverseGeocode,
  type DetectedLocation,
} from "../../services/locationService";

import "./AddressMap.css";

interface AddressMapProps {
  latitude?: number;
  longitude?: number;
  onDetectLocation: () => void;
  onLocationChange: (location: DetectedLocation) => void;
  isDetecting: boolean;
}

interface GoogleMapsWindow extends Window {
  google?: any;
}

const DEFAULT_CENTER = {
  lat: 28.601531,
  lng: 77.433498,
};

let googleMapsLoader: Promise<any> | null = null;

const loadGoogleMaps = (): Promise<any> => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  if (!apiKey) {
    return Promise.reject(
      new Error(
        "VITE_GOOGLE_MAPS_API_KEY is missing. Add your Google Maps JavaScript API key to the client .env file.",
      ),
    );
  }

  const googleWindow = window as GoogleMapsWindow;

  if (googleWindow.google?.maps) {
    return Promise.resolve(googleWindow.google);
  }

  if (googleMapsLoader) {
    return googleMapsLoader;
  }

  googleMapsLoader = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-quickcart-google-maps="true"]',
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (googleWindow.google?.maps) {
          resolve(googleWindow.google);
        } else {
          reject(new Error("Google Maps loaded without the Maps API."));
        }
      });

      existingScript.addEventListener("error", () => {
        reject(new Error("Unable to load Google Maps."));
      });

      return;
    }

    const script = document.createElement("script");
    script.dataset.quickcartGoogleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&v=weekly`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (googleWindow.google?.maps) {
        resolve(googleWindow.google);
      } else {
        reject(new Error("Google Maps loaded without the Maps API."));
      }
    };

    script.onerror = () => {
      reject(new Error("Unable to load Google Maps."));
    };

    document.head.appendChild(script);
  });

  return googleMapsLoader;
};

const AddressMap = ({
  latitude,
  longitude,
  onDetectLocation,
  onLocationChange,
  isDetecting,
}: AddressMapProps) => {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const centerMarkerRef = useRef<HTMLDivElement | null>(null);
  const geocodeRequestRef = useRef(0);
  const [mapError, setMapError] = useState("");
  const [isUpdatingAddress, setIsUpdatingAddress] = useState(false);

  const hasCoordinates =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  const currentCenter = hasCoordinates
    ? { lat: latitude as number, lng: longitude as number }
    : DEFAULT_CENTER;

  useEffect(() => {
    let cancelled = false;

    const initializeMap = async () => {
      try {
        setMapError("");

        const google = await loadGoogleMaps();

        if (cancelled || !mapElementRef.current) {
          return;
        }

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapElementRef.current, {
            center: currentCenter,
            zoom: hasCoordinates ? 17 : 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            clickableIcons: true,
            gestureHandling: "greedy",
          });

          const centerMarker = document.createElement("div");
          centerMarker.className = "address-map-center-pin";
          centerMarker.innerHTML = `
            <span class="address-map-center-pin-icon">📍</span>
          `;
          centerMarkerRef.current = centerMarker;
          mapElementRef.current.appendChild(centerMarker);

          mapRef.current.addListener("dragstart", () => {
            setMapError("");
          });

          mapRef.current.addListener("dragend", async () => {
            const center = mapRef.current.getCenter();

            if (!center) {
              return;
            }

            const nextLatitude = center.lat();
            const nextLongitude = center.lng();
            const requestId = ++geocodeRequestRef.current;

            setIsUpdatingAddress(true);

            try {
              const address = await reverseGeocode(nextLatitude, nextLongitude);

              if (cancelled || requestId !== geocodeRequestRef.current) {
                return;
              }

              onLocationChange({
                latitude: nextLatitude,
                longitude: nextLongitude,
                accuracy: 0,
                address,
              });
            } catch (error) {
              if (cancelled) {
                return;
              }

              console.error("Map reverse geocoding failed:", error);
              setMapError(
                "Unable to update the address for this map location.",
              );
            } finally {
              if (!cancelled && requestId === geocodeRequestRef.current) {
                setIsUpdatingAddress(false);
              }
            }
          });
        }

        mapRef.current.panTo(currentCenter);

        if (hasCoordinates) {
          mapRef.current.setZoom(17);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Google Maps initialization failed:", error);
        setMapError(
          error instanceof Error
            ? error.message
            : "Unable to load Google Maps.",
        );
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, hasCoordinates]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    mapRef.current.panTo(currentCenter);

    if (hasCoordinates) {
      mapRef.current.setZoom(17);
    }
  }, [latitude, longitude, hasCoordinates]);

  return (
    <div className="address-map">
      <div
        ref={mapElementRef}
        className="address-map-canvas"
        aria-label="Delivery location map"
      />

      <div className="address-map-search-hint">
        <span>⌖</span>
        <span>Move the map to choose your exact delivery location</span>
      </div>

      <button
        type="button"
        className="address-map-detect-button"
        onClick={onDetectLocation}
        disabled={isDetecting}
      >
        {isDetecting ? "Detecting..." : "◎ Go to current location"}
      </button>

      {isUpdatingAddress && (
        <div className="address-map-updating">Updating address...</div>
      )}

      {mapError && <div className="address-map-error">{mapError}</div>}

      {!hasCoordinates && !mapError && (
        <div className="address-map-empty">
          <span>📍</span>
          <strong>Set your delivery location</strong>
          <small>
            Detect your current location or move the map to choose a location.
          </small>
        </div>
      )}
    </div>
  );
};

export default AddressMap;

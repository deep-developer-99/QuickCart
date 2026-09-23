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

/*
 * We only use the small part of the Google Maps API that this component
 * needs. Defining these interfaces keeps the component fully typed without
 * adding untyped values or depending on @types/google.maps.
 */
interface GoogleLatLng {
  lat: () => number;
  lng: () => number;
}

interface GoogleMap {
  panTo: (position: GoogleLatLngLiteral) => void;
  setZoom: (zoom: number) => void;
  getCenter: () => GoogleLatLng | null;
  addListener: (
    eventName: "dragstart" | "dragend",
    handler: () => void | Promise<void>,
  ) => void;
}

interface GoogleLatLngLiteral {
  lat: number;
  lng: number;
}

interface GoogleMapOptions {
  center: GoogleLatLngLiteral;
  zoom: number;
  mapTypeControl: boolean;
  streetViewControl: boolean;
  fullscreenControl: boolean;
  clickableIcons: boolean;
  gestureHandling: "greedy" | "cooperative" | "none" | "auto";
}

interface GoogleMapsApi {
  maps: {
    Map: new (element: HTMLElement, options: GoogleMapOptions) => GoogleMap;
  };
}

interface GoogleMapsWindow extends Window {
  google?: GoogleMapsApi;
}

const DEFAULT_CENTER: GoogleLatLngLiteral = {
  lat: 28.601531,
  lng: 77.433498,
};

let googleMapsLoader: Promise<GoogleMapsApi> | null = null;

const loadGoogleMaps = (): Promise<GoogleMapsApi> => {
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

  googleMapsLoader = new Promise<GoogleMapsApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-quickcart-google-maps="true"]',
    );

    const handleLoad = () => {
      if (googleWindow.google?.maps) {
        resolve(googleWindow.google);
      } else {
        reject(new Error("Google Maps loaded without the Maps API."));
      }
    };

    const handleError = () => {
      reject(new Error("Unable to load Google Maps."));
    };

    if (existingScript) {
      existingScript.addEventListener("load", handleLoad, { once: true });

      existingScript.addEventListener("error", handleError, { once: true });

      return;
    }

    const script = document.createElement("script");

    script.dataset.quickcartGoogleMaps = "true";

    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&v=weekly`;

    script.async = true;
    script.defer = true;

    script.addEventListener("load", handleLoad, { once: true });

    script.addEventListener("error", handleError, { once: true });

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

  const mapRef = useRef<GoogleMap | null>(null);

  const geocodeRequestRef = useRef(0);

  /*
   * Keep the latest parent callback in a ref. The Google Maps drag
   * listener is registered only once, so without this ref it could
   * keep calling an old callback from an earlier render.
   */
  const onLocationChangeRef = useRef(onLocationChange);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  const [mapError, setMapError] = useState("");

  const [isUpdatingAddress, setIsUpdatingAddress] = useState(false);

  const hasCoordinates =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  const currentCenter: GoogleLatLngLiteral = hasCoordinates
    ? {
        lat: latitude as number,
        lng: longitude as number,
      }
    : DEFAULT_CENTER;

  /*
   * Create the Google Map only once. Location changes are handled by the
   * separate effect below, which calls panTo() on the existing map.
   */
  useEffect(() => {
    let cancelled = false;

    const initializeMap = async () => {
      try {
        setMapError("");

        const googleMaps = await loadGoogleMaps();

        if (cancelled || !mapElementRef.current) {
          return;
        }

        if (mapRef.current) {
          return;
        }

        const map = new googleMaps.maps.Map(mapElementRef.current, {
          center: DEFAULT_CENTER,
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: true,
          gestureHandling: "greedy",
        });

        mapRef.current = map;

        const centerMarker = document.createElement("div");

        centerMarker.className = "address-map-center-pin";

        centerMarker.innerHTML = `
            <span class="address-map-center-pin-icon">📍</span>
          `;

        mapElementRef.current.appendChild(centerMarker);

        map.addListener("dragstart", () => {
          setMapError("");
        });

        map.addListener("dragend", async () => {
          const center = map.getCenter();

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

            onLocationChangeRef.current({
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

            setMapError("Unable to update the address for this map location.");
          } finally {
            if (!cancelled && requestId === geocodeRequestRef.current) {
              setIsUpdatingAddress(false);
            }
          }
        });
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

    void initializeMap();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Whenever Checkout receives a new location (initial GPS detection,
   * "Go to current location", or a manually selected map location),
   * move the existing map to that exact coordinate.
   */
  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    map.panTo(currentCenter);

    if (hasCoordinates) {
      map.setZoom(17);
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

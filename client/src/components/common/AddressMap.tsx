import { useEffect, useRef, useState } from "react";
import L, { type Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  reverseGeocodeFromBackend,
  type DetectedLocation,
} from "../../services/locationService";

import "./AddressMap.css";

interface AddressMapProps {
  latitude?: number;
  longitude?: number;
  onDetectLocation: () => void;
  onLocationChange: (location: DetectedLocation) => void;
  isDetecting: boolean;
  reverseGeocodeOnMove?: boolean;
  instructionLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  showCurrentLocationButton?: boolean;
  emptyMapView?: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
}

interface Coordinates {
  lat: number;
  lng: number;
}

const DEFAULT_CENTER: Coordinates = {
  lat: 28.601531,
  lng: 77.433498,
};

const DEFAULT_ZOOM = 16;

const AddressMap = ({
  latitude,
  longitude,
  onDetectLocation,
  onLocationChange,
  isDetecting,
  reverseGeocodeOnMove = true,
  instructionLabel = "Move map to select delivery location",
  emptyTitle = "Select your delivery location",
  emptyDescription = "Move the map so the pin is exactly where you want delivery.",
  showCurrentLocationButton = true,
  emptyMapView,
}: AddressMapProps) => {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const reverseGeocodeOnMoveRef = useRef(reverseGeocodeOnMove);
  const geocodeRequestRef = useRef(0);
  const hasInitialisedRef = useRef(false);

  const [addressError, setAddressError] = useState("");
  const [tileError, setTileError] = useState("");
  const [isUpdatingAddress, setIsUpdatingAddress] = useState(false);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    reverseGeocodeOnMoveRef.current = reverseGeocodeOnMove;
  }, [reverseGeocodeOnMove]);

  const hasCoordinates =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  const currentCenter: Coordinates = hasCoordinates
    ? { lat: latitude, lng: longitude }
    : emptyMapView
      ? { lat: emptyMapView.latitude, lng: emptyMapView.longitude }
      : DEFAULT_CENTER;

  useEffect(() => {
    if (!mapElementRef.current || hasInitialisedRef.current) {
      return;
    }

    hasInitialisedRef.current = true;

    const map = L.map(mapElementRef.current, {
      center: [currentCenter.lat, currentCenter.lng],
      zoom: hasCoordinates ? DEFAULT_ZOOM : (emptyMapView?.zoom ?? 13),
      zoomControl: false,
      attributionControl: true,
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
    });

    mapRef.current = map;

    let successfulTileLoads = 0;
    let failedTileLoads = 0;
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        minZoom: 3,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
      },
    ).addTo(map);
    tiles.on("tileload", () => {
      successfulTileLoads += 1;
      setTileError("");
    });
    tiles.on("tileerror", () => {
      failedTileLoads += 1;
      if (successfulTileLoads === 0 && failedTileLoads >= 3) {
        setTileError("Map tiles could not be loaded. Check your connection and try again.");
      }
    });

    // Google-like vertical zoom controls on the top-left.
    L.control.zoom({ position: "topright" }).addTo(map);

    const handleDragStart = () => {
      geocodeRequestRef.current += 1;
      setIsUpdatingAddress(false);
      setAddressError("");
    };

    const handleDragEnd = async () => {
      const center = map.getCenter();
      const nextLatitude = center.lat;
      const nextLongitude = center.lng;
      const requestId = ++geocodeRequestRef.current;

      if (!reverseGeocodeOnMoveRef.current) {
        onLocationChangeRef.current({
          latitude: nextLatitude,
          longitude: nextLongitude,
          accuracy: 0,
          address: {
            addressLine: "",
            city: "",
            state: "",
            pincode: "",
            displayName: "",
          },
        });
        return;
      }

      setIsUpdatingAddress(true);
      setAddressError("");

      try {
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        if (requestId !== geocodeRequestRef.current) return;
        const address = await reverseGeocodeFromBackend(nextLatitude, nextLongitude);

        if (requestId !== geocodeRequestRef.current) {
          return;
        }

        onLocationChangeRef.current({
          latitude: nextLatitude,
          longitude: nextLongitude,
          accuracy: 0,
          address,
        });
      } catch (error) {
        if (requestId !== geocodeRequestRef.current) {
          return;
        }

        console.error("Map reverse geocoding failed:", error);
        setAddressError("Unable to update the address for this location.");
      } finally {
        if (requestId === geocodeRequestRef.current) {
          setIsUpdatingAddress(false);
        }
      }
    };

    map.on("dragstart", handleDragStart);
    map.on("dragend", handleDragEnd);

    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mapElementRef.current);

    // Fix initial rendering when the map is inside a flex/grid layout.
    window.setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      map.off("dragstart", handleDragStart);
      map.off("dragend", handleDragEnd);
      map.remove();
      mapRef.current = null;
      hasInitialisedRef.current = false;
    };
    // Map initialization intentionally happens only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const nextCenter: [number, number] = [currentCenter.lat, currentCenter.lng];

    const currentMapCenter = map.getCenter();
    const movedDistance = map.distance(currentMapCenter, nextCenter);

    // Parent changes (GPS detection / saved coordinates) should move the map.
    // Tiny changes from Leaflet's own drag cycle are ignored.
    if (movedDistance > 8) {
      map.setView(nextCenter, hasCoordinates ? DEFAULT_ZOOM : map.getZoom(), {
        animate: true,
        duration: 0.45,
      });
    }
  }, [
    latitude,
    longitude,
    hasCoordinates,
    currentCenter.lat,
    currentCenter.lng,
  ]);

  const handleLocateButton = () => {
    setAddressError("");
    onDetectLocation();
  };

  return (
    <div className="address-map">
      <div
        ref={mapElementRef}
        className="address-map-canvas"
        aria-label="Delivery location map"
      />

      <div className="address-map-topbar">
        <div className="address-map-location-chip">
          <span className="address-map-location-dot" aria-hidden="true" />
          <span>{instructionLabel}</span>
        </div>
      </div>

      <div className="address-map-center-marker" aria-hidden="true">
        <div className="address-map-marker-shadow" />
        <div className="address-map-marker-pin">
          <span />
        </div>
      </div>

      {showCurrentLocationButton ? <button
        type="button"
        className="address-map-locate"
        onClick={handleLocateButton}
        disabled={isDetecting}
        aria-label="Go to current location"
        title="Go to current location"
      >
        <span className="address-map-locate-icon" aria-hidden="true">
          ⦿
        </span>
        <span>{isDetecting ? "Locating..." : "Current location"}</span>
      </button> : null}

      {isUpdatingAddress && (
        <div className="address-map-status">Updating address...</div>
      )}

      {addressError && <div className="address-map-error">{addressError}</div>}

      {tileError && (
        <div className="address-map-tile-error" role="alert">
          {tileError}
        </div>
      )}

      {!hasCoordinates && !addressError && (
        <div className="address-map-empty">
          <strong>{emptyTitle}</strong>
          <span>{emptyDescription}</span>
        </div>
      )}
    </div>
  );
};

export default AddressMap;

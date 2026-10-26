import { useCallback } from "react";

import AddressMap from "../common/AddressMap";
import type { DetectedLocation } from "../../services/locationService";

export interface ShopCoordinates {
  latitude: number;
  longitude: number;
}

interface ShopLocationPickerProps {
  coordinates: ShopCoordinates | null;
  onChange: (coordinates: ShopCoordinates) => void;
  disabled?: boolean;
}

const ShopLocationPicker = ({
  coordinates,
  onChange,
  disabled = false,
}: ShopLocationPickerProps) => {
  const handleLocationChange = useCallback(
    (location: DetectedLocation) => {
      onChange({
        latitude: location.latitude,
        longitude: location.longitude,
      });
    },
    [onChange],
  );

  return (
    <div className={`shop-location-picker${disabled ? " disabled" : ""}`}>
      <p className="shop-location-picker-instruction">
        Drag the map until the center pin marks your shop entrance. The map
        location is saved only after you submit the form.
      </p>
      <AddressMap
        latitude={coordinates?.latitude}
        longitude={coordinates?.longitude}
        onDetectLocation={() => undefined}
        onLocationChange={handleLocationChange}
        isDetecting={false}
        reverseGeocodeOnMove={false}
        instructionLabel="Move the center pin to your shop entrance"
        emptyTitle="Select your shop entrance"
        emptyDescription="Drag the map until the center pin marks the exact shop entrance."
        showCurrentLocationButton={false}
        emptyMapView={{ latitude: 22.9734, longitude: 78.6569, zoom: 5 }}
      />
      {coordinates ? (
        <p className="shop-location-picker-selected" role="status">
          Location selected: {coordinates.latitude.toFixed(6)},{" "}
          {coordinates.longitude.toFixed(6)}
        </p>
      ) : (
        <p className="shop-location-picker-unselected" role="status">
          No shop location selected yet. Move the map to place the center pin.
        </p>
      )}
    </div>
  );
};

export default ShopLocationPicker;

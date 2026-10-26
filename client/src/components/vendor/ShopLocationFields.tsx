import type { ChangeEvent } from "react";

import ShopLocationPicker from "./ShopLocationPicker";
import "./ShopLocationFields.css";

export interface ShopLocationDraft {
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
}

interface ShopLocationFieldsProps {
  value: ShopLocationDraft;
  onChange: (value: Partial<ShopLocationDraft>) => void;
  disabled?: boolean;
  enableLocationTools?: boolean;
}

const ShopLocationFields = ({
  value,
  onChange,
  disabled = false,
  enableLocationTools = false,
}: ShopLocationFieldsProps) => {
  const updateText =
    (field: "address" | "city" | "state" | "pincode") =>
    (event: ChangeEvent<HTMLInputElement>) =>
      onChange({ [field]: event.target.value });

  const hasCoordinates =
    typeof value.latitude === "number" &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude);

  return (
    <section
      className="shop-location-fields"
      aria-labelledby="shop-location-title"
    >
      <div className="shop-location-fields-heading">
        <h2 id="shop-location-title">Shop address and map location</h2>
        <p>
          Enter the complete address, then place the map pin at the exact shop
          entrance.
        </p>
      </div>

      <label htmlFor="shop-address">Street address or building</label>
      <input
        id="shop-address"
        name="address"
        type="text"
        autoComplete="street-address"
        maxLength={300}
        placeholder="Shop or building number and street"
        value={value.address}
        onChange={updateText("address")}
        disabled={disabled}
        required
      />

      <div className="shop-location-address-grid">
        <div>
          <label htmlFor="shop-city">City</label>
          <input
            id="shop-city"
            name="city"
            type="text"
            autoComplete="address-level2"
            maxLength={100}
            value={value.city}
            onChange={updateText("city")}
            disabled={disabled}
            required
          />
        </div>
        <div>
          <label htmlFor="shop-state">State</label>
          <input
            id="shop-state"
            name="state"
            type="text"
            autoComplete="address-level1"
            maxLength={100}
            value={value.state}
            onChange={updateText("state")}
            disabled={disabled}
            required
          />
        </div>
        <div>
          <label htmlFor="shop-pincode">Postal code</label>
          <input
            id="shop-pincode"
            name="pincode"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            pattern="[0-9]{6}"
            value={value.pincode}
            onChange={updateText("pincode")}
            disabled={disabled}
            required
          />
        </div>
      </div>

      <ShopLocationPicker
        coordinates={
          hasCoordinates
            ? {
                latitude: value.latitude as number,
                longitude: value.longitude as number,
              }
            : null
        }
        onChange={(coordinates, address) =>
          onChange({ ...coordinates, ...address })
        }
        disabled={disabled}
        enableLocationTools={enableLocationTools}
      />
    </section>
  );
};

export default ShopLocationFields;

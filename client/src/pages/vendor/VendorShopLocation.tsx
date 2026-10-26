import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

import ShopLocationFields from "../../components/vendor/ShopLocationFields";
import type { ShopLocationDraft } from "../../components/vendor/ShopLocationFields";
import {
  getVendorShopLocation,
  updateVendorShopLocation,
} from "../../services/authService";
import type { Vendor } from "../../types/auth";

import "./VendorShopLocation.css";

const EMPTY_LOCATION: ShopLocationDraft = {
  address: "",
  city: "",
  state: "",
  pincode: "",
  latitude: null,
  longitude: null,
};

const VendorShopLocation = () => {
  const [location, setLocation] = useState<ShopLocationDraft>(EMPTY_LOCATION);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const response = await getVendorShopLocation();
        const vendor = response?.data as Vendor | undefined;
        if (!response?.success || !vendor?._id) {
          throw new Error("Unable to load the vendor shop profile.");
        }
        if (active) {
          setLocation({
            address: vendor.address ?? "",
            city: vendor.city ?? "",
            state: vendor.state ?? "",
            pincode: vendor.pincode ?? "",
            latitude:
              typeof vendor.latitude === "number" ? vendor.latitude : null,
            longitude:
              typeof vendor.longitude === "number" ? vendor.longitude : null,
          });
        }
      } catch (requestError: unknown) {
        if (active) {
          setError(
            axios.isAxiosError(requestError)
              ? requestError.response?.data?.message ||
                  "Unable to load the shop profile. Please try again."
              : requestError instanceof Error
                ? requestError.message
                : "Unable to load the shop profile. Please try again.",
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (
      !location.address.trim() ||
      !location.city.trim() ||
      !location.state.trim() ||
      !/^\d{6}$/.test(location.pincode.trim())
    ) {
      setError("Enter the complete shop address, city, state, and 6-digit postal code.");
      return;
    }
    if (
      typeof location.latitude !== "number" ||
      typeof location.longitude !== "number" ||
      !Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude) ||
      location.latitude < -90 ||
      location.latitude > 90 ||
      location.longitude < -180 ||
      location.longitude > 180
    ) {
      setError("Select the exact shop location on the map before saving.");
      return;
    }

    try {
      setIsSaving(true);
      const response = await updateVendorShopLocation({
        address: location.address.trim(),
        city: location.city.trim(),
        state: location.state.trim(),
        pincode: location.pincode.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
      });
      if (!response?.success) {
        throw new Error(response?.message || "Unable to save shop location.");
      }
      const savedVendor = response.data as Vendor;
      setLocation((current) => ({
        ...current,
        address: savedVendor.address ?? current.address,
        city: savedVendor.city ?? current.city,
        state: savedVendor.state ?? current.state,
        pincode: savedVendor.pincode ?? current.pincode,
        latitude: savedVendor.latitude ?? current.latitude,
        longitude: savedVendor.longitude ?? current.longitude,
      }));
      setSuccess("Shop address and map location saved.");
    } catch (requestError: unknown) {
      setError(
        axios.isAxiosError(requestError)
          ? requestError.response?.data?.message ||
              "Unable to save shop location. Please try again."
          : requestError instanceof Error
            ? requestError.message
            : "Unable to save shop location. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <main className="vendor-shop-location-page">
        <div className="vendor-shop-location-loading" role="status">
          Loading shop profile…
        </div>
      </main>
    );
  }

  return (
    <main className="vendor-shop-location-page">
      <div className="vendor-shop-location-container">
        <header className="vendor-shop-location-header">
          <div>
            <span className="vendor-shop-location-eyebrow">SHOP PROFILE</span>
            <h1>Shop address and location</h1>
            <p>
              Keep the full address and exact map pin current so customers see
              the right pickup location.
            </p>
          </div>
          <Link to="/vendor/dashboard" className="vendor-shop-location-back">
            Back to dashboard
          </Link>
        </header>

        {error ? (
          <div className="vendor-shop-location-alert error" role="alert">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="vendor-shop-location-alert success" role="status">
            {success}
          </div>
        ) : null}

        <form className="vendor-shop-location-card" onSubmit={handleSave}>
          <ShopLocationFields
            value={location}
            onChange={(next) => {
              setError("");
              setLocation(next);
              setSuccess("");
            }}
            disabled={isSaving}
          />
          <div className="vendor-shop-location-actions">
            <button
              type="submit"
              disabled={isSaving || location.latitude === null}
            >
              {isSaving ? "Saving shop location…" : "Save shop location"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};

export default VendorShopLocation;

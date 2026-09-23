export interface CurrentLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface ReverseGeocodedAddress {
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  displayName: string;
}

export interface DetectedLocation extends CurrentLocation {
  address: ReverseGeocodedAddress;
}

const STORAGE_KEY = "quickcart_current_location";

export const getCurrentLocation = (): Promise<CurrentLocation> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(
              new Error(
                "Location permission was denied. Please allow location access.",
              ),
            );
            break;

          case error.POSITION_UNAVAILABLE:
            reject(new Error("Your current location is unavailable."));
            break;

          case error.TIMEOUT:
            reject(new Error("Location request timed out. Please try again."));
            break;

          default:
            reject(new Error("Unable to get your current location."));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  });
};

export const reverseGeocode = async (
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodedAddress> => {
  const url =
    `https://nominatim.openstreetmap.org/reverse` +
    `?format=jsonv2` +
    `&lat=${encodeURIComponent(latitude)}` +
    `&lon=${encodeURIComponent(longitude)}` +
    `&zoom=18` +
    `&addressdetails=1`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to find an address for your current location.");
  }

  const data = await response.json();
  const address = data.address ?? {};

  const addressLine = [
    address.house_number,
    address.road,
    address.street,
    address.neighbourhood,
    address.suburb,
  ]
    .filter(Boolean)
    .filter(
      (value: string, index: number, array: string[]) =>
        array.indexOf(value) === index,
    )
    .join(", ");

  return {
    addressLine: addressLine || data.display_name || "",
    city:
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      "",
    state: address.state || "",
    pincode: address.postcode || "",
    displayName: data.display_name || "",
  };
};

export const detectCurrentLocation = async (): Promise<DetectedLocation> => {
  const location = await getCurrentLocation();

  const address = await reverseGeocode(location.latitude, location.longitude);

  return {
    ...location,
    address,
  };
};

export const saveCurrentLocation = (location: DetectedLocation) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(location));

  window.dispatchEvent(new CustomEvent("quickcart:location-changed"));
};

export const getSavedCurrentLocation = (): DetectedLocation | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return null;
    }

    return JSON.parse(stored) as DetectedLocation;
  } catch {
    return null;
  }
};

export const clearSavedCurrentLocation = () => {
  localStorage.removeItem(STORAGE_KEY);

  window.dispatchEvent(new CustomEvent("quickcart:location-changed"));
};

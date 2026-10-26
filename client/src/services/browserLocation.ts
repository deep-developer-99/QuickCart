export interface CurrentLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export const getCurrentLocation = (): Promise<CurrentLocation> =>
  new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      reject(new Error("Current location requires a secure connection (HTTPS)."));
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error("Current location is not available in this browser."));
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
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const optionalCoordinates = (input: {
  latitude?: unknown;
  longitude?: unknown;
}): Partial<Coordinates> => {
  const { latitude, longitude } = input;

  if ((latitude === undefined || latitude === null) &&
      (longitude === undefined || longitude === null)) {
    return {};
  }

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Latitude and longitude must be a valid coordinate pair.");
  }

  return { latitude, longitude };
};

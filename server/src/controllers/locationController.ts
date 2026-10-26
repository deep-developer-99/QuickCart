import { Request, Response } from "express";
import {
  forwardGeocodeAddress,
  LocationLookupError,
  reverseGeocodeCoordinates,
} from "../services/locationService";

const errorResponse = (error: unknown, res: Response): void => {
  const code =
    error instanceof LocationLookupError ? error.code : "PROVIDER_ERROR";
  const status =
    code === "INVALID_INPUT"
      ? 400
      : code === "NOT_FOUND"
        ? 404
        : code === "RATE_LIMITED"
          ? 429
          : code === "TIMEOUT"
            ? 504
            : 502;
  const message: Record<string, string> = {
    INVALID_INPUT: "Enter a complete address to look up.",
    NOT_FOUND: "No map location was found for this address.",
    RATE_LIMITED: "The address provider is temporarily rate-limiting requests.",
    TIMEOUT: "The address provider did not respond in time.",
    PROVIDER_ERROR: "The address provider could not complete this lookup.",
  };
  res.status(status).json({ success: false, code, message: message[code] });
};

export const forwardGeocodeController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await forwardGeocodeAddress(req.body?.address);
    res.status(200).json({
      success: true,
      data: {
        latitude: result.coordinate.latitude,
        longitude: result.coordinate.longitude,
        displayName: result.displayName,
      },
    });
  } catch (error) {
    errorResponse(error, res);
  }
};

export const reverseGeocodeController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  try {
    const result = await reverseGeocodeCoordinates(latitude, longitude);
    res.json({ success: true, data: result });
  } catch (error) {
    errorResponse(error, res);
  }
};

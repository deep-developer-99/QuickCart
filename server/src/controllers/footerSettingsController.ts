import { Request, Response } from "express";
import FooterSettings, { defaultFooterSettings, isFooterUrl } from "../models/FooterSettings";

class InvalidFooterSettings extends Error {}

const record = (input: unknown, label: string): Record<string, unknown> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new InvalidFooterSettings(`${label} must be an object.`);
  }
  return input as Record<string, unknown>;
};

const readText = (value: unknown, label: string, max: number, required = false) => {
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) {
    throw new InvalidFooterSettings(`${label} must be ${required ? "between 1 and" : "at most"} ${max} characters.`);
  }
  return value.trim();
};

const readLinks = (value: unknown, ordered: boolean) => {
  const max = ordered ? 30 : 10;
  const name = ordered ? "Useful links" : "Social links";
  if (!Array.isArray(value) || value.length > max) {
    throw new InvalidFooterSettings(`${name} must be a list of up to ${max} items.`);
  }
  return value.map((entry, index) => {
    const title = `${name}, item ${index + 1}`;
    const { label, href, isActive, order } = record(entry, title);
    if (typeof href !== "string" || !isFooterUrl(href.trim(), ordered)) {
      throw new InvalidFooterSettings(`${title} needs a valid ${ordered ? "website path or " : ""}HTTP(S) URL.`);
    }
    if (typeof isActive !== "boolean") {
      throw new InvalidFooterSettings(`${title} needs an active or inactive status.`);
    }
    const link = { label: readText(label, `${title} name`, 60, true), href: href.trim(), isActive };
    if (!ordered) return link;
    if (typeof order !== "number" || !Number.isSafeInteger(order) || order < 0) {
      throw new InvalidFooterSettings(`${title} needs a valid position.`);
    }
    return { ...link, order };
  });
};

const textLimits = { copyright: 160, disclaimer: 300, tagline: 160 } as const;

const readPatch = (body: unknown) => {
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record(body, "Footer settings"))) {
    switch (key) {
      case "usefulLinks":
        changes.usefulLinks = readLinks(value, true);
        break;
      case "socialLinks":
        changes.socialLinks = readLinks(value, false);
        changes.socialLinksConfigured = true;
        break;
      case "headings":
        for (const [heading, text] of Object.entries(record(value, "Headings"))) {
          if (!Object.hasOwn(defaultFooterSettings.headings, heading)) {
            throw new InvalidFooterSettings(`Unknown footer heading: ${heading}.`);
          }
          changes[`headings.${heading}`] = readText(text, "Section heading", 60, true);
        }
        break;
      case "appLinks":
        for (const [store, url] of Object.entries(record(value, "App download links"))) {
          if (!Object.hasOwn(defaultFooterSettings.appLinks, store)) {
            throw new InvalidFooterSettings(`Unknown app store: ${store}.`);
          }
          if (typeof url !== "string" || (url.trim() && !isFooterUrl(url.trim()))) {
            throw new InvalidFooterSettings("App download links must be valid HTTP(S) URLs or blank.");
          }
          changes[`appLinks.${store}`] = url.trim();
        }
        break;
      case "copyright":
      case "disclaimer":
      case "tagline":
        changes[key] = readText(value, key[0].toUpperCase() + key.slice(1), textLimits[key]);
        break;
      default:
        throw new InvalidFooterSettings(`Unsupported footer field: ${key}.`);
    }
  }
  return changes;
};

const presentSettings = (settings: Awaited<ReturnType<typeof findSettings>>) => {
  if (!settings) return defaultFooterSettings;
  const { usefulLinks, socialLinks, socialLinksConfigured, appLinks, headings, copyright, disclaimer, tagline } = settings;

  return {
    usefulLinks,
    // Older records stored an empty list even while showing the built-in socials.
    socialLinks: socialLinks.length || socialLinksConfigured ? socialLinks : defaultFooterSettings.socialLinks,
    appLinks,
    headings,
    copyright,
    disclaimer,
    tagline,
  };
};

const findSettings = () => FooterSettings.findOne({ key: "global" }).exec();

export const getPublicFooterSettingsController = async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: presentSettings(await findSettings()) });
  } catch (error) {
    console.error("Get public footer settings error:", error);
    res.json({ success: true, data: defaultFooterSettings });
  }
};

export const getAdminFooterSettingsController = async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: presentSettings(await findSettings()) });
  } catch (error) {
    console.error("Get admin footer settings error:", error);
    res.status(500).json({ success: false, message: "Failed to load footer settings." });
  }
};

export const updateAdminFooterSettingsController = async (req: Request, res: Response) => {
  try {
    const changes = readPatch(req.body);
    const settings = Object.keys(changes).length
      ? await FooterSettings.findOneAndUpdate(
        { key: "global" },
        { $set: changes },
        { returnDocument: "after", upsert: true, runValidators: true, setDefaultsOnInsert: true },
      ).exec()
      : await findSettings();
    res.json({ success: true, data: presentSettings(settings) });
  } catch (error) {
    if (error instanceof InvalidFooterSettings) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    console.error("Update footer settings error:", error);
    res.status(500).json({ success: false, message: "The server could not save your footer. Please try again." });
  }
};

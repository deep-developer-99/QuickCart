import type { Request, Response } from "express";
import {
  createSearchSuggestion, deleteSearchSuggestion, getAdminSearchSuggestions,
  getPublicSearchSuggestions, reorderSearchSuggestions, updateSearchSuggestion,
  updateSearchSuggestionSettings,
} from "../services/searchSuggestionService";

const sendError = (res: Response, error: unknown, fallback: string) => {
  const candidate = error as { statusCode?: number; code?: number; name?: string; message?: string };
  const status = candidate?.code === 11000 ? 409 : candidate?.statusCode ?? (candidate?.name === "Error" || candidate?.name === "ValidationError" || candidate?.name === "CastError" ? 400 : 500);
  res.status(status).json({ success: false, message: candidate?.code === 11000 ? "A suggestion with this phrase already exists" : candidate?.message || fallback });
};
const phraseFrom = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const phrase = value.trim();
  if (!phrase || phrase.length > 100) throw new Error("Phrase must be between 1 and 100 characters");
  return phrase;
};

export const getPublicSearchSuggestionsController = async (_req: Request, res: Response) => {
  try { res.json({ success: true, data: await getPublicSearchSuggestions() }); }
  catch (error) { console.error("Get public search suggestions error:", error); res.status(500).json({ success: false, message: "Failed to load search suggestions" }); }
};

export const getAdminSearchSuggestionsController = async (_req: Request, res: Response) => {
  try { res.json({ success: true, data: await getAdminSearchSuggestions() }); }
  catch (error) { console.error("Get admin search suggestions error:", error); res.status(500).json({ success: false, message: "Failed to load search suggestions" }); }
};

export const createSearchSuggestionController = async (req: Request, res: Response) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).some((key) => !["phrase", "isActive"].includes(key))) throw new Error("Unsupported suggestion fields");
    const phrase = phraseFrom(req.body?.phrase);
    if (!phrase || (req.body?.isActive !== undefined && typeof req.body.isActive !== "boolean")) throw new Error("A valid phrase and optional active status are required");
    res.status(201).json({ success: true, message: "Suggestion created", data: await createSearchSuggestion(phrase, req.body.isActive ?? true) });
  } catch (error) { sendError(res, error, "Failed to create suggestion"); }
};

export const updateSearchSuggestionController = async (req: Request, res: Response) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).some((key) => !["phrase", "isActive", "order"].includes(key))) throw new Error("Unsupported suggestion fields");
    const input: { phrase?: string; isActive?: boolean; order?: number } = {};
    if ("phrase" in req.body) { const phrase = phraseFrom(req.body.phrase); if (!phrase) throw new Error("Phrase is required"); input.phrase = phrase; }
    if ("isActive" in req.body) { if (typeof req.body.isActive !== "boolean") throw new Error("isActive must be a boolean"); input.isActive = req.body.isActive; }
    if ("order" in req.body) { if (!Number.isSafeInteger(req.body.order) || req.body.order < 0) throw new Error("Order must be a non-negative integer"); input.order = req.body.order; }
    if (!Object.keys(input).length) throw new Error("No editable fields provided");
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.json({ success: true, message: "Suggestion updated", data: await updateSearchSuggestion(id, input) });
  } catch (error) { sendError(res, error, "Failed to update suggestion"); }
};

export const deleteSearchSuggestionController = async (req: Request, res: Response) => {
  try { const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id; await deleteSearchSuggestion(id); res.json({ success: true, message: "Suggestion deleted" }); }
  catch (error) { sendError(res, error, "Failed to delete suggestion"); }
};

export const reorderSearchSuggestionsController = async (req: Request, res: Response) => {
  try {
    if (!req.body || typeof req.body !== "object" || Object.keys(req.body).some((key) => key !== "ids") || !Array.isArray(req.body.ids) || req.body.ids.some((id: unknown) => typeof id !== "string")) throw new Error("ids must be an array of suggestion IDs");
    res.json({ success: true, message: "Suggestion order saved", data: await reorderSearchSuggestions(req.body.ids as string[]) });
  } catch (error) { sendError(res, error, "Failed to save suggestion order"); }
};

export const updateSearchSuggestionSettingsController = async (req: Request, res: Response) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).some((key) => !["isEnabled", "rotationInterval"].includes(key))) throw new Error("Unsupported settings fields");
    const { isEnabled, rotationInterval } = req.body ?? {};
    if (typeof isEnabled !== "boolean" || !Number.isInteger(rotationInterval) || rotationInterval < 1000 || rotationInterval > 10000) throw new Error("isEnabled must be a boolean and rotationInterval must be 1000–10000ms");
    const settings = await updateSearchSuggestionSettings({ isEnabled, rotationInterval });
    res.json({ success: true, message: "Rotation settings saved", data: { isEnabled: settings?.isEnabled, rotationInterval: settings?.rotationInterval } });
  } catch (error) { sendError(res, error, "Failed to save rotation settings"); }
};

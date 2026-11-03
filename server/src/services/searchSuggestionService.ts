import mongoose from "mongoose";
import SearchSuggestion from "../models/SearchSuggestion";
import SearchSuggestionSettings from "../models/SearchSuggestionSettings";

export const getSettings = () => SearchSuggestionSettings.findOneAndUpdate(
  { key: "global" }, { $setOnInsert: { key: "global", isEnabled: true, rotationInterval: 2500 } },
  { upsert: true, new: true, setDefaultsOnInsert: true },
);

export const getPublicSearchSuggestions = async () => {
  const [settings, suggestions] = await Promise.all([
    getSettings(), SearchSuggestion.find({ isActive: true }).select("phrase order").sort({ order: 1, _id: 1 }).lean(),
  ]);
  return { isEnabled: settings?.isEnabled ?? true, rotationInterval: settings?.rotationInterval ?? 2500, suggestions };
};

export const getAdminSearchSuggestions = async () => {
  const [settings, suggestions] = await Promise.all([
    getSettings(), SearchSuggestion.find().sort({ order: 1, _id: 1 }).select("phrase order isActive createdAt updatedAt").lean(),
  ]);
  return { isEnabled: settings?.isEnabled ?? true, rotationInterval: settings?.rotationInterval ?? 2500, suggestions };
};

export const createSearchSuggestion = async (phrase: string, isActive: boolean) => {
  const order = await SearchSuggestion.countDocuments();
  return SearchSuggestion.create({ phrase, order, isActive });
};

export const updateSearchSuggestion = async (id: string, input: { phrase?: string; isActive?: boolean; order?: number }) => {
  if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error("Invalid suggestion ID"), { statusCode: 400 });
  const suggestion = await SearchSuggestion.findById(id);
  if (!suggestion) throw Object.assign(new Error("Suggestion not found"), { statusCode: 404 });
  if (input.phrase !== undefined) suggestion.phrase = input.phrase;
  if (input.isActive !== undefined) suggestion.isActive = input.isActive;
  if (input.order !== undefined) suggestion.order = input.order;
  return suggestion.save();
};

export const deleteSearchSuggestion = async (id: string) => {
  if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error("Invalid suggestion ID"), { statusCode: 400 });
  const deleted = await SearchSuggestion.findByIdAndDelete(id);
  if (!deleted) throw Object.assign(new Error("Suggestion not found"), { statusCode: 404 });
  return deleted;
};

export const reorderSearchSuggestions = async (ids: string[]) => {
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length || ids.some((id) => !mongoose.isValidObjectId(id))) throw Object.assign(new Error("Invalid suggestion ordering"), { statusCode: 400 });
  const existingCount = await SearchSuggestion.countDocuments({ _id: { $in: ids } });
  const totalCount = await SearchSuggestion.countDocuments();
  if (existingCount !== ids.length || totalCount !== ids.length) throw Object.assign(new Error("Suggestion list changed. Refresh and try again."), { statusCode: 409 });
  const operations = ids.map((_id, order) => ({ updateOne: { filter: { _id }, update: { $set: { order } } } }));
  if (operations.length) await SearchSuggestion.bulkWrite(operations);
  return getAdminSearchSuggestions();
};

export const updateSearchSuggestionSettings = async (input: { isEnabled: boolean; rotationInterval: number }) =>
  SearchSuggestionSettings.findOneAndUpdate(
    { key: "global" }, { $set: input, $setOnInsert: { key: "global" } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );

export const getEntityId = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object") return null;

  const entity = value as { _id?: unknown; id?: unknown };
  if (entity._id !== undefined && entity._id !== value) return getEntityId(entity._id);
  if (entity.id !== undefined && entity.id !== value) return getEntityId(entity.id);
  return null;
};

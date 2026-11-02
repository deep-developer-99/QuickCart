import type { AuthUser, UserRole } from "../types/auth";
import { getEntityId } from "./getEntityId";

const roles: UserRole[] = ["user", "vendor", "admin"];

export const normalizeAuthUser = (value: unknown): AuthUser | null => {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const id = getEntityId(source._id) ?? getEntityId(source.id);
  if (!id || typeof source.role !== "string" || !roles.includes(source.role as UserRole)) {
    return null;
  }

  return { ...source, id, _id: id } as AuthUser;
};

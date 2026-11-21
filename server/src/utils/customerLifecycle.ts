export const activeCustomerFilter = { isActive: { $ne: false } } as const;

export const deletionReasons = [
  "I don't want to use QuickCart anymore",
  "I'm using a different account",
  "I'm worried about my privacy",
  "You are sending me too many emails/notifications",
  "This app is not working properly",
  "Other",
] as const;

export const customerIdentityFields = ["email", "phone", "googleId"] as const;
export const customerIdentityIndexes = customerIdentityFields.map((field) => ({
  key: { [field]: 1 as const },
  name: `active_customer_${field}`,
  unique: true,
  partialFilterExpression: { isActive: true, [field]: { $type: "string" } },
}));

export const isDuplicateIdentity = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

export const normalizeCustomerPhone = (phone: string) => {
  const trimmed = phone.trim();
  return /^\d{10}$/.test(trimmed) ? `+91${trimmed}` : trimmed;
};

type IdentityIndex = {
  key: Record<string, unknown>;
  name?: string;
  unique?: boolean;
  partialFilterExpression?: Record<string, any>;
  collation?: { locale?: string };
};

export const legacyCustomerIdentityField = (index: IdentityIndex) =>
  index.unique && !index.partialFilterExpression && Object.keys(index.key).length === 1
    ? customerIdentityFields.find((field) => index.key[field] === 1 || index.key[field] === -1)
    : undefined;

export const inspectCustomerIndexDefinitions = (indexes: IdentityIndex[]) => {
  const invalidActiveIndexes = customerIdentityIndexes.filter((expected) => {
    const field = Object.keys(expected.key)[0];
    return !indexes.some((index) => {
      const filter = index.partialFilterExpression;
      return index.name === expected.name && index.unique === true &&
        Object.keys(index.key).length === 1 && index.key[field] === 1 &&
        (!index.collation || index.collation.locale === "simple") &&
        filter && Object.keys(filter).length === 2 && filter.isActive === true &&
        filter[field]?.$type === "string" && Object.keys(filter[field]).length === 1;
    });
  }).map((index) => index.name);
  const legacyIdentityFields = customerIdentityFields.filter((field) =>
    indexes.some((index) => legacyCustomerIdentityField(index) === field),
  );
  return { invalidActiveIndexes, legacyIdentityFields };
};

export const missingCustomerStatusFilter = { isActive: { $exists: false } } as const;

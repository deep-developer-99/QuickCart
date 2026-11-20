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

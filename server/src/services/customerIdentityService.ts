import User from "../models/User";
import { activeCustomerFilter, isDuplicateIdentity } from "../utils/customerLifecycle";

interface GoogleIdentity {
  googleId: string;
  email: string;
  name?: string;
  picture?: string;
}

export const resolveGoogleCustomer = async ({ googleId, email, name, picture }: GoogleIdentity) => {
  const normalizedEmail = email.trim().toLowerCase();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const byIdentity = await User.findOne({ googleId, ...activeCustomerFilter });
    if (byIdentity) return byIdentity;
    const byEmail = await User.findOne({ email: normalizedEmail, ...activeCustomerFilter });
    if (byEmail?.googleId && byEmail.googleId !== googleId) {
      throw new Error("This email belongs to another sign-in identity. Please use your original sign-in method.");
    }
    try {
      if (byEmail) {
        const linked = await User.findOneAndUpdate(
          { _id: byEmail._id, ...activeCustomerFilter, $or: [{ googleId: { $exists: false } }, { googleId: null }, { googleId }] },
          { $set: { googleId, ...(picture && !byEmail.profileImage ? { profileImage: picture } : {}) } },
          { returnDocument: "after", runValidators: true },
        );
        if (linked) return linked;
        continue;
      }
      return await User.create({
        name: name?.trim() || "QuickCart User",
        email: normalizedEmail, googleId, profileImage: picture, role: "user", isActive: true,
      });
    } catch (error) {
      if (!isDuplicateIdentity(error)) throw error;
    }
  }
  throw new Error("We could not finish signing you in. Please try again.");
};

export const resolvePhoneCustomer = async (phone: string, name?: string) => {
  const existing = await User.findOne({ phone, ...activeCustomerFilter });
  if (existing) return existing;
  if (!name?.trim()) throw new Error("Name is required for first-time login");
  try {
    return await User.create({ name: name.trim(), phone, role: "user", isActive: true });
  } catch (error) {
    if (!isDuplicateIdentity(error)) throw error;
    const winner = await User.findOne({ phone, ...activeCustomerFilter });
    if (winner) return winner;
    throw new Error("We could not finish signing you in. Please try again.");
  }
};

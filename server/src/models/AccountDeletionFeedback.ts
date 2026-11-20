import mongoose, { Schema } from "mongoose";

// Separate retention from the historical account. MongoDB TTL removes optional
// feedback after 30 days without removing the customer or financial records.
const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  feedback: { type: String, required: true, maxlength: 1000, select: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export default mongoose.model("AccountDeletionFeedback", schema);

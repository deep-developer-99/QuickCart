import "dotenv/config";
import mongoose from "mongoose";
import { inspectCustomerIdentityIndexes } from "../services/accountDeletionService";

const check = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not configured.");

  await mongoose.connect(uri, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 8000 });
  const issues = await inspectCustomerIdentityIndexes();
  const ready = !issues.invalidActiveIndexes.length && !issues.legacyIdentityFields.length;
  console.log(JSON.stringify({ ready, ...issues }));
  if (!ready) process.exitCode = 1;
};

void check().catch((error: unknown) => {
  const candidate = error as { name?: string; code?: string | number };
  console.error(JSON.stringify({ ready: false, errorName: candidate.name, code: candidate.code }));
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());

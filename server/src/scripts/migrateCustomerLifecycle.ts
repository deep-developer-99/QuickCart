import "dotenv/config";
import mongoose from "mongoose";
import { mkdir, open, writeFile } from "node:fs/promises";
import path from "node:path";
import { customerIdentityFields, customerIdentityIndexes } from "../utils/customerLifecycle";

export const migrateCustomerLifecycle = async (
  backupDirectory?: string,
  dropObsoleteIndexes = false,
) => {
  const collection = mongoose.connection.collection("users");
  const indexes = await collection.indexes();
  const apply = Boolean(backupDirectory);
  const obsoleteIndexes = indexes.filter((index) => {
    const keys = Object.keys(index.key);
    return Boolean(index.name && index.unique && !index.partialFilterExpression &&
      keys.length === 1 &&
      customerIdentityFields.some((field) => keys[0] === field && index.key[field] === 1));
  });

  // Inspect canonical identities and uniqueness before any writes.
  const seen = new Map<string, Set<string>>();
  for (const field of customerIdentityFields) seen.set(field, new Set());
  let count = 0;
  let legacy = 0;
  for await (const user of collection.find({})) {
    count += 1;
    if (user.isActive === undefined) legacy += 1;
    else if (typeof user.isActive !== "boolean") throw new Error("A customer has an invalid isActive value. Review customer data before migration.");
    for (const field of customerIdentityFields) {
      const value = user[field];
      if (value === undefined || value === null) continue;
      if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
        throw new Error(`Invalid ${field} value found. Review customer identities before migration.`);
      }
      if (field === "email" && value !== value.toLowerCase()) throw new Error("Non-canonical email found. Review and normalize customer emails before migration.");
      if (user.isActive === false) continue;
      const canonical = field === "phone" && /^\d{10}$/.test(value) ? `+91${value}` : value;
      if (seen.get(field)!.has(canonical)) throw new Error(`Duplicate active ${field} found. Resolve verified ownership before migration.`);
      seen.get(field)!.add(canonical);
      if (field === "phone" && canonical !== value) throw new Error("A phone needs E.164 normalization. Review and normalize customer phone numbers before migration.");
    }
  }

  console.log(`Preflight passed for ${count} customers, including ${legacy} legacy records.`);
  if (!apply) {
    console.log("Dry run only. Stop customer writes and rerun with --apply --maintenance --backup-dir=<private directory>.");
    return;
  }
  if (obsoleteIndexes.length && !dropObsoleteIndexes) {
    throw new Error(
      `Migration is ready for review but will not drop legacy global indexes automatically: ${obsoleteIndexes.map((index) => index.name).join(", ")}. ` +
      "After reviewing the backup and pausing writers, rerun with --drop-obsolete-indexes.",
    );
  }

  await mkdir(backupDirectory!, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const folder = path.join(backupDirectory!, `customer-lifecycle-${stamp}`);
  await mkdir(folder, { mode: 0o700 });
  await writeFile(path.join(folder, "indexes.ejson"), mongoose.mongo.BSON.EJSON.stringify(indexes, { relaxed: false }), { flag: "wx", mode: 0o600 });
  const backup = await open(path.join(folder, "users.ndjson"), "wx", 0o600);
  try {
    for await (const user of collection.find({})) {
      await backup.write(mongoose.mongo.BSON.EJSON.stringify(user, { relaxed: false }) + "\n");
    }
    await backup.sync();
  } finally {
    await backup.close();
  }
  console.log(`Customer and index backup written to ${folder}.`);

  await collection.updateMany({ isActive: { $exists: false } }, { $set: { isActive: true } });
  // Build replacements while the old unique indexes still protect identities.
  for (const { key, ...options } of customerIdentityIndexes) await collection.createIndex(key, options);
  await collection.createIndex({ isActive: 1 }, { name: "isActive_1" });

  if (dropObsoleteIndexes) {
    for (const index of obsoleteIndexes) await collection.dropIndex(index.name!);
  }
  const finalIndexes = await collection.indexes();
  for (const expected of customerIdentityIndexes) {
    const actual = finalIndexes.find((index) => index.name === expected.name);
    const field = Object.keys(expected.key)[0];
    if (!actual?.unique || actual.partialFilterExpression?.isActive !== true ||
        actual.partialFilterExpression?.[field]?.$type !== "string") {
      throw new Error("Index verification failed. Keep customer writes paused and inspect the migration.");
    }
  }
  if (await collection.countDocuments({ isActive: { $exists: false } })) throw new Error("Legacy account migration verification failed.");
  console.log("Customer lifecycle migration verified.");
};

if (require.main === module) {
  const apply = process.argv.includes("--apply");
  const dropObsoleteIndexes = process.argv.includes("--drop-obsolete-indexes");
  const backupArg = process.argv.find((argument) => argument.startsWith("--backup-dir="))?.slice("--backup-dir=".length);
  if (apply && (!process.argv.includes("--maintenance") || !backupArg)) {
    throw new Error("Applying requires --maintenance and --backup-dir=<private backup directory>.");
  }
  if (dropObsoleteIndexes && !apply) {
    throw new Error("--drop-obsolete-indexes requires --apply.");
  }
  mongoose.connect(process.env.MONGO_URI as string, { autoIndex: false })
    .then(() => migrateCustomerLifecycle(
      apply ? path.resolve(backupArg!) : undefined,
      dropObsoleteIndexes,
    ))
    .catch((error) => { console.error(error instanceof Error ? error.message : "Migration failed"); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}

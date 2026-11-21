import "dotenv/config";
import mongoose from "mongoose";
import { mkdir, open, writeFile } from "node:fs/promises";
import path from "node:path";
import { customerIdentityFields, customerIdentityIndexes, inspectCustomerIndexDefinitions, legacyCustomerIdentityField, missingCustomerStatusFilter, normalizeCustomerPhone } from "../utils/customerLifecycle";

class MigrationPreflightError extends Error {}

export const migrateCustomerLifecycle = async (
  backupDirectory?: string,
  dropObsoleteIndexes = false,
) => {
  const collection = mongoose.connection.collection("users");
  const indexes = await collection.indexes();
  const apply = Boolean(backupDirectory);
  const obsoleteIndexes = indexes.filter((index) => legacyCustomerIdentityField(index));
  const indexIssues = inspectCustomerIndexDefinitions(indexes);
  const conflictingNames = indexIssues.invalidActiveIndexes.filter((name) => indexes.some((index) => index.name === name));
  const problems = new Set<string>();
  if (conflictingNames.length) problems.add(`Invalid replacement index definitions: ${conflictingNames.join(", ")}.`);

  const seen = new Map(customerIdentityFields.map((field) => [field, new Set<string>()]));
  let count = 0;
  let legacy = 0;
  for await (const user of collection.find({}, { projection: { _id: 0, isActive: 1, email: 1, phone: 1, googleId: 1 } })) {
    count += 1;
    if (user.isActive === undefined) legacy += 1;
    else if (typeof user.isActive !== "boolean") problems.add("An invalid isActive value needs review.");
    if (user.isActive === false) continue;
    for (const field of customerIdentityFields) {
      const value = user[field];
      if (value === undefined || value === null) continue;
      if (typeof value !== "string" || !value.trim()) {
        problems.add(`An invalid active ${field} value needs review.`);
        continue;
      }
      const canonical = field === "email" ? value.trim().toLowerCase()
        : field === "phone" ? normalizeCustomerPhone(value) : value.trim();
      if (canonical !== value || (field === "phone" && !/^\+[1-9]\d{7,14}$/.test(canonical))) {
        problems.add(`A non-canonical active ${field} value needs review.`);
      }
      const identities = seen.get(field)!;
      if (identities.has(canonical)) problems.add(`Duplicate active ${field} found. Resolve verified ownership before migration.`);
      identities.add(canonical);
    }
  }
  if (problems.size) throw new MigrationPreflightError([...problems].join(" "));

  console.log(`Preflight passed for ${count} customers, including ${legacy} legacy records.`);
  console.log(`Legacy global unique indexes: ${obsoleteIndexes.map((index) => index.name).join(", ") || "none"}.`);
  if (!apply) {
    console.log("Dry run only. Follow the maintenance and backup procedure before applying.");
    return;
  }
  if (obsoleteIndexes.length && !dropObsoleteIndexes) {
    throw new MigrationPreflightError("Review the listed legacy indexes before authorizing --drop-obsolete-indexes. No writes performed.");
  }

  await mkdir(backupDirectory!, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const folder = path.join(backupDirectory!, `customer-lifecycle-${stamp}`);
  await mkdir(folder, { mode: 0o700 });
  await writeFile(path.join(folder, "indexes.ejson"), mongoose.mongo.BSON.EJSON.stringify(indexes, { relaxed: false }), { flag: "wx", mode: 0o600 });
  const backup = await open(path.join(folder, "users.ndjson"), "wx", 0o600);
  try {
    for await (const user of collection.find({}, { promoteValues: false })) {
      await backup.writeFile(mongoose.mongo.BSON.EJSON.stringify(user, { relaxed: false }) + "\n");
    }
    await backup.sync();
  } finally {
    await backup.close();
  }
  console.log(`Customer and index backup written to ${folder}.`);

  await collection.updateMany(missingCustomerStatusFilter, { $set: { isActive: true } }, { writeConcern: { w: "majority" } });
  // Build and verify replacements while the global unique indexes are still in place.
  for (const { key, name, ...options } of customerIdentityIndexes) {
    if (indexIssues.invalidActiveIndexes.includes(name)) await collection.createIndex(key, { name, ...options, collation: { locale: "simple" } });
  }
  await collection.createIndex({ isActive: 1 }, { name: "isActive_1" });

  const verify = async (allowLegacy: boolean) => {
    const issues = inspectCustomerIndexDefinitions(await collection.indexes());
    const missing = await collection.findOne(missingCustomerStatusFilter, { projection: { _id: 1 } });
    if (issues.invalidActiveIndexes.length || (!allowLegacy && issues.legacyIdentityFields.length) || missing) {
      throw new MigrationPreflightError("Migration verification failed. Keep customer writes paused and inspect readiness.");
    }
  };
  await verify(true);
  if (dropObsoleteIndexes) {
    for (const index of obsoleteIndexes) await collection.dropIndex(index.name!);
  }
  await verify(false);
  console.log("Customer lifecycle migration verified.");
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dropObsoleteIndexes = args.includes("--drop-obsolete-indexes");
  const backupArg = args.find((argument) => argument.startsWith("--backup-dir="))?.slice("--backup-dir=".length);
  const expectedDb = args.find((argument) => argument.startsWith("--expect-db="))?.slice("--expect-db=".length);

  const run = async () => {
    if (args.some((arg) => !["--apply", "--maintenance", "--drop-obsolete-indexes"].includes(arg) &&
        !arg.startsWith("--backup-dir=") && !arg.startsWith("--expect-db="))) {
      throw new MigrationPreflightError("Unknown migration option.");
    }
    if (apply && (!args.includes("--maintenance") || !backupArg || !expectedDb)) {
      throw new MigrationPreflightError("Applying requires --maintenance, --expect-db=<database>, and --backup-dir=<private directory>.");
    }
    if (dropObsoleteIndexes && !apply) throw new MigrationPreflightError("--drop-obsolete-indexes requires --apply.");
    if (!process.env.MONGO_URI) throw new MigrationPreflightError("MONGO_URI is not configured.");

    await mongoose.connect(process.env.MONGO_URI, {
      autoCreate: false, autoIndex: false, readPreference: "primary", serverSelectionTimeoutMS: 8000,
    });
    if (expectedDb && mongoose.connection.name !== expectedDb) {
      throw new MigrationPreflightError("Connected database name does not match --expect-db.");
    }
    console.log(`Connected database: ${mongoose.connection.name}.`);
    await migrateCustomerLifecycle(apply ? path.resolve(backupArg!) : undefined, dropObsoleteIndexes);
  };

  void run().catch((error: unknown) => {
    const code = (error as { code?: unknown } | null)?.code;
    const failure = error instanceof mongoose.Error.MongooseServerSelectionError
      ? "Could not connect to the configured MongoDB deployment."
      : `Migration failed${typeof code === "number" ? ` (database error ${code})` : ""}.`;
    console.error(error instanceof MigrationPreflightError ? error.message :
      `${failure}${apply ? " Keep customer writes paused and check readiness." : ""}`);
    process.exitCode = 1;
  }).finally(() => mongoose.disconnect());
}

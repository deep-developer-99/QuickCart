# Category hierarchy deployment notes

The application schema now supports main categories and one level of subcategories. Existing category records are kept as main categories, and product `category` references are not changed. Missing product `subCategory` values are backfilled to `null`.

## Migration workflow

The migration command defaults to a read-only dry run. It saves a review plan under `server/tmp/category-hierarchy-migration-plan.json` and prints an approval hash. The plan includes every changed category document, every product receiving `subCategory: null`, and all index operations.

1. Confirm the target host and database in the dry-run output. Review the proposed document and index changes.
2. Take a recoverable backup and verify it by restoring to an isolated staging database. Keep the backup and test restore separate from production.
3. Run the migration against the staging copy first:

   ```sh
   cd server
   npm run migrate:category-hierarchy -- --dry-run
   ```

4. After reviewing the plan and hash, apply to the staging copy with an explicit approval hash and backup assertion:

   ```sh
   npm run migrate:category-hierarchy -- --apply --approve=<reviewed-plan-hash> --backup-verified
   ```

5. Review the resulting documents/indexes and rerun dry-run. Apply to the production target only after the production backup is verified and the exact report is approved.

The script creates and verifies the unique `{ parentCategory: 1, normalizedName: 1 }` index before dropping only an existing simple unique `{ name: 1 }` index. It does not drop indexes with unrecognized definitions. Category IDs, category/product assignments, images and Cloudinary public IDs are preserved. Missing product `subCategory` fields are set to `null`.

The `--backup-verified` option is an operator assertion; it does not create or verify the backup itself.

If the script reports duplicate scoped names or an unexpected index, stop and resolve that specific data/index conflict manually after review. Do not delete records or drop an index by assumption.

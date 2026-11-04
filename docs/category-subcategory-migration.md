# Category hierarchy deployment notes

The application schema now supports main categories and one level of subcategories. Existing category records are kept as main categories, and product `category` references are not changed. Missing product `subCategory` values are backfilled to `null`.

## Before deploying

1. Take and verify a restorable database backup.
2. Review the Category collection's current indexes with `db.categories.getIndexes()` in the target environment. The migration script itself checks the exact index definitions and aborts if it finds ambiguous state or case-insensitive duplicates.
3. Run the migration against a staging copy first:

   ```sh
   cd server
   npm run migrate:category-hierarchy
   ```

4. Review the log and resulting documents/indexes. The script creates and verifies the unique `{ parentCategory: 1, normalizedName: 1 }` index before dropping only an existing unique `{ name: 1 }` index. It does not drop indexes with unrecognized definitions and does not modify category or product assignments.
5. Deploy the application only after the migration succeeds. Do not run this script against production until the reviewed deployment window and backup are ready.

If the script reports duplicate scoped names or an unexpected index, stop and resolve that specific data/index conflict manually after review. Do not delete records or drop an index by assumption.

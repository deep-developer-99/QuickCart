# Bulk subcategory Postman requests

Import `QuickCart-Admin-Bulk-Subcategories.postman_collection.json` and `QuickCart-Local.postman_environment.json`. Fill the environment's `baseUrl`, `adminEmail`, `adminPassword`, and a main-category `parentCategoryId`. Run **Admin Login** first; it copies the existing `token` cookie into `adminToken` for the collection's Bearer auth. The backend also accepts the existing HttpOnly cookie if you prefer Postman's cookie jar.

Use `Content-Type: application/json`. The collection has a ten-entry example body; replace all names, descriptions, image URLs, and the selected parent ID with reviewed values before running it. Run **Bulk Subcategory Validation (Dry-Run)** before **Bulk Subcategory Creation**.

Image URLs must be HTTPS and served by an explicitly permitted host. `res.cloudinary.com` is permitted by default. For other image hosts, configure `SUBCATEGORY_IMAGE_ALLOWED_HOSTS` in the backend deployment as a comma-separated list of exact hostnames (no wildcards), for example `images.example.com,cdn.example.net`. The API also rejects credentials in URLs, redirects to untrusted hosts, private or special-use DNS answers, unsupported image formats, and images over 5 MB. Dry-run checks URL syntax, allowlist membership, and public DNS resolution; it does not fetch image bytes or upload to Cloudinary. Actual requests download, verify, and re-upload the image through the existing QuickCart Cloudinary integration.

The API returns HTTP 503 until the category hierarchy migration's unique parent/normalized-name index and normalized fields are ready. The API does not run the migration or alter indexes.

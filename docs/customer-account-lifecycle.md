# Customer account privacy and deletion

Customers use Account → Account Privacy to read product privacy information, select a deletion reason, optionally leave feedback, and confirm closure. Closing the account atomically sets `isActive: false`, records `deletedAt` and a private `deletionReason`, and clears FCM tokens. Authentication checks the stored status on every protected request. A subsequent verified login creates a different customer ID.

## Deployment order

1. Confirm the deployment's MongoDB cluster and database name from trusted deployment configuration. Use the configured read-only connection for preflight where available. Compare the reported database name with the expected name and verify the cluster separately if environments share that name. Keep connection strings out of command arguments, logs, and chat.
2. Take an independent, consistent database snapshot using your normal backup system. Record its recovery point, restore it to an isolated environment, and verify users, indexes, orders, addresses, and payment records. Rehearse migration on the restore with the production MongoDB version and topology. Prepare the restore procedure and access before starting. The script's Extended JSON export covers only `users` and its indexes and is supplemental. Prepare an encrypted, access-controlled directory outside the repository and web root for that export.
3. Finish or reconcile predeployment payment sessions. Older Razorpay sessions without the full owning customer ID in provider notes require reconciliation through support. Pause customer traffic, drain in-flight work, and stop all API workers and other writers that can create or update customers or initiate and fulfill payments. Keep them paused through migration and readiness verification. Capture and verify the final pre-migration recovery point after draining writers. The maintenance duration depends on the backup, collection scan, and index builds.
4. Stage the new backend while traffic is paused. From `server`, substitute the verified database name and the prepared private directory in these read-only checks.

   ```powershell
   npm run check:customer-deletion
   npm run migrate:customer-lifecycle -- --expect-db=YOUR_VERIFIED_DATABASE
   ```

   The readiness check can exit nonzero before migration. The dry run must pass. It reports counts and candidate index names. It treats missing `isActive` as active and rejects invalid statuses, malformed or noncanonical active identities, and duplicates under the email and phone normalization rules. Review ownership before correcting any identity. Existing inactive identities are retained as stored. Review any conflicting replacement index definitions separately.
5. Obtain explicit approval for the database changes and exact legacy index names. If the dry run lists exactly the approved obsolete indexes (for the original deployment, `email_1`, `phone_1`, and `googleId_1`), use the command below. Omit `--drop-obsolete-indexes` if the list is empty. With legacy indexes present, apply without the drop flag exits before the supplemental export or any database write.

   ```powershell
   npm run migrate:customer-lifecycle -- --apply --maintenance --expect-db=YOUR_VERIFIED_DATABASE "--backup-dir=YOUR_ABSOLUTE_PRIVATE_DIRECTORY" --drop-obsolete-indexes
   npm run check:customer-deletion
   ```

   The script exports `users` and its index metadata, updates only missing `isActive` values to true, creates or retains the three partial unique indexes and the `isActive_1` lookup index, and verifies the backfill and replacement definitions before any drop. It then removes the approved legacy global indexes and verifies the final state. Verification should report `ready: true`, `hasMissingIsActive: false`, and empty index issue arrays. A rerun uses the same missing-field predicate and retains valid replacement indexes.
6. Start the new backend with public traffic still closed. Smoke-test Google and phone sign-in, checkout, and deletion with authorized test identities before reopening traffic. Deploy the website and compatible mobile client.

The schema's unique indexes are `active_customer_email`, `active_customer_phone`, and `active_customer_googleId`. Each applies only to `isActive: true` documents whose indexed identity is a string. Historical inactive documents keep their original identifiers. Existing inactive documents stay inactive.

If apply stops midway, keep writers paused. Inspect readiness and the actual index definitions. A reviewed rerun can finish a partial migration if the remaining indexes and records meet preflight. If a restore is necessary, restore the verified consistent backup using the prepared procedure and reconcile writes and provider activity after its recovery point. Once identities have been reused, recreating old global indexes can fail and old login code can select inactive records. Use a forward fix or a reviewed, consistent restore.

Run `npm run check:customer-deletion` from `server` to inspect identity-index metadata and check whether any customer still lacks `isActive`. The command performs read-only queries and exits nonzero if it cannot verify readiness. A `MIGRATION_REQUIRED` response occurs before deactivation. Correlate `account_deletion.failed` with the response's `X-Request-Id` in server logs.

## API and security

- `POST /api/auth/delete-account/confirmation` requires an active customer JWT. It returns a confirmation token bound to that customer and that session, valid for five minutes. The sign-in must be within 15 minutes. Google sessions use Firebase's authentication time.
- `POST /api/auth/delete-account` accepts `reason`, optional `feedback` (up to 1,000 characters), and `confirmationToken`. It uses the JWT subject as owner, rejects unknown body fields, and clears the authentication cookie on success.
- Cookie requests require the exact origin configured by `CLIENT_URL` and the `X-QuickCart-Account: delete` header. Bearer clients use the same confirmation flow without a browser origin requirement.
- Confirmation and deletion have independent ten- and five-second customer throttles stored in MongoDB. Internal timestamps are excluded from account projections.
- An inactive token returns HTTP 401 with `ACCOUNT_INACTIVE`. The website and mobile client invalidate that session and remove the old customer cart. A retry after a lost success response therefore remains safe.
- Google linking requires a verified Google-provider email. Registration races resolve to the one active owner. New accounts never copy historical user-owned data.
- Profile phone changes require Twilio OTP verification. Indian ten-digit numbers are normalized to +91 before uniqueness checks.

## Retention and payment operations

Historical users, addresses, orders, payments, carts, and notifications keep their old customer ID. Only that ID defines ownership. New accounts do not inherit the records. Customer selection, campaign fanout, token registration, and delivery check active status.

Optional feedback is isolated in `accountdeletionfeedbacks`, hidden by default, and expires through a MongoDB TTL index after 30 days, plus MongoDB's asynchronous cleanup interval. It has no public or admin browsing endpoint. The reason remains private on the historical account. The 30-day feedback period is an implementation default for business review. Account/order retention periods need the business's own approved policy. Product privacy content is editable in `client/src/pages/user/accountPrivacyContent.ts` and needs policy review before use as an official legal notice.

Existing orders continue after deactivation. Unsettled online payments block deactivation with `PAYMENT_PENDING` so customers can finish payment verification first. Active checkout handlers claim the customer record and prevent concurrent closure. New Razorpay orders store the full customer ID in provider notes and are recorded in the customer's private pending-payment list.

If a checkout process crashes or the client disconnects before its response finishes, an `activeCheckoutRequests` claim can remain. An abandoned Razorpay order can also remain in `pendingRazorpayOrders`. Support must reconcile the provider payment and order state before clearing the corresponding claim/reference. Never clear these fields while a matching handler is running or a captured payment is unresolved. Cashfree attempts with created/pending status or paid-but-unfulfilled status likewise require reconciliation. Retained order and payment documents must remain associated with the historical customer.

## Verification

- `npm run build` in server and client.
- `npm test` in server and client.
- `npm run test:account-lifecycle` in server runs validation tests. For database/API coverage set `ACCOUNT_TEST_MONGO_URI` to a fresh local database named `quickcart_lifecycle_test_<unique suffix>`. The test rejects non-local hosts and preexisting customer data, and uses actual routes, JWTs, migration, and MongoDB indexes.
- `npx tsc --noEmit`, `npm test -- --runInBand`, and `npm run lint` in the mobile project.
- Verify staging Google and Twilio sign-in using test identities, deactivation, a fresh ID on sign-up, empty account data, and rejection of the old token. External identity and payment provider sandbox checks require their configured test accounts.

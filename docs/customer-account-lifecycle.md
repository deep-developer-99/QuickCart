# Customer account privacy and deletion

Customers use Account → Account Privacy to read product privacy information, select a deletion reason, optionally leave feedback, and confirm closure. Closing the account atomically sets `isActive: false`, records `deletedAt` and a private `deletionReason`, and clears FCM tokens. Authentication checks the stored status on every protected request. A subsequent verified login creates a different customer ID.

## Deployment order

1. Take the normal production database backup and verify that it can be restored. Schedule a maintenance window. Stop every API worker, checkout worker, and other process that can create or edit customers or payments.
2. Finish or reconcile all predeployment online payment sessions. New Razorpay verification requires the full owning customer ID in provider order notes. Sessions created by older code need reconciliation through support before deployment.
3. Deploy the new server source with customer traffic still paused. User schema automatic index creation is disabled so application startup cannot recreate global identity indexes.
4. From `server`, run `npm run migrate:customer-lifecycle`. The dry run validates identity formats and active uniqueness, treating missing `isActive` as active. It aborts on duplicates, invalid status values, untrimmed identities, noncanonical emails, and phone numbers requiring normalization. Review those records and verified ownership before changing them.
5. Run `npm run migrate:customer-lifecycle -- --apply --maintenance --backup-dir=<absolute private backup directory>`. The explicit maintenance flag attests that writers are stopped. The script writes lossless Extended JSON customer and index backups, fills only missing `isActive` values with true, and builds the partial unique indexes without dropping anything. If legacy global unique identity indexes are present, review the backup and rerun the command with `--drop-obsolete-indexes` as explicit operator approval; only then are those named obsolete indexes removed. Other indexes are retained. It verifies the final indexes and legacy migration. Running the approved command again is safe.
6. Keep the backup outside the repository and web root. Restrict its OS permissions, encrypt it using your normal backup system, and apply your approved backup retention schedule. It contains customer personal information.
7. Start the new backend and run the staging smoke checks. Deploy the website and the compatible mobile client. Resume customer traffic after confirming both login methods and deletion. The deletion endpoint checks the required indexes and returns 503 until the migration is ready.

The schema's unique indexes are `active_customer_email`, `active_customer_phone`, and `active_customer_googleId`. Each applies only to `isActive: true` documents whose indexed identity is a string. Historical inactive documents keep their original identifiers. Existing inactive documents stay inactive.

Do not roll back to the old login logic after any account has been deactivated. That code can select historical records. A rollback requires maintenance and a forward fix, or a carefully reviewed restore of the entire consistent backup. Recreating global unique indexes can fail after historical identities are reused.

Run `npm run check:customer-deletion` from `server` to inspect the configured database before attempting deletion. The command only lists identity-index metadata and returns a nonzero exit code if it cannot verify readiness. A `MIGRATION_REQUIRED` response occurs before deactivation. Search server logs for `account_deletion.failed` and the response's `X-Request-Id` to see which index prerequisites failed. The readiness check does not alter indexes or read customer records.

## API and security

- `POST /api/auth/delete-account/confirmation` requires an active customer JWT. It returns a confirmation token bound to that customer and that session, valid for five minutes. The sign-in must be within 15 minutes. Google sessions use Firebase's authentication time.
- `POST /api/auth/delete-account` accepts `reason`, optional `feedback` (up to 1,000 characters), and `confirmationToken`. It uses the JWT subject as owner, rejects unknown body fields, and clears the authentication cookie on success.
- Cookie requests require the exact origin configured by `CLIENT_URL` and the `X-QuickCart-Account: delete` header. Bearer clients use the same confirmation flow without a browser origin requirement.
- Each operation has an independent five-second customer throttle stored in MongoDB. Internal timestamps are excluded from account projections.
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

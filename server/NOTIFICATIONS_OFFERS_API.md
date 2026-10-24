# Notification and Offer Management API

All routes use the existing JWT cookie or `Authorization: Bearer <token>` authentication. Sender IDs and roles come from the authenticated token. List endpoints accept `page` (default 1) and `limit` (default 20 for recipient/history lists, 10 for offers; maximum 50). Invalid pagination returns `400`.

## Eligible customer recipients

`GET /api/notifications/recipients?page=1&limit=20&search=...`

- Admin: searches customer accounts in QuickCart.
- Vendor: returns only customers referenced by persisted orders containing that vendor's items, including completed/cancelled orders.
- `search` matches customer name, email, and phone (maximum 100 characters).
- Response `200`: `{ success, data: [{ _id, name, email, phone }], pagination }`.
- Errors: `400` invalid query; `401` unauthenticated; `403` wrong role.

## Manual notifications

`POST /api/notifications/send` (admin/vendor; limited to 10 requests per actor per 15 minutes)

Requires `Idempotency-Key` (1–100 characters) and a JSON body:

```json
{
  "audience": "individual",
  "kind": "custom",
  "customerId": "<user ObjectId>",
  "category": "general",
  "title": "Hello",
  "message": "A message for this customer"
}
```

For an offer notification, use `kind: "offer"`, `category: "offer"`, and `offerId` for an existing published offer. Its stored title/message/navigation are used; caller-supplied title/message are ignored. `audience` may be `individual` or `all`; `all` broadcasts to customer accounts only and is supported only for offer notifications. `customerId` is required for individual delivery and forbidden for broadcast. Vendors can target an individual only when persisted order records show that customer ordered from them.

Response `200`: `{ success, data: { attempted, accepted, failed, skipped, recipients, stored } }`. `accepted` means accepted by Firebase, not confirmed device delivery. Errors: `400` invalid input/idempotency key, `401` unauthenticated, `403` vendor recipient is ineligible, `404` offer unavailable, `429` rate limit.

## Managed notification history

`GET /api/notifications/managed/history?page=1&limit=20` returns the authenticated admin/vendor's own managed notification records only. Response `200`: `{ success, data: [{ _id, title, message, category, type, relatedId, dispatchStatus, acceptedCount, failedCount, createdAt, sender, senderRole }], pagination }`.

`DELETE /api/notifications/managed/:id` soft-hides that sender's own history entry. It does not delete an offer. A push already delivered to a device cannot be recalled. Response `200`: `{ success, message, data: { id, deletedAt } }`; `404` if absent or not owned; `401`/`403` for auth failures.

## Offer management

Admin and vendor management routes are under `/api/offers`; the existing admin routes under `/api/admin/offers` remain available for listing, creating, editing, and publishing.

- `GET /api/offers/managed?page=1&limit=10`: admin sees all non-deleted offers; vendor sees only their own. Response `200`: `{ success, data, pagination }`.
- `POST /api/offers`: create a draft. Body: `{ "title", "message", "redirectType": "category"|"product", "redirectValue": "<destination ObjectId>" }`. Response `201` with the draft.
- `PUT /api/offers/:id`: update notification content only. Body: `{ "title", "message" }`. It does not publish or dispatch. Response `200` with the offer.
- `PUT /api/offers/:id/publish`: validates the active destination, publishes the draft, stores notification records, dispatches to customer accounts, and records aggregate outcome. Response `200` with the offer. It rejects already-published or unavailable offers.
- `DELETE /api/offers/:id`: soft-deletes the offer, preserving order and notification references. Deleted offers are no longer navigable or resendable. Response `200` with `deletedAt`.
- `POST /api/offers/:id/resend-notification`: requires `Idempotency-Key`; limited to 5 requests per actor per 15 minutes. Only published offers with active destinations can be resent. Response `200`: `{ success, message, data: { duplicate, stored, attempted, accepted, failed, skipped, completedAt? } }`.

Vendors can create, edit, publish, delete, and resend only their own offers. Admins can manage all non-deleted offers. Invalid IDs/input return `400`; unavailable, deleted, or non-owned offer IDs return `404` where applicable; auth failures return `401`/`403`; resend rate limits return `429`.

`GET /api/offers/:id` remains the public published-offer lookup and returns `404` for drafts, deleted offers, or inactive destinations.

## Dispatch and persistence notes

Notification rows record `stored`, `accepted`, `partial`, `failed`, or `no_devices` outcomes. FCM accepted counts represent Firebase's response only. Existing token registration and invalid-token cleanup remain in use; Firebase multicast sends are chunked at 500 tokens and database writes are processed in bounded groups of 25 recipients. Offer records retain resend keys and dispatch outcome history. Offer and notification deletion are soft deletes; customer history hides soft-deleted notification rows.

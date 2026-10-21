# QuickCart push notification contract

## Customer device tokens

The authenticated customer uses the existing notification routes:

- `POST /api/notifications/fcm-token`
- `DELETE /api/notifications/fcm-token`

Authentication is the existing JWT cookie or `Authorization: Bearer <jwt>`
with a JWT whose role is `user`. The request body is:

```json
{ "token": "<FCM registration token>" }
```

The token must be a non-empty string no longer than 4096 characters. The
server derives the customer ID from the JWT, stores multiple unique tokens,
and returns only a success message. Deleting a token removes only that token
from the authenticated customer's registrations.

Admin and vendor token behavior remains available on the same routes.

## Customer order status events

After a valid vendor status transition is persisted, the backend stores a
`Notification` record with type `ORDER_STATUS_UPDATED` and sends an FCM
notification asynchronously to the order owner's active customer tokens.
The FCM data fields are strings:

```json
{
  "event": "ORDER_STATUS_UPDATED",
  "type": "ORDER_STATUS_UPDATED",
  "orderId": "<order id>",
  "status": "Placed | Accepted | Out for Delivery | Delivered",
  "notificationId": "<notification id>",
  "role": "user"
}
```

The mobile client should use `orderId` to open the order details screen. An
FCM request succeeding means Firebase accepted the request; it does not prove
that a device displayed or the customer read the notification.

## Offers

Banners remain generic homepage presentation content. Offers use the separate
admin workflow:

- `GET /api/admin/offers?page=1&limit=10`
- `POST /api/admin/offers`
- `PUT /api/admin/offers/:id`
- `PUT /api/admin/offers/:id/publish`
- `GET /api/offers/:id` for a published offer

The admin routes require the existing admin JWT cookie or bearer token. Create
and update requests use JSON:

```json
{
  "title": "Weekend promotion",
  "message": "Explore this week's QuickCart promotion.",
  "redirectType": "category",
  "redirectValue": "<category id>"
}
```

`redirectType` is `category` or `product`; `redirectValue` is the actual ID
used by the existing customer navigation. New offers start as drafts. Only
`PUT /api/admin/offers/:id/publish` publishes an offer and triggers a dispatch.
Publishing is atomic and can succeed only once. Editing a published offer does
not send another publication notification.

The current audience rule is all customer accounts with at least one
registered FCM token. Admin and vendor tokens are never queried for this
dispatch. Customer offer records are created using the existing notification
model, while FCM delivery runs asynchronously in batches.

Offer FCM data fields are strings:

```json
{
  "event": "NEW_OFFER",
  "type": "NEW_OFFER",
  "offerId": "<published offer id>",
  "role": "user",
  "title": "Weekend promotion",
  "message": "Explore this week's QuickCart promotion.",
  "redirectType": "category",
  "redirectValue": "<category id>"
}
```

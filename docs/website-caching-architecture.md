# QuickCart Website caching architecture

This document describes the browser-side cache for the customer website. It uses Redux Toolkit Query already present in the website dependency set; it adds no dependency and does not share code or state with the Mobile App.

## Cache layers

- `publicCacheApi` stores public GET responses in Redux memory. `privateCacheApi` stores authenticated responses separately. Both use the existing Axios instance, so credentials, response interceptors, auth revision checks, ETags, and request ownership checks continue to apply.
- Query keys include the exact path and sorted query parameters. Private keys also include role, user ID, and auth revision. Multiple consumers of a key share the same in-flight query.
- Freshness is controlled by the TTL policy in `client/src/services/cachePolicy.ts`. Cache retention is separate: unused RTK Query entries expire after 15 minutes. Public entries are revalidated on focus, visibility return, and reconnect only after their TTL, with a five-second global throttle. Requests are deduplicated while pending.
- A failed background refresh keeps RTK Query's last successful response available. Failed first requests remain errors and can be retried by a later user action or eligible revalidation trigger.
- Logout, account switching, role changes, session revision changes, confirmed expiration, and deletion clear the private API slice. Public entries remain intact.

## Customer-facing API inventory

| Endpoint / method | Consumers | Classification | Freshness | Invalidation / notes |
|---|---|---|---:|---|
| `GET /categories`, `/categories/catalog`, `/categories/:id`, `/categories/:id/subcategories` | Home, category pages, Footer category list, admin selectors | Public | 15 min | Admin category/subcategory changes invalidate categories, products, homepage sections, and search results. |
| `GET /products` (search, category, subcategory, page, limit params) | Home product recommendations, category/search pages, product recommendations, selectors | Public | 60 sec | Complete parameters form the key. Vendor product writes invalidate product, homepage, and search-result tags. |
| `GET /products/category/:id` (subcategory/page/limit params) | Category listing and infinite scroll | Public | 60 sec | Category ID and all pagination/filter parameters form the key. |
| `GET /products/:id` | Product Details | Public | 60 sec | Product ID is part of the key; vendor writes invalidate product data. Variants, display price, and stock are embedded browse data; checkout still validates with the backend. |
| `GET /banners` | Home hero banner | Public | 10 min | Admin banner changes invalidate `Banners`. |
| `GET /promotional-banners` | Home promotions | Public | 10 min | Admin promotional banner writes invalidate `PromotionalBanners`. |
| `GET /homepage-sections` | Home product sections | Public | 60 sec | Admin section saves invalidate the RTK Query entry; the existing view-model subscription only manages loading/error presentation. |
| `GET /search-suggestions` | Navbar placeholder | Public | 5 min | Admin suggestion writes invalidate the shared entry. The existing phrase animation consumes its cached normalized view model. |
| `GET /footer-settings` | Footer, Contact Us, Login policy links | Public | 5 min | Admin saves update the shared public query entry. |
| `GET /theme/public` | ThemeProvider | Public | 10 min | Admin publish/reset invalidates `Theme`. |
| `GET /addresses?page=…&limit=…` | Account badge, saved addresses, checkout, cart drawer | User-specific | 60 sec | Private key includes customer/session. Address writes invalidate address lists/count. Listing `totalItems` seeds the count query. |
| `GET /orders/my-orders?page=…&limit=…` | Account badge and order history | User-specific | 30 sec list / 60 sec count | Private key includes customer/session. Listing `totalItems` seeds count. Confirmed placement invalidates once per order ID. |
| `GET /orders/:id` | Order details | User-specific | 30 sec | Private key includes customer/session; private data is never persisted. |
| `GET /notifications` | Notification UI (server currently authorizes Admin/Vendor roles) | Role/session-specific | 30 sec | Mark-read operations invalidate notifications. This endpoint is not customer-authorized in the current backend routes. |
| Auth, cart, checkout summary, payment creation/verification, address/order writes, location search, Wishlist | Existing flows | Sensitive or mutating | Not cached here | Existing Axios calls remain direct. Checkout price, stock, discount, delivery, order, and payment decisions remain backend-authoritative. |

Admin and Vendor management reads remain on their existing protected service paths; they do not enter the shared public cache. Successful management writes invalidate only related customer-facing tags. Across different browsers/devices, those entries expire by TTL and are revalidated on a later read or eligible focus/reconnect event; no cross-device synchronization is assumed.

## HTTP and server caching

Express's default ETag handling remains enabled for public responses; this change does not force `200` responses or disable `304` responses. Public route controllers currently do not set explicit `Cache-Control` max-age directives. Authenticated API prefixes now receive `Cache-Control: no-store` so browser and shared HTTP caches cannot retain private response bodies. The RTK Query private cache is memory-only.

## Storage and images

- The existing account-scoped LocalStorage cart (versioned key, product/variant IDs, quantity, and current display metadata/image URL) is unchanged. Cart restore and write failures are already caught and fall back to in-memory behavior.
- SessionStorage holds temporary selected-address IDs, donation selection, and a locality-only location preference scoped by customer ID. Legacy full location objects are reduced to city/state/pincode on read; recent searches remain bounded to ten entries and handle unavailable storage.
- LocalStorage holds only the cart, bounded recent searches, and locality-only general location preferences. No tokens, full saved addresses, full order responses, or API cache entries are written there.
- Customer-facing Cloudinary images use deterministic `f_auto,q_auto` transformations and responsive width candidates. Other hosts and local/data URLs are unchanged. Product cards, category cards, banners, product detail media, and cart images remain browser-managed resources; below-fold assets are lazy and decoded asynchronously. The hero banner remains high priority. CSS image wrappers already reserve their layout space.
- Cloudinary and production static-host Cache-Control headers cannot be measured from this local source checkout; retain the CDN's existing versioned asset behavior. Vite emits hashed build assets; deployment HTML header policy belongs to the hosting layer.

## Measurements and limits

There was no baseline browser trace, production URL, configured backend session, or DevTools capture available during source implementation, so network bytes, image transfer sizes, LCP, INP, CLS, and bundle deltas are not claimed. The source-level account navigation reduction remains: once counts are fresh, internal account route changes produce zero count requests instead of two per route transition. Public API request reduction is cache-key/TTL dependent and should be confirmed against a running browser session using DevTools' **Size/Transferred** columns to distinguish disk cache, memory cache, and network transfers.

IndexedDB persistence was deliberately not added: the in-memory public cache already shares results during a browsing session and bounded TTL/revalidation handles freshness. Persistent rehydration would add schema, quota, expiry, and invalidation complexity without a measured cold-start benefit. No backend database or persistent/distributed cache was introduced.

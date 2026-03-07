## Why

Prospective homebuyers lack a simple, accessible way to discover upcoming heavy building developments—data centers, factories, warehouses, and industrial facilities—near a property they're considering. Zoning filings and permit databases are public but fragmented, technical, and inaccessible to non-experts. Civic Scout surfaces this risk data at the point of decision, directly from a property address search.

## What Changes

- Introduce a new consumer-facing web application scoped to Chicago, IL for the MVP
- Integrate the Chicago Data Portal (Socrata API) to ingest active building permits and large-scale development filings
- Implement a map-centric, mobile-first UI displaying color-coded development markers within a 2-mile radius of a searched address
- Add Stripe-powered payments with two tiers: $2 single-address look-up (24-hour access window) and $5/month unlimited subscription
- Implement a Redis-backed caching layer to reduce redundant API calls for frequently searched addresses
- Enforce access control based on payment tier (guest → paid look-up → subscriber)

## Capabilities

### New Capabilities

- `address-search`: Geocode a user-supplied Chicago address and establish a 2-mile radius bounding box for permit queries
- `permit-data-ingestion`: Fetch, normalize, and store building permit records from Chicago Data Portal; filter for heavy development categories (new construction, industrial, data center, factory)
- `development-map`: Render an interactive Mapbox map with color-coded markers representing nearby developments; support detail popups with permit metadata
- `payment-gateway`: Stripe Checkout integration for $2 single look-up (session-scoped 24-hr token) and $5/month subscription (recurring billing + webhook lifecycle management)
- `search-caching`: Redis cache layer keyed on normalized address + radius; TTL-based invalidation to keep data fresh without hammering the Chicago Data Portal rate limits
- `user-access-control`: Token/session-based access enforcement; differentiate guest (no results), paid look-up (24-hr expiry), and subscriber (unlimited) tiers

### Modified Capabilities

## Impact

- **New dependencies**: Mapbox GL JS (or Google Maps JS SDK), Stripe JS + Stripe Node SDK, Redis, Chicago Data Portal Socrata API (app token required)
- **Backend**: New API routes for address search, permit lookup, payment initiation, Stripe webhooks, and access-token validation
- **Database**: New tables for `users`, `access_tokens`, `permit_cache`, `subscriptions`
- **Infrastructure**: Redis instance required for caching layer; Stripe webhook endpoint must be publicly reachable (HTTPS)
- **Geography constraint**: MVP hard-scoped to Chicago, IL bounding box; out-of-bounds addresses return a friendly "not yet available" message

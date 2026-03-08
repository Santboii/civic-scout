## Why

The application currently relies on hardcoded mock data for address geocoding, building permits, and user access control. This transition is necessary to enable live, real-world functionality by connecting to production APIs and databases, allowing users to search real Chicago addresses and see authentic, up-to-date development data.

## What Changes

- **Real Geocoding**: Replace mock geocoding results with live calls to the OpenStreetMap Nominatim API (or Mapbox if configured).
- **Live Permit Data**: Connect the `/api/permits` route to the Socrata Open Data API (dataset `ydr8-5enu`) for real-time Chicago building permits.
- **Production Access Control**: Enable JWT verification and Stripe subscription checks in the middleware/proxy layer to manage access to live data.
- **Data Enrichment**: Re-enable live Cook County GIS lookups for zoning classification on high-impact (RED) permits.
- **Persistent Caching**: Activate Upstash Redis caching to store live permit results and manage rate limiting.
- **Database Persistence**: Enable Supabase logging for searches and access token tracking.

## Capabilities

### New Capabilities
- `live-data-integration`: Connecting to Socrata, Nominatim, and Cook County APIs for authentic information.
- `production-access-management`: Full implementation of Stripe-verified subscriptions and single-use tokens for data access.
- `scalable-caching-layer`: Using Redis to optimize API performance and handle high-volume search requests.

### Modified Capabilities
- `chicago-dev-scanner-mvp`: Updating the core MVP requirements to move from simulation to production readiness.

## Impact

- **APIs**: `/api/geocode`, `/api/permits`, `/api/token`, and `/api/checkout/*` will now require valid environment variables and external connectivity.
- **Middleware**: `src/proxy.ts` will now enforce strict token validation for all requests.
- **Environment**: Requires valid `SOCRATA_APP_TOKEN`, `UPSTASH_REDIS_*`, `STRIPE_*`, and `DATABASE_URL` configurations.
- **UI**: The "Simulated Data" banners will be removed in favor of live data indicators.

## Context

The application currently uses a `MOCK_DATA=true` flag to bypass all external API calls and authentication checks. This was useful for initial UI/UX development but now needs to be replaced with a production-ready implementation that connects to real data sources (Socrata, OpenStreetMap/Nominatim, Cook County GIS, Upstash Redis, and Stripe).

## Goals / Non-Goals

**Goals:**
- Connect `/api/geocode` to live OpenStreetMap Nominatim API.
- Connect `/api/permits` to live Socrata Chicago Building Permits dataset.
- Re-enable `src/proxy.ts` strict validation for all protected routes.
- Activate Upstash Redis for caching and rate limiting.
- Ensure all environment variables are correctly utilized.

**Non-Goals:**
- Changing the frontend UI layout (Map + Sidebar).
- Modifying the permit classification logic (RED/YELLOW/GREEN).
- Setting up new Stripe products/prices (assuming they exist in the dashboard).

## Decisions

### 1. Data Fetching Strategy: Socrata SODA
- **Decision**: Use the Socrata Open Data API (SODA) with `$where` queries for radius-based permit fetching.
- **Rationale**: Provides the most up-to-date building permit information for Chicago.
- **Alternatives**: Pre-seeding a local database (discarded due to data freshness concerns).

### 2. Caching: Upstash Redis
- **Decision**: Use a 4-hour TTL for permit results based on a geo-grid key (`permits:{lat4}:{lon4}:2mi`).
- **Rationale**: Minimizes Socrata API hits and provides a "stale-while-revalidate" or fallback capability.

### 3. Geocoding: Nominatim vs. Mapbox
- **Decision**: Use OpenStreetMap Nominatim as the primary geocoder for the MVP.
- **Rationale**: Zero cost and no account setup required for the initial rollout.
- **Alternatives**: Mapbox (re-enable if the user provides a valid token later).

### 4. Middleware: Centralized Proxy
- **Decision**: All `/api/permits` requests must pass through `src/proxy.ts`.
- **Rationale**: Simplifies access control by centralizing JWT and subscription checks.

## Risks / Trade-offs

- **[Risk] Socrata Rate Limiting** → **Mitigation**: Use `SOCRATA_APP_TOKEN` and Redis caching to stay within limits.
- **[Risk] Nominatim Policy** → **Mitigation**: Ensure a descriptive `User-Agent` and respect the 1 request/second guideline per IP.
- **[Risk] Database Latency** → **Mitigation**: Use Supabase's Edge Functions or optimized queries for search logging.

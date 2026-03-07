## Context

Civic Scout is a greenfield consumer web application targeting prospective homebuyers in Chicago, IL. There is no existing codebase; this is an MVP build. The product fetches publicly available building permit data from the Chicago Data Portal (Socrata REST API), geocodes user-supplied addresses, and presents nearby heavy development risk on an interactive map—behind a Stripe-gated paywall.

Key external dependencies drive the architecture:
- **Chicago Data Portal** (Socrata): rate-limited public API (~1,000 req/day unauthenticated; higher with an app token); the primary source for permit data
- **Mapbox GL JS** (preferred over Google Maps due to lower cost at MVP scale and offline-capable vector tiles)
- **Stripe**: Checkout Sessions for one-time payments; Subscriptions + Webhooks for recurring billing
- **Redis**: caching layer to absorb repeated address lookups and protect Data Portal rate limits

Stack choice: **Next.js 14 (App Router)** on Vercel for fast SSR/ISR, serverless API routes (avoids managing a separate server), and built-in edge middleware for access-token validation. PostgreSQL (Supabase or Railway) for persistent storage.

## Goals / Non-Goals

**Goals:**
- Search any Chicago street address and see heavy developments within a 2-mile radius on a map
- Gate results behind Stripe payment: $2/24hr token or $5/month subscription
- Cache address+radius queries in Redis (TTL: 4 hours) to limit Chicago Data Portal calls
- Mobile-first, map-centric UI with color-coded permit markers and detail popups
- Nightly background job to re-hydrate the permit cache for the top-N searched addresses

**Non-Goals:**
- Support for cities outside Chicago (MVP constraint; extensibility deferred)
- User accounts / registration (access is token-based for the $2 tier; email only for subscriptions via Stripe)
- Real-time permit updates (nightly batch is sufficient for MVP)
- Native mobile apps (responsive web only)
- Advanced analytics or saved searches

## Decisions

### 1. Next.js + Vercel over a custom Express server
**Decision**: Use Next.js App Router with API Route Handlers deployed to Vercel.
**Rationale**: Serverless functions eliminate infra management for MVP. Vercel's edge network + ISR means fast TTFB for map pages. Built-in middleware is ideal for access-token checks before rendering.
**Alternative considered**: Express + separate frontend — adds deployment complexity with no MVP benefit.

### 2. Mapbox GL JS over Google Maps
**Decision**: Mapbox GL JS for the map renderer.
**Rationale**: Lower per-load cost at MVP scale ($0.50/1,000 loads vs Google's $7/1,000). Vector tiles allow offline-capable progressive web app behavior. Rich marker/popup customization without hacks.
**Alternative considered**: Google Maps JS SDK — familiar but more expensive and heavier SDK footprint on mobile.

### 3. Redis cache keyed on `{normalizedAddress}:{radiusMiles}` with 4-hour TTL
**Decision**: Cache the full enriched permit result set per address+radius combination.
**Rationale**: The Chicago Data Portal imposes rate limits that would be hit quickly with organic traffic. A 4-hour TTL balances freshness against API conservation. Nightly full-refresh for hot addresses keeps cache warm.
**Alternative considered**: Cache individual permit records by permit ID — more granular but requires more cache assembly logic per request; not worth the complexity for MVP.

### 4. Token-based access for $2 tier (no user accounts required)
**Decision**: Issue a signed JWT (or opaque Redis-stored token) after successful Stripe Checkout; store `{token: { address, expiresAt }}` in Redis. No user registration required.
**Rationale**: Reduces friction for one-time buyers. Eliminates auth complexity for MVP.
**Trade-off**: Users cannot recover their token if lost within 24hrs (acceptable MVP limitation; noted in UI).

### 5. PostgreSQL for persistent data (users, subscriptions, tokens)
**Decision**: PostgreSQL via Supabase (managed, free tier sufficient for MVP).
**Rationale**: Relational model fits subscription/token/user relationships well. Supabase provides connection pooling and a REST API layer for quick prototyping.
**Tables**: `access_tokens`, `subscriptions`, `permit_snapshots` (for audit/caching backup)
**Alternative considered**: SQLite — not suitable for serverless concurrent writes.

### 6. Nightly batch job via Vercel Cron to re-ingest Chicago Data Portal
**Decision**: A Vercel Cron job runs at 2 AM CT daily, fetching the last 30 days of newly issued/updated permits and upserting into a local `permit_snapshots` PostgreSQL table.
**Rationale**: Reduces live API dependency. Queries against local DB are faster and not rate-limited. The cron approach avoids a dedicated worker process.
**Alternative considered**: Webhook push from Data Portal — not supported by Socrata public datasets.

### 7. Color-coded markers by development severity
**Decision**: Three tiers based on permit `reported_cost` and `permit_type`:
- 🔴 Red: Industrial/factory/data center new construction, cost > $5M
- 🟡 Yellow: Large commercial new construction, cost $1M–$5M
- 🟢 Green: Renovation/addition under $1M (informational only)
**Rationale**: Simple visual hierarchy. Homebuyers primarily care about red-tier developments.

## Risks / Trade-offs

- **Chicago Data Portal availability** → Mitigation: Local `permit_snapshots` table serves as fallback; stale data notice shown if cache age > 24hrs
- **Stripe webhook reliability** → Mitigation: Idempotent webhook handler; store `stripe_event_id` to deduplicate. Subscription status re-verified on each protected API call.
- **Geocoding accuracy for Chicago addresses** → Mitigation: Use Mapbox Geocoding API with `proximity` bias set to Chicago bounding box; validate returned coordinates fall within Chicago before querying permits
- **Redis cold start on Vercel** → Mitigation: Use Upstash Redis (HTTP-based, serverless-compatible; no persistent TCP connections required)
- **MVP scope creep to other cities** → Mitigation: Hard-code Chicago bounding box validation in address-search layer; return HTTP 422 with "Coming soon" for out-of-scope addresses

## Migration Plan

1. Provision: Supabase project, Upstash Redis, Mapbox account, Stripe account (test mode)
2. Run DB migrations to create `access_tokens`, `subscriptions`, `permit_snapshots` tables
3. Seed permit data via manual Cron trigger (first run)
4. Deploy to Vercel (preview environment) → smoke test payment flows in Stripe test mode
5. Switch Stripe to live mode → production deploy
6. Rollback: Vercel instant rollback to previous deployment; Redis/DB state is additive (no destructive migrations at launch)

## Open Questions

- **Mapbox vs Google Maps**: Confirm Mapbox pricing holds at projected MVP traffic (est. 500–2,000 map loads/month)
- **Data Portal app token quota**: Confirm Socrata app token rate limit (currently understood as 1,000 req/hr with token vs 1,000/day without)
- **Permit classification heuristics**: Final list of `permit_type_desc` values and `work_description` keywords that constitute "heavy development" — needs validation against live Data Portal sample data (deferred to permit-data-ingestion implementation task)
- **GDPR/CCPA**: Since we collect email for subscriptions, confirm minimal privacy policy requirements before launch

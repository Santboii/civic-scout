## 1. Project Setup & Infrastructure

- [x] 1.1 Initialize Next.js 14 App Router project with TypeScript (`npx create-next-app@latest`)
- [x] 1.2 Add core dependencies: `@upstash/redis`, `stripe`, `@stripe/stripe-js`, `mapbox-gl`, `@mapbox/mapbox-gl-geocoder`, `jose` (JWT), `pg` or `@supabase/supabase-js`
- [x] 1.3 Configure environment variables: `MAPBOX_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SOCRATA_APP_TOKEN`, `DATABASE_URL`, `ACCESS_TOKEN_SECRET`
- [ ] 1.4 Provision Supabase project and run initial DB migrations (tables: `access_tokens`, `subscriptions`, `permit_snapshots`, `stripe_events`)
- [ ] 1.5 Provision Upstash Redis instance (HTTP-based, serverless-compatible)
- [ ] 1.6 Create Stripe products and prices: "Single Look-up" ($2 one-time) and "Unlimited Subscription" ($5/month recurring)
- [ ] 1.7 Register Mapbox account and create a public access token scoped to the app domain
- [ ] 1.8 Register for a Socrata App Token at data.cityofchicago.org/profile/app_tokens
- [ ] 1.9 Configure Vercel project with all environment variables and set up preview + production environments

## 2. Database Schema

- [x] 2.1 Create `permit_snapshots` table: `permit_id` (PK), `permit_type`, `permit_status`, `issue_date`, `work_description`, `estimated_cost`, `reported_cost`, `latitude`, `longitude`, `address`, `contractor_name`, `pin1`, `tier` (RED/YELLOW/GREEN), `zone_type`, `raw_json`, `ingested_at`
- [x] 2.2 Create `access_tokens` table: `jti` (PK), `normalized_address`, `expires_at`, `stripe_checkout_session_id`, `created_at`
- [x] 2.3 Create `subscriptions` table: `id` (PK), `stripe_customer_id` (unique), `stripe_subscription_id`, `email`, `status`, `current_period_end`, `created_at`, `updated_at`
- [x] 2.4 Create `stripe_events` table: `stripe_event_id` (PK), `event_type`, `processed_at` — for idempotency deduplication
- [x] 2.5 Add PostGIS extension and `GEOGRAPHY` index on `permit_snapshots (latitude, longitude)` for fast radius queries against local DB

## 3. Address Search & Geocoding

- [x] 3.1 Build `POST /api/geocode` route: accept raw address string, call Mapbox Geocoding API with `proximity=-87.6298,41.8781&bbox=-87.94,41.644,-87.524,42.023`, return `{ placeName, lat, lon, withinChicago: bool }`
- [x] 3.2 Implement Chicago boundary validation: reject coordinates outside bounding box (lat: 41.644–42.023, lon: -87.940–-87.524)
- [x] 3.3 Implement address normalization: use Mapbox `place_name` output lowercased and trimmed as the canonical key
- [x] 3.4 Build address search UI component: text input with autocomplete (Mapbox Geocoder widget), Chicago-biased, submit triggers geocode + access-control check
- [ ] 3.5 Handle out-of-bounds and unresolvable address error states in the UI with appropriate user-facing messages

## 4. Permit Data Ingestion

- [x] 4.1 Build `lib/socrata.ts`: Socrata SODA client with `X-App-Token` header, `within_circle` geo query builder, error handling with retry (1 retry on 429/503)
- [x] 4.2 Implement permit tier classification logic in `lib/classify.ts`: RED/YELLOW/GREEN rules based on `permit_type`, `work_description` keywords (`DATA CENTER`, `WAREHOUSE`, `FACTORY`, `MANUFACTURING`, `INDUSTRIAL`, `LOGISTICS`, `DISTRIBUTION CENTER`), and `estimated_cost` thresholds
- [x] 4.3 Build `GET /api/permits` route: check Redis cache → if miss, query `ydr8-5enu` with `within_circle(location, lat, lon, 3218)` and `permit_type='PERMIT - NEW CONSTRUCTION'` → classify → cache → return
- [x] 4.4 Implement Cook County CookViewer enrichment in `lib/enrich.ts`: given a `pin1`, query `https://gis.cookcountyil.gov/traditional/rest/services/CookViewer3Dynamic/MapServer/{layer_id}/query` for zone_type; wrap in try/catch with 5s timeout; return `null` on failure
- [ ] 4.5 Implement Chicago Zoning Districts zone warning: query `dj47-wfun` dataset to check if searched address falls within M1/M2/M3/PMD/PD zone polygon; attach `zoneWarning` to address result
- [ ] 4.6 Configure Vercel Cron job at `02:00 CT` (`vercel.json` cron): build `app/api/cron/ingest/route.ts` that fetches last-30-day permits from `ydr8-5enu`, classifies each, and upserts into `permit_snapshots`
- [x] 4.7 Build stale-data fallback: if Socrata call fails, attempt Redis stale key lookup; return data with `staleAge` metadata; surface banner in UI

## 5. Redis Caching Layer

- [x] 5.1 Initialize `@upstash/redis` client in `lib/redis.ts` using `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- [x] 5.2 Implement cache read/write in permit route: key pattern `permits:{lat4}:{lon4}:2mi`, TTL 14,400 seconds (4 hours); serialize result as JSON string
- [x] 5.3 Implement stale-key pattern: write a secondary `permits:{lat4}:{lon4}:2mi:stale` key with no TTL (evict manually on fresh write) for fallback serving
- [ ] 5.4 Implement `ZINCRBY search_counts 1 {normalizedAddress}` on every address search (fire-and-forget)
- [x] 5.5 Configure nightly pre-warm cron at `03:00 CT`: `app/api/cron/prewarm/route.ts` — fetch top 50 from `ZREVRANGE search_counts 0 49`, fetch fresh permit data for each, write to Redis

## 6. Stripe Payment Integration

- [x] 6.1 Build `POST /api/checkout/single` route: create Stripe Checkout Session (`mode: payment`, `$2` price ID, metadata: `{ normalizedAddress, tier: "single" }`), return `{ url }`
- [x] 6.2 Build `POST /api/checkout/subscription` route: create Stripe Checkout Session (`mode: subscription`, `$5/month` price ID, `customer_email` if known), return `{ url }`
- [x] 6.3 Build `POST /api/webhooks/stripe` route: verify signature with `stripe.webhooks.constructEvent`, check `stripe_events` for duplicate `stripe_event_id`, handle `checkout.session.completed` (single + subscription), `customer.subscription.updated`, `customer.subscription.deleted`
- [x] 6.4 Implement $2 token issuance in webhook handler: generate HS256 JWT (`{ jti, address, expiresAt: now+24h, tier: "single" }`), store in Redis `access_token:{jti}` TTL 86400, insert into `access_tokens` table
- [x] 6.5 Implement subscription activation/update in webhook handler: upsert `subscriptions` table on `customer.subscription.*` events
- [x] 6.6 Build Stripe success redirect handler: for single look-up, read token from Checkout Session metadata and pass to client via URL fragment; for subscription, set HTTP-only session cookie and redirect to search

## 7. User Access Control

- [x] 7.1 Build `lib/auth.ts`: `validateSingleToken(token, address)` — verify JWT signature, check Redis for token existence, validate `address` match and `expiresAt`; `validateSubscription(sessionCookie)` — look up `subscriptions` table, confirm `status=active` and `current_period_end > now()`
- [x] 7.2 Add Next.js middleware (`middleware.ts`): intercept requests to `/api/permits` and `/map/*`; run token/subscription validation; return 401/403 with structured error on failure
- [x] 7.3 Build paywall UI component: show searched address, blurred map preview, two CTA buttons (single $2 + subscription $5/month); subscription button styled as primary action
- [x] 7.4 Implement subscriber session cookie: HTTP-only, Secure, SameSite=Strict, signed with `ACCESS_TOKEN_SECRET`, contains `{ stripeCustomerId, email }`; set on subscription activation redirect
- [ ] 7.5 Add "Subscriber" badge to header nav when session cookie is present
- [ ] 7.6 Build `POST /api/auth/logout` route: clear session cookie and return 200

## 8. Development Map UI

- [x] 8.1 Install and configure Mapbox GL JS: add `mapbox-gl` CSS import, set `NEXT_PUBLIC_MAPBOX_TOKEN`, initialize map in a `<MapView>` React component with `style: mapbox://styles/mapbox/streets-v12`
- [x] 8.2 Render searched address pin: blue pulsing Mapbox marker at geocoded lat/lon
- [x] 8.3 Render 2-mile radius circle: GeoJSON `circle` layer using `turf.circle(center, 2, { units: 'miles' })`, semi-transparent blue fill + stroke
- [x] 8.4 Render color-coded permit markers: RED (#E53E3E), YELLOW (#D69E2E), GREEN (#38A169) circle markers; implement Mapbox `cluster` source for overlapping permits
- [x] 8.5 Implement marker click/tap handler: desktop → Mapbox popup with permit detail fields; mobile → bottom sheet slide-up drawer
- [ ] 8.6 Implement "show more" for long `work_description` in popup/drawer (expand inline at 200 chars)
- [x] 8.7 Build map legend overlay: fixed bottom-right corner, three-color tier key
- [ ] 8.8 Build tier filter controls (toggle buttons): show/hide RED/YELLOW/GREEN markers client-side without re-fetching; show empty state message when all filters off
- [x] 8.9 Implement mobile-first responsive layout: full-viewport map on mobile; side panel on desktop (≥ 768px) with permit list alongside map
- [ ] 8.10 Display `zoneWarning` banner below address bar when address is within an industrial zone

## 9. Quality, Security & Launch Prep

- [x] 9.1 Add Chicago bounding box hard-validation in middleware to reject out-of-scope addresses before they reach the permit layer
- [ ] 9.2 Add rate limiting on `/api/geocode` and `/api/permits` using Upstash Redis (`INCR` + TTL per IP) — max 20 req/min per IP
- [ ] 9.3 Set `Content-Security-Policy` headers to allow Mapbox GL JS CDN and Stripe.js origins
- [ ] 9.4 Write minimal privacy policy page covering email collection for subscriptions (GDPR/CCPA)
- [ ] 9.5 Smoke test full payment flows in Stripe test mode: $2 single look-up → token issuance → map access → 24hr expiry; $5/month subscription → activation → unlimited access → cancellation → paywall
- [ ] 9.6 Trigger manual Cron ingest run to seed `permit_snapshots` with initial Chicago data before launch
- [ ] 9.7 Switch Stripe keys from test mode to live mode and deploy to Vercel production
- [ ] 9.8 Verify Stripe webhook endpoint is registered in Stripe dashboard pointing to production URL
- [ ] 9.9 Confirm Mapbox token is domain-restricted to production domain in Mapbox account settings

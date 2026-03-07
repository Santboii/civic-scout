## ADDED Requirements

### Requirement: System caches permit query results in Redis
The system SHALL cache the full enriched permit result set for each unique `{normalizedAddress}:{radiusMiles}` combination in Upstash Redis with a TTL of 4 hours. All permit lookups SHALL check the cache before issuing a Socrata API call.

#### Scenario: Cache miss — first search for an address
- **WHEN** a user searches an address with no existing cache entry
- **THEN** the system SHALL query the Chicago Data Portal Socrata API, classify and enrich the results, store the serialized result set in Redis under key `permits:{normalizedAddress}:2mi` with TTL 14,400 seconds (4 hours), and return the results to the user

#### Scenario: Cache hit — same address searched within TTL window
- **WHEN** a user searches an address that already has a valid cache entry (TTL not expired)
- **THEN** the system SHALL return the cached result set WITHOUT making any Socrata API call, and SHALL include a `cacheAge` field in the API response indicating how many minutes old the data is

#### Scenario: Cache entry expires after 4 hours
- **WHEN** 4 hours have elapsed since a cache entry was written
- **THEN** Redis SHALL automatically evict the entry; the next search for that address SHALL trigger a fresh Socrata API call and re-populate the cache

### Requirement: Cache keys are normalized to prevent redundant entries
The system SHALL normalize all address strings to a canonical form before computing cache keys, so that minor input variations for the same address hit the same cache entry.

#### Scenario: Address input variations map to the same cache key
- **WHEN** users search "123 N Michigan Ave Chicago IL", "123 N. Michigan Ave, Chicago, IL 60601", and "123 north michigan ave chicago"
- **THEN** all three SHALL resolve to the same Mapbox `place_name` output after geocoding, and all SHALL use the same Redis cache key (keyed on the geocoded coordinates rounded to 4 decimal places, not the raw input string)

#### Scenario: Genuinely different addresses produce different cache keys
- **WHEN** a user searches "123 N Michigan Ave" and another searches "456 N Michigan Ave"
- **THEN** these SHALL produce different geocoded coordinates and therefore different Redis cache keys

### Requirement: Nightly cron pre-warms cache for top-searched addresses
The system SHALL maintain a `search_counts` sorted set in Redis that increments on every address search. A nightly Vercel Cron job at 03:00 CT SHALL fetch the top 50 addresses by search count and pre-warm their Redis permit cache entries, so frequent searches are served from cache immediately after the daily data refresh.

#### Scenario: Address search increments search count
- **WHEN** any address search is executed (cache hit or miss)
- **THEN** the system SHALL execute `ZINCRBY search_counts 1 {normalizedAddress}` in Redis

#### Scenario: Nightly cache pre-warm executes
- **WHEN** the pre-warm cron job runs at 03:00 CT
- **THEN** the system SHALL call `ZREVRANGE search_counts 0 49` to get the top 50 addresses, fetch fresh permit data for each from the Socrata API, and write/overwrite their Redis cache entries with a 4-hour TTL

### Requirement: Cache serves stale data as fallback when Socrata is unavailable
The system SHALL attempt to serve stale cached data (any age) when a live Socrata API call fails, rather than returning an error to the user.

#### Scenario: Socrata API is unavailable and stale cache exists
- **WHEN** a Socrata API call fails (timeout or non-200 response) AND a stale cache entry exists for the queried address (TTL expired but data still in Redis via a separate "stale" key pattern)
- **THEN** the system SHALL return the stale cached data to the user with a banner: "Showing data from [X] hours ago. Live data is temporarily unavailable."

#### Scenario: Socrata API is unavailable and no cache exists
- **WHEN** a Socrata API call fails AND no cache entry (fresh or stale) exists for the queried address
- **THEN** the system SHALL return HTTP 503 with message: "We're unable to load development data right now. Please try again in a few minutes."

### Requirement: Cache implementation uses Upstash Redis for serverless compatibility
The system SHALL use Upstash Redis (HTTP-based client `@upstash/redis`) rather than a traditional Redis client, to ensure compatibility with Vercel serverless functions which do not support persistent TCP connections.

#### Scenario: Redis client initialized in serverless context
- **WHEN** any API route handler initializes the Redis client
- **THEN** the `@upstash/redis` client SHALL be instantiated using `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables without opening a TCP connection

## ADDED Requirements

### Requirement: Grid-Based Redis Caching
The system SHALL cache permit search results in Redis using a key based on 4-decimal place latitude/longitude coordinate grids.

#### Scenario: Cache Hit
- **WHEN** a search is performed for an address already in the cache
- **THEN** system returns data from Redis without hitting the Socrata API

### Requirement: Cache TTL Management
The system SHALL set a 4-hour (14,400 seconds) expiration for all fresh permit search results in Redis.

#### Scenario: Expired Cache
- **WHEN** a search is performed for an address where the cache has expired
- **THEN** system fetches fresh data from Socrata and updates the cache

### Requirement: Stale-Data Fallback
The system SHALL store search results in a secondary "stale" key without expiration to provide a fallback during Socrata API outages.

#### Scenario: Socrata API Outage
- **WHEN** the Socrata API is unavailable during a search
- **THEN** system returns data from the stale cache with a warning

## ADDED Requirements

### Requirement: User can search a Chicago street address
The system SHALL accept a free-text address input and attempt to geocode it via the Mapbox Geocoding API with a Chicago bounding box bias. Only addresses whose geocoded coordinates fall within the Chicago, IL city boundary SHALL be accepted for permit lookup.

#### Scenario: Valid Chicago address entered
- **WHEN** a user submits a valid Chicago street address (e.g., "123 N Michigan Ave, Chicago, IL")
- **THEN** the system geocodes the address, confirms the resulting coordinates fall within the Chicago bounding box (lat: 41.644–42.023, lon: -87.940–-87.524), and proceeds to the access-control gate

#### Scenario: Address outside Chicago entered
- **WHEN** a user submits an address that geocodes outside the Chicago city boundary
- **THEN** the system SHALL return an error message "Civic Scout is currently available for Chicago, IL only. More cities coming soon." and SHALL NOT charge the user or proceed to permit lookup

#### Scenario: Unresolvable address entered
- **WHEN** a user submits an address that Mapbox cannot geocode with sufficient confidence (score < 0.5)
- **THEN** the system SHALL display "We couldn't find that address. Please try a more specific address including street number and city." and allow the user to retry

#### Scenario: Address normalized for cache lookup
- **WHEN** a geocoded address is accepted
- **THEN** the system SHALL normalize the address to a canonical form (lowercase, trimmed, Mapbox `place_name` output) and derive a 2-mile radius bounding box centered on the geocoded lat/lon for use in downstream permit queries

### Requirement: System computes 2-mile radius for permit queries
The system SHALL compute a geospatial bounding box and pass lat/lon + radius (3,218 meters) to the permit data layer using the `within_circle` Socrata SoQL operator.

#### Scenario: Radius computation from geocoded point
- **WHEN** a valid Chicago address is geocoded to coordinates (lat, lon)
- **THEN** the system SHALL construct the Socrata query parameter `within_circle(location, {lat}, {lon}, 3218)` and pass it to the permit-data-ingestion layer

#### Scenario: Same address searched by two users
- **WHEN** two users independently search the same address within the cache TTL window
- **THEN** both users SHALL receive results from the cache without triggering a new Socrata API call (see search-caching spec)

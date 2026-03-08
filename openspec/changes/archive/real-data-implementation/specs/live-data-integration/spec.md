## ADDED Requirements

### Requirement: Live Nominatim Geocoding
The system SHALL use the OpenStreetMap Nominatim API for address geocoding when `MOCK_DATA` is disabled.

#### Scenario: Successful Geocoding
- **WHEN** user searches for a valid Chicago address
- **THEN** system returns latitude, longitude, and formatted address from Nominatim

### Requirement: Socrata Building Permits Integration
The system SHALL fetch real-time building permit data from the SODA API dataset `ydr8-5enu`.

#### Scenario: Fetch Nearby Permits
- **WHEN** user requests permits for a specific lat/lon
- **THEN** system queries Socrata with a `within_circle` filter and returns the results

### Requirement: Cook County GIS Enrichment
The system SHALL enrich high-impact (RED) permits with zoning data from the Cook County GIS MapServer API.

#### Scenario: Enriched Permit Result
- **WHEN** a RED severity permit is identified
- **THEN** system queries Cook County GIS and attaches the `zoning_classification` to the permit object

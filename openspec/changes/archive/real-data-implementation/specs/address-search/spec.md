## MODIFIED Requirements

### Requirement: User can search a Chicago street address
The system SHALL accept a free-text address input and attempt to geocode it via the OpenStreetMap Nominatim API when `MOCK_DATA` is disabled. The system SHALL append ", Chicago, IL" to all queries and enforce a Chicago bounding box filter (lat: 41.644–42.023, lon: -87.940–-87.524). Only addresses whose geocoded coordinates fall within this boundary SHALL be accepted.

#### Scenario: Valid Chicago address entered
- **WHEN** a user submits a valid Chicago street address (e.g., "121 N LaSalle St")
- **THEN** the system geocodes the address using Nominatim, confirms the resulting coordinates fall within the Chicago bounding box, and proceeds to the access-control gate

#### Scenario: Address outside Chicago entered
- **WHEN** a user submits an address that geocodes outside the Chicago city boundary
- **THEN** the system SHALL return an error message "Civic Scout is currently available for Chicago, IL only." and SHALL NOT proceed to permit lookup

#### Scenario: Unresolvable address entered
- **WHEN** a user submits an address that Nominatim cannot geocode
- **THEN** the system SHALL display "We couldn't find that address. Please try a more specific address including street number and city." and allow the user to retry

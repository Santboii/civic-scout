## MODIFIED Requirements

### Requirement: User can search a Chicago street address
The system SHALL provide a sleek, modern address search interface using the `modern-design-system` tokens. This includes high-contrast text input, clear focus states, and a professional "Search" button.

#### Scenario: Valid Chicago address entered
- **WHEN** a user submits a valid Chicago street address (e.g., "123 N Michigan Ave, Chicago, IL")
- **THEN** the system geocodes the address, confirms the resulting coordinates fall within the Chicago bounding box (lat: 41.644–42.023, lon: -87.940–-87.524), and displays a modern loading state using the `accent-primary` color (#2563EB) before proceeding

#### Scenario: Address outside Chicago entered
- **WHEN** a user submits an address that geocodes outside the Chicago city boundary
- **THEN** the system SHALL return a stylized error message using #EF4444 (Red-500) that clearly communicates: "Civic Scout is currently available for Chicago, IL only. More cities coming soon."

#### Scenario: Unresolvable address entered
- **WHEN** a user submits an address that Mapbox cannot geocode with sufficient confidence (score < 0.5)
- **THEN** the system SHALL display a clear, accessible warning "We couldn't find that address. Please try a more specific address including street number and city." and allow the user to retry with a high-contrast retry interface

## MODIFIED Requirements

### Requirement: System displays color-coded permit markers on the map
The system SHALL render one Mapbox marker per returned permit at the permit's `latitude`/`longitude` coordinates. Marker color SHALL correspond to the permit's severity tier: RED for high-impact, YELLOW for medium-impact, GREEN for low-impact/informational. These colors SHALL be updated to align with the modern, high-contrast design system.

#### Scenario: RED tier permit marker rendered
- **WHEN** a permit with `tier: "RED"` is included in the result set
- **THEN** the system SHALL render a bright red (#EF4444) filled circle marker at the permit's coordinates with a white border

#### Scenario: YELLOW tier permit marker rendered
- **WHEN** a permit with `tier: "YELLOW"` is included in the result set
- **THEN** the system SHALL render a bold yellow (#F59E0B) filled circle marker at the permit's coordinates with a white border

#### Scenario: GREEN tier permit marker rendered
- **WHEN** a permit with `tier: "GREEN"` is included in the result set
- **THEN** the system SHALL render a deep green (#10B981) filled circle marker at the permit's coordinates with a white border

#### Scenario: Multiple permits at the same location
- **WHEN** two or more permits share identical or near-identical coordinates (within 50 meters)
- **THEN** the system SHALL cluster them into a single numbered cluster marker; clicking the cluster SHALL zoom in and expand individual markers

### Requirement: User can tap/click a permit marker to view details
The system SHALL display a popup overlay when a user taps or clicks a permit marker. The popup SHALL contain: permit number, permit type, issue date, work description (truncated to 200 chars with "show more" expansion), estimated cost (formatted as currency), contractor name, and zoning classification (if available). The popup's background and typography SHALL use the `modern-design-system` tokens.

#### Scenario: User taps a permit marker on mobile
- **WHEN** a user taps a permit marker on a mobile device
- **THEN** a bottom sheet SHALL slide up with a modern, high-contrast theme (#FFFFFF background, #0F172A text) displaying the permit detail fields; the map SHALL remain visible behind the sheet

#### Scenario: User clicks a permit marker on desktop
- **WHEN** a user clicks a permit marker on desktop
- **THEN** a Mapbox popup SHALL appear at the marker location with the permit detail fields; the popup SHALL have a close button and use the updated design system typography

#### Scenario: Work description exceeds 200 characters
- **WHEN** a permit's `work_description` is longer than 200 characters
- **THEN** the popup SHALL display the first 200 characters followed by a "Show more" link that expands the full description inline

### Requirement: Map includes a legend and 2-mile radius circle
The system SHALL render a semi-transparent circle overlay on the map representing the 2-mile (3,218m) search radius centered on the searched address. A fixed legend SHALL be visible on the map identifying the three tier colors. The radius circle and legend SHALL be visually updated for a cleaner, modern look.

#### Scenario: Radius circle rendered on map load
- **WHEN** the development map loads
- **THEN** the system SHALL render a Mapbox GeoJSON circle layer with radius 3,218 meters, centered on the searched address coordinates, with a semi-transparent indigo fill (#6366F1, opacity 0.1) and a subtle Indigo stroke

#### Scenario: Legend visible on all screen sizes
- **WHEN** the map is displayed on any screen size
- **THEN** a legend overlay SHALL be visible in the bottom-right corner of the map with a sleek #FFFFFF background and #0F172A text showing: 🔴 High Impact, 🟡 Medium Impact, 🟢 Low Impact / Informational

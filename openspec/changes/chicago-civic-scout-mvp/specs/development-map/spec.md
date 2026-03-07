## ADDED Requirements

### Requirement: System renders a Mapbox map centered on the searched address
The system SHALL render an interactive Mapbox GL JS map centered on the geocoded coordinates of the searched address, with an initial zoom level that makes the full 2-mile radius visible on screen. The map SHALL be the primary content element and SHALL occupy the full viewport on mobile devices.

#### Scenario: Map renders after successful address search and payment
- **WHEN** a user completes a valid address search and has an active access token
- **THEN** the system SHALL render a Mapbox GL JS map centered at the geocoded lat/lon, zoom level 13, with a pulsing blue pin at the searched address and all nearby permit markers loaded

#### Scenario: Map renders on a mobile device (< 768px viewport)
- **WHEN** a user accesses the map view on a mobile device
- **THEN** the map SHALL occupy 100% of the viewport height and width, with a slide-up drawer for permit list details below the map fold

### Requirement: System displays color-coded permit markers on the map
The system SHALL render one Mapbox marker per returned permit at the permit's `latitude`/`longitude` coordinates. Marker color SHALL correspond to the permit's severity tier: RED for high-impact, YELLOW for medium-impact, GREEN for low-impact/informational.

#### Scenario: RED tier permit marker rendered
- **WHEN** a permit with `tier: "RED"` is included in the result set
- **THEN** the system SHALL render a red (#E53E3E) filled circle marker at the permit's coordinates with a white border

#### Scenario: YELLOW tier permit marker rendered
- **WHEN** a permit with `tier: "YELLOW"` is included in the result set
- **THEN** the system SHALL render a yellow (#D69E2E) filled circle marker at the permit's coordinates with a white border

#### Scenario: GREEN tier permit marker rendered
- **WHEN** a permit with `tier: "GREEN"` is included in the result set
- **THEN** the system SHALL render a green (#38A169) filled circle marker at the permit's coordinates with a white border

#### Scenario: Multiple permits at the same location
- **WHEN** two or more permits share identical or near-identical coordinates (within 50 meters)
- **THEN** the system SHALL cluster them into a single numbered cluster marker; clicking the cluster SHALL zoom in and expand individual markers

### Requirement: User can tap/click a permit marker to view details
The system SHALL display a popup overlay when a user taps or clicks a permit marker. The popup SHALL contain: permit number, permit type, issue date, work description (truncated to 200 chars with "show more" expansion), estimated cost (formatted as currency), contractor name, and zoning classification (if available).

#### Scenario: User taps a permit marker on mobile
- **WHEN** a user taps a permit marker on a mobile device
- **THEN** a bottom sheet SHALL slide up displaying the permit detail fields listed above; the map SHALL remain visible behind the sheet

#### Scenario: User clicks a permit marker on desktop
- **WHEN** a user clicks a permit marker on desktop
- **THEN** a Mapbox popup SHALL appear at the marker location with the permit detail fields; the popup SHALL have a close button

#### Scenario: Work description exceeds 200 characters
- **WHEN** a permit's `work_description` is longer than 200 characters
- **THEN** the popup SHALL display the first 200 characters followed by a "Show more" link that expands the full description inline

### Requirement: Map includes a legend and 2-mile radius circle
The system SHALL render a semi-transparent circle overlay on the map representing the 2-mile (3,218m) search radius centered on the searched address. A fixed legend SHALL be visible on the map identifying the three tier colors.

#### Scenario: Radius circle rendered on map load
- **WHEN** the development map loads
- **THEN** the system SHALL render a Mapbox GeoJSON circle layer with radius 3,218 meters, centered on the searched address coordinates, with a semi-transparent blue fill (opacity 0.08) and a blue stroke

#### Scenario: Legend visible on all screen sizes
- **WHEN** the map is displayed on any screen size
- **THEN** a legend overlay SHALL be visible in the bottom-right corner of the map showing: 🔴 High Impact (>$5M / Industrial), 🟡 Medium Impact ($1M–$5M), 🟢 Low Impact / Informational

### Requirement: User can toggle permit tier visibility
The system SHALL provide filter controls (checkboxes or toggle buttons) that allow the user to show or hide permit markers by tier. All tiers SHALL be visible by default.

#### Scenario: User hides RED tier markers
- **WHEN** a user deselects the RED tier filter
- **THEN** all RED tier markers SHALL be hidden from the map without reloading permit data; re-enabling the filter SHALL restore the markers immediately

#### Scenario: All filters deselected
- **WHEN** a user deselects all tier filters
- **THEN** all markers SHALL be hidden and a message SHALL appear: "No markers visible. Use the filters above to show developments."

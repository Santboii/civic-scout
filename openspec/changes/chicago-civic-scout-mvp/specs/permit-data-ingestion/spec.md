## ADDED Requirements

### Requirement: System fetches building permits from Chicago Data Portal
The system SHALL query the Chicago Building Permits dataset (`ydr8-5enu`) via the Socrata SODA REST API using a registered App Token passed in the `X-App-Token` header. The primary endpoint is `https://data.cityofchicago.org/resource/ydr8-5enu.json`.

#### Scenario: Live permit fetch for a geocoded address
- **WHEN** a permit query is initiated for a validated Chicago address with no cache hit
- **THEN** the system SHALL issue a Socrata query with `within_circle(location, {lat}, {lon}, 3218)` and `permit_type='PERMIT - NEW CONSTRUCTION'` filtered to permits issued within the last 2 years, returning up to 1,000 results with fields: `permit_`, `permit_type`, `permit_status`, `issue_date`, `work_description`, `estimated_cost`, `reported_cost`, `latitude`, `longitude`, `street_number`, `street_direction`, `street_name`, `contractor_name`, `pin1`

#### Scenario: App Token present in all Socrata requests
- **WHEN** any request is made to `data.cityofchicago.org`
- **THEN** the request SHALL include the `X-App-Token` header with the configured Socrata app token to avoid anonymous rate throttling

#### Scenario: Socrata API returns an error or is unreachable
- **WHEN** the Socrata API returns a non-200 response or times out (> 10 seconds)
- **THEN** the system SHALL attempt to serve stale cached data if available (any TTL), log the error, and display a banner: "Data may be up to [X] hours old due to a temporary issue."

### Requirement: System classifies permits into severity tiers
The system SHALL classify each returned permit into one of three severity tiers based on `permit_type`, `work_description` keywords, and `estimated_cost` (or `reported_cost` as fallback).

Tier rules (evaluated in order, first match wins):
- **RED** (High Impact): `permit_type = 'PERMIT - NEW CONSTRUCTION'` AND (`estimated_cost > 5,000,000` OR `work_description` contains any keyword in: `DATA CENTER`, `WAREHOUSE`, `FACTORY`, `MANUFACTURING`, `INDUSTRIAL`, `LOGISTICS`, `DISTRIBUTION CENTER`)
- **YELLOW** (Medium Impact): `permit_type = 'PERMIT - NEW CONSTRUCTION'` AND `estimated_cost` between 1,000,000 and 5,000,000
- **GREEN** (Low Impact / Informational): All other matched permits

#### Scenario: Permit classified as RED tier
- **WHEN** a fetched permit has `estimated_cost = 12000000` and `work_description` contains "WAREHOUSE"
- **THEN** the system SHALL assign it `tier: "RED"` in the normalized permit record

#### Scenario: Permit classified as YELLOW tier
- **WHEN** a fetched permit has `permit_type = 'PERMIT - NEW CONSTRUCTION'` and `estimated_cost = 2500000` with no industrial keywords in `work_description`
- **THEN** the system SHALL assign it `tier: "YELLOW"` in the normalized permit record

#### Scenario: Permit with missing cost data
- **WHEN** both `estimated_cost` and `reported_cost` are null or zero
- **THEN** the system SHALL fall back to keyword-only classification; if no keywords match, the permit SHALL be assigned `tier: "GREEN"`

### Requirement: Nightly batch job re-ingests Chicago permit data
The system SHALL run a Vercel Cron job at 02:00 CT daily that fetches all new or updated Chicago Building Permits issued or modified in the last 30 days and upserts them into the `permit_snapshots` PostgreSQL table. This ensures the permit cache can be served from local DB rather than relying on live Socrata calls.

#### Scenario: Nightly cron executes successfully
- **WHEN** the cron job runs at 02:00 CT
- **THEN** the system SHALL fetch permits with `issue_date > (now - 30 days)` from `ydr8-5enu`, classify each permit by tier, upsert into `permit_snapshots` keyed on `permit_` (permit number), and log the count of new/updated records

#### Scenario: Cron job fails partway through
- **WHEN** the cron job encounters an error mid-run (e.g., Socrata timeout after processing 200 of 1,000 records)
- **THEN** the system SHALL log the failure with details, retain all already-upserted records, and NOT delete any existing `permit_snapshots` data

### Requirement: System enriches permits with Cook County zoning data
The system SHALL optionally cross-reference a permit's `pin1` field against the Cook County CookViewer ArcGIS MapServer REST API to retrieve the parcel's zoning classification (`zone_type`). This enrichment is best-effort and SHALL NOT block permit display if the Cook County API is unavailable.

#### Scenario: Zoning enrichment succeeds
- **WHEN** a permit record has a valid `pin1` value
- **THEN** the system SHALL query `https://gis.cookcountyil.gov/traditional/rest/services/CookViewer3Dynamic/MapServer/{layer_id}/query?where=PIN14='{pin}'&outFields=*&f=json` and attach the returned `zone_type` to the permit record for display in the marker popup

#### Scenario: Cook County API unavailable
- **WHEN** the CookViewer API returns an error or times out (> 5 seconds)
- **THEN** the system SHALL set `zone_type: null` on the permit record and proceed without blocking; no error shall be shown to the user for this field specifically

### Requirement: System uses Chicago Zoning Districts to flag industrial zones
The system SHALL query the Chicago Zoning Districts dataset (`dj47-wfun`) to determine if the searched address falls within or is adjacent to an industrial zone (`M1`, `M2`, `M3`, `PMD`, or `PD`). A positive zone match SHALL be surfaced in the UI as an additional risk indicator.

#### Scenario: Address within an M2 manufacturing zone
- **WHEN** a searched address geocodes to coordinates inside an `M2`-zoned district polygon
- **THEN** the system SHALL include a `zoneWarning: "Located in M2 Light Manufacturing zone"` field in the address search result

#### Scenario: Address not in an industrial zone
- **WHEN** a searched address geocodes to coordinates not within any M1/M2/M3/PMD/PD zone polygon
- **THEN** the system SHALL set `zoneWarning: null` and display no zone warning in the UI

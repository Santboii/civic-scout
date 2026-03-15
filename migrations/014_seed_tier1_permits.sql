-- Seed Tier 1 cities: Seattle, San Francisco, Austin
-- NOTE(Agent): These are the first non-Chicago permit registries.
-- No code changes needed — the existing registry-based pipeline handles them.

-- ═══════════════════════════════════════════════════════════════════════
-- SEATTLE  (cos-data.seattle.gov)
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO city_registries (
  city, state, country, domain, dataset_id, column_map, permit_type_filter,
  geo_type, bbox, priority, verified, enabled, data_source_type, arcgis_url,
  permit_status_values, enrichment_type, source_url, last_verified_at
) VALUES (
  'Seattle', 'WA', 'US',
  'data.seattle.gov',
  '76t5-zqzr',
  '{
    "permit_id": "permitnum",
    "permit_type": "permittypedesc",
    "work_description": "description",
    "reported_cost": "value",
    "issue_date": "issueddate",
    "latitude": "latitude",
    "longitude": "longitude",
    "location": "location1",
    "permit_status": "statuscurrent"
  }'::jsonb,
  NULL,
  'separate',
  '{"latMin": 47.49, "latMax": 47.74, "lonMin": -122.44, "lonMax": -122.24}'::jsonb,
  10, true, true,
  'socrata', NULL,
  '["Issued", "Application Accepted"]'::jsonb,
  NULL,
  'https://data.seattle.gov/Permitting/Building-Permits-Current/76t5-zqzr',
  NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- SAN FRANCISCO  (data.sfgov.org)
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO city_registries (
  city, state, country, domain, dataset_id, column_map, permit_type_filter,
  geo_type, bbox, priority, verified, enabled, data_source_type, arcgis_url,
  permit_status_values, enrichment_type, source_url, last_verified_at
) VALUES (
  'San Francisco', 'CA', 'US',
  'data.sfgov.org',
  'i98e-djp9',
  '{
    "permit_id": "permit_number",
    "permit_type": "permit_type_definition",
    "work_description": "description",
    "reported_cost": "estimated_cost",
    "issue_date": "issued_date",
    "location": "location",
    "street_number": "street_number",
    "street_name": "street_name",
    "suffix": "street_suffix",
    "permit_status": "status"
  }'::jsonb,
  NULL,
  'point',
  '{"latMin": 37.70, "latMax": 37.84, "lonMin": -122.52, "lonMax": -122.36}'::jsonb,
  10, true, true,
  'socrata', NULL,
  '["issued", "complete", "approved"]'::jsonb,
  NULL,
  'https://data.sfgov.org/Housing-and-Buildings/Building-Permits/i98e-djp9',
  NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- AUSTIN  (data.austintexas.gov)
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO city_registries (
  city, state, country, domain, dataset_id, column_map, permit_type_filter,
  geo_type, bbox, priority, verified, enabled, data_source_type, arcgis_url,
  permit_status_values, enrichment_type, source_url, last_verified_at
) VALUES (
  'Austin', 'TX', 'US',
  'data.austintexas.gov',
  '3syk-w9eu',
  '{
    "permit_id": "permit_number",
    "permit_type": "permit_type_desc",
    "work_description": "description",
    "reported_cost": "total_valuation",
    "issue_date": "issue_date",
    "latitude": "latitude",
    "longitude": "longitude",
    "location": "location",
    "permit_status": "status_current"
  }'::jsonb,
  NULL,
  'point',
  '{"latMin": 30.09, "latMax": 30.52, "lonMin": -97.94, "lonMax": -97.56}'::jsonb,
  10, true, true,
  'socrata', NULL,
  '["Active"]'::jsonb,
  NULL,
  'https://data.austintexas.gov/Building-and-Development/Issued-Construction-Permits/3syk-w9eu',
  NOW()
);

-- Seed data layers for Tier 1 cities (where geo-enabled datasets exist)
-- NOTE(Agent): Only adding confirmed geo-enabled datasets. More layers can be
-- added later via INSERT with no code changes.

-- ═══════════════════════════════════════════════════════════════════════
-- SEATTLE — Crimes  (data.seattle.gov / tazs-3rd5)
-- ═══════════════════════════════════════════════════════════════════════
-- Dataset: SPD Crime Data 2008-Present, has latitude/longitude columns
INSERT INTO data_layer_registries (
  city, state, domain, layer_type, dataset_id, geo_column, column_map,
  order_by, source_url, source_label, bbox
) VALUES (
  'Seattle', 'WA', 'data.seattle.gov', 'crimes', 'tazs-3rd5', 'location',
  '{
    "id": "offense_id",
    "case_number": "report_number",
    "date": "offense_date",
    "primary_type": "offense_category",
    "description": "nibrs_offense_code_description",
    "block": "block_address",
    "latitude": "latitude",
    "longitude": "longitude",
    "arrest": "arrest",
    "domestic": "domestic"
  }'::jsonb,
  'offense_date DESC',
  'https://data.seattle.gov/Public-Safety/SPD-Crime-Data-2008-Present/tazs-3rd5',
  'Seattle Crime Data',
  '{"latMin": 47.49, "latMax": 47.74, "lonMin": -122.44, "lonMax": -122.24}'::jsonb
);

-- ═══════════════════════════════════════════════════════════════════════
-- SEATTLE — Violations  (data.seattle.gov / k44w-2dcq)
-- ═══════════════════════════════════════════════════════════════════════
-- Dataset: Code Complaints and Violations
INSERT INTO data_layer_registries (
  city, state, domain, layer_type, dataset_id, geo_column, column_map,
  order_by, source_url, source_label, bbox
) VALUES (
  'Seattle', 'WA', 'data.seattle.gov', 'violations', 'k44w-2dcq', 'location1',
  '{
    "id": "case_number",
    "violation_date": "openeddate",
    "violation_code": "case_type",
    "violation_description": "description",
    "violation_status": "status",
    "inspection_status": "status",
    "address": "address",
    "department_bureau": "case_group",
    "latitude": "latitude",
    "longitude": "longitude"
  }'::jsonb,
  'openeddate DESC',
  'https://data.seattle.gov/Community/Code-Complaints-and-Violations/k44w-2dcq',
  'Seattle Code Violations',
  '{"latMin": 47.49, "latMax": 47.74, "lonMin": -122.44, "lonMax": -122.24}'::jsonb
);

-- ═══════════════════════════════════════════════════════════════════════
-- SAN FRANCISCO — Crimes  (data.sfgov.org / wg3w-h783)
-- ═══════════════════════════════════════════════════════════════════════
-- Dataset: Police Department Incident Reports 2018 to Present
INSERT INTO data_layer_registries (
  city, state, domain, layer_type, dataset_id, geo_column, column_map,
  order_by, source_url, source_label, bbox
) VALUES (
  'San Francisco', 'CA', 'data.sfgov.org', 'crimes', 'wg3w-h783', 'point',
  '{
    "id": "row_id",
    "case_number": "incident_number",
    "date": "incident_datetime",
    "primary_type": "incident_category",
    "description": "incident_description",
    "block": "intersection",
    "latitude": "latitude",
    "longitude": "longitude",
    "arrest": "resolution",
    "domestic": "domestic"
  }'::jsonb,
  'incident_datetime DESC',
  'https://data.sfgov.org/Public-Safety/Police-Department-Incident-Reports-2018-to-Present/wg3w-h783',
  'SF Crime Data',
  '{"latMin": 37.70, "latMax": 37.84, "lonMin": -122.52, "lonMax": -122.36}'::jsonb
);

-- ═══════════════════════════════════════════════════════════════════════
-- AUSTIN — Crashes  (data.austintexas.gov / y2wy-tgr5)
-- ═══════════════════════════════════════════════════════════════════════
-- Dataset: Austin Crash Report Data
INSERT INTO data_layer_registries (
  city, state, domain, layer_type, dataset_id, geo_column, column_map,
  order_by, source_url, source_label, bbox
) VALUES (
  'Austin', 'TX', 'data.austintexas.gov', 'crashes', 'y2wy-tgr5', 'point',
  '{
    "crash_record_id": "cris_crash_id",
    "crash_date": "crash_timestamp",
    "crash_type": "collsn_desc",
    "injuries_total": "tot_injry_cnt",
    "injuries_fatal": "death_cnt",
    "damage": "est_comp_cost_crash_based",
    "prim_contributory_cause": "collsn_desc",
    "latitude": "latitude",
    "longitude": "longitude"
  }'::jsonb,
  'crash_timestamp DESC',
  'https://data.austintexas.gov/Transportation-and-Mobility/Austin-Crash-Report-Data-Crash-Level-Records/y2wy-tgr5',
  'Austin Crash Data',
  '{"latMin": 30.09, "latMax": 30.52, "lonMin": -97.94, "lonMax": -97.56}'::jsonb
);

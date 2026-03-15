-- Seed Chicago's data layer registries
-- NOTE(Agent): column_map keys match the field names expected by the existing
-- normalizeCrime/normalizeViolation/normalizeCrash functions in data-layers.ts.
-- Chicago uses Socrata's standard column names, so the map is mostly identity.

INSERT INTO data_layer_registries (city, state, domain, layer_type, dataset_id, geo_column, column_map, order_by, source_url, source_label, bbox) VALUES
(
  'Chicago', 'IL', 'data.cityofchicago.org', 'crimes', 'ijzp-q8t2', 'location',
  '{
    "id": "id",
    "case_number": "case_number",
    "date": "date",
    "primary_type": "primary_type",
    "description": "description",
    "block": "block",
    "latitude": "latitude",
    "longitude": "longitude",
    "arrest": "arrest",
    "domestic": "domestic"
  }'::jsonb,
  'date DESC',
  'https://data.cityofchicago.org/Public-Safety/Crimes-2001-to-Present/ijzp-q8t2',
  'Chicago Crime Data',
  '{"latMin": 41.64, "latMax": 42.02, "lonMin": -87.94, "lonMax": -87.52}'::jsonb
),
(
  'Chicago', 'IL', 'data.cityofchicago.org', 'violations', '22u3-xenr', 'location',
  '{
    "id": "id",
    "violation_date": "violation_date",
    "violation_code": "violation_code",
    "violation_description": "violation_description",
    "violation_status": "violation_status",
    "inspection_status": "inspection_status",
    "address": "address",
    "department_bureau": "department_bureau",
    "latitude": "latitude",
    "longitude": "longitude"
  }'::jsonb,
  'violation_date DESC',
  'https://data.cityofchicago.org/Buildings/Building-Violations/22u3-xenr',
  'Chicago Building Violations',
  '{"latMin": 41.64, "latMax": 42.02, "lonMin": -87.94, "lonMax": -87.52}'::jsonb
),
(
  'Chicago', 'IL', 'data.cityofchicago.org', 'crashes', '85ca-t3if', 'location',
  '{
    "id": "crash_record_id",
    "crash_date": "crash_date",
    "crash_type": "crash_type",
    "injuries_total": "injuries_total",
    "injuries_fatal": "injuries_fatal",
    "damage": "damage",
    "prim_contributory_cause": "prim_contributory_cause",
    "latitude": "latitude",
    "longitude": "longitude"
  }'::jsonb,
  'crash_date DESC',
  'https://data.cityofchicago.org/Transportation/Traffic-Crashes-Crashes/85ca-t3if',
  'Chicago Traffic Crashes',
  '{"latMin": 41.64, "latMax": 42.02, "lonMin": -87.94, "lonMax": -87.52}'::jsonb
);

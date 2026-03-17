-- Add 311 service_requests layer type to data_layer_registries
-- NOTE(Agent): Wrapped in transaction per PE review — DROP + ADD constraint
-- must be atomic to avoid a window without the constraint on concurrent inserts.

BEGIN;

-- Update layer_type CHECK constraint to include 'service_requests'
ALTER TABLE data_layer_registries
  DROP CONSTRAINT IF EXISTS data_layer_registries_layer_type_check;

ALTER TABLE data_layer_registries
  ADD CONSTRAINT data_layer_registries_layer_type_check
  CHECK (layer_type IN ('crimes', 'violations', 'crashes', 'service_requests'));

-- Seed Chicago 311 Service Requests
-- Dataset: https://data.cityofchicago.org/Service-Requests/311-Service-Requests/v6vf-nfxy
INSERT INTO data_layer_registries (
  city, state, domain, layer_type, dataset_id,
  geo_column, geo_type, column_map, order_by,
  source_url, source_label, bbox, priority, enabled
) VALUES (
  'Chicago', 'IL', 'data.cityofchicago.org', 'service_requests', 'v6vf-nfxy',
  'location', 'point',
  '{
    "sr_number": "sr_number",
    "sr_type": "sr_type",
    "status": "status",
    "created_date": "created_date",
    "street_address": "street_address",
    "latitude": "latitude",
    "longitude": "longitude"
  }'::jsonb,
  'created_date DESC',
  'https://data.cityofchicago.org/Service-Requests/311-Service-Requests/v6vf-nfxy',
  'Chicago 311 Service Requests',
  '{"latMin": 41.64, "latMax": 42.02, "lonMin": -87.94, "lonMax": -87.52}'::jsonb,
  0,
  true
);

COMMIT;

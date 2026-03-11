-- Add permit_status_values column (JSONB array, nullable)
ALTER TABLE city_registries
  ADD COLUMN IF NOT EXISTS permit_status_values jsonb DEFAULT NULL;

-- Update Chicago's column_map to include permit_status, and set active status values
UPDATE city_registries
SET
  column_map = column_map || '{"permit_status": "permit_status"}'::jsonb,
  permit_status_values = '["ACTIVE", "PHASED PERMITTING"]'::jsonb
WHERE dataset_id = 'ydr8-5enu';

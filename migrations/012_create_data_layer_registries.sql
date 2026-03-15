-- Data layer registries: multi-city activity data (crimes, violations, crashes)
-- NOTE(Agent): Mirrors the city_registries pattern for data layers.
-- Each row represents one Socrata dataset for one layer type in one city.

CREATE TABLE data_layer_registries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  domain TEXT NOT NULL,
  layer_type TEXT NOT NULL CHECK (layer_type IN ('crimes', 'violations', 'crashes')),
  dataset_id TEXT NOT NULL,
  -- Socrata column containing geographic coordinates (e.g., 'location')
  geo_column TEXT NOT NULL DEFAULT 'location',
  -- Maps Socrata field names to normalized field names used by normalizers
  column_map JSONB NOT NULL DEFAULT '{}',
  -- Socrata $order clause (e.g., 'date DESC')
  order_by TEXT NOT NULL,
  -- Human-readable URL shown in DataLayerDetailModal "View Source" button
  source_url TEXT,
  -- Short label for attribution footer (e.g., 'Chicago Crime Data')
  source_label TEXT,
  -- Bounding box for coordinate-based registry lookup
  bbox JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (domain, dataset_id, layer_type)
);

COMMENT ON TABLE data_layer_registries IS 'Registry of Socrata datasets for crime, violation, and crash data layers. One row per city per layer type.';

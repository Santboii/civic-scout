ALTER TABLE city_registries ADD COLUMN data_source_type TEXT NOT NULL DEFAULT 'socrata';
ALTER TABLE city_registries ADD COLUMN arcgis_url TEXT;
COMMENT ON COLUMN city_registries.data_source_type IS 'Data source adapter: socrata or arcgis';
COMMENT ON COLUMN city_registries.arcgis_url IS 'Full ArcGIS Feature Service URL (required when data_source_type = arcgis)';

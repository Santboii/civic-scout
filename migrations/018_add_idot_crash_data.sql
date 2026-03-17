-- Add data_source_type and arcgis_url columns to data_layer_registries
-- Enables ArcGIS Feature Service data sources alongside existing Socrata sources

ALTER TABLE data_layer_registries
ADD COLUMN IF NOT EXISTS data_source_type text NOT NULL DEFAULT 'socrata',
ADD COLUMN IF NOT EXISTS arcgis_url text;

-- IDOT Statewide Crash Data (2024)
-- Covers all Greater Chicagoland counties via a single ArcGIS Feature Service.
-- Priority -1 ensures Chicago's Socrata crash data (priority 0) takes precedence
-- within Chicago city limits, while IDOT covers all suburban areas.
INSERT INTO data_layer_registries (
    city, state, domain, layer_type, dataset_id, geo_column, geo_type,
    column_map, order_by, source_url, source_label, bbox, priority, enabled,
    data_source_type, arcgis_url
) VALUES (
    'Greater Chicagoland', 'IL', '', 'crashes', '',
    '', 'separate',
    '{
        "crash_record_id": "ICN",
        "crash_date": "CrashDate",
        "crash_type": "TypeOfFirstCrash",
        "injuries_total": "TotalInjured",
        "injuries_fatal": "TotalFatals",
        "damage": "CrashSeverity",
        "prim_contributory_cause": "Cause1",
        "latitude": "TSCrashLatitude",
        "longitude": "TSCrashLongitude"
    }'::jsonb,
    'CrashDate DESC',
    'https://gis-idot.opendata.arcgis.com/datasets/crashes-2024',
    'IDOT Crash Data (2024)',
    '{"latMin": 41.4, "latMax": 42.5, "lonMin": -88.7, "lonMax": -87.5}'::jsonb,
    -1, true,
    'arcgis',
    'https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/CRASHES__2024/FeatureServer/0'
);

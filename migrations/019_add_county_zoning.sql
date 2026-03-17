-- County-level zoning data registries for Greater Chicagoland
-- These cover UNINCORPORATED areas only (municipalities maintain their own zoning)

-- 1. Update layer_type check constraint to include 'zoning'
ALTER TABLE data_layer_registries
DROP CONSTRAINT IF EXISTS data_layer_registries_layer_type_check;

ALTER TABLE data_layer_registries
ADD CONSTRAINT data_layer_registries_layer_type_check
CHECK (layer_type IN ('crimes', 'violations', 'crashes', 'service_requests', 'zoning'));

-- 2. Update unique constraint to support multiple ArcGIS registries
-- Old: (domain, dataset_id, layer_type) fails when domain/dataset_id empty
-- New: (city, state, layer_type)
ALTER TABLE data_layer_registries
DROP CONSTRAINT IF EXISTS data_layer_registries_domain_dataset_id_layer_type_key;

ALTER TABLE data_layer_registries
ADD CONSTRAINT data_layer_registries_city_state_layer_type_key
UNIQUE (city, state, layer_type);

-- 3. DuPage County Zoning (MapServer)
INSERT INTO data_layer_registries (
    city, state, domain, layer_type, dataset_id, geo_column, geo_type,
    column_map, order_by, source_url, source_label, bbox, priority, enabled,
    data_source_type, arcgis_url
) VALUES (
    'DuPage County', 'IL', '', 'zoning', '',
    '', 'polygon',
    '{"zone_class": "ZONING", "zone_type": "ZCODE"}'::jsonb,
    '',
    'https://gis.dupageco.org/arcgis/rest/services/Zoning/UnincorporatedZoningData/MapServer',
    'DuPage County Zoning (Unincorporated)',
    '{"latMin": 41.64, "latMax": 41.97, "lonMin": -88.25, "lonMax": -87.91}'::jsonb,
    -1, true,
    'arcgis',
    'https://gis.dupageco.org/arcgis/rest/services/Zoning/UnincorporatedZoningData/MapServer/0'
) ON CONFLICT DO NOTHING;

-- 4. Will County Zoning (MapServer)
INSERT INTO data_layer_registries (
    city, state, domain, layer_type, dataset_id, geo_column, geo_type,
    column_map, order_by, source_url, source_label, bbox, priority, enabled,
    data_source_type, arcgis_url
) VALUES (
    'Will County', 'IL', '', 'zoning', '',
    '', 'polygon',
    '{"zone_class": "LAST_APPROVED_ZONING", "zone_type": "LAST_APPROVED_ZONING"}'::jsonb,
    '',
    'https://gis.willcountyillinois.com/hosting/rest/services/Basemap/Zoning/MapServer',
    'Will County Zoning (Unincorporated)',
    '{"latMin": 41.16, "latMax": 41.77, "lonMin": -88.27, "lonMax": -87.52}'::jsonb,
    -1, true,
    'arcgis',
    'https://gis.willcountyillinois.com/hosting/rest/services/Basemap/Zoning/MapServer/0'
) ON CONFLICT DO NOTHING;

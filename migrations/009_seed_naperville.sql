-- NOTE(Agent): Naperville's ArcGIS Feature Service has no geometry (addresses only).
-- We use data_source_type='arcgis_no_geo' so the adapter knows to geocode addresses
-- via Census Bureau + Mapbox fallback rather than doing spatial queries.
INSERT INTO city_registries (
  city, state, domain, dataset_id, geo_type, priority, verified, enabled,
  data_source_type, arcgis_url,
  column_map, permit_type_filter, bbox
) VALUES (
  'Naperville', 'IL',
  'data.naperville.il.us',
  'Building_Permits_View',
  'none', 20, true, true,
  'arcgis_no_geo',
  'https://services1.arcgis.com/rXJ6QApc2sOtl1Pd/arcgis/rest/services/Building_Permits_View/FeatureServer/0',
  '{
    "permit_id": "PERMITNUMBER",
    "permit_type": "PERMITWORKCLASS",
    "work_description": "DESCRIPTION",
    "reported_cost": "PERMITVALUATION",
    "issue_date": "ISSUEDATE",
    "latitude": "UNUSED",
    "longitude": "UNUSED",
    "street_number": "STREETNUMBER",
    "street_direction": "PREDIRECTION",
    "street_name": "STREETNAME",
    "suffix": "STREETTYPE"
  }'::jsonb,
  $$PERMITTYPE IN ('COMMERCIAL','RESIDENTIAL','RESIDENTIAL: OTHER IMPROVEMENTS')$$,
  '{"latMin": 41.65, "latMax": 41.84, "lonMin": -88.26, "lonMax": -88.07}'::jsonb
);

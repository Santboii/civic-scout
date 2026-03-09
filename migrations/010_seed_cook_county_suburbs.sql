-- NOTE(Agent): Cook County Assessor's building permits dataset covers ALL 120+
-- Cook County municipalities. We exclude CITY OF CHICAGO since it has its own
-- richer, geo-enabled Socrata dataset (ydr8-5enu on data.cityofchicago.org).
-- The socrata_no_geo adapter fetches by municipality filter, geocodes addresses
-- via Census+Mapbox, then filters by distance from search point.
INSERT INTO city_registries (
  city, state, domain, dataset_id, geo_type, priority, verified, enabled,
  data_source_type, arcgis_url,
  column_map, permit_type_filter, bbox
) VALUES (
  'Cook County Suburbs', 'IL',
  'datacatalog.cookcountyil.gov',
  '6yjf-dfxs',
  'none', 5, true, true,
  'socrata_no_geo',
  NULL,
  '{
    "permit_id": "permit_number",
    "permit_type": "job_code_primary",
    "work_description": "work_description",
    "reported_cost": "amount",
    "issue_date": "date_issued",
    "latitude": "UNUSED",
    "longitude": "UNUSED",
    "full_address": "mailing_address"
  }'::jsonb,
  $$municipality != 'CITY OF CHICAGO'$$,
  '{"latMin": 41.47, "latMax": 42.16, "lonMin": -88.26, "lonMax": -87.52}'::jsonb
);

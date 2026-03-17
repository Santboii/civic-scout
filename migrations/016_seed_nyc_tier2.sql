-- Seed New York City permits + crime data layer (Tier 2)
-- Verified API columns from Socrata on 2026-03-15

-- NYC Building Permits (DOB Permit Issuance)
-- Dataset: ipu4-2q9a on data.cityofnewyork.us
-- Geo: separate gis_latitude / gis_longitude columns
-- Date: issuance_date (MM/DD/YYYY format)
-- Status: permit_status (ISSUED, etc.)
INSERT INTO city_registries (
    city, state, domain, dataset_id, data_source_type, geo_type,
    column_map, permit_type_filter, permit_status_values,
    bbox, enrichment_type, source_url, enabled
) VALUES (
    'New York City', 'NY', 'data.cityofnewyork.us', 'ipu4-2q9a', 'socrata', 'separate',
    '{
        "permit_id": "job__",
        "permit_type": "job_type",
        "work_description": "job_type",
        "reported_cost": "job__",
        "issue_date": "issuance_date",
        "latitude": "gis_latitude",
        "longitude": "gis_longitude",
        "full_address": "house__",
        "street_name": "street_name",
        "permit_status": "permit_status"
    }'::jsonb,
    NULL,
    '["ISSUED"]'::jsonb,
    '{"north": 40.92, "south": 40.49, "east": -73.70, "west": -74.26}'::jsonb,
    'none',
    'https://data.cityofnewyork.us/Housing-Development/DOB-Permit-Issuance/ipu4-2q9a',
    true
);

-- NYC Crime Data Layer (NYPD Complaint Data Current Year To Date)
-- Dataset: qgea-i56i on data.cityofnewyork.us
-- Geo: separate latitude / longitude columns (lat_lon is a Socrata location field)
INSERT INTO data_layer_registries (
    city, state, domain, layer_type, dataset_id,
    geo_column, geo_type, column_map, order_by,
    source_url, source_label,
    bbox, priority, enabled
) VALUES (
    'New York City', 'NY', 'data.cityofnewyork.us', 'crimes', 'qgea-i56i',
    'lat_lon', 'separate',
    '{
        "id": "cmplnt_num",
        "case_number": "cmplnt_num",
        "date": "cmplnt_fr_dt",
        "primary_type": "ofns_desc",
        "description": "pd_desc",
        "block": "boro_nm",
        "latitude": "latitude",
        "longitude": "longitude",
        "arrest": "crm_atpt_cptd_cd",
        "domestic": "loc_of_occur_desc"
    }'::jsonb,
    'cmplnt_fr_dt DESC',
    'https://data.cityofnewyork.us/Public-Safety/NYPD-Complaint-Data-Current-Year-To-Date-/qgea-i56i',
    'NYC Open Data',
    '{"north": 40.92, "south": 40.49, "east": -73.70, "west": -74.26}'::jsonb,
    0,
    true
);

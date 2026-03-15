-- Multi-city expansion: make city_registries city-agnostic
-- NOTE(Agent): Drops domain UNIQUE so multiple datasets from the same portal
-- (e.g. NYC with permits + building applications) can coexist.

-- Replace UNIQUE(domain) with UNIQUE(domain, dataset_id)
ALTER TABLE city_registries DROP CONSTRAINT city_registries_domain_key;
ALTER TABLE city_registries ADD CONSTRAINT city_registries_domain_dataset_unique UNIQUE (domain, dataset_id);

-- Enrichment config — replaces hardcoded domain check in transform-permit.ts
-- Values: 'cook_county_gis' | NULL (extensible for future enrichment providers)
ALTER TABLE city_registries ADD COLUMN enrichment_type TEXT;
COMMENT ON COLUMN city_registries.enrichment_type IS 'Optional enrichment adapter key (e.g. cook_county_gis). NULL = no enrichment.';

-- Source URL for frontend "View Full Data Source" links
ALTER TABLE city_registries ADD COLUMN source_url TEXT;
COMMENT ON COLUMN city_registries.source_url IS 'Human-readable URL to the dataset page on the open data portal.';

-- Verification tracking for monitoring data freshness
ALTER TABLE city_registries ADD COLUMN last_verified_at TIMESTAMPTZ;
COMMENT ON COLUMN city_registries.last_verified_at IS 'Last time this registry entry was manually verified as active.';

-- Backfill existing rows
UPDATE city_registries
  SET enrichment_type = 'cook_county_gis'
  WHERE domain IN ('data.cityofchicago.org', 'datacatalog.cookcountyil.gov');

UPDATE city_registries
  SET source_url = 'https://data.cityofchicago.org/Buildings/Building-Permits/ydr8-5enu'
  WHERE domain = 'data.cityofchicago.org' AND dataset_id = 'ydr8-5enu';

UPDATE city_registries
  SET source_url = 'https://datacatalog.cookcountyil.gov/Property-Taxation/Cook-County-Assessor-s-Residential-Improvement-Per/3jee-kpfa'
  WHERE domain = 'datacatalog.cookcountyil.gov';

UPDATE city_registries
  SET last_verified_at = NOW();

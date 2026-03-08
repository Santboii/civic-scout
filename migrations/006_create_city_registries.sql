CREATE TABLE IF NOT EXISTS city_registries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  state TEXT,
  country TEXT DEFAULT 'US',
  domain TEXT NOT NULL UNIQUE,        -- e.g. 'data.cityofchicago.org'
  dataset_id TEXT NOT NULL,           -- e.g. 'ydr8-5enu'
  column_map JSONB NOT NULL,          -- maps our fields to their column names
  permit_type_filter TEXT,            -- optional SoQL WHERE clause for permit types
  geo_type TEXT NOT NULL DEFAULT 'point',  -- 'point' (within_circle) or 'separate' (lat/lon bbox)
  bbox JSONB,                         -- {latMin, latMax, lonMin, lonMax}
  priority INTEGER DEFAULT 0,         -- higher = more specific (resolves overlap)
  verified BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTE(Agent): Seed Chicago atomically in the same migration to prevent deployment
-- ordering issues (P1 risk). The code expects at least one registry entry.
INSERT INTO city_registries (
  city, state, domain, dataset_id, geo_type, priority, verified, enabled,
  column_map, permit_type_filter, bbox
) VALUES (
  'Chicago', 'IL',
  'data.cityofchicago.org',
  'ydr8-5enu',
  'point',
  10,
  true,
  true,
  '{
    "permit_id": "permit_",
    "permit_type": "permit_type",
    "work_description": "work_description",
    "reported_cost": "reported_cost",
    "issue_date": "issue_date",
    "latitude": "latitude",
    "longitude": "longitude",
    "location": "location",
    "street_number": "street_number",
    "street_direction": "street_direction",
    "street_name": "street_name",
    "suffix": "suffix"
  }'::jsonb,
  $$permit_type IN ('PERMIT - NEW CONSTRUCTION','PERMIT - NEW CONSTRUCTION (COMMON AREAS)','PERMIT - RENOVATION/ALTERATION')$$,
  '{"latMin": 41.644, "latMax": 42.023, "lonMin": -87.940, "lonMax": -87.524}'::jsonb
);

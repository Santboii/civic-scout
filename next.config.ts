import type { NextConfig } from "next";

// NOTE(Agent): Security headers added per best-practices audit. CSP connect-src
// allowlists every external API the app calls. Extend this list if new origins
// are added (e.g. a new geocoding provider, error tracker, etc.).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires 'unsafe-inline' for its inline runtime scripts; 'unsafe-eval'
      // required by Leaflet which uses new Function() for tile template strings.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
      "font-src 'self' https://fonts.gstatic.com",
      // blob: for Leaflet canvas tiles; data: for inline SVG/icon URLs; unpkg.com for Leaflet marker PNGs
      "img-src 'self' data: blob: https://unpkg.com https://*.basemaps.cartocdn.com",
      // worker-src for Mapbox GL / Leaflet if upgraded later
      "worker-src 'self' blob:",
      [
        "connect-src 'self'",
        // Mapbox geocoding + tile events
        "https://api.mapbox.com",
        "https://events.mapbox.com",
        // Supabase (project-specific; wildcard covers all Supabase project URLs)
        "https://*.supabase.co",
        // Upstash Redis (REST API for caching)
        "https://*.upstash.io",
        // Stripe (client redirects only — actual API calls are server-side)
        "https://api.stripe.com",
        "https://checkout.stripe.com",
        // CartoDB raster map tiles
        "https://*.basemaps.cartocdn.com",
        // Chicago open data (Socrata)
        "https://data.cityofchicago.org",
        // Cook County GIS (zoning enrichment)
        "https://gisapps.cookcountyil.gov",
        // ArcGIS (suburban city permit data)
        "https://*.arcgis.com",
        "https://*.arcgisonline.com",
        // Census Bureau geocoder
        "https://geocoding.geo.census.gov",
      ].join(" "),
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://checkout.stripe.com",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
};

export default nextConfig;

import type { MetadataRoute } from "next";

// NOTE(Agent): Next.js App Router generates /sitemap.xml automatically from this export.
// CivicScout is a single-route SPA — only the root URL is indexable.
// If dedicated pages are added (e.g. /about, /pricing), add them here.
export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            url: "https://civicscout.com",
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 1.0,
        },
    ];
}

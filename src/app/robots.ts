import type { MetadataRoute } from "next";

// NOTE(Agent): Next.js App Router generates /robots.txt automatically from this export.
// We block all API routes to prevent indexing of JSON endpoints, and reference
// the sitemap so crawlers can discover pages efficiently.
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/api/"],
            },
        ],
        sitemap: "https://civicscout.com/sitemap.xml",
    };
}

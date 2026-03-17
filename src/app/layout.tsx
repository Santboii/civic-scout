import type { Metadata, Viewport } from "next";
import { Inter, DM_Serif_Display } from "next/font/google";
import "./globals.css";

// NOTE(Agent): Inter is used for both display and body text. Weight variation
// (700-800 for headings, 400-500 for body) provides hierarchy without mixing
// typefaces. Inter is the industry-standard for data-dense dashboard UIs
// (Vercel, Linear, Notion) due to its screen-optimized design and generous x-height.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// NOTE(Agent): DM Serif Display is used exclusively for the landing page hero
// headline. Its high-contrast serif letterforms create visual distinction from
// Inter's geometric neutrality — establishing brand identity at first glance.
const dmSerif = DM_Serif_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// NOTE(Agent): metadataBase is required by Next.js for resolving absolute URLs
// in Open Graph images. Set to production domain when OG images are added.
export const metadata: Metadata = {
  metadataBase: new URL("https://civicscout.com"),
  title: "CivicScout — Track Building Permits Near You | Real-Time",
  description:
    "Track building permits, zoning changes, and construction activity near any US address. CivicScout uses AI to classify development impact — know what's being built before it starts.",
  keywords: [
    "building permits",
    "construction tracking",
    "zoning changes",
    "neighborhood development",
    "building permit map",
    "development activity",
    "CivicScout",
  ],
  authors: [{ name: "CivicScout", url: "https://civicscout.com" }],
  creator: "CivicScout",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "CivicScout — Track Building Permits Near You",
    description:
      "AI-powered building permit tracking. See what's being built near any US address with real-time data from municipal open data portals.",
    url: "https://civicscout.com",
    siteName: "CivicScout",
    locale: "en_US",
    type: "website",
    // NOTE(Agent): OG image commented out until a 1200×630px asset is created
    // and placed at public/og-image.png. Uncomment when ready:
    // images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "CivicScout building permit map" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CivicScout — Track Building Permits Near You",
    description:
      "AI-powered building permit tracking. See what's being built near any US address.",
    // images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// NOTE(Agent): JSON-LD structured data injected as static <script> tags.
// dangerouslySetInnerHTML is safe here — content is server-controlled, no user input.
const webApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "CivicScout",
  url: "https://civicscout.com",
  description:
    "Track building permits, zoning changes, and construction activity near any US address. AI-powered impact classification for neighborhood development.",
  applicationCategory: "UtilityApplication",
  operatingSystem: "All",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free building permit search with AI-powered impact analysis",
  },
  featureList: [
    "Real-time building permit tracking",
    "AI-powered development impact classification",
    "Interactive map visualization",
    "Nationwide coverage from municipal open data",
  ],
  author: {
    "@type": "Organization",
    name: "CivicScout",
    url: "https://civicscout.com",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CivicScout",
  url: "https://civicscout.com",
  description:
    "AI-powered building permit tracking and neighborhood development intelligence.",
  foundingDate: "2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* NOTE(Agent): Preconnect hints reduce DNS+TCP+TLS latency for origins we load
            at runtime. next/font/google already handles fonts.googleapis.com automatically. */}
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link rel="preconnect" href="https://basemaps.cartocdn.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://events.mapbox.com" crossOrigin="anonymous" />
      </head>
      {/* NOTE(Agent): suppressHydrationWarning prevents false mismatches from browser
          extensions injecting attributes (e.g., ColorZilla on <body>). */}
      <body
        className={`${inter.variable} ${dmSerif.variable} antialiased`}
        suppressHydrationWarning
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {children}
      </body>
    </html>
  );
}

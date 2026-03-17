'use client'

import SearchForm from './SearchForm'
import CityGrid from './CityGrid'
import type { CityInfo } from './CityGrid'
import styles from './LandingHero.module.css'

interface Suggestion {
    address: string
    lat: number
    lon: number
}

interface LandingHeroProps {
    onSearch: (suggestion: Suggestion) => void
    isLoading?: boolean
    cities?: CityInfo[]
}

/**
 * Landing page hero — "Cartographic Intelligence" design.
 *
 * NOTE(Agent): Complete rewrite for the landing page UX/UI overhaul. The previous
 * design was a narrow centered column with a headline, search bar, and 3 tiny cards.
 * This version uses a dark split-layout hero with an animated radar visualization,
 * a metrics bar, a bento feature grid, and the existing CityGrid component.
 *
 * Key design decisions:
 * - DM Serif Display for the hero headline (brand identity)
 * - CSS-only radar/data-point visualization (no JS, no libraries)
 * - Bento grid showcases all 6 capabilities (not just 3)
 * - Dark hero → light body transition via gradient divider
 */
export default function LandingHero({ onSearch, isLoading, cities = [] }: LandingHeroProps) {
    return (
        <div className={styles.landing}>
            {/* ─── SECTION 1: Dark Hero ─── */}
            <section className={styles.hero}>
                {/* Topographic contour-line background */}
                <div className={styles.topoLayer} aria-hidden="true" />
                <div className={styles.spotlight} aria-hidden="true" />

                <div className={styles.heroInner}>
                    {/* Left: Copy + Search */}
                    <div className={styles.heroLeft}>
                        <div className={styles.brand}>
                            <span className={styles.brandName}>
                                Civic<span className={styles.brandAccent}>Scout</span>
                            </span>
                            <span className={styles.badge}>
                                Greater Chicagoland
                            </span>
                        </div>

                        <h1 className={styles.headline}>
                            Uncover what&rsquo;s{' '}
                            <span className={styles.headlineAccent}>changing</span>{' '}
                            in your neighborhood.
                        </h1>

                        <span className={styles.accentLine} aria-hidden="true" />

                        <p className={styles.subtitle}>
                            Track building permits, crime reports, zoning changes, traffic crashes,
                            and neighborhood activity — all in one real-time intelligence platform.
                        </p>

                        <div className={styles.searchWrapper}>
                            <div className={styles.searchGlow}>
                                <SearchForm onSearch={onSearch} isLoading={isLoading} />
                            </div>
                            <p className={styles.searchHint}>
                                Try{' '}
                                <kbd className={styles.searchHintKey}>1060 W Addison, Chicago</kbd>
                                {' '}or{' '}
                                <kbd className={styles.searchHintKey}>233 S Wacker Dr, Chicago</kbd>
                            </p>
                        </div>
                    </div>

                    {/* Right: Map-style Radar Visualization */}
                    <div className={styles.heroRight} aria-hidden="true">
                        <div className={styles.vizContainer}>
                            {/* NOTE(Agent): SVG map background. Designed to resemble the
                                CartoDB Voyager tiles used in Map.tsx — Chicago-style grid with
                                a river curve, parks, major/minor streets, and building blocks. */}
                            <svg
                                className={styles.vizMapGrid}
                                viewBox="0 0 380 380"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                {/* Minor streets — thin, regular grid */}
                                <line x1="0" y1="52" x2="380" y2="52" />
                                <line x1="0" y1="95" x2="380" y2="95" />
                                <line x1="0" y1="142" x2="380" y2="142" />
                                <line x1="0" y1="192" x2="380" y2="192" />
                                <line x1="0" y1="238" x2="380" y2="238" />
                                <line x1="0" y1="285" x2="380" y2="285" />
                                <line x1="0" y1="330" x2="380" y2="330" />
                                <line x1="50" y1="0" x2="50" y2="380" />
                                <line x1="95" y1="0" x2="95" y2="380" />
                                <line x1="145" y1="0" x2="145" y2="380" />
                                <line x1="195" y1="0" x2="195" y2="380" />
                                <line x1="240" y1="0" x2="240" y2="380" />
                                <line x1="290" y1="0" x2="290" y2="380" />
                                <line x1="335" y1="0" x2="335" y2="380" />
                                {/* Major avenues — thicker, like Ashland/Western/Chicago Ave */}
                                <line x1="0" y1="192" x2="380" y2="192" className={styles.vizMapMajorSt} />
                                <line x1="195" y1="0" x2="195" y2="380" className={styles.vizMapMajorSt} />
                                {/* Diagonal — like Milwaukee Ave cutting through the grid */}
                                <line x1="30" y1="350" x2="310" y2="30" className={styles.vizMapDiagonal} />
                                {/* River curve — inspired by the Chicago River */}
                                <path
                                    d="M0,170 Q60,175 100,165 Q140,155 170,170 Q200,185 230,165 Q260,145 310,155 Q350,165 380,150"
                                    className={styles.vizMapRiver}
                                />
                                {/* City blocks — building-filled rectangles */}
                                <rect x="54" y="58" width="36" height="32" rx="1" className={styles.vizMapBlock} />
                                <rect x="100" y="58" width="40" height="32" rx="1" className={styles.vizMapBlock} />
                                <rect x="200" y="58" width="35" height="32" rx="1" className={styles.vizMapBlock} />
                                <rect x="245" y="58" width="40" height="32" rx="1" className={styles.vizMapBlock} />
                                <rect x="295" y="58" width="35" height="32" rx="1" className={styles.vizMapBlock} />
                                <rect x="54" y="100" width="36" height="36" rx="1" className={styles.vizMapBlock} />
                                <rect x="100" y="100" width="40" height="36" rx="1" className={styles.vizMapBlock} />
                                <rect x="200" y="100" width="35" height="36" rx="1" className={styles.vizMapBlock} />
                                <rect x="245" y="200" width="40" height="32" rx="1" className={styles.vizMapBlock} />
                                <rect x="200" y="200" width="35" height="32" rx="1" className={styles.vizMapBlock} />
                                <rect x="100" y="200" width="40" height="32" rx="1" className={styles.vizMapBlock} />
                                <rect x="54" y="200" width="36" height="32" rx="1" className={styles.vizMapBlock} />
                                <rect x="295" y="200" width="35" height="32" rx="1" className={styles.vizMapBlock} />
                                <rect x="54" y="244" width="36" height="36" rx="1" className={styles.vizMapBlock} />
                                <rect x="100" y="244" width="40" height="36" rx="1" className={styles.vizMapBlock} />
                                <rect x="200" y="244" width="35" height="36" rx="1" className={styles.vizMapBlock} />
                                <rect x="245" y="244" width="40" height="36" rx="1" className={styles.vizMapBlock} />
                                <rect x="295" y="244" width="35" height="36" rx="1" className={styles.vizMapBlock} />
                                <rect x="54" y="292" width="36" height="32" rx="1" className={styles.vizMapBlock} />
                                <rect x="100" y="292" width="40" height="32" rx="1" className={styles.vizMapBlock} />
                                <rect x="245" y="292" width="40" height="32" rx="1" className={styles.vizMapBlock} />
                                <rect x="295" y="292" width="35" height="32" rx="1" className={styles.vizMapBlock} />
                                {/* Parks — rounded, green-tinted */}
                                <rect x="150" y="97" width="40" height="40" rx="12" className={styles.vizMapPark} />
                                <rect x="150" y="244" width="40" height="36" rx="10" className={styles.vizMapPark} />
                                <rect x="200" y="292" width="35" height="32" rx="8" className={styles.vizMapPark} />

                                {/* ── Search radius circle (dashed, matching Map.tsx) ── */}
                                <circle
                                    cx="190"
                                    cy="190"
                                    r="140"
                                    className={styles.vizSearchRadius}
                                />

                                {/* ── Realistic data markers matching Map.tsx shapes ── */}
                                {/* Permit markers — filled circles (severity-colored, 2px border) */}
                                <circle cx="130" cy="110" r="5" className={styles.vizMarkerPermitGreen} />
                                <circle cx="260" cy="85" r="5" className={styles.vizMarkerPermitYellow} />
                                <circle cx="85" cy="260" r="5" className={styles.vizMarkerPermitRed} />
                                <circle cx="300" cy="260" r="5" className={styles.vizMarkerPermitGreen} />
                                <circle cx="215" cy="310" r="5" className={styles.vizMarkerPermitYellow} />

                                {/* Crime markers — rotated diamonds (matching Map.tsx) */}
                                <rect x="265" y="121" width="7" height="7" className={styles.vizMarkerCrime} />
                                <rect x="70" y="145" width="7" height="7" className={styles.vizMarkerCrime} />
                                <rect x="310" cy="225" width="7" height="7" className={styles.vizMarkerCrime} />

                                {/* Violation markers — squares (matching Map.tsx) */}
                                <rect x="112" y="215" width="6" height="6" rx="1" className={styles.vizMarkerViolation} />
                                <rect x="265" y="205" width="6" height="6" rx="1" className={styles.vizMarkerViolation} />

                                {/* Crash markers — triangles (matching Map.tsx) */}
                                <polygon points="160,274 165,266 155,266" className={styles.vizMarkerCrash} />
                                <polygon points="230,230 235,222 225,222" className={styles.vizMarkerCrash} />

                                {/* Center pin — teal with white dot (matching Map.tsx center marker) */}
                                <circle cx="190" cy="190" r="6" className={styles.vizCenterPin} />
                                <circle cx="190" cy="190" r="2" fill="white" />
                                <circle cx="190" cy="190" r="12" className={styles.vizCenterPulse} />
                            </svg>

                            {/* Radar sweep arm — overlays the map for that "scanning" feel */}
                            <div className={styles.vizSweep} />

                            {/* Data point labels — positioned around the radar */}
                            <DataPoint
                                type="permit"
                                label="Permit"
                                top="18%"
                                left="22%"
                                labelOffset={{ top: '-18px', left: '12px' }}
                                delay="0s"
                            />
                            <DataPoint
                                type="crime"
                                label="Crime"
                                top="28%"
                                left="72%"
                                labelOffset={{ top: '-18px', left: '-38px' }}
                                delay="0.6s"
                            />
                            <DataPoint
                                type="violation"
                                label="Violation"
                                top="68%"
                                left="18%"
                                labelOffset={{ top: '14px', left: '2px' }}
                                delay="1.2s"
                            />
                            <DataPoint
                                type="crash"
                                label="Crash"
                                top="75%"
                                left="65%"
                                labelOffset={{ top: '14px', left: '-16px' }}
                                delay="0.3s"
                            />
                        </div>

                        {/* Layer type legend — compact row below the radar */}
                        <div className={styles.layerLegend}>
                            <div className={styles.legendItem}>
                                <span className={`${styles.legendMarker} ${styles.legendPermit}`} />
                                <span className={styles.legendLabel}>Permits</span>
                            </div>
                            <div className={styles.legendItem}>
                                <span className={`${styles.legendMarker} ${styles.legendCrime}`} />
                                <span className={styles.legendLabel}>Crimes</span>
                            </div>
                            <div className={styles.legendItem}>
                                <span className={`${styles.legendMarker} ${styles.legendViolation}`} />
                                <span className={styles.legendLabel}>Violations</span>
                            </div>
                            <div className={styles.legendItem}>
                                <span className={`${styles.legendMarker} ${styles.legendCrash}`} />
                                <span className={styles.legendLabel}>Crashes</span>
                            </div>
                            <div className={styles.legendItem}>
                                <span className={`${styles.legendMarker} ${styles.legendZoning}`} />
                                <span className={styles.legendLabel}>Zoning</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Gradient divider: dark → light */}
            <div className={styles.heroDivider} aria-hidden="true" />

            {/* ─── SECTION 2: Metrics Bar ─── */}
            <div className={styles.metricsBar}>
                <div className={styles.metric}>
                    <span className={styles.metricValue}>12K+</span>
                    <span className={styles.metricLabel}>Permits Analyzed</span>
                </div>
                <div className={styles.metric}>
                    <span className={styles.metricValue}>5</span>
                    <span className={styles.metricLabel}>Data Layers</span>
                </div>
                <div className={styles.metric}>
                    <span className={styles.metricValue}>Real-Time</span>
                    <span className={styles.metricLabel}>Municipal Data</span>
                </div>
                <div className={styles.metric}>
                    <span className={styles.metricValue}>AI</span>
                    <span className={styles.metricLabel}>Impact Scoring</span>
                </div>
            </div>

            {/* ─── SECTION 3: Feature Bento Grid ─── */}
            <section className={styles.featuresSection}>
                <h2 className={styles.featuresSectionTitle}>
                    Everything you need to understand your area
                </h2>
                <p className={styles.featuresSectionSubtitle}>
                    Six powerful data layers working together to give you complete
                    neighborhood intelligence.
                </p>

                <div className={styles.bentoGrid}>
                    {/* Large card: Interactive Map — split layout with cartographic identity */}
                    <div
                        className={`${styles.bentoCard} ${styles.bentoCardLarge} ${styles.bentoAccentTeal}`}
                        style={{ animationDelay: '0.15s' }}
                    >
                        <div className={styles.permitInner}>
                            <div className={styles.permitText}>
                                <span className={styles.permitCoords} aria-hidden="true">41.88° N · 87.63° W</span>
                                <span className={styles.bentoTitle}>Interactive Permit Map</span>
                                <p className={styles.bentoDesc}>
                                    Visualize every building permit within a 1-mile radius on an interactive map.
                                    Click any marker to see full permit details, contractor info, estimated costs,
                                    and AI-generated impact analysis.
                                </p>
                                <span className={styles.permitSource}>Source: Municipal Open Data</span>
                            </div>
                            <div className={styles.permitViz} aria-hidden="true">
                                {/* Decorative mini-map SVG */}
                                <svg className={styles.permitMapSvg} viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    {/* Street grid */}
                                    <line x1="0" y1="35" x2="140" y2="35" stroke="currentColor" strokeOpacity="0.15" strokeWidth="0.8" />
                                    <line x1="0" y1="70" x2="140" y2="70" stroke="currentColor" strokeOpacity="0.15" strokeWidth="0.8" />
                                    <line x1="0" y1="105" x2="140" y2="105" stroke="currentColor" strokeOpacity="0.15" strokeWidth="0.8" />
                                    <line x1="35" y1="0" x2="35" y2="140" stroke="currentColor" strokeOpacity="0.15" strokeWidth="0.8" />
                                    <line x1="70" y1="0" x2="70" y2="140" stroke="currentColor" strokeOpacity="0.15" strokeWidth="0.8" />
                                    <line x1="105" y1="0" x2="105" y2="140" stroke="currentColor" strokeOpacity="0.15" strokeWidth="0.8" />
                                    {/* Diagonal avenue */}
                                    <line x1="0" y1="120" x2="120" y2="0" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
                                    {/* Building blocks */}
                                    <rect x="40" y="40" width="24" height="24" rx="2" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.5" />
                                    <rect x="76" y="40" width="22" height="24" rx="2" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.5" />
                                    <rect x="40" y="76" width="24" height="22" rx="2" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.5" />
                                    <rect x="76" y="76" width="22" height="22" rx="2" fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.5" />
                                    {/* Pin marker */}
                                    <circle cx="70" cy="58" r="6" fill="#0FD4BD" fillOpacity="0.3" />
                                    <circle cx="70" cy="58" r="3" fill="#0FD4BD" />
                                    {/* Radius ring */}
                                    <circle cx="70" cy="58" r="30" fill="none" stroke="#0FD4BD" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="3 3" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* AI Impact Analysis — dashboard panel with spectrum bar */}
                    <div
                        className={`${styles.bentoCard} ${styles.bentoAccentGreen}`}
                        style={{ animationDelay: '0.25s' }}
                    >
                        <span className={styles.analysisLabel}>Analysis</span>
                        <span className={styles.bentoTitle}>AI Impact Scoring</span>
                        <p className={styles.bentoDesc}>
                            Every permit is classified by severity using AI — so you know
                            what actually matters to your daily life.
                        </p>
                        {/* Spectrum bar — visual gradient from low → high */}
                        <div className={styles.spectrumBar} aria-hidden="true">
                            <div className={styles.spectrumTrack} />
                            <div className={styles.spectrumMarker} />
                        </div>
                        <div className={styles.spectrumLabels} aria-hidden="true">
                            <span>Low</span>
                            <span>Medium</span>
                            <span>High</span>
                        </div>
                    </div>

                    {/* Crime & Safety — alert-panel with left border */}
                    <div
                        className={`${styles.bentoCard} ${styles.bentoAccentRed}`}
                        style={{ animationDelay: '0.35s' }}
                    >
                        <div className={styles.crimeHeader}>
                            <span className={styles.crimeStatusDot} aria-hidden="true" />
                            <span className={styles.crimeHeaderLabel}>Live Monitoring</span>
                        </div>
                        <span className={styles.bentoTitle}>Crime &amp; Safety Intel</span>
                        <p className={styles.bentoDesc}>
                            See recent crime incidents near any address. Filter by
                            severity to focus on what&rsquo;s relevant.
                        </p>
                        <div className={styles.crimeTags}>
                            <span className={styles.crimeTag}>
                                <span className={styles.crimeTagDot} style={{ background: '#F87171' }} aria-hidden="true" />
                                Assault
                            </span>
                            <span className={styles.crimeTag}>
                                <span className={styles.crimeTagDot} style={{ background: '#FBBF24' }} aria-hidden="true" />
                                Theft
                            </span>
                            <span className={styles.crimeTag}>
                                <span className={styles.crimeTagDot} style={{ background: '#FB923C' }} aria-hidden="true" />
                                Burglary
                            </span>
                        </div>
                    </div>

                    {/* Zoning Intelligence */}
                    <div
                        className={`${styles.bentoCard} ${styles.bentoAccentBlue}`}
                        style={{ animationDelay: '0.45s' }}
                    >
                        <div className={styles.bentoIcon}>🏗️</div>
                        <span className={styles.bentoTitle}>Zoning Intelligence</span>
                        <p className={styles.bentoDesc}>
                            Overlay zoning districts on the map. Click any zone to see
                            its classification, allowed uses, and building restrictions.
                        </p>
                    </div>

                    {/* Neighborhood Activity */}
                    <div
                        className={`${styles.bentoCard} ${styles.bentoCardFull} ${styles.bentoAccentPurple}`}
                        style={{ animationDelay: '0.55s' }}
                    >
                        <div className={styles.bentoIcon}>📊</div>
                        <span className={styles.bentoTitle}>Neighborhood Activity Dashboard</span>
                        <p className={styles.bentoDesc}>
                            Toggle on building violations, traffic crashes, and 311 service requests
                            to see the full picture of neighborhood activity. Each data layer is
                            independently filterable by severity, with detailed drill-down modals.
                        </p>
                        <div className={styles.layerBadges}>
                            <span className={styles.layerBadge}>🔨 Violations</span>
                            <span className={styles.layerBadge}>🚗 Crashes</span>
                            <span className={styles.layerBadge}>📞 311 Requests</span>
                            <span className={styles.layerBadge}>🚔 Crime</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── SECTION 4: Available Cities + Trust ─── */}
            <section className={styles.citiesSection}>
                {cities.length > 0 && (
                    <CityGrid
                        cities={cities}
                        onCityClick={(city) => {
                            if (city.center) {
                                onSearch({
                                    address: `${city.city}${city.state ? `, ${city.state}` : ''}`,
                                    lat: city.center.lat,
                                    lon: city.center.lon,
                                })
                            }
                        }}
                    />
                )}

                <div className={styles.trust}>
                    <span className={styles.trustDot} aria-hidden="true" />
                    <p className={styles.trustText}>
                        Powered by municipal open data portals &mdash; verified public records
                    </p>
                </div>
            </section>
        </div>
    )
}

/* ─── DataPoint Sub-component ─────────────────────────────────────────────
   NOTE(Agent): Renders a positioned dot on the radar visualization.
   Each dot has a type-based color, optional label, and staggered pulse animation.
   Purely decorative (aria-hidden on parent container). */

interface DataPointProps {
    type: 'permit' | 'crime' | 'violation' | 'zoning' | 'crash'
    label: string
    top: string
    left: string
    labelOffset: Record<string, string>
    delay: string
}

const typeStyles: Record<string, string> = {
    permit: styles.dpPermit,
    crime: styles.dpCrime,
    violation: styles.dpViolation,
    zoning: styles.dpZoning,
    crash: styles.dpCrash,
}

function DataPoint({ type, label, top, left, labelOffset, delay }: DataPointProps) {
    // NOTE(Agent): Labels are positioned absolutely in vizContainer. We compute
    // the label position as "dot position + offset" using CSS calc(). Without
    // this, top/left on the label overrides (rather than offsets from) the dot.
    const labelTop = labelOffset.top ? `calc(${top} + ${labelOffset.top})` : top
    const labelLeft = labelOffset.left ? `calc(${left} + ${labelOffset.left})` : left

    return (
        <>
            <div
                className={`${styles.dataPoint} ${typeStyles[type]}`}
                style={{
                    top,
                    left,
                    animationDelay: delay,
                }}
            />
            {label && (
                <span
                    className={styles.dataLabel}
                    style={{
                        top: labelTop,
                        left: labelLeft,
                    }}
                >
                    {label}
                </span>
            )}
        </>
    )
}

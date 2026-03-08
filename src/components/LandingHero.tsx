'use client'

import SearchForm from './SearchForm'
import styles from './LandingHero.module.css'

interface Suggestion {
    address: string
    lat: number
    lon: number
}

interface LandingHeroProps {
    onSearch: (suggestion: Suggestion) => void
    isLoading?: boolean
}

export default function LandingHero({ onSearch, isLoading }: LandingHeroProps) {
    return (
        <div className={styles.hero} style={{ backgroundColor: 'var(--background-primary)' }}>
            {/* Animated city-grid background */}
            <div className={styles.gridLayer} aria-hidden="true" />
            <div className={styles.spotlight} aria-hidden="true" />

            <div className={styles.content}>
                {/* Brand */}
                <div className={styles.brand}>
                    <span className={styles.brandName}>
                        Civic<span className={styles.brandAccent}>Scout</span>
                    </span>
                    <span className={styles.badge}>Nationwide</span>
                </div>

                {/* Headline */}
                <h1 className={styles.headline}>
                    Know what&rsquo;s being built around you.
                </h1>

                <span className={styles.accentLine} aria-hidden="true" />

                <p className={styles.subtitle}>
                    Track building permits, zoning changes, and development activity
                    near any US address — before the construction starts.
                </p>

                {/* Search CTA */}
                <div className={styles.searchWrapper}>
                    <div className={styles.searchGlow}>
                        <SearchForm onSearch={onSearch} isLoading={isLoading} />
                    </div>
                    <p className={styles.searchHint}>
                        Try <kbd className={styles.searchHintKey}>1060 W Addison</kbd> or{' '}
                        <kbd className={styles.searchHintKey}>233 S Wacker</kbd>
                    </p>
                </div>

                {/* Feature highlights */}
                <div className={styles.features}>
                    <div className={styles.featureCard}>
                        <span className={styles.featureIcon}>📡</span>
                        <span className={styles.featureTitle}>Real-Time Data</span>
                        <p className={styles.featureDesc}>
                            Sourced live from municipal open data portals
                        </p>
                    </div>
                    <div className={styles.featureCard}>
                        <span className={styles.featureIcon}>🎯</span>
                        <span className={styles.featureTitle}>Impact Analysis</span>
                        <p className={styles.featureDesc}>
                            AI-classified severity so you know what matters
                        </p>
                    </div>
                    <div className={styles.featureCard}>
                        <span className={styles.featureIcon}>🗒️</span>
                        <span className={styles.featureTitle}>Community Notes</span>
                        <p className={styles.featureDesc}>
                            Plain-language summaries of how permits affect your block
                        </p>
                    </div>
                </div>

                {/* Trust */}
                <div className={styles.trust}>
                    <span className={styles.trustDot} />
                    <p className={styles.trustText}>
                        Powered by municipal open data portals across the US
                    </p>
                </div>
            </div>
        </div>
    )
}

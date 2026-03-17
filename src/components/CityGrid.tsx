'use client'

import { useState } from 'react'
import styles from './CityGrid.module.css'

export interface CityInfo {
    city: string
    state: string | null
    center: { lat: number; lon: number } | null
}

interface CityGridProps {
    cities: CityInfo[]
    onCityClick?: (city: CityInfo) => void
}

/**
 * Renders supported cities as styled pills grouped and sorted.
 * Includes a "Don't see your city?" CTA with an inline request form.
 *
 * NOTE(Agent): This is a purely presentational component for the landing page.
 * The request form POSTs to /api/city-requests. No auth is needed.
 */
export default function CityGrid({ cities, onCityClick }: CityGridProps) {
    const [showForm, setShowForm] = useState(false)
    const [email, setEmail] = useState('')
    const [submitted, setSubmitted] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // NOTE(Agent): Deduplicate cities by name+state. The registry can have
    // overlapping entries (e.g., "Seattle" appears twice — one disabled, one enabled).
    // The API only returns enabled ones, but two enabled entries could share the same
    // city+state (e.g., separate datasets for the same city).
    const uniqueCities = cities.reduce<CityInfo[]>((acc, c) => {
        const key = `${c.city}-${c.state}`
        if (!acc.some((existing) => `${existing.city}-${existing.state}` === key)) {
            acc.push(c)
        }
        return acc
    }, [])

    // Sort alphabetically by state then city
    const sorted = [...uniqueCities].sort((a, b) => {
        const stateCompare = (a.state ?? '').localeCompare(b.state ?? '')
        if (stateCompare !== 0) return stateCompare
        return a.city.localeCompare(b.city)
    })

    async function handleRequest() {
        setSubmitting(true)
        try {
            await fetch('/api/city-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat: 0, lon: 0, email: email || null }),
            })
            setSubmitted(true)
        } catch {
            // Best-effort — silently fail
        } finally {
            setSubmitting(false)
        }
    }

    if (sorted.length === 0) return null

    return (
        <div className={styles.section}>
            <p className={styles.sectionTitle}>Available Cities</p>

            <div className={styles.grid}>
                {sorted.map((c, i) => (
                    <button
                        key={`${c.city}-${c.state}`}
                        type="button"
                        className={styles.pill}
                        style={{ animationDelay: `${0.6 + i * 0.06}s` }}
                        onClick={() => onCityClick?.(c)}
                    >
                        <span className={styles.pillDot} aria-hidden="true" />
                        <span className={styles.pillCity}>{c.city}</span>
                        {c.state && (
                            <span className={styles.pillState}>{c.state}</span>
                        )}
                    </button>
                ))}
            </div>

            <div className={styles.cta}>
                {!showForm && !submitted && (
                    <button
                        className={styles.ctaLink}
                        onClick={() => setShowForm(true)}
                        type="button"
                    >
                        Don&rsquo;t see your city?{' '}
                        <span className={styles.ctaArrow}>→</span>
                    </button>
                )}

                {showForm && !submitted && (
                    <div className={styles.requestForm}>
                        <input
                            type="email"
                            className={styles.requestInput}
                            placeholder="Your email (optional)"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            aria-label="Email for city request notification"
                        />
                        <button
                            className={styles.requestButton}
                            onClick={handleRequest}
                            disabled={submitting}
                            type="button"
                        >
                            {submitting ? 'Sending…' : 'Request It'}
                        </button>
                    </div>
                )}

                {submitted && (
                    <p className={styles.successMessage}>
                        ✓ We&rsquo;ll let you know when we expand!
                    </p>
                )}
            </div>
        </div>
    )
}

'use client'

import { memo } from 'react'
import type { PermitSeverity } from '@/lib/permit-classifier'

interface SeverityFilterProps {
    value: PermitSeverity
    onChange: (severity: PermitSeverity) => void
    counts: Record<PermitSeverity, number>
    /** Override the default "Impact Filter" header label */
    label?: string
}

const STOPS: { severity: PermitSeverity; label: string; color: string }[] = [
    { severity: 'green', label: 'All', color: 'var(--status-green)' },
    { severity: 'yellow', label: 'Med +', color: 'var(--status-yellow)' },
    { severity: 'red', label: 'High', color: 'var(--status-red)' },
]

function SeverityFilter({ value, onChange, counts, label = 'Impact Filter' }: SeverityFilterProps) {
    const activeIndex = STOPS.findIndex((s) => s.severity === value)

    // Count of permits currently shown at each threshold
    const visibleCount = (sev: PermitSeverity): number => {
        const order: Record<PermitSeverity, number> = { green: 0, yellow: 1, red: 2 }
        const threshold = order[sev]
        return (
            (order.green >= threshold ? counts.green : 0) +
            (order.yellow >= threshold ? counts.yellow : 0) +
            (order.red >= threshold ? counts.red : 0)
        )
    }

    return (
        <div
            className="mb-5 pb-5 border-b"
            style={{ borderBottomColor: 'var(--border-glass)' }}
        >
            <div className="flex items-center justify-between mb-3">
                <span
                    className="text-[9px] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: 'var(--text-muted)' }}
                    id="severity-filter-label"
                >
                    {label}
                </span>
                <span
                    className="text-[10px] font-semibold tabular-nums"
                    aria-live="polite"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    {visibleCount(value)} shown
                </span>
            </div>

            {/* Gradient track with stops */}
            <div className="relative" style={{ padding: '8px 0' }}>
                {/* Background track */}
                <div
                    className="h-[3px] rounded-full w-full relative"
                    style={{
                        background: 'linear-gradient(to right, #34D399, #EABC3A, #F06449)',
                        opacity: 0.25,
                    }}
                />

                {/* Active track fill — up to selected stop */}
                <div
                    className="absolute top-[8px] left-0 h-[3px] rounded-full transition-all duration-300 ease-out"
                    style={{
                        width: `${activeIndex * 50}%`,
                        background: 'linear-gradient(to right, #34D399, #EABC3A, #F06449)',
                    }}
                />

                {/* Stop buttons */}
                {/* NOTE(Agent): role="radiogroup" + role="radio" + aria-checked implement the
                    ARIA radio button pattern so screen readers announce the active severity
                    threshold and its change. WCAG 4.1.2 — Name, Role, Value. */}
                <div
                    className="absolute inset-0 flex items-center justify-between"
                    role="radiogroup"
                    aria-labelledby="severity-filter-label"
                >
                    {STOPS.map((stop, i) => {
                        const isActive = i <= activeIndex
                        const isSelected = i === activeIndex
                        return (
                            <button
                                key={stop.severity}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                onClick={() => onChange(stop.severity)}
                                className="relative group flex flex-col items-center"
                                aria-label={`Filter: ${stop.label}`}
                            >
                                {/* Glow ring on selected */}
                                {isSelected && (
                                    <div
                                        className="absolute rounded-full animate-pulse"
                                        aria-hidden="true"
                                        style={{
                                            width: 32,
                                            height: 32,
                                            top: -5,
                                            backgroundColor: stop.color,
                                            opacity: 0.15,
                                        }}
                                    />
                                )}

                                {/* Dot */}
                                <div
                                    className="relative z-10 rounded-full transition-all duration-200 ease-out"
                                    aria-hidden="true"
                                    style={{
                                        width: isSelected ? 22 : 14,
                                        height: isSelected ? 22 : 14,
                                        backgroundColor: isActive ? stop.color : 'var(--background-card)',
                                        border: `2px solid ${isActive ? stop.color : 'var(--border-strong)'}`,
                                        boxShadow: isSelected ? `0 0 10px ${stop.color}66` : 'none',
                                        cursor: 'pointer',
                                    }}
                                />
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Labels row */}
            <div className="flex items-center justify-between mt-2">
                {STOPS.map((stop, i) => {
                    const isSelected = i === activeIndex
                    return (
                        <button
                            key={stop.severity}
                            type="button"
                            onClick={() => onChange(stop.severity)}
                            className="text-center transition-colors duration-200"
                            style={{
                                color: isSelected ? stop.color : 'var(--text-muted)',
                                fontSize: '10px',
                                fontWeight: isSelected ? 700 : 500,
                                letterSpacing: '0.05em',
                                cursor: 'pointer',
                                background: 'none',
                                border: 'none',
                                padding: '2px 4px',
                            }}
                        >
                            {stop.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// NOTE(Agent): Memoized to prevent re-renders when parent state changes
// (e.g., selectedPermitId, loading) don't affect filter props.
export default memo(SeverityFilter)

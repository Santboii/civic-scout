'use client'

import { memo, useState, useRef, useEffect, useCallback } from 'react'
import type { PermitSeverity, SeverityFilterValue } from '@/lib/permit-classifier'

interface SeverityFilterProps {
    value: SeverityFilterValue
    onChange: (severity: SeverityFilterValue) => void
    counts: Record<PermitSeverity, number>
    /** Override the default "Impact Filter" header label */
    label?: string
}

const STOPS: { severity: SeverityFilterValue; label: string; color: string }[] = [
    { severity: 'all', label: 'All', color: 'var(--text-secondary)' },
    { severity: 'green', label: 'Low', color: 'var(--status-green)' },
    { severity: 'yellow', label: 'Med', color: 'var(--status-yellow)' },
    { severity: 'red', label: 'High', color: 'var(--status-red)' },
]

// NOTE(Agent): FILTER_ORDER maps each filter value to a numeric threshold.
// 'all' = -1 so every item (green=0, yellow=1, red=2) passes the >= check.
const FILTER_ORDER: Record<SeverityFilterValue, number> = {
    all: -1,
    green: 0,
    yellow: 1,
    red: 2,
}

const ITEM_ORDER: Record<PermitSeverity, number> = {
    green: 0,
    yellow: 1,
    red: 2,
}

// NOTE(Agent): ImpactTooltip explains how the severity/impact classification works.
// Uses click-toggle (not hover) for mobile-friendliness. Positioned absolutely
// relative to the filter header row. Closes on outside-click or Escape.
function ImpactTooltip() {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    const close = useCallback(() => setOpen(false), [])

    useEffect(() => {
        if (!open) return
        function onClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) close()
        }
        function onEscape(e: KeyboardEvent) {
            if (e.key === 'Escape') close()
        }
        document.addEventListener('mousedown', onClickOutside)
        document.addEventListener('keydown', onEscape)
        return () => {
            document.removeEventListener('mousedown', onClickOutside)
            document.removeEventListener('keydown', onEscape)
        }
    }, [open, close])

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-flex', textTransform: 'none' }}>
            <button
                type="button"
                aria-label="How is impact calculated?"
                onClick={() => setOpen((prev) => !prev)}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0 4px',
                    fontSize: '11px',
                    lineHeight: 1,
                    color: 'var(--text-muted)',
                    opacity: open ? 1 : 0.6,
                    transition: 'opacity 150ms',
                }}
                onMouseEnter={(e) => { (e.currentTarget.style.opacity = '1') }}
                onMouseLeave={(e) => { if (!open) e.currentTarget.style.opacity = '0.6' }}
            >
                ⓘ
            </button>

            {open && (
                <div
                    role="tooltip"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        zIndex: 50,
                        width: 260,
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md, 8px)',
                        background: 'var(--background-card, rgba(30,30,40,0.95))',
                        border: '1px solid var(--border-glass, rgba(255,255,255,0.08))',
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        color: 'var(--text-secondary, #ccc)',
                        fontSize: '11px',
                        lineHeight: 1.5,
                    }}
                >
                    <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--text-primary, #fff)', fontSize: '11px' }}>
                        How is impact calculated?
                    </p>
                    <p style={{ margin: '0 0 6px' }}>
                        <strong style={{ color: 'var(--status-red)' }}>High</strong> — Permits ≥$5M or with industrial keywords; violent crimes; fatal/mass-injury crashes; life-safety violations.
                    </p>
                    <p style={{ margin: '0 0 6px' }}>
                        <strong style={{ color: 'var(--status-yellow)' }}>Medium</strong> — Permits $1M–$5M; assault/robbery; injury crashes; open code violations.
                    </p>
                    <p style={{ margin: 0 }}>
                        <strong style={{ color: 'var(--status-green)' }}>Low</strong> — Routine permits; minor/property crimes; no-injury crashes; resolved violations.
                    </p>
                </div>
            )}
        </div>
    )
}

function SeverityFilter({ value, onChange, counts, label = 'Impact Filter' }: SeverityFilterProps) {
    const activeIndex = STOPS.findIndex((s) => s.severity === value)

    // Count of items currently shown at the given threshold
    const visibleCount = (sev: SeverityFilterValue): number => {
        const threshold = FILTER_ORDER[sev]
        return (
            (ITEM_ORDER.green >= threshold ? counts.green : 0) +
            (ITEM_ORDER.yellow >= threshold ? counts.yellow : 0) +
            (ITEM_ORDER.red >= threshold ? counts.red : 0)
        )
    }

    // Percentage position for each stop (evenly spaced across 4 stops)
    const stopPercent = (index: number): number => {
        return (index / (STOPS.length - 1)) * 100
    }

    return (
        <div
            className="mb-5 pb-5 border-b"
            style={{ borderBottomColor: 'var(--border-glass)' }}
        >
            <div className="flex items-center justify-between mb-3">
                <span
                    className="text-[9px] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    id="severity-filter-label"
                >
                    {label}
                    <ImpactTooltip />
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
                        background: 'linear-gradient(to right, var(--text-muted), #34D399, #EABC3A, #F06449)',
                        opacity: 0.25,
                    }}
                />

                {/* Active track fill — up to selected stop */}
                <div
                    className="absolute top-[8px] left-0 h-[3px] rounded-full transition-all duration-300 ease-out"
                    style={{
                        width: `${stopPercent(activeIndex)}%`,
                        background: 'linear-gradient(to right, var(--text-muted), #34D399, #EABC3A, #F06449)',
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

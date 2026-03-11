'use client'

import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import type { DataLayerType } from '@/lib/data-layers'
import styles from './LayerToggle.module.css'

// ── Layer definitions ───────────────────────────────────────────────────────

interface LayerDef {
    type: DataLayerType
    label: string
    icon: string
    color: string
    bg: string
}

const LAYERS: LayerDef[] = [
    {
        type: 'crimes',
        label: 'Crime',
        icon: '🔴',
        color: 'var(--layer-crime, #D94F3B)',
        bg: 'rgba(217, 79, 59, 0.08)',
    },
    {
        type: 'violations',
        label: 'Violations',
        icon: '🟡',
        color: 'var(--layer-violation, #D97706)',
        bg: 'rgba(217, 119, 6, 0.08)',
    },
    {
        type: 'crashes',
        label: 'Crashes',
        icon: '🔵',
        color: 'var(--layer-crash, #4A90B0)',
        bg: 'rgba(74, 144, 176, 0.08)',
    },
]

// ── Props ───────────────────────────────────────────────────────────────────

interface LayerToggleProps {
    enabledLayers: Set<DataLayerType>
    onToggle: (layer: DataLayerType) => void
    counts: Partial<Record<DataLayerType, number>>
    loading: Partial<Record<DataLayerType, boolean>>
    /** Whether building permit markers are visible on the map */
    permitsVisible: boolean
    /** Callback to toggle permit marker visibility */
    onPermitsToggle: () => void
    /** Number of permits currently loaded */
    permitsCount?: number
    /** Whether permits are currently loading */
    permitsLoading?: boolean
}

// ── Component ───────────────────────────────────────────────────────────────

export default function LayerToggle({ enabledLayers, onToggle, counts, loading, permitsVisible, onPermitsToggle, permitsCount, permitsLoading }: LayerToggleProps) {
    const [expanded, setExpanded] = useState(false)
    // NOTE(Agent): Permits count toward enabled total since they appear
    // in the panel alongside data layers.
    const enabledCount = enabledLayers.size + (permitsVisible ? 1 : 0)

    const handleToggle = useCallback(
        (layer: DataLayerType) => {
            onToggle(layer)
        },
        [onToggle]
    )

    if (!expanded) {
        return (
            <div className={styles.container}>
                <button
                    className={styles.pill}
                    onClick={() => setExpanded(true)}
                    aria-label={`Data layers panel. ${enabledCount} layers enabled. Click to expand.`}
                    aria-expanded={false}
                >
                    <span className={styles.pillIcon} aria-hidden="true">◉</span>
                    Layers
                    {enabledCount > 0 && (
                        <span className={styles.pillBadge} aria-hidden="true">
                            {enabledCount}
                        </span>
                    )}
                </button>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <div className={styles.panel} role="region" aria-label="Data layers panel">
                <div className={styles.panelHeader}>
                    <span className={styles.panelTitle}>Data Layers</span>
                    <button
                        className={styles.closeBtn}
                        onClick={() => setExpanded(false)}
                        aria-label="Close layers panel"
                    >
                        <X size={14} aria-hidden="true" />
                    </button>
                </div>

                {/* Permits toggle — rendered first, above data layers */}
                <div className={styles.layerRow}>
                    <div
                        className={styles.layerIcon}
                        style={{ backgroundColor: 'rgba(10, 158, 142, 0.08)' }}
                        aria-hidden="true"
                    >
                        🏗️
                    </div>
                    <div className={styles.layerInfo}>
                        <span className={styles.layerLabel}>
                            Permits
                            {(permitsLoading ?? false) && (
                                <span
                                    className={styles.layerSpinner}
                                    style={{ color: 'var(--accent-primary, #0A9E8E)' }}
                                    aria-label="Loading permits data"
                                />
                            )}
                            {!(permitsLoading ?? false) && permitsVisible && permitsCount !== undefined && (
                                <span className={styles.layerCount}>{permitsCount}</span>
                            )}
                        </span>
                    </div>
                    <label
                        className={styles.toggle}
                        htmlFor="layer-toggle-permits"
                    >
                        <input
                            id="layer-toggle-permits"
                            className={styles.toggleInput}
                            type="checkbox"
                            role="switch"
                            aria-checked={permitsVisible}
                            aria-label="Toggle Permits layer"
                            checked={permitsVisible}
                            onChange={onPermitsToggle}
                        />
                        <span className={styles.toggleTrack} />
                        <span className={styles.toggleKnob} />
                    </label>
                </div>

                {/* Divider between permits and data layers */}
                <div style={{ height: '1px', backgroundColor: 'var(--border-glass, rgba(255,255,255,0.06))', margin: '2px 0' }} />

                {LAYERS.map((layer) => {
                    const isEnabled = enabledLayers.has(layer.type)
                    const count = counts[layer.type]
                    const isLoading = loading[layer.type] ?? false
                    const toggleId = `layer-toggle-${layer.type}`

                    return (
                        <div key={layer.type} className={styles.layerRow}>
                            <div
                                className={styles.layerIcon}
                                style={{ backgroundColor: layer.bg }}
                                aria-hidden="true"
                            >
                                {layer.icon}
                            </div>
                            <div className={styles.layerInfo}>
                                <span className={styles.layerLabel}>
                                    {layer.label}
                                    {isLoading && (
                                        <span
                                            className={styles.layerSpinner}
                                            style={{ color: layer.color }}
                                            aria-label={`Loading ${layer.label} data`}
                                        />
                                    )}
                                    {!isLoading && isEnabled && count !== undefined && (
                                        <span className={styles.layerCount}>{count}</span>
                                    )}
                                </span>
                            </div>
                            {/* NOTE(Agent): role="switch" + aria-checked implements the
                  ARIA switch pattern. Keyboard users can toggle with Space. */}
                            <label
                                className={styles.toggle}
                                htmlFor={toggleId}
                            >
                                <input
                                    id={toggleId}
                                    className={styles.toggleInput}
                                    type="checkbox"
                                    role="switch"
                                    aria-checked={isEnabled}
                                    aria-label={`Toggle ${layer.label} layer`}
                                    checked={isEnabled}
                                    onChange={() => handleToggle(layer.type)}
                                />
                                <span className={styles.toggleTrack} />
                                <span className={styles.toggleKnob} />
                            </label>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

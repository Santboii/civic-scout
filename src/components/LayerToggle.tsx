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
}

// ── Component ───────────────────────────────────────────────────────────────

export default function LayerToggle({ enabledLayers, onToggle, counts, loading }: LayerToggleProps) {
    const [expanded, setExpanded] = useState(false)
    const enabledCount = enabledLayers.size

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

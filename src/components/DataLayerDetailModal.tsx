'use client'

import { useEffect, useRef, useId } from 'react'
import { X, MapPin, Calendar, AlertTriangle, Shield, Car } from 'lucide-react'
import type { DataLayerItem } from '@/lib/data-layers'
import { LAYER_SEVERITY_LABELS } from '@/lib/data-layer-classifier'
import type { PermitSeverity } from '@/lib/permit-classifier'

interface DataLayerDetailModalProps {
    item: DataLayerItem
    onClose: () => void
}

// ── Layer Config ────────────────────────────────────────────────────────────

const LAYER_CONFIG = {
    crimes: {
        color: 'var(--layer-crime, #D94F3B)',
        bg: 'rgba(217, 79, 59, 0.06)',
        border: 'rgba(217, 79, 59, 0.12)',
        label: 'Crime Incident',
        Icon: Shield,
        sourceUrl: 'https://data.cityofchicago.org/Public-Safety/Crimes-2001-to-Present/ijzp-q8t2',
        sourceLabel: 'Chicago Crime Data',
    },
    violations: {
        color: 'var(--layer-violation, #D97706)',
        bg: 'rgba(217, 119, 6, 0.06)',
        border: 'rgba(217, 119, 6, 0.12)',
        label: 'Building Violation',
        Icon: AlertTriangle,
        sourceUrl: 'https://data.cityofchicago.org/Buildings/Building-Violations/22u3-xenr',
        sourceLabel: 'Chicago Building Violations',
    },
    crashes: {
        color: 'var(--layer-crash, #4A90B0)',
        bg: 'rgba(74, 144, 176, 0.06)',
        border: 'rgba(74, 144, 176, 0.12)',
        label: 'Traffic Crash',
        Icon: Car,
        sourceUrl: 'https://data.cityofchicago.org/Transportation/Traffic-Crashes-Crashes/85ca-t3if',
        sourceLabel: 'Chicago Traffic Crashes',
    },
}

// ── Component ───────────────────────────────────────────────────────────────

export default function DataLayerDetailModal({ item, onClose }: DataLayerDetailModalProps) {
    const config = LAYER_CONFIG[item.layerType]
    const dialogRef = useRef<HTMLDivElement>(null)
    const closeBtnRef = useRef<HTMLButtonElement>(null)
    const headingId = useId()

    // Focus trap + Escape handler (mirrors PermitDetailModal pattern)
    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement
        closeBtnRef.current?.focus()

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                onClose()
                return
            }
            if (e.key !== 'Tab' || !dialogRef.current) return

            const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
            const first = focusable[0]
            const last = focusable[focusable.length - 1]

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault()
                    last.focus()
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault()
                    first.focus()
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            previouslyFocused?.focus()
        }
    }, [onClose])

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-opacity"
            style={{ backgroundColor: 'var(--backdrop-overlay)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
            aria-hidden="true"
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={headingId}
                className="rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-fade-slide-up"
                style={{
                    backgroundColor: 'var(--background-card)',
                    border: '1px solid var(--border-strong)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="px-6 py-4 flex items-center justify-between border-b"
                    style={{
                        backgroundColor: config.bg,
                        borderBottomColor: config.border,
                    }}
                >
                    <div className="flex items-center gap-3">
                        <config.Icon size={16} style={{ color: config.color }} aria-hidden="true" />
                        <span
                            className="text-[10px] font-semibold uppercase tracking-widest"
                            style={{ color: config.color }}
                        >
                            {config.label}
                        </span>
                    </div>
                    <button
                        ref={closeBtnRef}
                        onClick={onClose}
                        aria-label="Close dialog"
                        className="p-2 hover:bg-black/5 rounded-full transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {item.layerType === 'crimes' && <CrimeContent item={item} headingId={headingId} config={config} />}
                    {item.layerType === 'violations' && <ViolationContent item={item} headingId={headingId} config={config} />}
                    {item.layerType === 'crashes' && <CrashContent item={item} headingId={headingId} config={config} />}
                </div>

                {/* Footer */}
                <div className="p-6 pt-0 mt-auto">
                    <a
                        href={config.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
                        style={{
                            backgroundColor: config.color,
                            color: '#FFFFFF',
                            boxShadow: `0 4px 16px ${config.color}33`,
                        }}
                    >
                        View Source Dataset →
                    </a>
                    <p
                        className="text-center text-[10px] mt-4 uppercase tracking-wider font-semibold"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        {config.sourceLabel} • City of Chicago Open Data
                    </p>
                </div>
            </div>
        </div>
    )
}

// ── Content Renderers ───────────────────────────────────────────────────────

interface ContentProps {
    headingId: string
    config: typeof LAYER_CONFIG[keyof typeof LAYER_CONFIG]
}

function StatCard({ label, value, icon: IconComp }: { label: string; value: string; icon: typeof Calendar }) {
    return (
        <div
            className="rounded-xl p-4 border"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: 'var(--border-glass)' }}
        >
            <div className="flex items-center gap-2 mb-1">
                <IconComp size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {label}
                </span>
            </div>
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {value}
            </p>
        </div>
    )
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
    return (
        <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ color, backgroundColor: bg, border: `1px solid ${color}22` }}
        >
            {label}
        </span>
    )
}

// NOTE(Agent): Severity colors for the community note callout.
const SEVERITY_HEX: Record<PermitSeverity, string> = {
    red: '#D94F3B',
    yellow: '#C99A1D',
    green: '#1B9B6C',
}

function SeverityCallout({ severity, layerType, communityNote }: {
    severity: PermitSeverity
    layerType: string
    communityNote: string
}) {
    const color = SEVERITY_HEX[severity]
    const label = LAYER_SEVERITY_LABELS[severity]?.[layerType] ?? ''
    if (!communityNote) return null
    return (
        <div
            className="p-4 rounded-xl border-l-[3px]"
            style={{
                backgroundColor: `${color}08`,
                borderLeftColor: color,
            }}
        >
            <span
                className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                style={{ color, backgroundColor: `${color}14` }}
            >
                {label}
            </span>
            <p className="text-xs leading-relaxed mt-2" style={{ color: 'var(--text-primary)' }}>
                {communityNote}
            </p>
        </div>
    )
}

function CrimeContent({ item, headingId, config }: ContentProps & { item: Extract<DataLayerItem, { layerType: 'crimes' }> }) {
    const formattedDate = item.date
        ? new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
        : 'Unknown'

    return (
        <>
            {/* Severity callout */}
            <SeverityCallout severity={item.severity} layerType={item.layerType} communityNote={item.communityNote} />

            <section>
                <h2
                    id={headingId}
                    className="text-2xl leading-tight tracking-tight"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 700 }}
                >
                    {item.primaryType}
                </h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <MapPin size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{item.block}</span>
                </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
                <StatCard label="Date" value={formattedDate} icon={Calendar} />
                <StatCard label="Case #" value={item.caseNumber || 'N/A'} icon={Shield} />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                {item.arrest && <Badge label="Arrest Made" color="#1B9B6C" bg="rgba(27, 155, 108, 0.08)" />}
                {!item.arrest && <Badge label="No Arrest" color="var(--text-muted)" bg="rgba(0, 0, 0, 0.04)" />}
                {item.domestic && <Badge label="Domestic" color="#D94F3B" bg="rgba(217, 79, 59, 0.08)" />}
            </div>

            {item.description && (
                <div
                    className="p-5 rounded-xl border"
                    style={{ backgroundColor: config.bg, borderColor: config.border }}
                >
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: config.color }}>
                        Description
                    </p>
                    <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {item.description}
                    </p>
                </div>
            )}
        </>
    )
}

function ViolationContent({ item, headingId, config }: ContentProps & { item: Extract<DataLayerItem, { layerType: 'violations' }> }) {
    const formattedDate = item.violationDate
        ? new Date(item.violationDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Unknown'

    const isOpen = item.violationStatus.toUpperCase().includes('OPEN')

    return (
        <>
            {/* Severity callout */}
            <SeverityCallout severity={item.severity} layerType={item.layerType} communityNote={item.communityNote} />

            <section>
                <h2
                    id={headingId}
                    className="text-2xl leading-tight tracking-tight"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 700 }}
                >
                    {item.violationCode || 'Building Violation'}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                    <MapPin size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{item.address}</span>
                </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
                <StatCard label="Violation Date" value={formattedDate} icon={Calendar} />
                <div
                    className="rounded-xl p-4 border"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: 'var(--border-glass)' }}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            Status
                        </span>
                    </div>
                    <Badge
                        label={item.violationStatus || 'Unknown'}
                        color={isOpen ? '#D94F3B' : '#1B9B6C'}
                        bg={isOpen ? 'rgba(217, 79, 59, 0.08)' : 'rgba(27, 155, 108, 0.08)'}
                    />
                </div>
            </div>

            {item.violationDescription && (
                <div
                    className="p-5 rounded-xl border"
                    style={{ backgroundColor: config.bg, borderColor: config.border }}
                >
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: config.color }}>
                        Violation Description
                    </p>
                    <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {item.violationDescription}
                    </p>
                </div>
            )}

            {item.inspectionStatus && (
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Inspection:{' '}
                    </span>
                    {item.inspectionStatus}
                </div>
            )}

            {item.departmentBureau && (
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Department:{' '}
                    </span>
                    {item.departmentBureau}
                </div>
            )}
        </>
    )
}

function CrashContent({ item, headingId, config }: ContentProps & { item: Extract<DataLayerItem, { layerType: 'crashes' }> }) {
    const formattedDate = item.crashDate
        ? new Date(item.crashDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
        : 'Unknown'

    return (
        <>
            {/* Severity callout */}
            <SeverityCallout severity={item.severity} layerType={item.layerType} communityNote={item.communityNote} />

            <section>
                <h2
                    id={headingId}
                    className="text-2xl leading-tight tracking-tight"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 700 }}
                >
                    {item.crashType || 'Traffic Crash'}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                    <Calendar size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{formattedDate}</span>
                </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
                <div
                    className="rounded-xl p-4 border"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: 'var(--border-glass)' }}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            Total Injuries
                        </span>
                    </div>
                    <p
                        className="text-lg font-bold"
                        style={{ color: item.injuriesTotal > 0 ? '#D94F3B' : 'var(--text-primary)' }}
                    >
                        {item.injuriesTotal}
                    </p>
                </div>
                <div
                    className="rounded-xl p-4 border"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderColor: 'var(--border-glass)' }}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            Fatal Injuries
                        </span>
                    </div>
                    <p
                        className="text-lg font-bold"
                        style={{ color: item.injuriesFatal > 0 ? '#D94F3B' : 'var(--text-primary)' }}
                    >
                        {item.injuriesFatal}
                    </p>
                </div>
            </div>

            {item.damage && (
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Damage:
                    </span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {item.damage}
                    </span>
                </div>
            )}

            {item.primContributoryCause && (
                <div
                    className="p-5 rounded-xl border"
                    style={{ backgroundColor: config.bg, borderColor: config.border }}
                >
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: config.color }}>
                        Primary Contributing Cause
                    </p>
                    <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {item.primContributoryCause}
                    </p>
                </div>
            )}
        </>
    )
}

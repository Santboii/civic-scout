'use client'

import { useState, useMemo, memo } from 'react'
import { Shield, AlertTriangle, Car } from 'lucide-react'
import type { DataLayerItem, DataLayerType, CrimeIncident, BuildingViolation, TrafficCrash } from '@/lib/data-layers'
import { LAYER_SEVERITY_LABELS } from '@/lib/data-layer-classifier'
import type { PermitSeverity } from '@/lib/permit-classifier'

// ── Props ───────────────────────────────────────────────────────────────────

interface DataLayerListProps {
    items: DataLayerItem[]
    enabledLayers: Set<DataLayerType>
    onItemClick?: (item: DataLayerItem) => void
    onViewDetails?: (item: DataLayerItem) => void
    selectedItemId?: string | null
}

// ── Tab Config ──────────────────────────────────────────────────────────────

interface TabDef {
    type: DataLayerType
    label: string
    icon: typeof Shield
    color: string
    bg: string
}

const TABS: TabDef[] = [
    { type: 'crimes', label: 'Crime', icon: Shield, color: 'var(--layer-crime, #D94F3B)', bg: 'rgba(217, 79, 59, 0.06)' },
    { type: 'violations', label: 'Violations', icon: AlertTriangle, color: 'var(--layer-violation, #D97706)', bg: 'rgba(217, 119, 6, 0.06)' },
    { type: 'crashes', label: 'Crashes', icon: Car, color: 'var(--layer-crash, #4A90B0)', bg: 'rgba(74, 144, 176, 0.06)' },
]

// ── Component ───────────────────────────────────────────────────────────────

export default memo(DataLayerList)

function DataLayerList({ items, enabledLayers, onItemClick, onViewDetails, selectedItemId }: DataLayerListProps) {
    const availableTabs = useMemo(
        () => TABS.filter((t) => enabledLayers.has(t.type)),
        [enabledLayers]
    )

    const [activeTab, setActiveTab] = useState<DataLayerType | null>(null)

    // Auto-select first available tab if current selection is invalid
    const effectiveTab = activeTab && enabledLayers.has(activeTab) ? activeTab : (availableTabs[0]?.type ?? null)

    const filteredItems = useMemo(
        () => effectiveTab ? items.filter((i) => i.layerType === effectiveTab) : [],
        [items, effectiveTab]
    )

    if (availableTabs.length === 0) return null

    return (
        <div>
            {/* Tab Bar */}
            <div
                className="flex gap-1 mb-3 overflow-x-auto"
                role="tablist"
                aria-label="Data layer tabs"
            >
                {availableTabs.map((tab) => {
                    const isActive = tab.type === effectiveTab
                    const count = items.filter((i) => i.layerType === tab.type).length
                    const Icon = tab.icon
                    return (
                        <button
                            key={tab.type}
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={`tabpanel-${tab.type}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap"
                            style={{
                                backgroundColor: isActive ? tab.bg : 'transparent',
                                color: isActive ? tab.color : 'var(--text-muted)',
                                border: `1px solid ${isActive ? tab.color + '33' : 'transparent'}`,
                            }}
                            onClick={() => setActiveTab(tab.type)}
                        >
                            <Icon size={12} aria-hidden="true" />
                            {tab.label}
                            <span
                                className="text-[9px] font-bold px-1.5 rounded-full"
                                style={{
                                    backgroundColor: isActive ? tab.color + '1A' : 'rgba(0,0,0,0.04)',
                                    color: isActive ? tab.color : 'var(--text-muted)',
                                }}
                            >
                                {count}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Tab Panel */}
            {effectiveTab && (
                <div
                    id={`tabpanel-${effectiveTab}`}
                    role="tabpanel"
                    aria-label={`${effectiveTab} list`}
                >
                    {filteredItems.length === 0 ? (
                        <p className="text-center text-xs py-6" style={{ color: 'var(--text-muted)' }}>
                            No data found for this layer.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {filteredItems.map((item, index) => (
                                <li key={item.id} className="animate-fade-slide-up" style={{ animationDelay: `${index * 30}ms` }}>
                                    {item.layerType === 'crimes' && (
                                        <CrimeCard item={item} isSelected={item.id === selectedItemId} onClick={() => onItemClick?.(item)} onViewDetails={() => onViewDetails?.(item)} />
                                    )}
                                    {item.layerType === 'violations' && (
                                        <ViolationCard item={item} isSelected={item.id === selectedItemId} onClick={() => onItemClick?.(item)} onViewDetails={() => onViewDetails?.(item)} />
                                    )}
                                    {item.layerType === 'crashes' && (
                                        <CrashCard item={item} isSelected={item.id === selectedItemId} onClick={() => onItemClick?.(item)} onViewDetails={() => onViewDetails?.(item)} />
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Card Components ─────────────────────────────────────────────────────────

interface CardProps {
    isSelected: boolean
    onClick: () => void
    onViewDetails: () => void
}

// NOTE(Agent): Severity colors matching permit markers in Map.tsx.
const SEVERITY_COLORS: Record<PermitSeverity, string> = {
    red: '#D94F3B',
    yellow: '#C99A1D',
    green: '#1B9B6C',
}

function CardWrapper({ children, color, severity, severityLabel, communityNote, isSelected, onClick, onViewDetails, ariaLabel }: CardProps & {
    children: React.ReactNode
    color: string
    severity: PermitSeverity
    severityLabel: string
    communityNote: string
    ariaLabel: string
}) {
    const severityColor = SEVERITY_COLORS[severity]
    return (
        <div
            className="glass-elevated rounded-xl p-3 transition-all cursor-pointer active:scale-[0.99] relative overflow-hidden"
            tabIndex={0}
            role="article"
            aria-label={ariaLabel}
            style={{
                boxShadow: isSelected ? `0 0 0 2px ${color}, 0 4px 16px ${color}1A` : 'var(--shadow-sm)',
                borderColor: isSelected ? color + '4D' : undefined,
            }}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onClick()
                }
            }}
        >
            {/* Side accent — colored by severity, not type */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ backgroundColor: severityColor }} />
            <div className="pl-1">
                {children}
                {/* Community note preview */}
                {communityNote && (
                    <p
                        className="text-[10px] leading-snug mt-1.5 line-clamp-2"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {communityNote}
                    </p>
                )}
                <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{ borderTopColor: 'var(--border-glass)' }}>
                    {/* Severity badge */}
                    <span
                        className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                        style={{
                            color: severityColor,
                            backgroundColor: severityColor + '14',
                        }}
                    >
                        {severityLabel}
                    </span>
                    <button
                        className="text-[10px] font-semibold transition-opacity hover:opacity-80"
                        style={{ color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        onClick={(e) => { e.stopPropagation(); onViewDetails() }}
                        aria-label="View full details"
                    >
                        View →
                    </button>
                </div>
            </div>
        </div>
    )
}

function CrimeCard({ item, isSelected, onClick, onViewDetails }: CardProps & { item: CrimeIncident }) {
    const formattedDate = item.date ? new Date(item.date).toLocaleDateString() : ''
    const severityLabel = LAYER_SEVERITY_LABELS[item.severity]?.crimes ?? 'Incident Report'
    return (
        <CardWrapper color="var(--layer-crime, #D94F3B)" severity={item.severity} severityLabel={severityLabel} communityNote={item.communityNote} isSelected={isSelected} onClick={onClick} onViewDetails={onViewDetails} ariaLabel={`${severityLabel}: ${item.primaryType} at ${item.block}`}>
            <div className="flex items-start gap-2">
                <div className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: 'rgba(217, 79, 59, 0.06)' }}>
                    <Shield size={14} style={{ color: 'var(--layer-crime, #D94F3B)' }} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {item.primaryType}
                    </p>
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                        {item.block}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formattedDate}</span>
                        {item.arrest && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: '#1B9B6C', backgroundColor: 'rgba(27, 155, 108, 0.08)' }}>
                                ARREST
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </CardWrapper>
    )
}

function ViolationCard({ item, isSelected, onClick, onViewDetails }: CardProps & { item: BuildingViolation }) {
    const formattedDate = item.violationDate ? new Date(item.violationDate).toLocaleDateString() : ''
    const isOpen = item.violationStatus.toUpperCase().includes('OPEN')
    const severityLabel = LAYER_SEVERITY_LABELS[item.severity]?.violations ?? 'Routine'
    return (
        <CardWrapper color="var(--layer-violation, #D97706)" severity={item.severity} severityLabel={severityLabel} communityNote={item.communityNote} isSelected={isSelected} onClick={onClick} onViewDetails={onViewDetails} ariaLabel={`${severityLabel}: ${item.violationCode} at ${item.address}`}>
            <div className="flex items-start gap-2">
                <div className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: 'rgba(217, 119, 6, 0.06)' }}>
                    <AlertTriangle size={14} style={{ color: 'var(--layer-violation, #D97706)' }} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {item.violationCode || 'Violation'}
                    </p>
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                        {item.address}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formattedDate}</span>
                        <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                                color: isOpen ? '#D94F3B' : '#1B9B6C',
                                backgroundColor: isOpen ? 'rgba(217, 79, 59, 0.08)' : 'rgba(27, 155, 108, 0.08)',
                            }}
                        >
                            {isOpen ? 'OPEN' : 'CLOSED'}
                        </span>
                    </div>
                </div>
            </div>
        </CardWrapper>
    )
}

function CrashCard({ item, isSelected, onClick, onViewDetails }: CardProps & { item: TrafficCrash }) {
    const formattedDate = item.crashDate ? new Date(item.crashDate).toLocaleDateString() : ''
    const severityLabel = LAYER_SEVERITY_LABELS[item.severity]?.crashes ?? 'Minor Crash'
    return (
        <CardWrapper color="var(--layer-crash, #4A90B0)" severity={item.severity} severityLabel={severityLabel} communityNote={item.communityNote} isSelected={isSelected} onClick={onClick} onViewDetails={onViewDetails} ariaLabel={`${severityLabel}: ${item.crashType} with ${item.injuriesTotal} injuries`}>
            <div className="flex items-start gap-2">
                <div className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: 'rgba(74, 144, 176, 0.06)' }}>
                    <Car size={14} style={{ color: 'var(--layer-crash, #4A90B0)' }} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {item.crashType || 'Traffic Crash'}
                    </p>
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                        {item.primContributoryCause}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formattedDate}</span>
                        {item.injuriesTotal > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: '#D94F3B', backgroundColor: 'rgba(217, 79, 59, 0.08)' }}>
                                {item.injuriesTotal} INJURED
                            </span>
                        )}
                        {item.injuriesFatal > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: '#fff', backgroundColor: '#D94F3B' }}>
                                {item.injuriesFatal} FATAL
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </CardWrapper>
    )
}

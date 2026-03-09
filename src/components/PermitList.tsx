'use client'

import { useMemo, memo } from 'react'
import type { ClassifiedPermit } from '@/lib/permit-classifier'
import { AlertTriangle, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react'

interface PermitListProps {
  permits: ClassifiedPermit[]
  onPermitClick?: (permit: ClassifiedPermit) => void
  onViewDetails?: (permit: ClassifiedPermit) => void
  selectedPermitId?: string | null
}

const SEVERITY_CONFIG = {
  red: {
    icon: AlertTriangle,
    color: 'var(--status-red)',
    bg: 'rgba(217, 79, 59, 0.06)',
    border: 'rgba(217, 79, 59, 0.15)',
    label: 'High Impact',
  },
  yellow: {
    icon: AlertCircle,
    color: 'var(--status-yellow)',
    bg: 'rgba(201, 154, 29, 0.06)',
    border: 'rgba(201, 154, 29, 0.15)',
    label: 'Medium Impact',
  },
  green: {
    icon: CheckCircle,
    color: 'var(--status-green)',
    bg: 'rgba(27, 155, 108, 0.06)',
    border: 'rgba(27, 155, 108, 0.15)',
    label: 'Standard',
  },
}

// NOTE(Agent): Memoized to prevent re-renders from unrelated parent state changes
// (e.g., loading, showPayment, selectedMapPermit) that don't affect list props.
export default memo(PermitList)

function PermitList({ permits, onPermitClick, onViewDetails, selectedPermitId }: PermitListProps) {
  // NOTE(Agent): useMemo must be called unconditionally before any early returns to comply with
  // Rules of Hooks. When permits is empty the sorted array is also empty, which is fine.
  const sorted = useMemo(() => {
    const order = { red: 0, yellow: 1, green: 2 }
    return [...permits]
      .sort((a, b) => order[a.severity] - order[b.severity])
      .map((p) => ({
        ...p,
        _formattedDate: new Date(p.issue_date).toLocaleDateString(),
      }))
  }, [permits])

  if (permits.length === 0) {
    return (
      <div
        className="text-center text-sm py-12 px-6 rounded-xl border border-dashed"
        style={{ color: 'var(--text-muted)', borderColor: 'var(--border-strong)' }}
      >
        <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
          No significant developments found.
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Try searching a different address.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {sorted.map((permit, index) => {
        const config = SEVERITY_CONFIG[permit.severity]
        const Icon = config.icon
        const isSelected = permit.id === selectedPermitId
        return (
          <li
            key={permit.id}
            className="glass-elevated rounded-xl p-4 transition-all cursor-pointer active:scale-[0.99] group relative overflow-hidden animate-fade-slide-up"
            tabIndex={0}
            role="article"
            aria-label={`${config.label} permit at ${permit.address}`}
            style={{
              animationDelay: `${index * 50}ms`,
              // NOTE(Agent): Teal ring on the selected card to show which
              // pin the map is currently focused on. Keeps severity accent
              // bar intact for color-coded impact info.
              boxShadow: isSelected
                ? '0 0 0 2px var(--accent-primary), 0 4px 16px rgba(10, 158, 142, 0.12)'
                : 'var(--shadow-sm)',
              borderColor: isSelected ? 'rgba(10, 158, 142, 0.3)' : undefined,
            }}
            onClick={() => onPermitClick?.(permit)}
            // NOTE(Agent): onKeyDown handles keyboard activation (Enter/Space) for
            // the <li> card. Required because <li> is not natively interactive.
            // WCAG 2.1.1 — Keyboard Accessible.
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onPermitClick?.(permit)
              }
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = 'rgba(10, 158, 142, 0.3)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.08)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = ''
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
              }
            }}
          >
            {/* Severity side accent */}
            <div
              className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
              style={{ backgroundColor: config.color }}
            />

            <div className="flex items-start gap-3 pl-1">
              <div
                className="p-2 rounded-lg shrink-0"
                style={{ backgroundColor: config.bg }}
              >
                <Icon size={16} style={{ color: config.color }} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {permit.address}
                  </p>
                  {permit.reported_cost > 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                      style={{
                        backgroundColor: 'rgba(200, 136, 10, 0.08)',
                        color: 'var(--accent-warm)',
                        border: '1px solid rgba(200, 136, 10, 0.15)',
                      }}
                    >
                      ${(permit.reported_cost / 1e6).toFixed(1)}M
                    </span>
                  )}
                </div>

                <p
                  className="text-[10px] font-semibold uppercase tracking-tight mt-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {permit.permit_label}
                </p>

                {permit.community_note && (
                  <p
                    className="text-xs mt-2 line-clamp-2 leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {permit.community_note}
                  </p>
                )}

                <div
                  className="flex items-center justify-between gap-2 mt-3 pt-3 border-t"
                  style={{ borderTopColor: 'var(--border-glass)' }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: config.color }}
                    >
                      {config.label}
                    </span>
                    <span
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: 'var(--border-strong)' }}
                    />
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {permit._formattedDate}
                    </span>
                  </div>

                  {/* View Details link — opens modal without triggering card click */}
                  <button
                    className="flex items-center gap-1 text-[10px] font-semibold transition-opacity hover:opacity-80"
                    aria-label={`View details for permit at ${permit.address}`}
                    style={{ color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onViewDetails?.(permit)
                    }}
                  >
                    Details
                    <ExternalLink size={10} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

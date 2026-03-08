'use client'

import { useState } from 'react'
import type { ClassifiedPermit } from '@/lib/permit-classifier'
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react'
import PermitDetailModal from './PermitDetailModal'

interface PermitListProps {
  permits: ClassifiedPermit[]
}

const SEVERITY_CONFIG = {
  red: {
    icon: AlertTriangle,
    color: 'var(--status-red)',
    bg: 'rgba(240, 100, 73, 0.08)',
    border: 'rgba(240, 100, 73, 0.2)',
    label: 'High Impact',
  },
  yellow: {
    icon: AlertCircle,
    color: 'var(--status-yellow)',
    bg: 'rgba(234, 188, 58, 0.08)',
    border: 'rgba(234, 188, 58, 0.2)',
    label: 'Medium Impact',
  },
  green: {
    icon: CheckCircle,
    color: 'var(--status-green)',
    bg: 'rgba(52, 211, 153, 0.08)',
    border: 'rgba(52, 211, 153, 0.2)',
    label: 'Standard',
  },
}

export default function PermitList({ permits }: PermitListProps) {
  const [selectedPermit, setSelectedPermit] = useState<ClassifiedPermit | null>(null)

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
          Try searching a different Chicago address.
        </p>
      </div>
    )
  }

  const sorted = [...permits].sort((a, b) => {
    const order = { red: 0, yellow: 1, green: 2 }
    return order[a.severity] - order[b.severity]
  })

  return (
    <>
      <div className="flex items-center justify-between mb-4 px-1">
        <h3
          className="text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: 'var(--text-muted)' }}
        >
          Results ({permits.length})
        </h3>
      </div>
      <ul className="space-y-3">
        {sorted.map((permit, index) => {
          const config = SEVERITY_CONFIG[permit.severity]
          const Icon = config.icon
          return (
            <li
              key={permit.id}
              className="glass-elevated rounded-xl p-4 transition-all cursor-pointer active:scale-[0.99] group relative overflow-hidden animate-fade-slide-up"
              style={{
                animationDelay: `${index * 50}ms`,
              }}
              onClick={() => setSelectedPermit(permit)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(13, 200, 180, 0.25)'
                e.currentTarget.style.boxShadow = '0 0 16px rgba(13, 200, 180, 0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = ''
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
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
                  <Icon size={16} style={{ color: config.color }} />
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
                          backgroundColor: 'rgba(232, 168, 50, 0.1)',
                          color: 'var(--accent-warm)',
                          border: '1px solid rgba(232, 168, 50, 0.2)',
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
                    {permit.permit_type}
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
                    className="flex items-center gap-2 mt-3 pt-3 border-t"
                    style={{ borderTopColor: 'var(--border-glass)' }}
                  >
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
                      {new Date(permit.issue_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {selectedPermit && (
        <PermitDetailModal
          permit={selectedPermit}
          onClose={() => setSelectedPermit(null)}
        />
      )}
    </>
  )
}

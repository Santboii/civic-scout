'use client'

import { useEffect, useState } from 'react'
import type { ClassifiedPermit } from '@/lib/permit-classifier'
import { X, DollarSign, Calendar, MapPin, Info, ExternalLink, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react'

interface PermitDetailModalProps {
  permit: ClassifiedPermit
  onClose: () => void
}

const SEVERITY_CONFIG = {
  red: {
    color: 'var(--status-red)',
    bg: 'rgba(240, 100, 73, 0.08)',
    border: 'rgba(240, 100, 73, 0.15)',
    label: 'High Impact Development',
  },
  yellow: {
    color: 'var(--status-yellow)',
    bg: 'rgba(234, 188, 58, 0.08)',
    border: 'rgba(234, 188, 58, 0.15)',
    label: 'Medium Impact Development',
  },
  green: {
    color: 'var(--status-green)',
    bg: 'rgba(52, 211, 153, 0.08)',
    border: 'rgba(52, 211, 153, 0.15)',
    label: 'Standard Development',
  },
}

export default function PermitDetailModal({ permit, onClose }: PermitDetailModalProps) {
  const config = SEVERITY_CONFIG[permit.severity]
  const [showTechnical, setShowTechnical] = useState(false)

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-opacity"
      style={{ backgroundColor: 'var(--backdrop-overlay)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
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
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
              style={{
                color: config.color,
                borderColor: config.color,
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
              }}
            >
              {permit.severity}
            </span>
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              {permit.permit_type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Address & Title */}
          <section>
            <h2
              className="text-2xl leading-tight tracking-tight"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display), Georgia, serif',
                fontWeight: 700,
              }}
            >
              {permit.address}
            </h2>
            <div className="flex items-center gap-2 mt-2 text-sm font-medium">
              <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Chicago, Illinois</span>
              {permit.zoning_classification && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>•</span>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-glass)',
                    }}
                  >
                    Zone {permit.zoning_classification}
                  </span>
                </>
              )}
            </div>
          </section>

          {/* Key Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl p-4 border"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderColor: 'var(--border-glass)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={14} style={{ color: 'var(--text-muted)' }} />
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Est. Cost
                </span>
              </div>
              <p
                className="text-lg font-bold"
                style={{
                  color: permit.reported_cost > 0 ? 'var(--accent-warm)' : 'var(--text-secondary)',
                }}
              >
                {permit.reported_cost > 0
                  ? `$${permit.reported_cost.toLocaleString()}`
                  : 'Undisclosed'}
              </p>
            </div>
            <div
              className="rounded-xl p-4 border"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderColor: 'var(--border-glass)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Issued Date
                </span>
              </div>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {new Date(permit.issue_date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Community Note — primary, prominent */}
          <div
            className="p-5 rounded-xl border flex gap-4 items-start"
            style={{
              backgroundColor: config.bg,
              borderColor: config.border,
            }}
          >
            <div
              className="p-2 rounded-lg shrink-0"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
            >
              <MessageCircle size={20} style={{ color: config.color }} />
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: config.color }}
              >
                What This Means for Your Neighborhood
              </p>
              <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {permit.community_note}
              </p>
            </div>
          </div>

          {/* Technical Details — collapsible */}
          <section>
            <button
              onClick={() => setShowTechnical(!showTechnical)}
              className="flex items-center gap-2 w-full text-left group"
            >
              <h3
                className="text-[10px] font-semibold uppercase tracking-widest group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-muted)' }}
              >
                Technical Details
              </h3>
              {showTechnical
                ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />
                : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
              }
            </button>
            {showTechnical && (
              <div className="mt-4 space-y-4 animate-fade-slide-up">
                {/* Impact Analysis (technical reason) */}
                <div
                  className="rounded-xl p-4 text-sm border"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderColor: 'var(--border-glass)',
                  }}
                >
                  <p
                    className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Info size={12} className="inline mr-1" style={{ verticalAlign: 'middle' }} />
                    Classification Reason
                  </p>
                  <p className="font-medium leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {permit.severity_reason || 'Standard development activity within the defined search radius.'}
                  </p>
                </div>

                {/* Work Description (raw) */}
                <div
                  className="rounded-xl p-4 text-sm border"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderColor: 'var(--border-glass)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <p
                    className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Work Description
                  </p>
                  <p className="leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
                    {permit.work_description || 'No detailed work description provided for this permit.'}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-0 mt-auto">
          <a
            href={`https://data.cityofchicago.org/resource/ydr8-5enu?permit_=${permit.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--background-primary)',
              boxShadow: '0 4px 16px rgba(13, 200, 180, 0.25)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)'
              e.currentTarget.style.boxShadow = '0 4px 24px rgba(13, 200, 180, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)'
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(13, 200, 180, 0.25)'
            }}
          >
            View Full Data Source
            <ExternalLink size={16} />
          </a>
          <p
            className="text-center text-[10px] mt-4 uppercase tracking-wider font-semibold"
            style={{ color: 'var(--text-muted)' }}
          >
            Permit ID: {permit.id} • Data provided by City of Chicago
          </p>
        </div>
      </div>
    </div>
  )
}

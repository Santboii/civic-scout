'use client'

import { useEffect, useState, useRef, useId } from 'react'
import type { ClassifiedPermit } from '@/lib/permit-classifier'
import { X, DollarSign, Calendar, MapPin, Info, ExternalLink, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react'

interface PermitDetailModalProps {
  permit: ClassifiedPermit
  onClose: () => void
  cityName?: string
}


const SEVERITY_CONFIG = {
  red: {
    color: 'var(--status-red)',
    bg: 'rgba(217, 79, 59, 0.06)',
    border: 'rgba(217, 79, 59, 0.12)',
    label: 'High Impact Development',
  },
  yellow: {
    color: 'var(--status-yellow)',
    bg: 'rgba(201, 154, 29, 0.06)',
    border: 'rgba(201, 154, 29, 0.12)',
    label: 'Medium Impact Development',
  },
  green: {
    color: 'var(--status-green)',
    bg: 'rgba(27, 155, 108, 0.06)',
    border: 'rgba(27, 155, 108, 0.12)',
    label: 'Standard Development',
  },
}

export default function PermitDetailModal({ permit, onClose, cityName = 'Unknown City' }: PermitDetailModalProps) {
  const config = SEVERITY_CONFIG[permit.severity]
  const [showTechnical, setShowTechnical] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const headingId = useId()

  // NOTE(Agent): Combined focus trap + Escape handler using a single keydown
  // listener on document. On mount, focus moves to the close button; on unmount,
  // focus is restored to the element that triggered the modal. WCAG 2.4.3.
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
      {/* NOTE(Agent): role="dialog" + aria-modal + aria-labelledby implement the
          ARIA dialog pattern for screen readers. WCAG 4.1.2. */}
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
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
              style={{
                color: config.color,
                borderColor: config.color,
                backgroundColor: 'rgba(0, 0, 0, 0.06)',
              }}
            >
              {permit.severity}
            </span>
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              {permit.permit_label}
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
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Address & Title */}
          <section>
            <h2
              id={headingId}
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
              <MapPin size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
              <span style={{ color: 'var(--text-secondary)' }}>{cityName}</span>
              {permit.zoning_classification && (
                <>
                  <span style={{ color: 'var(--text-muted)' }} aria-hidden="true">•</span>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.03)',
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
                <DollarSign size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
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
                <Calendar size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
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
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.03)' }}
            >
              <MessageCircle size={20} style={{ color: config.color }} aria-hidden="true" />
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
              aria-expanded={showTechnical}
              aria-controls="technical-details-panel"
              className="flex items-center gap-2 w-full text-left group"
            >
              <h3
                className="text-[10px] font-semibold uppercase tracking-widest group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-muted)' }}
              >
                Technical Details
              </h3>
              {showTechnical
                ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
              }
            </button>
            {showTechnical && (
              <div id="technical-details-panel" className="mt-4 space-y-4 animate-fade-slide-up">
                {/* Impact Analysis (technical reason) */}
                <div
                  className="rounded-xl p-4 text-sm border"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    borderColor: 'var(--border-glass)',
                  }}
                >
                  <p
                    className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Info size={12} className="inline mr-1" aria-hidden="true" style={{ verticalAlign: 'middle' }} />
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

                {/* Raw Permit Type (from city database) */}
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
                    Permit Type (Raw)
                  </p>
                  <p className="leading-relaxed font-medium" style={{ fontFamily: 'var(--font-body)' }}>
                    {permit.permit_type || 'Not specified'}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-0 mt-auto">
          <a
            href={permit.source_url || `https://${permit.source_domain || 'data.cityofchicago.org'}/resource/${permit.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#FFFFFF',
              boxShadow: '0 4px 16px rgba(10, 158, 142, 0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)'
              e.currentTarget.style.boxShadow = '0 4px 24px rgba(10, 158, 142, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)'
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(10, 158, 142, 0.2)'
            }}
          >
            View Full Data Source
            <ExternalLink size={16} aria-hidden="true" />
          </a>
          <p
            className="text-center text-[10px] mt-4 uppercase tracking-wider font-semibold"
            style={{ color: 'var(--text-muted)' }}
          >
            Permit ID: {permit.id} • Data provided by {cityName || 'Open Data Portal'}
          </p>
        </div>
      </div>
    </div>
  )
}

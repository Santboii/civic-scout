'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { X, Loader2, ArrowLeft } from 'lucide-react'

interface PaymentModalProps {
  address: string
  lat: number
  lon: number
  onClose: () => void
}

export default function PaymentModal({ address, lat, lon, onClose }: PaymentModalProps) {
  const [loading, setLoading] = useState<'lookup' | 'subscription' | null>(null)
  const [email, setEmail] = useState('')
  const [view, setView] = useState<'choose' | 'subscribe'>('choose')
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const headingId = useId()
  const emailId = useId()

  // NOTE(Agent): Focus trap — keeps keyboard focus inside the modal while it's open.
  // On mount, focus moves to the close button. Tab/Shift+Tab cycles only within
  // the modal's focusable elements. WCAG 2.4.3 (Focus Order). 
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement
    // Move focus into the modal
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
      // Restore focus to the triggering element on close
      previouslyFocused?.focus()
    }
  }, [onClose])

  async function handleLookup() {
    setLoading('lookup')
    setError(null)
    try {
      const res = await fetch('/api/checkout/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon, address }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      setLoading(null)
      setError('Payment unavailable. Please try again.')
    }
  }

  async function handleSubscription() {
    if (!email) return
    setLoading('subscription')
    setError(null)
    try {
      const res = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      setLoading(null)
      setError('Payment unavailable. Please try again.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'var(--backdrop-overlay)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      aria-hidden="true"
    >
      {/* NOTE(Agent): role="dialog" + aria-modal tells screen readers this is a modal
          dialog and that content behind it should be hidden. aria-labelledby associates
          the heading as the dialog's accessible name. WCAG 4.1.2, 2.4.3. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="rounded-2xl w-full max-w-sm p-8 relative overflow-hidden animate-fade-slide-up"
        style={{
          backgroundColor: 'var(--background-card)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-glass)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          aria-hidden="true"
          style={{ background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-warm))' }}
        />

        <button
          ref={closeBtnRef}
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-6 right-6 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={20} aria-hidden="true" />
        </button>

        <h2
          id={headingId}
          className="text-xl mb-1 tracking-tight"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 700 }}
        >
          Unlock Development Report
        </h2>
        <p className="text-sm font-medium mb-8 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
          {address}
        </p>

        {view === 'choose' ? (
          <div className="space-y-3">
            <button
              onClick={handleLookup}
              disabled={!!loading}
              className="w-full flex items-center justify-between rounded-xl px-5 py-4 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
              style={{ backgroundColor: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-strong)' }}
            >
              <div className="text-left">
                <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Single Look-Up</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>24-hour access</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black" style={{ color: 'var(--accent-warm)' }}>$2</span>
                {loading === 'lookup' && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />}
              </div>
            </button>

            <button
              onClick={() => setView('subscribe')}
              className="w-full flex items-center justify-between rounded-xl px-5 py-5 transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{ backgroundColor: 'var(--accent-primary)', color: '#FFFFFF', boxShadow: '0 4px 20px rgba(10,158,142,0.2)' }}
            >
              <div className="text-left">
                <p className="font-bold text-sm">Unlimited Plan</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Search any US address</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xl font-black">$5</span>
                <span className="text-[10px] font-bold uppercase opacity-60">per month</span>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => setView('choose')}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest hover:opacity-70 transition-opacity mb-2"
              style={{ color: 'var(--accent-primary)' }}
            >
              <ArrowLeft size={14} aria-hidden="true" /> Back to Plans
            </button>
            {/* NOTE(Agent): Label is explicit via htmlFor+id rather than aria-label,
                consistent with WCAG 3.3.2 and easier for automated testing. */}
            <label htmlFor={emailId} className="visually-hidden">
              Email address
            </label>
            <input
              id={emailId}
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-xl px-4 py-3.5 text-sm font-medium outline-none transition-all"
              style={{ backgroundColor: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={handleSubscription}
              disabled={!email || !!loading}
              className="w-full rounded-xl py-4 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ backgroundColor: 'var(--accent-primary)', color: '#FFFFFF', boxShadow: '0 4px 20px rgba(10,158,142,0.2)' }}
            >
              {loading === 'subscription' ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
              Subscribe for $5/month
            </button>
          </div>
        )}

        {error && (
          <p
            role="alert"
            style={{ color: 'var(--accent-warm, #E8734A)', fontSize: '0.8125rem', fontWeight: 600, textAlign: 'center', marginTop: '0.75rem' }}
          >
            {error}
          </p>
        )}

        <div className="flex items-center justify-center gap-2 mt-8">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Powered by Stripe</span>
          <span className="w-1 h-1 rounded-full" aria-hidden="true" style={{ backgroundColor: 'var(--text-muted)' }} />
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Secure Payment</span>
        </div>

        {/* NOTE(Agent): Temporarily show bypass in ALL environments for beta testing.
            TODO: Remove or re-gate behind NODE_ENV === 'development' once beta period ends.
            Cookie includes max-age so it persists across browser sessions (not a session cookie). */}
        <button
          onClick={() => { document.cookie = 'ds_session=dev-token; path=/; max-age=2592000'; window.location.reload(); }}
          className="w-full mt-6 text-xs font-bold transition-colors uppercase tracking-widest"
          style={{ color: 'var(--accent-primary)', opacity: 0.7 }}
        >
          Beta: Free Access
        </button>
      </div>
    </div>
  )
}

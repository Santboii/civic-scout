'use client'

import { useState } from 'react'
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

  async function handleLookup() {
    setLoading('lookup')
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
    }
  }

  async function handleSubscription() {
    if (!email) return
    setLoading('subscription')
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
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'var(--backdrop-overlay)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="rounded-2xl w-full max-w-sm p-8 relative overflow-hidden animate-fade-slide-up"
        style={{
          backgroundColor: 'var(--background-card)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-glass)',
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-warm))' }}
        />

        <button
          onClick={onClose}
          className="absolute top-6 right-6 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={20} />
        </button>

        <h2
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
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-strong)' }}
            >
              <div className="text-left">
                <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Single Look-Up</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>24-hour access</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black" style={{ color: 'var(--accent-warm)' }}>$2</span>
                {loading === 'lookup' && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />}
              </div>
            </button>

            <button
              onClick={() => setView('subscribe')}
              className="w-full flex items-center justify-between rounded-xl px-5 py-5 transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--background-primary)', boxShadow: '0 4px 20px rgba(13,200,180,0.3)' }}
            >
              <div className="text-left">
                <p className="font-bold text-sm">Unlimited Plan</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Search any Chicago address</p>
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
              <ArrowLeft size={14} /> Back to Plans
            </button>
            <input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl px-4 py-3.5 text-sm font-medium outline-none transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={handleSubscription}
              disabled={!email || !!loading}
              className="w-full rounded-xl py-4 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--background-primary)', boxShadow: '0 4px 20px rgba(13,200,180,0.3)' }}
            >
              {loading === 'subscription' ? <Loader2 size={18} className="animate-spin" /> : null}
              Subscribe for $5/month
            </button>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 mt-8">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Powered by Stripe</span>
          <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Secure Payment</span>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={() => { document.cookie = 'ds_session=dev-token; path=/'; window.location.reload(); }}
            className="w-full mt-6 text-[10px] font-bold transition-colors underline uppercase tracking-widest opacity-20 hover:opacity-60"
            style={{ color: 'var(--text-muted)' }}
          >
            Dev: Bypass Paywall (Live Data)
          </button>
        )}
      </div>
    </div>
  )
}

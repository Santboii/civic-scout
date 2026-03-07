'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-bold text-gray-900 mb-1">Unlock Development Report</h2>
        <p className="text-sm text-gray-500 mb-5 line-clamp-2">{address}</p>

        {view === 'choose' ? (
          <div className="space-y-3">
            <button
              onClick={handleLookup}
              disabled={!!loading}
              className="w-full flex items-center justify-between bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-4 transition disabled:opacity-60"
            >
              <div className="text-left">
                <p className="font-semibold text-sm">Single Look-Up</p>
                <p className="text-xs text-blue-200">24-hour access to this address</p>
              </div>
              <span className="text-lg font-bold">$2</span>
              {loading === 'lookup' && <Loader2 size={16} className="animate-spin ml-2" />}
            </button>

            <button
              onClick={() => setView('subscribe')}
              className="w-full flex items-center justify-between bg-gray-900 hover:bg-gray-800 text-white rounded-xl px-5 py-4 transition"
            >
              <div className="text-left">
                <p className="font-semibold text-sm">Unlimited Subscription</p>
                <p className="text-xs text-gray-400">Search any Chicago address</p>
              </div>
              <span className="text-lg font-bold">$5<span className="text-sm font-normal">/mo</span></span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button onClick={() => setView('choose')} className="text-sm text-blue-600 hover:underline">
              ← Back
            </button>
            <input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={handleSubscription}
              disabled={!email || !!loading}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition"
            >
              {loading === 'subscription' ? <Loader2 size={16} className="animate-spin" /> : null}
              Subscribe for $5/month
            </button>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">Powered by Stripe · Secure payment</p>

        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={() => {
              document.cookie = 'ds_session=mock-token; path=/';
              window.location.reload();
            }}
            className="w-full mt-4 text-[10px] text-gray-300 hover:text-blue-400 transition underline uppercase tracking-widest"
          >
            Dev: Use Mock Token
          </button>
        )}
      </div>
    </div>
  )
}

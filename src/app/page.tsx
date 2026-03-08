'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams, useRouter } from 'next/navigation'
import SearchForm from '@/components/SearchForm'
import PermitList from '@/components/PermitList'
import PaymentModal from '@/components/PaymentModal'
import type { ClassifiedPermit } from '@/lib/permit-classifier'

// Leaflet requires browser APIs — load client-side only
const Map = dynamic(() => import('@/components/Map'), { ssr: false })

interface SearchState {
  address: string
  lat: number
  lon: number
}

function HomeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [search, setSearch] = useState<SearchState | null>(null)
  const [permits, setPermits] = useState<ClassifiedPermit[]>([])
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [dataSource, setDataSource] = useState<string>('')

  // NOTE(Agent): useRef guards prevent infinite re-render loops. useSearchParams() returns
  // a new object reference on every render in Next.js 16, so using it as a useEffect
  // dependency without guards causes: render → useEffect → setSearch (new obj) → re-render → repeat.
  const initializedFromUrl = useRef(false)
  const stripeSessionHandled = useRef<string | null>(null)

  // Check for existing session cookie or URL params (run once on mount)
  useEffect(() => {
    // Cookie check
    const cookies = document.cookie.split('; ')
    const sessionCookie = cookies.find(row => row.startsWith('ds_session='))
    if (sessionCookie) {
      const val = sessionCookie.split('=')[1]
      setToken(val)
    }

    // URL Param check (persists search across reloads) — only on initial mount
    if (!initializedFromUrl.current) {
      initializedFromUrl.current = true
      const lat = searchParams.get('lat')
      const lon = searchParams.get('lon')
      const address = searchParams.get('address')
      if (lat && lon && address) {
        setSearch({
          address: decodeURIComponent(address),
          lat: parseFloat(lat),
          lon: parseFloat(lon)
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle return from Stripe checkout
  useEffect(() => {
    const sessionId = searchParams.get('session_id')

    if (sessionId && stripeSessionHandled.current !== sessionId) {
      stripeSessionHandled.current = sessionId
      fetch(`/api/token?session_id=${sessionId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.token) {
            setToken(data.token)
          }
        })
        .catch(console.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchPermits = useCallback(
    async (lat: number, lon: number, accessToken: string) => {
      setLoading(true)
      try {
        const res = await fetch(`/api/permits?lat=${lat}&lon=${lon}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (res.status === 401) {
          setShowPayment(true)
          setPermits([])
          return
        }

        const data = await res.json()
        if (data.error) {
          console.error('API Error:', data.error)
          setPermits([])
        } else {
          setPermits(data.permits ?? [])
          setDataSource(data.source ?? '')
          setShowPayment(false) // Hide payment if we got data
        }
      } catch (err) {
        console.error('Fetch failed:', err)
        setPermits([])
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (search && token) {
      fetchPermits(search.lat, search.lon, token)
    } else if (search && !token) {
      setShowPayment(true)
    }
  }, [search, token, fetchPermits])

  function handleSearch(s: { address: string; lat: number; lon: number }) {
    setSearch(s)
    setPermits([])

    // Update URL to persist search state
    const params = new URLSearchParams()
    params.set('lat', s.lat.toString())
    params.set('lon', s.lon.toString())
    params.set('address', encodeURIComponent(s.address))
    router.push(`/?${params.toString()}`, { scroll: false })
  }

  const mapCenter: [number, number] = search
    ? [search.lat, search.lon]
    : [41.8781, -87.6298] // Chicago default (lat, lon)

  return (
    <main className="flex flex-col h-screen" style={{ backgroundColor: 'var(--background-primary)' }}>
      {/* Header — Dark editorial glass */}
      <header
        className="glass px-4 py-4 z-10 relative"
        style={{
          borderBottom: '1px solid var(--border-strong)',
        }}
      >
        {/* Subtle accent line at the very top */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)',
            opacity: 0.6,
          }}
        />
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="text-2xl tracking-tight"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display), Georgia, serif',
                fontWeight: 700,
              }}
            >
              Civic<span style={{ color: 'var(--accent-primary)' }}>Scout</span>
            </span>
            <span
              className="text-[9px] font-semibold uppercase tracking-[0.25em] px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: 'var(--accent-glow)',
                color: 'var(--accent-primary)',
                border: '1px solid rgba(13, 200, 180, 0.15)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Chicago
            </span>
          </div>
          <div className="flex-1 max-w-xl">
            <SearchForm onSearch={handleSearch} isLoading={loading} />
          </div>
        </div>
      </header>

      {/* Map + Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Map */}
        <div className="flex-1 min-h-[50vh] lg:min-h-0 relative">
          <Map permits={permits} center={mapCenter} />
          {loading && (
            <div
              className="absolute inset-0 flex items-center justify-center z-20"
              style={{ backgroundColor: 'rgba(12, 17, 23, 0.6)', backdropFilter: 'blur(4px)' }}
            >
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-8 h-8 border-[3px] border-t-transparent rounded-full animate-spin"
                  style={{
                    borderColor: 'var(--accent-primary)',
                    borderTopColor: 'transparent',
                    boxShadow: '0 0 16px rgba(13, 200, 180, 0.3)',
                  }}
                ></div>
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  Scanning permits…
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar — Dark glass surface */}
        {(search || permits.length > 0) && (
          <aside
            className="glass w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l overflow-y-auto p-6"
            style={{
              borderColor: 'var(--border-strong)',
            }}
          >
            {search && (
              <div className="mb-6">
                <h2
                  className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Current Search
                </h2>
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {search.address}
                </p>
                {dataSource === 'stale' && (
                  <p
                    className="text-[10px] font-semibold mt-2 flex items-center gap-1.5"
                    style={{ color: 'var(--status-yellow)' }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ backgroundColor: 'var(--status-yellow)' }}
                    />
                    Showing cached data (live data unavailable)
                  </p>
                )}
              </div>
            )}

            <PermitList permits={permits} />

            {/* Data Attribution Footer */}
            <div className="mt-12 pt-8 border-t" style={{ borderTopColor: 'var(--border-strong)' }}>
              <h3
                className="text-[9px] font-semibold uppercase tracking-[0.25em] mb-4"
                style={{ color: 'var(--text-muted)' }}
              >
                Data Verification
              </h3>
              <div className="space-y-3">
                <a
                  href="https://data.cityofchicago.org/Buildings/Building-Permits/ydr8-5enu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 group rounded-lg p-2.5 -mx-2.5 transition-colors"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent-glow)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <div
                    className="p-1.5 rounded-md"
                    style={{
                      backgroundColor: 'rgba(13, 200, 180, 0.08)',
                      border: '1px solid var(--border-glass)',
                    }}
                  >
                    <span className="text-xs">🏙️</span>
                  </div>
                  <div>
                    <p
                      className="text-[11px] font-semibold leading-tight"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      City of Chicago Open Data
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Real-time building permit records
                    </p>
                  </div>
                </a>
                <a
                  href="https://maps.cookcountyil.gov/cookviewer/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 group rounded-lg p-2.5 -mx-2.5 transition-colors"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(52, 211, 153, 0.06)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <div
                    className="p-1.5 rounded-md"
                    style={{
                      backgroundColor: 'rgba(52, 211, 153, 0.08)',
                      border: '1px solid var(--border-glass)',
                    }}
                  >
                    <span className="text-xs">🗺️</span>
                  </div>
                  <div>
                    <p
                      className="text-[11px] font-semibold leading-tight"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Cook County GIS
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Zoning & property classification
                    </p>
                  </div>
                </a>
              </div>
              <p
                className="mt-6 text-[10px] leading-relaxed italic"
                style={{ color: 'var(--text-muted)' }}
              >
                Note: This tool provides impact analysis based on public records. Always verify
                details with the Department of Buildings for official use.
              </p>
            </div>
          </aside>
        )}
      </div>

      {showPayment && search && (
        <PaymentModal
          address={search.address}
          lat={search.lat}
          lon={search.lon}
          onClose={() => setShowPayment(false)}
        />
      )}
    </main>
  )
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  )
}

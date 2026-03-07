'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
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

  // Check for existing session cookie or URL params
  useEffect(() => {
    // Cookie check
    const cookies = document.cookie.split('; ')
    const sessionCookie = cookies.find(row => row.startsWith('ds_session='))
    if (sessionCookie) {
      const val = sessionCookie.split('=')[1]
      setToken(val)
    }

    // URL Param check (persists search across reloads)
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
  }, [searchParams])

  // Handle return from Stripe checkout
  useEffect(() => {
    const sessionId = searchParams.get('session_id')

    if (sessionId) {
      fetch(`/api/token?session_id=${sessionId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.token) {
            setToken(data.token)
          }
        })
        .catch(console.error)
    }
  }, [searchParams])

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
    <main className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="px-4 py-4 bg-white border-b border-gray-100 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl font-bold text-gray-900">🏗️ CivicScout</span>
            <span className="text-xs text-gray-400 ml-1">Chicago</span>
          </div>
          <SearchForm onSearch={handleSearch} isLoading={loading} />
        </div>
      </header>

      {/* Map + Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Map */}
        <div className="flex-1 min-h-[50vh] lg:min-h-0 relative">
          <Map permits={permits} center={mapCenter} />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-20">
              <span className="text-sm text-gray-600 animate-pulse">Fetching permit data…</span>
            </div>
          )}
        </div>

        {/* Sidebar */}
        {(search || permits.length > 0) && (
          <aside className="w-full lg:w-80 xl:w-96 bg-white border-t lg:border-t-0 lg:border-l border-gray-100 overflow-y-auto p-4">
            {search && (
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Developments within 2 miles</h2>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{search.address}</p>
                {dataSource === 'mock' && (
                  <p className="text-[10px] text-blue-600 mt-1 font-medium">✨ Showing Simulated Data</p>
                )}
                {dataSource === 'stale' && (
                  <p className="text-xs text-yellow-600 mt-1">⚠ Showing cached data (live data unavailable)</p>
                )}
              </div>
            )}
            <PermitList permits={permits} />

            {/* Data Attribution Footer */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Data Sources & Verification</h3>
              <div className="space-y-3">
                <a 
                  href="https://data.cityofchicago.org/Buildings/Building-Permits/ydr8-5enu" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 group"
                >
                  <div className="p-1.5 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <span className="text-xs">🏙️</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-700 leading-tight">City of Chicago Open Data</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Real-time building permit records</p>
                  </div>
                </a>
                <a 
                  href="https://maps.cookcountyil.gov/cookviewer/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 group"
                >
                  <div className="p-1.5 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                    <span className="text-xs">🗺️</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-700 leading-tight">Cook County GIS</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Zoning & property classification</p>
                  </div>
                </a>
              </div>
              <p className="mt-4 text-[10px] text-gray-400 leading-relaxed italic">
                Note: This tool provides impact analysis based on public records. Always verify details with the Department of Buildings for official use.
              </p>
            </div>
          </aside>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-xl shadow-md px-3 py-2 text-xs flex gap-3 z-10">
        {[['red', 'High Impact'], ['yellow', 'Medium'], ['green', 'Standard']].map(([color, label]) => (
          <span key={color} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color === 'red' ? '#ef4444' : color === 'yellow' ? '#f59e0b' : '#22c55e' }} />
            {label}
          </span>
        ))}
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

'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import dynamic from 'next/dynamic'

import { useSearchParams, useRouter } from 'next/navigation'
import SearchForm from '@/components/SearchForm'
import PermitList from '@/components/PermitList'
import SeverityFilter from '@/components/SeverityFilter'
import LandingHero from '@/components/LandingHero'
import PaymentModal from '@/components/PaymentModal'
import PermitDetailModal from '@/components/PermitDetailModal'
import LayerToggle from '@/components/LayerToggle'
import DataLayerList from '@/components/DataLayerList'
import DataLayerDetailModal from '@/components/DataLayerDetailModal'
import SidebarTabs from '@/components/SidebarTabs'
import type { SidebarTab } from '@/components/SidebarTabs'
import headerStyles from '@/components/AppHeader.module.css'
import { Building2, BarChart3 } from 'lucide-react'
import type { CityInfo } from '@/components/CityGrid'
import type { ClassifiedPermit } from '@/lib/permit-classifier'
import type { SeverityFilterValue } from '@/lib/permit-classifier'
import type { DataLayerItem, DataLayerType, CrimeIncident, BuildingViolation, TrafficCrash, ServiceRequest } from '@/lib/data-layers'
import type { ZoningFeatureCollection } from '@/lib/zoning'

// Leaflet requires browser APIs — load client-side only
const Map = dynamic(() => import('@/components/Map'), { ssr: false })

interface SearchState {
  address: string
  lat: number
  lon: number
}

// ── Unsupported Area Card ─────────────────────────────────────────────────
// NOTE(Agent): Extracted as a file-local component to keep HomeContent smaller.
// Computes nearby supported cities via haversine, shows clickable links, and
// includes an inline city request form.

interface UnsupportedAreaCardProps {
  searchLat: number
  searchLon: number
  supportedCities: CityInfo[]
  onSearch: (s: { address: string; lat: number; lon: number }) => void
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959 // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function UnsupportedAreaCard({ searchLat, searchLon, supportedCities, onSearch }: UnsupportedAreaCardProps) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Compute nearest supported cities with distance
  const nearbyCities = useMemo(() => {
    if (supportedCities.length === 0) return []

    // Deduplicate by city+state
    const seen = new Set<string>()
    const unique = supportedCities.filter((c) => {
      const key = `${c.city}-${c.state}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return unique
      .filter((c) => c.center !== null)
      .map((c) => ({
        ...c,
        distance: haversineDistance(searchLat, searchLon, c.center!.lat, c.center!.lon),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
  }, [supportedCities, searchLat, searchLon])

  async function handleRequest() {
    setSubmitting(true)
    try {
      await fetch('/api/city-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: searchLat, lon: searchLon, email: email || null }),
      })
      setSubmitted(true)
    } catch {
      // Best-effort
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="mt-3 p-4 rounded-lg text-center"
      style={{
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
      }}
    >
      <p
        className="text-[12px] font-semibold"
        style={{ color: 'var(--status-yellow)', marginBottom: '6px' }}
      >
        No permit data available for this area yet
      </p>

      {/* Nearby city suggestions */}
      {nearbyCities.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <p
            className="text-[10px]"
            style={{ color: 'var(--text-muted)', marginBottom: '6px' }}
          >
            Try a nearby supported city:
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {nearbyCities.map((c) => (
              <button
                key={`${c.city}-${c.state}`}
                type="button"
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all"
                style={{
                  backgroundColor: 'var(--accent-glow)',
                  color: 'var(--accent-text)',
                  border: '1px solid rgba(10, 158, 142, 0.15)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent-glow-strong)'
                  e.currentTarget.style.borderColor = 'var(--accent-primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent-glow)'
                  e.currentTarget.style.borderColor = 'rgba(10, 158, 142, 0.15)'
                }}
                onClick={() => {
                  if (c.center) {
                    onSearch({
                      address: `${c.city}, ${c.state ?? ''}`.trim(),
                      lat: c.center.lat,
                      lon: c.center.lon,
                    })
                  }
                }}
              >
                {c.city}{c.state ? `, ${c.state}` : ''}{' '}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                  ({Math.round(c.distance)} mi)
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Request this city */}
      {!submitted ? (
        <div>
          <p
            className="text-[10px] font-medium"
            style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}
          >
            Want CivicScout here?
          </p>
          <div className="flex items-center justify-center gap-2">
            <input
              type="email"
              className="text-[11px] px-3 py-1.5 rounded-lg outline-none"
              placeholder="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email for city request notification"
              style={{
                backgroundColor: 'var(--background-card)',
                border: '1px solid var(--border-strong)',
                color: 'var(--text-primary)',
                width: '160px',
              }}
            />
            <button
              type="button"
              className="text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
              }}
              onClick={handleRequest}
              disabled={submitting}
            >
              {submitting ? '…' : 'Request'}
            </button>
          </div>
        </div>
      ) : (
        <p
          className="text-[10px] font-medium"
          style={{ color: 'var(--status-green)', marginBottom: 0 }}
        >
          ✓ We&rsquo;ll notify you when we expand here!
        </p>
      )}
    </div>
  )
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
  const [cityName, setCityName] = useState<string>('')
  const [unsupportedArea, setUnsupportedArea] = useState(false)

  // NOTE(Agent): Supported cities list — fetched once on mount from /api/cities.
  // Powers the landing page CityGrid and unsupported-area nearby city suggestions.
  const [supportedCities, setSupportedCities] = useState<CityInfo[]>([])
  const [minSeverity, setMinSeverity] = useState<SeverityFilterValue>('all')
  const [selectedMapPermit, setSelectedMapPermit] = useState<ClassifiedPermit | null>(null)
  const [selectedPermitId, setSelectedPermitId] = useState<string | null>(null)
  // NOTE(Agent): Controls map-only visibility of permit markers. Sidebar
  // PermitList always shows permits regardless (Option A from design doc).
  const [permitsVisible, setPermitsVisible] = useState(true)

  // ── Data Layer State ──────────────────────────────────────────────────
  const [enabledLayers, setEnabledLayers] = useState<Set<DataLayerType>>(new Set())
  const [layerData, setLayerData] = useState<{
    crimes: CrimeIncident[]
    violations: BuildingViolation[]
    crashes: TrafficCrash[]
    service_requests: ServiceRequest[]
  }>({ crimes: [], violations: [], crashes: [], service_requests: [] })
  const [layerLoading, setLayerLoading] = useState<Record<DataLayerType, boolean>>({
    crimes: false, violations: false, crashes: false, service_requests: false,
  })
  const [selectedLayerItem, setSelectedLayerItem] = useState<DataLayerItem | null>(null)
  const [selectedLayerItemId, setSelectedLayerItemId] = useState<string | null>(null)
  const [minLayerSeverity, setMinLayerSeverity] = useState<SeverityFilterValue>('all')
  // NOTE(Agent): Per-layer source metadata from the API response. Used to pass
  // dynamic sourceUrl/sourceLabel to DataLayerDetailModal instead of hardcoded Chicago values.
  const [layerSourceMeta, setLayerSourceMeta] = useState<Record<string, { sourceUrl?: string | null; sourceLabel?: string | null }>>({})

  // ── Zoning State ──────────────────────────────────────────────────────
  const [zoningVisible, setZoningVisible] = useState(false)
  const [zoningData, setZoningData] = useState<ZoningFeatureCollection | null>(null)
  const [zoningLoading, setZoningLoading] = useState(false)

  // NOTE(Agent): Severity order used for filtering — 'all' shows everything,
  // 'green' shows low+med+high, 'yellow' shows med+high, 'red' shows only high.
  const SEVERITY_ORDER: Record<SeverityFilterValue, number> = useMemo(() => ({
    all: -1,
    green: 0,
    yellow: 1,
    red: 2,
  }), [])

  const filteredPermits = useMemo(() => {
    const threshold = SEVERITY_ORDER[minSeverity]
    return permits.filter((p) => SEVERITY_ORDER[p.severity] >= threshold)
  }, [permits, minSeverity, SEVERITY_ORDER])

  // NOTE(Agent): Clear stale permit selection when the selected item is
  // filtered out by severity change. Without this, toggling back to "All"
  // resurrects a phantom selection — confusing UX.
  useEffect(() => {
    if (selectedPermitId && !filteredPermits.some((p) => p.id === selectedPermitId)) {
      setSelectedPermitId(null)
    }
  }, [filteredPermits, selectedPermitId])

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

    // Fetch supported cities for landing page + unsupported area state
    fetch('/api/cities')
      .then((r) => r.json())
      .then((data) => {
        if (data.cities) setSupportedCities(data.cities as CityInfo[])
      })
      .catch(() => { /* best-effort */ })
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
      setUnsupportedArea(false)
      try {
        const res = await fetch(`/api/permits?lat=${lat}&lon=${lon}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (res.status === 401) {
          setShowPayment(true)
          setPermits([])
          return
        }

        if (res.status === 422) {
          // No registry entry for this location
          setUnsupportedArea(true)
          setPermits([])
          setCityName('')
          return
        }

        const data = await res.json()
        if (data.error) {
          console.error('API Error:', data.error)
          setPermits([])
        } else {
          setPermits(data.permits ?? [])
          setDataSource(data.source ?? '')
          setCityName(data.city ?? '')
          setShowPayment(false)
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


  // ── Data Layer Fetching ───────────────────────────────────────────────
  // NOTE(Agent): Lazy-fetch — only fetches when a layer is enabled AND we
  // have an active search + token. Layers are fetched independently.
  const fetchDataLayers = useCallback(
    async (lat: number, lon: number, accessToken: string, layers: DataLayerType[]) => {
      if (layers.length === 0) return

      // Set loading for requested layers
      setLayerLoading((prev) => {
        const next = { ...prev }
        for (const l of layers) next[l] = true
        return next
      })

      try {
        const res = await fetch(
          `/api/data-layers?lat=${lat}&lon=${lon}&layers=${layers.join(',')}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        if (!res.ok) {
          console.error('[data-layers] API error:', res.status)
          return
        }

        const data = await res.json() as Record<string, { data: DataLayerItem[]; sourceUrl?: string | null; sourceLabel?: string | null }>

        setLayerData((prev) => {
          const next = { ...prev }
          if (data.crimes) next.crimes = data.crimes.data as CrimeIncident[]
          if (data.violations) next.violations = data.violations.data as BuildingViolation[]
          if (data.crashes) next.crashes = data.crashes.data as TrafficCrash[]
          if (data.service_requests) next.service_requests = data.service_requests.data as ServiceRequest[]
          return next
        })

        // Store per-layer source metadata for DataLayerDetailModal
        setLayerSourceMeta((prev) => {
          const next = { ...prev }
          for (const [layer, info] of Object.entries(data)) {
            if (info.sourceUrl || info.sourceLabel) {
              next[layer] = { sourceUrl: info.sourceUrl, sourceLabel: info.sourceLabel }
            }
          }
          return next
        })
      } catch (err) {
        console.error('[data-layers] Fetch failed:', err)
      } finally {
        setLayerLoading((prev) => {
          const next = { ...prev }
          for (const l of layers) next[l] = false
          return next
        })
      }
    },
    []
  )

  // NOTE(Agent): Re-fetch all currently-enabled data layers when the search
  // location changes. Without this, toggling layers on for Location A and then
  // searching for Location B would leave Location A's data on the map.
  // enabledLayers intentionally excluded — handleLayerToggle handles toggle events.
  useEffect(() => {
    if (search && token && enabledLayers.size > 0) {
      fetchDataLayers(search.lat, search.lon, token, [...enabledLayers])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, token, fetchDataLayers])

  // NOTE(Agent): Re-fetch zoning data when search location changes while the
  // zoning overlay is visible. Similar to the data layer re-fetch above.
  useEffect(() => {
    if (search && token && zoningVisible) {
      setZoningLoading(true)
      setZoningData(null)
      fetch(`/api/zoning?lat=${search.lat}&lon=${search.lon}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data: ZoningFeatureCollection) => {
          setZoningData(data)
        })
        .catch((err) => console.error('[zoning] Fetch failed:', err))
        .finally(() => setZoningLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, token])


  // Trigger layer fetch when layers are toggled on
  const handleLayerToggle = useCallback(
    (layer: DataLayerType) => {
      setEnabledLayers((prev) => {
        const next = new Set(prev)
        if (next.has(layer)) {
          next.delete(layer)
          // Clear data for disabled layer
          setLayerData((d) => ({ ...d, [layer]: [] }))
        } else {
          next.add(layer)
          // Fetch if we have an active search
          if (search && token) {
            fetchDataLayers(search.lat, search.lon, token, [layer])
          }
        }
        return next
      })
    },
    [search, token, fetchDataLayers]
  )

  // Merge enabled layer items for the map
  const dataLayerItems: DataLayerItem[] = useMemo(() => {
    const items: DataLayerItem[] = []
    if (enabledLayers.has('crimes')) items.push(...layerData.crimes)
    if (enabledLayers.has('violations')) items.push(...layerData.violations)
    if (enabledLayers.has('crashes')) items.push(...layerData.crashes)
    if (enabledLayers.has('service_requests')) items.push(...layerData.service_requests)
    return items
  }, [enabledLayers, layerData])

  // NOTE(Agent): Severity filtering for data layers, independent from permit
  // severity. Uses the same SEVERITY_ORDER threshold logic.
  const filteredDataLayerItems = useMemo(() => {
    const threshold = SEVERITY_ORDER[minLayerSeverity]
    return dataLayerItems.filter((item) => SEVERITY_ORDER[item.severity] >= threshold)
  }, [dataLayerItems, minLayerSeverity, SEVERITY_ORDER])

  // NOTE(Agent): Clear stale data layer selection when the selected item is
  // filtered out by severity change — mirrors the permit selection guard above.
  useEffect(() => {
    if (selectedLayerItemId && !filteredDataLayerItems.some((i) => i.id === selectedLayerItemId)) {
      setSelectedLayerItemId(null)
    }
  }, [filteredDataLayerItems, selectedLayerItemId])

  // Layer counts for the toggle panel
  const layerCounts: Partial<Record<DataLayerType, number>> = useMemo(() => {
    const counts: Partial<Record<DataLayerType, number>> = {}
    if (enabledLayers.has('crimes')) counts.crimes = layerData.crimes.length
    if (enabledLayers.has('violations')) counts.violations = layerData.violations.length
    if (enabledLayers.has('crashes')) counts.crashes = layerData.crashes.length
    if (enabledLayers.has('service_requests')) counts.service_requests = layerData.service_requests.length
    return counts
  }, [enabledLayers, layerData])

  function handleSearch(s: { address: string; lat: number; lon: number }) {
    setSearch(s)
    setPermits([])
    // NOTE(Agent): Clear all stale state from the previous location so the UI
    // doesn't flash old markers, modals, or sidebar highlights while the new
    // data loads. Data layers are re-fetched by the useEffect below.
    setLayerData({ crimes: [], violations: [], crashes: [], service_requests: [] })
    setSelectedPermitId(null)
    setSelectedMapPermit(null)
    setSelectedLayerItemId(null)
    setSelectedLayerItem(null)
    // NOTE(Agent): Clear zoning data so the old polygons don't persist
    // on the map while the new location loads.
    setZoningData(null)

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

  // NOTE(Agent): Show the full-viewport landing hero when no search is active.
  // Once a search is performed (or URL params load one), we switch to the map layout.
  if (!search) {
    return (
      <main style={{ backgroundColor: 'var(--background-primary)' }}>
        <LandingHero onSearch={handleSearch} isLoading={loading} cities={supportedCities} />
        {showPayment && (
          <PaymentModal
            address=""
            lat={0}
            lon={0}
            onClose={() => setShowPayment(false)}
          />
        )}
      </main>
    )
  }

  return (
    <main className="flex flex-col h-screen" style={{ backgroundColor: 'var(--background-primary)' }}>
      {/* NOTE(Agent): sr-only h1 ensures search crawlers always find a primary heading
          in the map view state, where LandingHero (which contains the visible h1) is unmounted.
          This is critical for SEO — without it the map-view render has zero h1 tags. */}
      <h1 className="sr-only">Building Permits Near {search?.address ?? 'Your Location'} — CivicScout</h1>
      {/* Header — Dark navy persistent brand bar (matches landing hero identity) */}
      <header className={headerStyles.header}>
        <div className={headerStyles.accentLine} aria-hidden="true" />
        <div className={headerStyles.topoClip} aria-hidden="true">
          <div className={headerStyles.topoTexture} />
        </div>
        <div className={headerStyles.bottomBorder} aria-hidden="true" />
        <div className={headerStyles.inner}>
          {/* NOTE(Agent): Using a button instead of <Link> because a client-side
              navigation to "/" alone doesn't reset React state (search, permits,
              layers, etc.), so the landing hero never re-appears. We must
              explicitly clear state to trigger the `if (!search)` branch. */}
          <button
            type="button"
            className={headerStyles.brand}
            onClick={() => {
              setSearch(null)
              setPermits([])
              setUnsupportedArea(false)
              setEnabledLayers(new Set())
              setLayerData({ crimes: [], violations: [], crashes: [], service_requests: [] })
              setSelectedPermitId(null)
              setSelectedMapPermit(null)
              setSelectedLayerItemId(null)
              setSelectedLayerItem(null)
              setZoningData(null)
              setZoningVisible(false)
              setMinSeverity('all')
              setMinLayerSeverity('all')
              router.push('/', { scroll: false })
            }}
          >
            <span className={headerStyles.brandName}>
              Civic<span className={headerStyles.brandAccent}>Scout</span>
            </span>
            <span className={headerStyles.badge}>
              {cityName || 'Chicagoland'}
            </span>
          </button>
          <div className={headerStyles.search}>
            <SearchForm onSearch={handleSearch} isLoading={loading} initialValue={search.address} variant="dark" />
          </div>
        </div>
      </header>

      {/* Map + Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Map */}
        <div className="flex-1 min-h-[50vh] lg:min-h-0 relative">
          {/* NOTE(Agent): Blur wrapper applies only to the Map, not overlay controls
              (LayerToggle, loading bar). pointer-events:none prevents interaction
              with blurred markers during load. */}
          <div
            style={{
              width: '100%',
              height: '100%',
              filter: loading ? 'blur(3px)' : 'blur(0px)',
              opacity: loading ? 0.7 : 1,
              transition: 'filter 0.4s ease, opacity 0.4s ease',
              pointerEvents: loading ? 'none' : 'auto',
            }}
          >
            <Map
              permits={permitsVisible ? filteredPermits : []}
              center={mapCenter}
              onPermitSelect={setSelectedMapPermit}
              selectedPermitId={selectedPermitId}
              onPermitDeselect={() => setSelectedPermitId(null)}
              dataLayerItems={filteredDataLayerItems}
              onDataLayerSelect={setSelectedLayerItem}
              selectedDataLayerItemId={selectedLayerItemId}
              onDataLayerDeselect={() => setSelectedLayerItemId(null)}
              zoningGeoJSON={zoningVisible ? zoningData : null}
            />
          </div>
          {/* Layer Toggle Panel — floating on the map */}
          {search && (
            <LayerToggle
              enabledLayers={enabledLayers}
              onToggle={handleLayerToggle}
              counts={layerCounts}
              loading={layerLoading}
              permitsVisible={permitsVisible}
              onPermitsToggle={() => setPermitsVisible((prev) => !prev)}
              permitsCount={filteredPermits.length}
              permitsLoading={loading}
              zoningVisible={zoningVisible}
              onZoningToggle={() => {
                setZoningVisible((prev) => {
                  const next = !prev
                  if (next && !zoningData && search && token) {
                    // Fetch zoning data on first toggle-on
                    setZoningLoading(true)
                    fetch(`/api/zoning?lat=${search.lat}&lon=${search.lon}`, {
                      headers: { Authorization: `Bearer ${token}` },
                    })
                      .then((r) => r.json())
                      .then((data: ZoningFeatureCollection) => {
                        setZoningData(data)
                      })
                      .catch((err) => console.error('[zoning] Fetch failed:', err))
                      .finally(() => setZoningLoading(false))
                  }
                  return next
                })
              }}
              zoningLoading={zoningLoading}
            />
          )}
          {loading && (
            <div
              className="absolute top-0 left-0 right-0 z-20 overflow-hidden"
              aria-live="polite"
              aria-label="Loading permits"
              style={{ height: '3px', backgroundColor: 'rgba(10, 158, 142, 0.1)' }}
            >
              <div
                style={{
                  width: '25%',
                  height: '100%',
                  backgroundColor: 'var(--accent-primary)',
                  borderRadius: '0 2px 2px 0',
                  animation: 'indeterminate 1.4s ease-in-out infinite',
                }}
              />
            </div>
          )}
        </div>

        {/* Sidebar — Dark glass surface */}
        {(search || permits.length > 0) && (
          <aside
            className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l overflow-y-auto p-6"
            style={{
              borderColor: 'var(--border-strong)',
              backgroundColor: 'var(--background-primary)',
              borderLeft: '2px solid rgba(10, 158, 142, 0.15)',
            }}
          >
            {search && (
              <div
                className="mb-4 pb-4 border-b"
                style={{ borderBottomColor: 'var(--border-glass)' }}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span
                    className="text-[9px] font-semibold uppercase tracking-[0.2em] flex items-center gap-1.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                      aria-hidden="true"
                    />
                    Searching near
                  </span>
                  {filteredPermits.length > 0 && (
                    <span
                      className="text-[9px] font-semibold uppercase tracking-[0.15em]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {filteredPermits.length} results
                    </span>
                  )}
                </div>
                <p
                  className="truncate leading-snug"
                  style={{
                    color: 'var(--text-primary)',
                    marginBottom: 0,
                    fontFamily: 'var(--font-inter), system-ui, sans-serif',
                    fontSize: '1rem',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                  }}
                  title={search.address}
                >
                  {search.address}
                </p>
                {dataSource === 'stale' && (
                  <p
                    className="text-[10px] font-semibold mt-1.5 flex items-center gap-1.5"
                    style={{ color: 'var(--status-yellow)', marginBottom: 0 }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ backgroundColor: 'var(--status-yellow)' }}
                    />
                    Showing cached data (live data unavailable)
                  </p>
                )}
                {unsupportedArea && (
                  <UnsupportedAreaCard
                    searchLat={search.lat}
                    searchLon={search.lon}
                    supportedCities={supportedCities}
                    onSearch={handleSearch}
                  />
                )}
              </div>
            )}

            {/* NOTE(Agent): SidebarTabs replaces the previous linear stack of
               SeverityFilter → PermitList → Neighborhood Activity. This solves
               the scroll-depth problem where Activity was buried ~40k px down.
               Tabs are defined inline so they pick up the latest state from
               closure without extra prop-passing. */}
            <SidebarTabs
              tabs={[
                {
                  id: 'permits',
                  label: 'Permits',
                  icon: Building2,
                  badge: filteredPermits.length,
                  content: (
                    <>
                      {permits.length > 0 && (
                        <SeverityFilter
                          value={minSeverity}
                          onChange={setMinSeverity}
                          counts={{
                            green: permits.filter((p) => p.severity === 'green').length,
                            yellow: permits.filter((p) => p.severity === 'yellow').length,
                            red: permits.filter((p) => p.severity === 'red').length,
                          }}
                        />
                      )}
                      <PermitList
                        permits={filteredPermits}
                        selectedPermitId={selectedPermitId}
                        onPermitClick={(permit) => {
                          // NOTE(Agent): Toggle behaviour — clicking the same card
                          // again deselects it. Map handles flyTo/popup via prop.
                          // Also clears data layer selection for mutual exclusion.
                          // Auto-enables permits on the map if hidden, so the
                          // flyTo/popup interaction always works.
                          if (!permitsVisible) setPermitsVisible(true)
                          setSelectedPermitId((prev) =>
                            prev === permit.id ? null : permit.id
                          )
                          setSelectedLayerItemId(null)
                        }}
                        onViewDetails={(permit) => setSelectedMapPermit(permit)}
                      />
                    </>
                  ),
                },
                {
                  id: 'activity',
                  label: 'Activity',
                  icon: BarChart3,
                  badge: filteredDataLayerItems.length > 0 ? filteredDataLayerItems.length : undefined,
                  content: enabledLayers.size > 0 ? (
                    <>
                      <SeverityFilter
                        label="Severity Filter"
                        value={minLayerSeverity}
                        onChange={setMinLayerSeverity}
                        counts={{
                          green: dataLayerItems.filter((i) => i.severity === 'green').length,
                          yellow: dataLayerItems.filter((i) => i.severity === 'yellow').length,
                          red: dataLayerItems.filter((i) => i.severity === 'red').length,
                        }}
                      />
                      <DataLayerList
                        items={filteredDataLayerItems}
                        enabledLayers={enabledLayers}
                        selectedItemId={selectedLayerItemId}
                        onItemClick={(item) => {
                          // NOTE(Agent): Toggle behaviour — same as permits.
                          // Also clears permit selection for mutual exclusion.
                          setSelectedLayerItemId((prev) =>
                            prev === item.id ? null : item.id
                          )
                          setSelectedPermitId(null)
                        }}
                        onViewDetails={(item) => setSelectedLayerItem(item)}
                      />
                    </>
                  ) : (
                    <div
                      className="text-center py-12 px-6 rounded-xl border border-dashed"
                      style={{ borderColor: 'var(--border-strong)' }}
                    >
                      <span className="text-2xl block mb-3" style={{ opacity: 0.7 }}>📊</span>
                      <p
                        className="text-xs font-semibold mb-1"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        No activity layers enabled
                      </p>
                      <p
                        className="text-[10px] leading-relaxed"
                        style={{ color: 'var(--text-muted)', marginBottom: 0 }}
                      >
                        Toggle on Crime, Violations, or Crashes via the
                        <strong> Layers</strong> button on the map to see
                        neighborhood activity here.
                      </p>
                    </div>
                  ),
                },
              ] satisfies SidebarTab[]}
              defaultTab="permits"
            />

            {/* Data Attribution Footer */}
            <div className="mt-12 pt-8 border-t" style={{ borderTopColor: 'var(--border-strong)' }}>
              <h2
                className="text-[9px] font-semibold uppercase tracking-[0.25em] mb-4"
                style={{ color: 'var(--text-muted)' }}
              >
                Data Verification
              </h2>
              <div className="space-y-3">
                <a
                  href={
                    // NOTE(Agent): Derive from first permit's source_url, fall back to Chicago default.
                    permits[0]?.source_url
                    || (cityName === 'Chicago'
                      ? 'https://data.cityofchicago.org/Buildings/Building-Permits/ydr8-5enu'
                      : undefined)
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 group rounded-lg p-2.5 -mx-2.5 transition-colors"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(10, 158, 142, 0.06)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <div
                    className="p-1.5 rounded-md"
                    style={{
                      backgroundColor: 'rgba(10, 158, 142, 0.06)',
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
                      {cityName ? `${cityName} Open Data` : 'Municipal Open Data'}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Real-time building permit records
                    </p>
                  </div>
                </a>
                {cityName === 'Chicago' && (
                  <a
                    href="https://maps.cookcountyil.gov/cookviewer/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 group rounded-lg p-2.5 -mx-2.5 transition-colors"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(27, 155, 108, 0.06)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <div
                      className="p-1.5 rounded-md"
                      style={{
                        backgroundColor: 'rgba(27, 155, 108, 0.06)',
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
                )}
              </div>
              <p
                className="mt-6 text-[10px] leading-relaxed italic"
                style={{ color: 'var(--text-muted)' }}
              >
                Note: This tool provides impact analysis based on public records. Always verify
                details with your local building department for official use.
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

      {selectedMapPermit && (
        <PermitDetailModal
          permit={selectedMapPermit}
          cityName={cityName}
          onClose={() => setSelectedMapPermit(null)}
        />
      )}

      {selectedLayerItem && (
        <DataLayerDetailModal
          item={selectedLayerItem}
          onClose={() => setSelectedLayerItem(null)}
          sourceUrl={layerSourceMeta[selectedLayerItem.layerType]?.sourceUrl}
          sourceLabel={layerSourceMeta[selectedLayerItem.layerType]?.sourceLabel}
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

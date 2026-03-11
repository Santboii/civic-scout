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
import { Building2, BarChart3 } from 'lucide-react'
import type { ClassifiedPermit } from '@/lib/permit-classifier'
import type { PermitSeverity } from '@/lib/permit-classifier'
import type { DataLayerItem, DataLayerType, CrimeIncident, BuildingViolation, TrafficCrash } from '@/lib/data-layers'

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
  const [cityName, setCityName] = useState<string>('')
  const [unsupportedArea, setUnsupportedArea] = useState(false)
  const [minSeverity, setMinSeverity] = useState<PermitSeverity>('green')
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
  }>({ crimes: [], violations: [], crashes: [] })
  const [layerLoading, setLayerLoading] = useState<Record<DataLayerType, boolean>>({
    crimes: false, violations: false, crashes: false,
  })
  const [selectedLayerItem, setSelectedLayerItem] = useState<DataLayerItem | null>(null)
  const [selectedLayerItemId, setSelectedLayerItemId] = useState<string | null>(null)
  const [minLayerSeverity, setMinLayerSeverity] = useState<PermitSeverity>('green')

  // NOTE(Agent): Severity order used for filtering — 'green' shows all,
  // 'yellow' shows yellow+red, 'red' shows only red.
  const SEVERITY_ORDER: Record<PermitSeverity, number> = useMemo(() => ({
    green: 0,
    yellow: 1,
    red: 2,
  }), [])

  const filteredPermits = useMemo(() => {
    const threshold = SEVERITY_ORDER[minSeverity]
    return permits.filter((p) => SEVERITY_ORDER[p.severity] >= threshold)
  }, [permits, minSeverity, SEVERITY_ORDER])

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

        const data = await res.json() as Record<string, { data: DataLayerItem[] }>

        setLayerData((prev) => {
          const next = { ...prev }
          if (data.crimes) next.crimes = data.crimes.data as CrimeIncident[]
          if (data.violations) next.violations = data.violations.data as BuildingViolation[]
          if (data.crashes) next.crashes = data.crashes.data as TrafficCrash[]
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
    return items
  }, [enabledLayers, layerData])

  // NOTE(Agent): Severity filtering for data layers, independent from permit
  // severity. Uses the same SEVERITY_ORDER threshold logic.
  const filteredDataLayerItems = useMemo(() => {
    const threshold = SEVERITY_ORDER[minLayerSeverity]
    return dataLayerItems.filter((item) => SEVERITY_ORDER[item.severity] >= threshold)
  }, [dataLayerItems, minLayerSeverity, SEVERITY_ORDER])

  // Layer counts for the toggle panel
  const layerCounts: Partial<Record<DataLayerType, number>> = useMemo(() => {
    const counts: Partial<Record<DataLayerType, number>> = {}
    if (enabledLayers.has('crimes')) counts.crimes = layerData.crimes.length
    if (enabledLayers.has('violations')) counts.violations = layerData.violations.length
    if (enabledLayers.has('crashes')) counts.crashes = layerData.crashes.length
    return counts
  }, [enabledLayers, layerData])

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

  // NOTE(Agent): Show the full-viewport landing hero when no search is active.
  // Once a search is performed (or URL params load one), we switch to the map layout.
  if (!search) {
    return (
      <main style={{ backgroundColor: 'var(--background-primary)' }}>
        <LandingHero onSearch={handleSearch} isLoading={loading} />
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
                border: '1px solid rgba(10, 158, 142, 0.15)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {cityName || 'Nationwide'}
            </span>
          </div>
          <div className="flex-1 max-w-xl">
            <SearchForm onSearch={handleSearch} isLoading={loading} initialValue={search.address} />
          </div>
        </div>
      </header>

      {/* Map + Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Map */}
        <div className="flex-1 min-h-[50vh] lg:min-h-0 relative">
          <Map
            permits={permitsVisible ? filteredPermits : []}
            center={mapCenter}
            onPermitSelect={setSelectedMapPermit}
            selectedPermitId={selectedPermitId}
            onPermitDeselect={() => setSelectedPermitId(null)}
            dataLayerItems={dataLayerItems}
            onDataLayerSelect={setSelectedLayerItem}
            selectedDataLayerItemId={selectedLayerItemId}
            onDataLayerDeselect={() => setSelectedLayerItemId(null)}
          />
          {/* Layer Toggle Panel — floating on the map */}
          {search && (
            <LayerToggle
              enabledLayers={enabledLayers}
              onToggle={handleLayerToggle}
              counts={layerCounts}
              loading={layerLoading}
              permitsVisible={permitsVisible}
              onPermitsToggle={() => setPermitsVisible((prev) => !prev)}
              permitsCount={permits.length}
              permitsLoading={loading}
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
            className="glass w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l overflow-y-auto p-6"
            style={{
              borderColor: 'var(--border-strong)',
            }}
          >
            {search && (
              <div
                className="mb-4 pb-4 border-b"
                style={{ borderBottomColor: 'var(--border-glass)' }}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span
                    className="text-[9px] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Searching near
                  </span>
                  {permits.length > 0 && (
                    <span
                      className="text-[9px] font-semibold uppercase tracking-[0.15em]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {permits.length} results
                    </span>
                  )}
                </div>
                <p
                  className="text-[13px] font-medium truncate leading-snug"
                  style={{ color: 'var(--text-primary)', marginBottom: 0 }}
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
                  <div
                    className="mt-3 p-3 rounded-lg text-center"
                    style={{
                      backgroundColor: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                    }}
                  >
                    <p
                      className="text-[12px] font-semibold"
                      style={{ color: 'var(--status-yellow)', marginBottom: '4px' }}
                    >
                      No permit data available for this area yet
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: 'var(--text-muted)', marginBottom: 0 }}
                    >
                      CivicScout is expanding to new cities. Check back soon!
                    </p>
                  </div>
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
                  href={cityName === 'Chicago'
                    ? 'https://data.cityofchicago.org/Buildings/Building-Permits/ydr8-5enu'
                    : '#'
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

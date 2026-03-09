'use client'

import { useEffect, useRef, useCallback, memo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ClassifiedPermit } from '@/lib/permit-classifier'

interface MapProps {
  permits: ClassifiedPermit[]
  center: [number, number]
  onPermitSelect?: (permit: ClassifiedPermit) => void
  selectedPermitId?: string | null
  onPermitDeselect?: () => void
}

// NOTE(Agent): Hex values required for inline HTML Leaflet markers/popups
// where CSS custom properties cannot be resolved. Updated for light theme.
const SEVERITY_COLORS: Record<string, string> = {
  red: '#D94F3B',
  yellow: '#C99A1D',
  green: '#1B9B6C',
}

const ACCENT_TEAL = '#0A9E8E'
const TEXT_PRIMARY = '#1A1D26'
const TEXT_SECONDARY = '#5C6370'
const TEXT_MUTED = '#9CA3AF'

// NOTE(Agent): Exported as memo'd component to prevent re-renders from unrelated
// parent state (selectedMapPermit, loading, showPayment, etc.).
export default memo(Map)

function Map({ permits, center, onPermitSelect, selectedPermitId, onPermitDeselect }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<globalThis.Map<string, L.Marker>>(new globalThis.Map())
  const circleRef = useRef<L.Circle | null>(null)
  // NOTE(Agent): Track the previously-selected ID so the lightweight selection effect
  // can restore the old marker's icon without rebuilding all markers.
  const prevSelectedIdRef = useRef<string | null>(null)
  // NOTE(Agent): Track whether the popupclose was triggered programmatically
  // (e.g. when opening a different marker's popup) vs. by user interaction.
  // Prevents spurious deselect calls during marker switches.
  const suppressDeselectRef = useRef(false)

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    // NOTE(Agent): Leaflet's _getIconUrl is a private property not in the type defs.
    // We cast through unknown first to satisfy strict TypeScript overlap checking.
    // NOTE(Agent): Self-host Leaflet marker images from /public/leaflet/ to avoid
    // unpkg.com cross-origin latency and reliability risk. Images copied from
    // node_modules/leaflet/dist/images/ during the performance audit (Mar 2026).
    delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)['_getIconUrl']
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '/leaflet/marker-icon-2x.png',
      iconUrl: '/leaflet/marker-icon.png',
      shadowUrl: '/leaflet/marker-shadow.png',
    })

    mapRef.current = L.map(mapContainer.current, {
      center,
      zoom: 13,
      zoomControl: false,
    })

    L.control.zoom({ position: 'topright' }).addTo(mapRef.current)

    // NOTE(Agent): CartoDB Voyager tiles — clean colored map with blue water, green parks. Free, no API key.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(mapRef.current)

    setTimeout(() => { mapRef.current?.invalidateSize() }, 100)
  }, [center])

  // NOTE(Agent): Helper to create a permit marker icon. `isSelected` controls
  // whether the marker gets the enlarged, glowing "selected" treatment.
  const createPermitIcon = useCallback((color: string, isSelected: boolean) => {
    if (isSelected) {
      return L.divIcon({
        className: '',
        html: `<div style="position:relative">
          <div style="position:absolute;inset:-6px;border-radius:50%;background:${color}33;animation:selectedPulse 2s ease-in-out infinite"></div>
          <div style="width:24px;height:24px;border-radius:50%;border:3px solid rgba(255,255,255,0.95);background:${color};box-shadow:0 0 14px ${color}66, 0 2px 8px rgba(0,0,0,0.3);cursor:pointer;transition:all 0.2s"></div>
        </div>
        <style>@keyframes selectedPulse{0%,100%{transform:scale(1);opacity:0.7}50%{transform:scale(1.6);opacity:0}}</style>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
    }
    return L.divIcon({
      className: '',
      html: `<div style="width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,0.9);background:${color};box-shadow:0 1px 6px rgba(0,0,0,0.25);cursor:pointer;transition:transform 0.15s"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    })
  }, [])

  // NOTE(Agent): Marker-build effect — rebuilds ALL markers only when the permits
  // list or center changes. selectedPermitId is intentionally NOT in the dep array
  // here; icon swaps for selection are handled by the lightweight effect below.
  // This prevents the expensive full-rebuild when a sidebar card is clicked.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.setView(center, map.getZoom())
    map.invalidateSize()

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = new globalThis.Map()

    if (circleRef.current) {
      circleRef.current.remove()
    }

    // Center pin — teal with glow
    const centerIcon = L.divIcon({
      className: '',
      html: `
        <div style="position:relative">
          <div style="position:absolute;inset:-5px;border-radius:50%;background:rgba(10,158,142,0.2);animation:pulse 2s ease-in-out infinite"></div>
          <div style="width:18px;height:18px;border-radius:50%;border:2px solid ${ACCENT_TEAL};background:${ACCENT_TEAL};box-shadow:0 0 12px rgba(10,158,142,0.35);display:flex;align-items:center;justify-content:center">
            <div style="width:5px;height:5px;border-radius:50%;background:white"></div>
          </div>
        </div>
        <style>@keyframes pulse{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.8);opacity:0}}</style>
      `,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    })
    const centerMarker = L.marker(center, { icon: centerIcon }).addTo(map)
    markersRef.current.set('__center__', centerMarker)

    // 5-mile radius circle — matches the fetch radius in socrata.ts / arcgis.ts
    circleRef.current = L.circle(center, {
      radius: 8046,
      color: ACCENT_TEAL,
      weight: 1.5,
      dashArray: '4, 8',
      fillColor: ACCENT_TEAL,
      fillOpacity: 0.04,
      interactive: false,
    }).addTo(map)

    // Permit markers — all rendered with unselected icon initially.
    // The selection-style effect below will apply the selected icon.
    permits.forEach((permit) => {
      const color = SEVERITY_COLORS[permit.severity] ?? '#9CA3AF'
      const permitIcon = createPermitIcon(color, false)

      const popupContent = `
        <div style="padding:12px;font-family:system-ui;min-width:200px;color:${TEXT_PRIMARY}">
          <p style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 4px;color:${TEXT_MUTED}">${permit.permit_label}</p>
          <p style="font-weight:700;font-size:14px;margin:0 0 8px;color:${TEXT_PRIMARY}">${permit.address}</p>
          <p style="font-size:12px;line-height:1.5;margin:0 0 10px;color:${TEXT_SECONDARY}">
            ${permit.community_note?.slice(0, 100) ?? ''}${(permit.community_note?.length ?? 0) > 100 ? '…' : ''}
          </p>
          <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(0,0,0,0.06);padding-top:8px">
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:${color}">
              ${permit.severity}
            </span>
            ${permit.reported_cost ? `<span style="font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(200,136,10,0.08);color:#C8880A;border:1px solid rgba(200,136,10,0.15)">$${(permit.reported_cost / 1e6).toFixed(1)}M</span>` : ''}
          </div>
          <button data-permit-id="${permit.id}" style="display:block;width:100%;margin-top:10px;padding:7px 0;border:none;border-radius:6px;background:${ACCENT_TEAL};color:#fff;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:0.02em;transition:opacity 0.15s" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">View Details →</button>
        </div>
      `

      const marker = L.marker([permit.lat, permit.lon], { icon: permitIcon })
        .bindPopup(popupContent, { offset: [0, -5], maxWidth: 300, className: 'modern-map-popup' })
        .addTo(map)

      // NOTE(Agent): Leaflet popups are raw HTML, so we attach a native click listener
      // to the "View Details" button after the popup opens to bridge into React state.
      // { once: true } auto-removes the listener after first invocation, preventing
      // stacked handlers if the same marker popup is opened multiple times.
      marker.on('popupopen', () => {
        const popupEl = marker.getPopup()?.getElement()
        const btn = popupEl?.querySelector(`[data-permit-id="${permit.id}"]`)
        btn?.addEventListener('click', () => {
          onPermitSelect?.(permit)
          marker.closePopup()
        }, { once: true })
      })

      markersRef.current.set(permit.id, marker)
    })

    // NOTE(Agent): Listen for popup close events on the map to clear the
    // selected state in the parent. Suppressed during programmatic popup switches.
    const handlePopupClose = () => {
      if (!suppressDeselectRef.current) {
        onPermitDeselect?.()
      }
    }
    map.on('popupclose', handlePopupClose)

    // After rebuilding, re-apply selected icon if one is currently selected
    if (selectedPermitId) {
      const marker = markersRef.current.get(selectedPermitId)
      if (marker) {
        const permit = permits.find((p) => p.id === selectedPermitId)
        if (permit) {
          const color = SEVERITY_COLORS[permit.severity] ?? '#9CA3AF'
          marker.setIcon(createPermitIcon(color, true))
        }
      }
    }
    prevSelectedIdRef.current = selectedPermitId ?? null

    return () => {
      map.off('popupclose', handlePopupClose)
    }
    // NOTE(Agent): selectedPermitId deliberately excluded — icon selection is
    // handled by the lightweight effect below to avoid full marker rebuilds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permits, center, createPermitIcon, onPermitSelect, onPermitDeselect])

  // NOTE(Agent): Lightweight selection-icon effect — only swaps icons for the
  // previously-selected and newly-selected markers. Does NOT rebuild anything else.
  // This fires when a sidebar card is clicked, keeping INP low.
  useEffect(() => {
    const prevId = prevSelectedIdRef.current

    // Restore old marker to unselected icon
    if (prevId && prevId !== selectedPermitId) {
      const prevMarker = markersRef.current.get(prevId)
      const prevPermit = permits.find((p) => p.id === prevId)
      if (prevMarker && prevPermit) {
        const color = SEVERITY_COLORS[prevPermit.severity] ?? '#9CA3AF'
        prevMarker.setIcon(createPermitIcon(color, false))
      }
    }

    // Apply selected icon to new marker
    if (selectedPermitId) {
      const nextMarker = markersRef.current.get(selectedPermitId)
      const nextPermit = permits.find((p) => p.id === selectedPermitId)
      if (nextMarker && nextPermit) {
        const color = SEVERITY_COLORS[nextPermit.severity] ?? '#9CA3AF'
        nextMarker.setIcon(createPermitIcon(color, true))
      }
    }

    prevSelectedIdRef.current = selectedPermitId ?? null
  }, [selectedPermitId, permits, createPermitIcon])

  // NOTE(Agent): Separate effect to handle flyTo + popup open when a card is selected
  // from the sidebar. Reads from the markersRef which is populated by the effect above.
  // Using a separate effect prevents unnecessary marker rebuilds on selection change —
  // but since selectedPermitId is also in the marker-building effect's deps (for styling),
  // both run together. This effect handles the animation/popup timing cleanly.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedPermitId) return

    const marker = markersRef.current.get(selectedPermitId)
    if (!marker) return

    suppressDeselectRef.current = true
    map.closePopup()

    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), {
      duration: 0.6,
    })

    // NOTE(Agent): Open the popup after flyTo animation completes.
    // Leaflet doesn't provide a flyTo completion callback, so we use
    // a timeout matching the duration.
    setTimeout(() => {
      marker.openPopup()
      suppressDeselectRef.current = false
    }, 650)
  }, [selectedPermitId])

  return (
    <div
      className="w-full h-full relative z-0 min-h-[400px]"
      style={{ backgroundColor: 'var(--background-primary)' }}
    >
      {/* NOTE(Agent): role="application" signals to screen readers that this is an
          interactive region with custom keyboard behaviour (Leaflet handles its own
          keyboard bindings). aria-label provides the accessible name. */}
      <div
        ref={mapContainer}
        className="w-full h-full"
        role="application"
        aria-label="Interactive map showing building permit locations"
        style={{ height: '100%', width: '100%' }}
      />

      {/* Map Legend — Light glass */}
      <div
        className="glass absolute bottom-6 right-6 z-10 p-4 rounded-xl hidden sm:block"
        role="region"
        aria-label="Map legend"
      >
        <p className="text-[9px] font-semibold uppercase tracking-[0.25em] mb-3" style={{ color: 'var(--text-muted)' }}>
          Legend
        </p>
        <div className="space-y-2.5">
          {(['red', 'yellow', 'green'] as const).map((severity) => (
            <div key={severity} className="flex items-center gap-2.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                aria-hidden="true"
                style={{ backgroundColor: SEVERITY_COLORS[severity], boxShadow: `0 1px 4px ${SEVERITY_COLORS[severity]}33` }}
              />
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                {severity === 'red' ? 'High Impact' : severity === 'yellow' ? 'Medium Impact' : 'Standard'}
              </span>
            </div>
          ))}
          <div className="pt-2 border-t mt-2" style={{ borderColor: 'var(--border-glass)' }}>
            <div className="flex items-center gap-2.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                aria-hidden="true"
                style={{ backgroundColor: ACCENT_TEAL, boxShadow: `0 1px 4px ${ACCENT_TEAL}44` }}
              />
              <span className="text-[11px] font-medium" style={{ color: ACCENT_TEAL }}>Search Center</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

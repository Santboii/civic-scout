'use client'

import { useEffect, useRef, useCallback, useMemo, memo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ClassifiedPermit } from '@/lib/permit-classifier'
import type { DataLayerItem } from '@/lib/data-layers'
import { LAYER_SEVERITY_LABELS } from '@/lib/data-layer-classifier'
import type { ZoningFeatureCollection, ZoningCategory } from '@/lib/zoning'
import { getZoningColor, getZoningLabel, getZoneDescription, getChicagoZoningMapUrl, classifyZoneClass, ZONING_COLORS, ZONING_CATEGORY_LABELS } from '@/lib/zoning'
import { clipZoningToRadius } from '@/lib/zoning-clip'
import { groupByLocation, buildItemToGroupLookup, findPageIndex, getGroupSeverity } from '@/lib/marker-cluster'
import type { MarkerGroupItem } from '@/lib/marker-cluster'

interface MapProps {
  permits: ClassifiedPermit[]
  center: [number, number]
  onPermitSelect?: (permit: ClassifiedPermit) => void
  selectedPermitId?: string | null
  onPermitDeselect?: () => void
  dataLayerItems?: DataLayerItem[]
  onDataLayerSelect?: (item: DataLayerItem) => void
  selectedDataLayerItemId?: string | null
  onDataLayerDeselect?: () => void
  zoningGeoJSON?: ZoningFeatureCollection | null
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

// NOTE(Agent): Layer-specific colors and marker shapes for visual differentiation.
// Smaller than permit markers (10px vs 16px) to keep permits visually primary.
const LAYER_COLORS: Record<string, string> = {
  crimes: '#D94F3B',
  violations: '#D97706',
  crashes: '#4A90B0',
  service_requests: '#8B5CF6',
}

const LAYER_LABELS: Record<string, string> = {
  crimes: 'Crime',
  violations: 'Violation',
  crashes: 'Crash',
  service_requests: '311 Request',
}

// NOTE(Agent): Exported as memo'd component to prevent re-renders from unrelated
// parent state (selectedMapPermit, loading, showPayment, etc.).
export default memo(Map)

function Map({ permits, center, onPermitSelect, selectedPermitId, onPermitDeselect, dataLayerItems = [], onDataLayerSelect, selectedDataLayerItemId, onDataLayerDeselect, zoningGeoJSON }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  // NOTE(Agent): Unified marker ref for both solo and cluster markers.
  // Keyed by group key (from marker-cluster.ts).
  const markersRef = useRef<globalThis.Map<string, L.Marker>>(new globalThis.Map())
  const circleRef = useRef<L.Circle | null>(null)
  // NOTE(Agent): Track the previously-selected permit ID for lightweight icon-swap
  // on solo permit markers (clusters don't do icon-swap).
  const prevSelectedIdRef = useRef<string | null>(null)
  // NOTE(Agent): Holds the Leaflet GeoJSON layer for zoning district polygons.
  const zoningLayerRef = useRef<L.GeoJSON | null>(null)
  // NOTE(Agent): Track whether the popupclose was triggered programmatically
  // (e.g. when opening a different marker's popup) vs. by user interaction.
  const suppressDeselectRef = useRef(false)

  // ── Phase 1: Compute marker groups (useMemo, cheap) ──────────────────
  // NOTE(Agent): Pure computation, O(n). Groups co-located permits and data
  // layer items so overlapping markers become clusters with paginated popups.
  const markerGroups = useMemo(
    () => groupByLocation(permits, dataLayerItems),
    [permits, dataLayerItems]
  )

  // NOTE(Agent): Lookup table from item ID → group key, used by flyTo/selection
  // effects to find which cluster contains a selected sidebar item.
  const itemToGroupLookup = useMemo(
    () => buildItemToGroupLookup(markerGroups),
    [markerGroups]
  )

  // ── Map initialization ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    // NOTE(Agent): Leaflet's _getIconUrl is a private property not in the type defs.
    // We cast through unknown first to satisfy strict TypeScript overlap checking.
    // NOTE(Agent): Self-host Leaflet marker images from /public/leaflet/ to avoid
    // unpkg.com cross-origin latency and reliability risk.
    delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)['_getIconUrl']
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '/leaflet/marker-icon-2x.png',
      iconUrl: '/leaflet/marker-icon.png',
      shadowUrl: '/leaflet/marker-shadow.png',
    })

    mapRef.current = L.map(mapContainer.current, {
      center,
      zoom: 15,
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

  // ── Marker icon factories ────────────────────────────────────────────

  // NOTE(Agent): Distinct marker shapes per layer type. 10px base size
  // (vs 16px for permits) to keep layer data visually subordinate.
  const createLayerIcon = useCallback((layerType: string, color: string) => {
    const shapes: Record<string, string> = {
      crimes: `<div style="width:10px;height:10px;transform:rotate(45deg);border-radius:2px;border:1.5px solid rgba(255,255,255,0.9);background:${color};box-shadow:0 1px 4px rgba(0,0,0,0.2);cursor:pointer"></div>`,
      violations: `<div style="width:10px;height:10px;border-radius:2px;border:1.5px solid rgba(255,255,255,0.9);background:${color};box-shadow:0 1px 4px rgba(0,0,0,0.2);cursor:pointer"></div>`,
      crashes: `<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid ${color};filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));cursor:pointer"></div>`,
      service_requests: `<div style="width:10px;height:10px;border-radius:50%;border:2px solid ${color};background:transparent;box-shadow:0 1px 4px rgba(0,0,0,0.2);cursor:pointer"></div>`,
    }
    return L.divIcon({
      className: '',
      html: shapes[layerType] ?? shapes.crimes,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    })
  }, [])

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

  // NOTE(Agent): Creates a cluster marker icon — a circle with a count badge.
  // Colored by the highest-severity item in the cluster.
  const createClusterIcon = useCallback((count: number, severityColor: string) => {
    return L.divIcon({
      className: '',
      html: `<div style="position:relative;cursor:pointer">
        <div style="width:28px;height:28px;border-radius:50%;border:2.5px solid rgba(255,255,255,0.95);background:${severityColor};box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
          <span style="color:#fff;font-size:11px;font-weight:800;font-family:system-ui;line-height:1;text-shadow:0 1px 2px rgba(0,0,0,0.3)">${count}</span>
        </div>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })
  }, [])

  // ── Popup HTML generators ────────────────────────────────────────────

  const buildPermitPopupHtml = useCallback((permit: ClassifiedPermit): string => {
    const color = SEVERITY_COLORS[permit.severity] ?? '#9CA3AF'
    return `
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
  }, [])

  const buildDataLayerPopupHtml = useCallback((item: DataLayerItem): string => {
    const severityColor = SEVERITY_COLORS[item.severity] ?? SEVERITY_COLORS.green
    const typeColor = LAYER_COLORS[item.layerType] ?? '#9CA3AF'
    const severityLabel = LAYER_SEVERITY_LABELS[item.severity]?.[item.layerType] ?? ''

    if (item.layerType === 'crimes') {
      return `
        <div style="padding:10px;font-family:system-ui;min-width:180px;color:${TEXT_PRIMARY}">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;margin:0;color:${typeColor}">Crime Incident</p>
            <span style="font-size:8px;font-weight:700;padding:1px 5px;border-radius:4px;background:${severityColor}1A;color:${severityColor}">${severityLabel}</span>
          </div>
          <p style="font-weight:700;font-size:13px;margin:0 0 6px;color:${TEXT_PRIMARY}">${item.primaryType}</p>
          <p style="font-size:11px;margin:0 0 4px;color:${TEXT_SECONDARY}">${item.block}</p>
          <p style="font-size:10px;margin:0;color:${TEXT_MUTED}">${item.date ? new Date(item.date).toLocaleDateString() : ''}</p>
          ${item.arrest ? '<span style="display:inline-block;margin-top:6px;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(27,155,108,0.08);color:#1B9B6C">ARREST</span>' : ''}
          <button data-layer-id="${item.id}" data-layer-type="${item.layerType}" style="display:block;width:100%;margin-top:8px;padding:6px 0;border:none;border-radius:6px;background:${typeColor};color:#fff;font-size:11px;font-weight:600;cursor:pointer">View Details →</button>
        </div>`
    }

    if (item.layerType === 'violations') {
      const isOpen = item.violationStatus.toUpperCase().includes('OPEN')
      return `
        <div style="padding:10px;font-family:system-ui;min-width:180px;color:${TEXT_PRIMARY}">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;margin:0;color:${typeColor}">Building Violation</p>
            <span style="font-size:8px;font-weight:700;padding:1px 5px;border-radius:4px;background:${severityColor}1A;color:${severityColor}">${severityLabel}</span>
          </div>
          <p style="font-weight:700;font-size:13px;margin:0 0 6px;color:${TEXT_PRIMARY}">${item.violationCode || 'Violation'}</p>
          <p style="font-size:11px;margin:0 0 4px;color:${TEXT_SECONDARY}">${item.address}</p>
          <span style="display:inline-block;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:${isOpen ? 'rgba(217,79,59,0.08)' : 'rgba(27,155,108,0.08)'};color:${isOpen ? '#D94F3B' : '#1B9B6C'}">${isOpen ? 'OPEN' : 'CLOSED'}</span>
          <button data-layer-id="${item.id}" data-layer-type="${item.layerType}" style="display:block;width:100%;margin-top:8px;padding:6px 0;border:none;border-radius:6px;background:${typeColor};color:#fff;font-size:11px;font-weight:600;cursor:pointer">View Details →</button>
        </div>`
    }

    if (item.layerType === 'service_requests') {
      const isOpen = !String(item.status ?? '').toLowerCase().includes('completed') && !String(item.status ?? '').toLowerCase().includes('closed')
      return `
        <div style="padding:10px;font-family:system-ui;min-width:180px;color:${TEXT_PRIMARY}">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;margin:0;color:${typeColor}">311 Request</p>
            <span style="font-size:8px;font-weight:700;padding:1px 5px;border-radius:4px;background:${severityColor}1A;color:${severityColor}">${severityLabel}</span>
          </div>
          <p style="font-weight:700;font-size:13px;margin:0 0 6px;color:${TEXT_PRIMARY}">${item.srType || '311 Request'}</p>
          <p style="font-size:11px;margin:0 0 4px;color:${TEXT_SECONDARY}">${item.address}</p>
          <span style="display:inline-block;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:${isOpen ? 'rgba(139,92,246,0.08)' : 'rgba(27,155,108,0.08)'};color:${isOpen ? '#8B5CF6' : '#1B9B6C'}">${isOpen ? 'OPEN' : 'CLOSED'}</span>
          <button data-layer-id="${item.id}" data-layer-type="${item.layerType}" style="display:block;width:100%;margin-top:8px;padding:6px 0;border:none;border-radius:6px;background:${typeColor};color:#fff;font-size:11px;font-weight:600;cursor:pointer">View Details →</button>
        </div>`
    }

    // crashes (default)
    return `
      <div style="padding:10px;font-family:system-ui;min-width:180px;color:${TEXT_PRIMARY}">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;margin:0;color:${typeColor}">Traffic Crash</p>
          <span style="font-size:8px;font-weight:700;padding:1px 5px;border-radius:4px;background:${severityColor}1A;color:${severityColor}">${severityLabel}</span>
        </div>
        <p style="font-weight:700;font-size:13px;margin:0 0 6px;color:${TEXT_PRIMARY}">${item.crashType || 'Traffic Crash'}</p>
        <p style="font-size:11px;margin:0 0 4px;color:${TEXT_SECONDARY}">${item.primContributoryCause}</p>
        ${item.injuriesTotal > 0 ? `<span style="display:inline-block;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(217,79,59,0.08);color:#D94F3B">${item.injuriesTotal} INJURED</span>` : ''}
        <button data-layer-id="${item.id}" data-layer-type="${item.layerType}" style="display:block;width:100%;margin-top:8px;padding:6px 0;border:none;border-radius:6px;background:${typeColor};color:#fff;font-size:11px;font-weight:600;cursor:pointer">View Details →</button>
      </div>`
  }, [])

  // NOTE(Agent): Wraps multiple item popups in a paginated container with ←/→
  // navigation. Each page is a hidden div, toggled by embedded vanilla JS.
  // Calls popup.update() after page change to fix Leaflet repositioning.
  const buildPaginatedPopupHtml = useCallback((items: MarkerGroupItem[], markerId: string): string => {
    const pages = items.map((item, i) => {
      const html = item.type === 'permit' && item.permit
        ? buildPermitPopupHtml(item.permit)
        : item.dataLayerItem
          ? buildDataLayerPopupHtml(item.dataLayerItem)
          : ''
      return `<div data-cluster-page="${i}" style="display:${i === 0 ? 'block' : 'none'}">${html}</div>`
    }).join('')

    const navBar = `
      <div data-cluster-nav style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid rgba(0,0,0,0.06);font-family:system-ui">
        <button onclick="event.stopPropagation();window.__clusterNav&&window.__clusterNav('${markerId}','prev')" style="width:26px;height:26px;border:none;border-radius:50%;background:rgba(0,0,0,0.06);color:${TEXT_PRIMARY};font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s" onmouseover="this.style.background='rgba(0,0,0,0.12)'" onmouseout="this.style.background='rgba(0,0,0,0.06)'" aria-label="Previous item">‹</button>
        <span data-cluster-counter="${markerId}" style="font-size:11px;font-weight:600;color:${TEXT_SECONDARY}">1 of ${items.length}</span>
        <button onclick="event.stopPropagation();window.__clusterNav&&window.__clusterNav('${markerId}','next')" style="width:26px;height:26px;border:none;border-radius:50%;background:rgba(0,0,0,0.06);color:${TEXT_PRIMARY};font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s" onmouseover="this.style.background='rgba(0,0,0,0.12)'" onmouseout="this.style.background='rgba(0,0,0,0.06)'" aria-label="Next item">›</button>
      </div>
    `

    return `<div data-cluster-root="${markerId}">${navBar}${pages}</div>`
  }, [buildPermitPopupHtml, buildDataLayerPopupHtml])

  // NOTE(Agent): Global pagination handler registered on the window object.
  // Inline onclick handlers in the popup HTML call this function directly.
  // This avoids Leaflet event system issues that prevented addEventListener
  // from working reliably on popup buttons. The function finds the relevant
  // DOM elements using data attributes and performs page switching in-place.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__clusterNav = (markerId: string, direction: 'prev' | 'next') => {
      const root = document.querySelector(`[data-cluster-root="${markerId}"]`)
      if (!root) return

      const pages = root.querySelectorAll('[data-cluster-page]')
      const counter = root.querySelector(`[data-cluster-counter="${markerId}"]`)
      const totalPages = pages.length
      if (totalPages === 0) return

      let currentPage = parseInt(root.getAttribute('data-current-page') ?? '0', 10)
      if (direction === 'next') {
        currentPage = currentPage >= totalPages - 1 ? 0 : currentPage + 1
      } else {
        currentPage = currentPage <= 0 ? totalPages - 1 : currentPage - 1
      }

      pages.forEach((p, i) => {
        (p as HTMLElement).style.display = i === currentPage ? 'block' : 'none'
      })
      if (counter) counter.textContent = `${currentPage + 1} of ${totalPages}`
      root.setAttribute('data-current-page', String(currentPage))

      // NOTE(Agent): Find the open popup and update its position to account
      // for content height changes across pages.
      mapRef.current?.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.getPopup()?.isOpen()) {
          layer.getPopup()?.update()
        }
      })
    }

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__clusterNav
    }
  }, [])

  // NOTE(Agent): Ensures the correct page is displayed when a paginated
  // popup is opened (e.g. from sidebar selection setting data-current-page).
  const initPaginatedPopup = useCallback((markerId: string) => {
    const root = document.querySelector(`[data-cluster-root="${markerId}"]`)
    if (!root) return

    const pages = root.querySelectorAll('[data-cluster-page]')
    const counter = root.querySelector(`[data-cluster-counter="${markerId}"]`)
    const currentPage = parseInt(root.getAttribute('data-current-page') ?? '0', 10)

    pages.forEach((p, i) => {
      (p as HTMLElement).style.display = i === currentPage ? 'block' : 'none'
    })
    if (counter) counter.textContent = `${currentPage + 1} of ${pages.length}`
  }, [])


  // ── Phase 2: Unified Marker Rendering Effect ─────────────────────────
  // NOTE(Agent): Single effect that renders all markers (both permits and data
  // layer items) using the computed marker groups. Clusters (groups of 2+) get
  // a badge icon and paginated popup. Solos (groups of 1) render exactly as
  // before for zero visual regression. Replaces the previous separate permit
  // and data layer marker effects.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.setView(center, map.getZoom())
    map.invalidateSize()

    // Clean up all previous markers
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

    // 0.5-mile radius circle (1-mile diameter) — matches the fetch radius
    circleRef.current = L.circle(center, {
      radius: 805,
      color: ACCENT_TEAL,
      weight: 1.5,
      dashArray: '4, 8',
      fillColor: ACCENT_TEAL,
      fillOpacity: 0.04,
      interactive: false,
    }).addTo(map)

    // ── Render marker groups ──────────────────────────────────────────
    for (const group of markerGroups) {
      if (group.items.length === 1) {
        // ── Solo marker — render exactly as before ──────────────────
        const item = group.items[0]

        if (item.type === 'permit' && item.permit) {
          const permit = item.permit
          const color = SEVERITY_COLORS[permit.severity] ?? '#9CA3AF'
          const icon = createPermitIcon(color, false)
          const popupContent = buildPermitPopupHtml(permit)

          const marker = L.marker([permit.lat, permit.lon], { icon })
            .bindPopup(popupContent, { offset: [0, -5], maxWidth: 300, className: 'modern-map-popup' })
            .addTo(map)

          marker.on('popupopen', () => {
            const popupEl = marker.getPopup()?.getElement()
            const btn = popupEl?.querySelector(`[data-permit-id="${permit.id}"]`)
            btn?.addEventListener('click', () => {
              onPermitSelect?.(permit)
              marker.closePopup()
            }, { once: true })
          })

          markersRef.current.set(group.key, marker)

        } else if (item.type === 'dataLayer' && item.dataLayerItem) {
          const dataItem = item.dataLayerItem
          const severityColor = SEVERITY_COLORS[dataItem.severity] ?? SEVERITY_COLORS.green
          const icon = createLayerIcon(dataItem.layerType, severityColor)
          const popupContent = buildDataLayerPopupHtml(dataItem)

          const marker = L.marker([dataItem.lat, dataItem.lon], { icon })
            .bindPopup(popupContent, { offset: [0, -3], maxWidth: 280, className: 'modern-map-popup' })
            .addTo(map)

          marker.on('popupopen', () => {
            const popupEl = marker.getPopup()?.getElement()
            const btn = popupEl?.querySelector(`[data-layer-id="${dataItem.id}"]`)
            btn?.addEventListener('click', () => {
              onDataLayerSelect?.(dataItem)
              marker.closePopup()
            }, { once: true })
          })

          markersRef.current.set(group.key, marker)
        }

      } else {
        // ── Cluster marker — badge + paginated popup ──────────────
        const groupSeverity = getGroupSeverity(group)
        const clusterColor = SEVERITY_COLORS[groupSeverity] ?? '#9CA3AF'
        const icon = createClusterIcon(group.items.length, clusterColor)
        const popupHtml = buildPaginatedPopupHtml(group.items, group.key)

        const marker = L.marker([group.lat, group.lon], { icon })
          .bindPopup(popupHtml, { offset: [0, -8], maxWidth: 320, className: 'modern-map-popup' })
          .addTo(map)

        // NOTE(Agent): Higher z-index for clusters so they render above solo markers.
        marker.setZIndexOffset(group.items.length * 100)

        // NOTE(Agent): On popupopen, init the correct page and bind click handlers
        // for ALL "View Details" buttons across all pages (not just the visible page).
        // Pagination itself is handled by inline onclick → window.__clusterNav.
        marker.on('popupopen', () => {
          initPaginatedPopup(group.key)

          const popupEl = marker.getPopup()?.getElement()
          if (!popupEl) return

          // Bind permit "View Details" buttons
          popupEl.querySelectorAll('[data-permit-id]').forEach((btn) => {
            const permitId = btn.getAttribute('data-permit-id')
            const permit = group.items.find(
              (gi) => gi.type === 'permit' && gi.permit?.id === permitId
            )?.permit
            if (permit) {
              btn.addEventListener('click', () => {
                onPermitSelect?.(permit)
                marker.closePopup()
              }, { once: true })
            }
          })

          // Bind data layer "View Details" buttons
          popupEl.querySelectorAll('[data-layer-id]').forEach((btn) => {
            const layerId = btn.getAttribute('data-layer-id')
            const dataItem = group.items.find(
              (gi) => gi.type === 'dataLayer' && gi.dataLayerItem?.id === layerId
            )?.dataLayerItem
            if (dataItem) {
              btn.addEventListener('click', () => {
                onDataLayerSelect?.(dataItem)
                marker.closePopup()
              }, { once: true })
            }
          })
        })

        markersRef.current.set(group.key, marker)
      }
    }

    // NOTE(Agent): Listen for popup close events on the map to clear the
    // selected state in the parent. Suppressed during programmatic popup switches.
    const handlePopupClose = () => {
      if (!suppressDeselectRef.current) {
        onPermitDeselect?.()
        onDataLayerDeselect?.()
      }
    }
    map.on('popupclose', handlePopupClose)

    // After rebuilding, re-apply selected icon for solo permit markers
    if (selectedPermitId) {
      const groupKey = itemToGroupLookup.get(selectedPermitId)
      if (groupKey) {
        const group = markerGroups.find((g) => g.key === groupKey)
        if (group && group.items.length === 1) {
          const marker = markersRef.current.get(groupKey)
          const permit = group.items[0].permit
          if (marker && permit) {
            const color = SEVERITY_COLORS[permit.severity] ?? '#9CA3AF'
            marker.setIcon(createPermitIcon(color, true))
          }
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
  }, [markerGroups, center, createPermitIcon, createLayerIcon, createClusterIcon,
    buildPermitPopupHtml, buildDataLayerPopupHtml, buildPaginatedPopupHtml,
    initPaginatedPopup, onPermitSelect, onDataLayerSelect,
    onPermitDeselect, onDataLayerDeselect])

  // ── Lightweight selection icon-swap effect ───────────────────────────
  // NOTE(Agent): Only swaps icons for solo permit markers. Cluster markers
  // don't get icon swaps (the popup page is the selection indicator).
  useEffect(() => {
    const prevId = prevSelectedIdRef.current

    // Restore old marker to unselected icon (solo permits only)
    if (prevId && prevId !== selectedPermitId) {
      const prevGroupKey = itemToGroupLookup.get(prevId)
      if (prevGroupKey) {
        const prevGroup = markerGroups.find((g) => g.key === prevGroupKey)
        if (prevGroup && prevGroup.items.length === 1 && prevGroup.items[0].permit) {
          const prevMarker = markersRef.current.get(prevGroupKey)
          if (prevMarker) {
            const color = SEVERITY_COLORS[prevGroup.items[0].permit.severity] ?? '#9CA3AF'
            prevMarker.setIcon(createPermitIcon(color, false))
          }
        }
      }
    }

    // Apply selected icon to new marker (solo permits only)
    if (selectedPermitId) {
      const nextGroupKey = itemToGroupLookup.get(selectedPermitId)
      if (nextGroupKey) {
        const nextGroup = markerGroups.find((g) => g.key === nextGroupKey)
        if (nextGroup && nextGroup.items.length === 1 && nextGroup.items[0].permit) {
          const nextMarker = markersRef.current.get(nextGroupKey)
          if (nextMarker) {
            const color = SEVERITY_COLORS[nextGroup.items[0].permit.severity] ?? '#9CA3AF'
            nextMarker.setIcon(createPermitIcon(color, true))
          }
        }
      }
    }

    prevSelectedIdRef.current = selectedPermitId ?? null
  }, [selectedPermitId, markerGroups, itemToGroupLookup, createPermitIcon])

  // ── Unified flyTo + popup open effect ────────────────────────────────
  // NOTE(Agent): Handles sidebar card clicks for both permits and data layer
  // items. For solo markers, flies to the marker and opens its popup (as before).
  // For cluster markers, flies to the cluster, opens the popup, and navigates
  // to the correct page within the paginated popup.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Determine which item was selected
    const selectedId = selectedPermitId || selectedDataLayerItemId
    if (!selectedId) return

    const groupKey = itemToGroupLookup.get(selectedId)
    if (!groupKey) return

    const marker = markersRef.current.get(groupKey)
    if (!marker) return

    const group = markerGroups.find((g) => g.key === groupKey)
    if (!group) return

    suppressDeselectRef.current = true
    map.closePopup()

    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), {
      duration: 0.6,
    })

    // NOTE(Agent): For cluster markers, set the page index BEFORE opening the
    // popup so that when popupopen fires and initPaginatedPopup runs,
    // it reads the correct page from the data attribute.
    if (group.items.length > 1) {
      const pageIdx = findPageIndex(group, selectedId)
      // Store the target page on the popup HTML root via a data attribute.
      // The popup DOM doesn't exist yet (it's created on openPopup), so we
      // modify the popup content string to include the starting page.
      const popup = marker.getPopup()
      if (popup) {
        const content = popup.getContent()
        if (typeof content === 'string') {
          const updated = content.replace(
            `data-cluster-root="${groupKey}"`,
            `data-cluster-root="${groupKey}" data-current-page="${pageIdx}"`
          )
          popup.setContent(updated)
        }
      }
    }

    setTimeout(() => {
      marker.openPopup()
      suppressDeselectRef.current = false
    }, 650)
  }, [selectedPermitId, selectedDataLayerItemId, itemToGroupLookup, markerGroups])

  // ── Zoning Overlay ────────────────────────────────────────────────────
  // NOTE(Agent): Renders zoning district polygons as a translucent colored overlay.
  // Unchanged from pre-clustering implementation.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (zoningLayerRef.current) {
      zoningLayerRef.current.remove()
      zoningLayerRef.current = null
    }

    if (!zoningGeoJSON || zoningGeoJSON.features.length === 0) return

    const clipped = clipZoningToRadius(zoningGeoJSON, center[0], center[1])
    if (clipped.features.length === 0) return

    const geoJsonLayer = L.geoJSON(clipped as GeoJSON.GeoJsonObject, {
      style: (feature) => {
        const zoneClass = String(feature?.properties?.zone_class ?? '')
        const color = getZoningColor(zoneClass)
        return {
          fillColor: color,
          fillOpacity: 0.15,
          weight: 1,
          color: color,
          opacity: 0.5,
        }
      },
      onEachFeature: (feature, layer) => {
        const zoneClass = String(feature.properties?.zone_class ?? '')
        const label = getZoningLabel(zoneClass)
        if (zoneClass) {
          layer.bindTooltip(`<strong>${zoneClass}</strong> · ${label}`, {
            sticky: true,
            direction: 'top',
            className: 'zoning-tooltip',
            offset: [0, -8],
          })
        }

        if (zoneClass) {
          const desc = getZoneDescription(zoneClass)
          const color = getZoningColor(zoneClass)
          const ordinance = String(feature.properties?.ordinance ?? '')
          const ordinanceDate = String(feature.properties?.ordinance_1 ?? '')
          const formattedDate = ordinanceDate
            ? new Date(ordinanceDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            : ''

          const bounds = (layer as L.Polygon).getBounds()
          const center = bounds.getCenter()
          const mapUrl = getChicagoZoningMapUrl(center.lat, center.lng)

          const popupHtml = `
            <div style="padding:14px;font-family:system-ui;min-width:220px;max-width:280px;color:${TEXT_PRIMARY}">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
                <div style="width:14px;height:14px;border-radius:3px;background:${color};opacity:0.7;flex-shrink:0"></div>
                <div>
                  <p style="font-weight:700;font-size:15px;margin:0;color:${TEXT_PRIMARY}">${zoneClass}</p>
                  <p style="font-size:11px;margin:1px 0 0;color:${TEXT_SECONDARY}">${desc.label}</p>
                </div>
              </div>
              <p style="font-size:12px;line-height:1.5;margin:0 0 10px;color:${TEXT_SECONDARY}">${desc.allowedUses}</p>
              ${ordinance ? `
                <div style="border-top:1px solid rgba(0,0,0,0.06);padding-top:8px;margin-bottom:10px">
                  <p style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 2px;color:${TEXT_MUTED}">Ordinance</p>
                  <p style="font-size:12px;margin:0;color:${TEXT_PRIMARY}">#${ordinance}${formattedDate ? ` · ${formattedDate}` : ''}</p>
                </div>
              ` : ''}
              <a href="${mapUrl}" target="_blank" rel="noopener noreferrer"
                 style="display:block;text-align:center;padding:7px 0;border:none;border-radius:6px;background:${ACCENT_TEAL};color:#fff;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:0.02em;text-decoration:none;transition:opacity 0.15s"
                 onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'"
              >View on City Zoning Map →</a>
            </div>
          `

          layer.bindPopup(popupHtml, {
            offset: [0, -5],
            maxWidth: 300,
            className: 'zoning-popup',
          })
        }

        layer.on({
          mouseover: (e: L.LeafletMouseEvent) => {
            const target = e.target as L.Path
            target.setStyle({ fillOpacity: 0.3, weight: 2 })
            target.bringToFront()
          },
          mouseout: () => {
            geoJsonLayer.resetStyle(layer as L.Path)
            geoJsonLayer.bringToBack()
          },
          click: () => {
            if (!zoneClass) return
            geoJsonLayer.eachLayer((otherLayer) => {
              const otherFeature = (otherLayer as L.GeoJSON & { feature?: GeoJSON.Feature }).feature
              const otherClass = String(otherFeature?.properties?.zone_class ?? '')
              if (otherClass === zoneClass) {
                (otherLayer as L.Path).setStyle({ fillOpacity: 0.35, weight: 2.5 })
              } else {
                (otherLayer as L.Path).setStyle({ fillOpacity: 0.08, weight: 0.5 })
              }
            })
          },
        })

        layer.on('popupclose', () => {
          geoJsonLayer.eachLayer((otherLayer) => {
            geoJsonLayer.resetStyle(otherLayer as L.Path)
          })
          geoJsonLayer.bringToBack()
        })
      },
    }).addTo(map)

    geoJsonLayer.bringToBack()
    zoningLayerRef.current = geoJsonLayer
  }, [zoningGeoJSON, center])

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
          {/* NOTE(Agent): Conditional legend entries for enabled data layers. */}
          {dataLayerItems.length > 0 && (
            <div className="pt-2 border-t mt-2" style={{ borderColor: 'var(--border-glass)' }}>
              {(['crimes', 'violations', 'crashes', 'service_requests'] as const)
                .filter((type) => dataLayerItems.some((i) => i.layerType === type))
                .map((type) => (
                  <div key={type} className="flex items-center gap-2.5 mt-1.5 first:mt-0">
                    <div
                      className="w-2.5 h-2.5"
                      aria-hidden="true"
                      style={{
                        backgroundColor: type === 'service_requests' ? 'transparent' : LAYER_COLORS[type],
                        border: type === 'service_requests' ? `2px solid ${LAYER_COLORS[type]}` : 'none',
                        borderRadius: type === 'crashes' ? '0' : type === 'service_requests' ? '50%' : type === 'crimes' ? '2px' : '1px',
                        transform: type === 'crimes' ? 'rotate(45deg) scale(0.8)' : type === 'crashes' ? 'rotate(45deg) scale(0.8)' : 'none',
                        boxShadow: `0 1px 4px ${LAYER_COLORS[type]}33`,
                      }}
                    />
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {LAYER_LABELS[type]}
                    </span>
                  </div>
                ))}
            </div>
          )}
          {/* NOTE(Agent): Conditional zoning legend showing active zone categories. */}
          {zoningGeoJSON && zoningGeoJSON.features.length > 0 && (
            <div className="pt-2 border-t mt-2" style={{ borderColor: 'var(--border-glass)' }}>
              <p className="text-[8px] font-semibold uppercase tracking-[0.2em] mb-1.5" style={{ color: 'var(--text-muted)' }}>Zoning</p>
              {(() => {
                const categories = new Set<ZoningCategory>()
                zoningGeoJSON.features.forEach((f) => {
                  categories.add(classifyZoneClass(f.properties.zone_class))
                })
                return Array.from(categories)
                  .sort()
                  .slice(0, 6)
                  .map((cat) => (
                    <div key={cat} className="flex items-center gap-2.5 mt-1 first:mt-0">
                      <div
                        className="w-2.5 h-2.5 rounded-sm"
                        aria-hidden="true"
                        style={{
                          backgroundColor: ZONING_COLORS[cat],
                          opacity: 0.6,
                          boxShadow: `0 1px 4px ${ZONING_COLORS[cat]}33`,
                        }}
                      />
                      <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {ZONING_CATEGORY_LABELS[cat]}
                      </span>
                    </div>
                  ))
              })()}
            </div>
          )}
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

'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ClassifiedPermit } from '@/lib/permit-classifier'

interface MapProps {
  permits: ClassifiedPermit[]
  center: [number, number]
}

// NOTE(Agent): Hex values required for inline HTML Leaflet markers/popups
// where CSS custom properties cannot be resolved. Updated for dark theme visibility.
const SEVERITY_COLORS: Record<string, string> = {
  red: '#F06449',
  yellow: '#EABC3A',
  green: '#34D399',
}

const ACCENT_TEAL = '#0DC8B4'
const TEXT_PRIMARY = '#E8ECF1'
const TEXT_SECONDARY = '#7A8BA4'
const TEXT_MUTED = '#4A5568'

export default function Map({ permits, center }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const circleRef = useRef<L.Circle | null>(null)

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    mapRef.current = L.map(mapContainer.current, {
      center,
      zoom: 13,
      zoomControl: false,
    })

    L.control.zoom({ position: 'topright' }).addTo(mapRef.current)

    // NOTE(Agent): CartoDB Dark Matter tiles for dark theme cohesion. Free, no API key.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(mapRef.current)

    setTimeout(() => { mapRef.current?.invalidateSize() }, 100)
  }, [center])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.setView(center, map.getZoom())
    map.invalidateSize()

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    if (circleRef.current) {
      circleRef.current.remove()
    }

    // Center pin — teal with glow
    const centerIcon = L.divIcon({
      className: '',
      html: `
        <div style="position:relative">
          <div style="position:absolute;inset:-4px;border-radius:50%;background:rgba(13,200,180,0.25);animation:pulse 2s ease-in-out infinite"></div>
          <div style="width:14px;height:14px;border-radius:50%;border:2px solid ${ACCENT_TEAL};background:${ACCENT_TEAL};box-shadow:0 0 12px rgba(13,200,180,0.5);display:flex;align-items:center;justify-content:center">
            <div style="width:4px;height:4px;border-radius:50%;background:white"></div>
          </div>
        </div>
        <style>@keyframes pulse{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.8);opacity:0}}</style>
      `,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    })
    const centerMarker = L.marker(center, { icon: centerIcon }).addTo(map)
    markersRef.current.push(centerMarker)

    // 2-mile radius circle
    circleRef.current = L.circle(center, {
      radius: 3218,
      color: ACCENT_TEAL,
      weight: 1.5,
      dashArray: '4, 8',
      fillColor: ACCENT_TEAL,
      fillOpacity: 0.04,
      interactive: false,
    }).addTo(map)

    // Permit markers
    permits.forEach((permit) => {
      const color = SEVERITY_COLORS[permit.severity] ?? '#7A8BA4'
      const permitIcon = L.divIcon({
        className: '',
        html: `<div style="width:10px;height:10px;border-radius:50%;border:2px solid rgba(12,17,23,0.6);background:${color};box-shadow:0 0 8px ${color}44;cursor:pointer;transition:transform 0.15s"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      })

      const popupContent = `
        <div style="padding:12px;font-family:system-ui;min-width:200px;color:${TEXT_PRIMARY}">
          <p style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 4px;color:${TEXT_MUTED}">${permit.permit_type}</p>
          <p style="font-weight:700;font-size:14px;margin:0 0 8px;color:${TEXT_PRIMARY}">${permit.address}</p>
          <p style="font-size:12px;line-height:1.5;margin:0 0 10px;color:${TEXT_SECONDARY}">
            ${permit.community_note?.slice(0, 100) ?? ''}${(permit.community_note?.length ?? 0) > 100 ? '…' : ''}
          </p>
          <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px">
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:${color}">
              ${permit.severity}
            </span>
            ${permit.reported_cost ? `<span style="font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(232,168,50,0.12);color:#E8A832;border:1px solid rgba(232,168,50,0.2)">$${(permit.reported_cost / 1e6).toFixed(1)}M</span>` : ''}
          </div>
        </div>
      `

      const marker = L.marker([permit.lat, permit.lon], { icon: permitIcon })
        .bindPopup(popupContent, { offset: [0, -5], maxWidth: 300, className: 'modern-map-popup' })
        .addTo(map)

      markersRef.current.push(marker)
    })
  }, [permits, center])

  return (
    <div className="w-full h-full relative z-0 min-h-[400px]" style={{ backgroundColor: 'var(--background-primary)' }}>
      <div ref={mapContainer} className="w-full h-full" style={{ height: '100%', width: '100%' }} />

      {/* Map Legend — Dark glass */}
      <div className="glass absolute bottom-6 right-6 z-10 p-4 rounded-xl hidden sm:block">
        <p className="text-[9px] font-semibold uppercase tracking-[0.25em] mb-3" style={{ color: 'var(--text-muted)' }}>
          Legend
        </p>
        <div className="space-y-2.5">
          {(['red', 'yellow', 'green'] as const).map((severity) => (
            <div key={severity} className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[severity], boxShadow: `0 0 6px ${SEVERITY_COLORS[severity]}44` }} />
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                {severity === 'red' ? 'High Impact' : severity === 'yellow' ? 'Medium Impact' : 'Standard'}
              </span>
            </div>
          ))}
          <div className="pt-2 border-t mt-2" style={{ borderColor: 'var(--border-glass)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ACCENT_TEAL, boxShadow: `0 0 8px ${ACCENT_TEAL}66` }} />
              <span className="text-[11px] font-medium" style={{ color: ACCENT_TEAL }}>Search Center</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

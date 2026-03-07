'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ClassifiedPermit } from '@/lib/permit-classifier'

interface MapProps {
  permits: ClassifiedPermit[]
  center: [number, number] // [lat, lon] - Leaflet uses [lat, lon]
}

const SEVERITY_COLORS: Record<string, string> = {
  red: '#ef4444',
  yellow: '#f59e0b',
  green: '#22c55e',
}

export default function Map({ permits, center }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const circleRef = useRef<L.Circle | null>(null)

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    // Leaflet icon fix
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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current)

    // Force a resize check after initialization to prevent gray map/lines
    setTimeout(() => {
      mapRef.current?.invalidateSize()
    }, 100)
  }, [center])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Update center
    map.setView(center, map.getZoom())
    map.invalidateSize()

    // Clear old markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    if (circleRef.current) {
      circleRef.current.remove()
    }

    // Add search-center pin
    const centerIcon = L.divIcon({
      className: '',
      html: '<div class="w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-lg"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })
    const centerMarker = L.marker(center, { icon: centerIcon }).addTo(map)
    markersRef.current.push(centerMarker)

    // Add 2-mile (3218 meters) radius circle
    circleRef.current = L.circle(center, {
      radius: 3218,
      color: '#3b82f6',
      weight: 1.5,
      dashArray: '3, 3',
      fillColor: '#3b82f6',
      fillOpacity: 0.05,
    }).addTo(map)

    // Add permit markers
    permits.forEach((permit) => {
      const permitIcon = L.divIcon({
        className: '',
        html: `<div class="w-4 h-4 rounded-full border-2 border-white shadow cursor-pointer" style="background-color: ${SEVERITY_COLORS[permit.severity] ?? '#6b7280'}"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })

      const popupContent = `
        <div class="text-sm p-1">
          <p class="font-semibold" style="margin: 0">${permit.address}</p>
          <p class="text-xs text-gray-500" style="margin: 2px 0">${permit.permit_type}</p>
          <p style="margin: 4px 0">${permit.work_description?.slice(0, 100) ?? ''}${(permit.work_description?.length ?? 0) > 100 ? '…' : ''}</p>
          ${permit.reported_cost ? `<p style="margin: 4px 0; font-weight: 500">$${permit.reported_cost.toLocaleString()}</p>` : ''}
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; color: white; font-size: 10px; background:${SEVERITY_COLORS[permit.severity]}">${permit.severity.toUpperCase()}</span>
        </div>
      `

      const marker = L.marker([permit.lat, permit.lon], { icon: permitIcon })
        .bindPopup(popupContent, { offset: [0, -5], maxWidth: 280 })
        .addTo(map)

      markersRef.current.push(marker)
    })
  }, [permits, center])

  return (
    <div className="w-full h-full bg-gray-100 relative z-0 min-h-[400px]">
      <div ref={mapContainer} className="w-full h-full" style={{ height: '100%', width: '100%' }} />
    </div>
  )
}

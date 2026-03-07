'use client'

import { useEffect } from 'react'
import type { ClassifiedPermit } from '@/lib/permit-classifier'
import { X, DollarSign, Calendar, MapPin, Info, ExternalLink } from 'lucide-react'

interface PermitDetailModalProps {
  permit: ClassifiedPermit
  onClose: () => void
}

const SEVERITY_CONFIG = {
  red: { color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100', label: 'High Impact Development' },
  yellow: { color: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-100', label: 'Medium Impact Development' },
  green: { color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-100', label: 'Standard Development' },
}

export default function PermitDetailModal({ permit, onClose }: PermitDetailModalProps) {
  const config = SEVERITY_CONFIG[permit.severity]

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-md transition-opacity"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${config.border} ${config.bg}`}>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.color} border border-current bg-white/50`}>
              {permit.severity}
            </span>
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-tight">{permit.permit_type}</span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-black/5 rounded-full transition-colors text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Address & Title */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">{permit.address}</h2>
            <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500 font-medium">
              <MapPin size={14} className="text-gray-400" />
              <span>Chicago, Illinois</span>
              {permit.zoning_classification && (
                <>
                  <span className="text-gray-300 mx-1">•</span>
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px] font-bold text-gray-600">ZONE {permit.zoning_classification}</span>
                </>
              )}
            </div>
          </section>

          {/* Key Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <DollarSign size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Estimated Cost</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {permit.reported_cost > 0 
                  ? `$${permit.reported_cost.toLocaleString()}`
                  : 'Undisclosed'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Calendar size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Issued Date</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {new Date(permit.issue_date).toLocaleDateString(undefined, { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </p>
            </div>
          </div>

          {/* Impact Reason */}
          <div className={`p-4 rounded-2xl border ${config.border} ${config.bg} flex gap-3 items-start`}>
            <div className={`${config.color} shrink-0 mt-0.5`}>
              <Info size={18} />
            </div>
            <div>
              <p className={`text-[11px] font-bold uppercase tracking-wider ${config.color} mb-1`}>Impact Analysis</p>
              <p className="text-sm text-gray-800 font-medium leading-relaxed">
                {permit.severity_reason || 'Standard development activity within the defined search radius.'}
              </p>
            </div>
          </div>

          {/* Full Description */}
          <section>
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Work Description</h3>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-sm text-gray-700 leading-relaxed font-normal shadow-sm">
              {permit.work_description || 'No detailed work description provided for this permit.'}
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-0 mt-auto">
          <a 
            href={`https://data.cityofchicago.org/resource/ydr8-5enu?permit_=${permit.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white py-4 rounded-2xl font-bold text-sm transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
          >
            View Full Data Source
            <ExternalLink size={14} />
          </a>
          <p className="text-center text-[10px] text-gray-400 mt-4 uppercase tracking-tighter">
            Permit ID: {permit.id} • Data provided by City of Chicago
          </p>
        </div>
      </div>
    </div>
  )
}

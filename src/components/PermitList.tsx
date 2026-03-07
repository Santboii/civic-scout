'use client'

import { useState } from 'react'
import type { ClassifiedPermit } from '@/lib/permit-classifier'
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react'
import PermitDetailModal from './PermitDetailModal'

interface PermitListProps {
  permits: ClassifiedPermit[]
}

const SEVERITY_CONFIG = {
  red: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100', label: 'High Impact' },
  yellow: { icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-100', label: 'Medium Impact' },
  green: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-100', label: 'Standard' },
}

export default function PermitList({ permits }: PermitListProps) {
  const [selectedPermit, setSelectedPermit] = useState<ClassifiedPermit | null>(null)

  if (permits.length === 0) {
    return (
      <div className="text-center text-gray-400 text-sm py-8">
        No significant developments found within 2 miles.
      </div>
    )
  }

  const sorted = [...permits].sort((a, b) => {
    const order = { red: 0, yellow: 1, green: 2 }
    return order[a.severity] - order[b.severity]
  })

  return (
    <>
      <ul className="space-y-3">
        {sorted.map((permit) => {
          const config = SEVERITY_CONFIG[permit.severity]
          const Icon = config.icon
          return (
            <li 
              key={permit.id} 
              className={`rounded-xl p-3 border ${config.border} ${config.bg} cursor-pointer hover:shadow-md transition-all active:scale-[0.98] group`}
              onClick={() => setSelectedPermit(permit)}
            >
              <div className="flex items-start gap-2">
                <Icon size={16} className={`${config.color} mt-0.5 shrink-0`} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate group-hover:text-black transition-colors">{permit.address}</p>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-tight mt-0.5">{permit.permit_type}</p>
                  {permit.work_description && (
                    <p className="text-xs text-gray-600 mt-1.5 line-clamp-2 leading-relaxed">{permit.work_description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {permit.reported_cost > 0 && (
                      <span className="text-[11px] font-bold text-gray-700 bg-white/50 px-1.5 py-0.5 rounded border border-gray-100">
                        ${(permit.reported_cost / 1e6).toFixed(1)}M
                      </span>
                    )}
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>{config.label}</span>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {selectedPermit && (
        <PermitDetailModal 
          permit={selectedPermit} 
          onClose={() => setSelectedPermit(null)} 
        />
      )}
    </>
  )
}

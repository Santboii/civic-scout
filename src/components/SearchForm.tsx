'use client'

import { useState, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'

interface Suggestion {
  address: string
  lat: number
  lon: number
}

interface SearchFormProps {
  onSearch: (suggestion: Suggestion) => void
  isLoading?: boolean
}

export default function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (query.length < 4) {
      setSuggestions([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setSuggestions(data.results ?? [])
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      }
    }, 300)
  }, [query])

  function handleSelect(s: Suggestion) {
    setQuery(s.address)
    setShowSuggestions(false)
    onSearch(s)
  }

  return (
    <div className="relative w-full max-w-xl mx-auto">
      <div className="flex items-center gap-2 bg-white rounded-2xl shadow-lg px-4 py-3 border border-gray-200">
        <Search size={18} className="text-gray-400 shrink-0" />
        <input
          type="text"
          className="flex-1 outline-none text-sm text-gray-800 placeholder:text-gray-400"
          placeholder="Search a Chicago address…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          autoComplete="off"
        />
        {isLoading && (
          <span className="text-xs text-gray-400 animate-pulse">Loading…</span>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden text-sm">
          {suggestions.map((s, i) => (
            <li
              key={i}
              className="px-4 py-3 cursor-pointer hover:bg-blue-50 border-b last:border-b-0 border-gray-100 text-gray-700"
              onMouseDown={() => handleSelect(s)}
            >
              {s.address}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

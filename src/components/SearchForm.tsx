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
  const [isFocused, setIsFocused] = useState(false)
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
    <div className="relative w-full max-w-xl mx-auto px-4 sm:px-0">
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all"
        style={{
          backgroundColor: 'var(--background-card)',
          border: isFocused
            ? '1px solid var(--accent-primary)'
            : '1px solid var(--border-strong)',
          boxShadow: isFocused ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
        }}
      >
        <Search
          size={18}
          style={{ color: isFocused ? 'var(--accent-primary)' : 'var(--text-muted)' }}
          className="shrink-0 transition-colors"
        />
        <input
          type="text"
          className="flex-1 outline-none text-sm font-medium bg-transparent placeholder:text-[var(--text-muted)]"
          placeholder="Search any US address…"
          style={{
            color: 'var(--text-primary)',
          }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setIsFocused(true)
            if (suggestions.length > 0) setShowSuggestions(true)
          }}
          onBlur={() => setIsFocused(false)}
          autoComplete="off"
        />
        {isLoading && (
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            />
            <span
              className="text-[10px] font-semibold uppercase tracking-wider animate-pulse"
              style={{ color: 'var(--accent-primary)' }}
            >
              Searching…
            </span>
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ul
          className="absolute z-50 w-[calc(100%-2rem)] sm:w-full left-4 sm:left-0 mt-2 rounded-xl overflow-hidden text-sm"
          style={{
            backgroundColor: 'var(--background-card)',
            border: '1px solid var(--border-strong)',
            boxShadow: 'var(--shadow-glass)',
          }}
        >
          {suggestions.map((s, i) => (
            <li
              key={i}
              className="px-4 py-3 cursor-pointer transition-colors border-b last:border-b-0 font-medium"
              style={{
                color: 'var(--text-primary)',
                borderBottomColor: 'var(--border-glass)',
              }}
              onMouseDown={() => handleSelect(s)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-glow)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {s.address}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

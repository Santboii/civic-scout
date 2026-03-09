'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { Search } from 'lucide-react'

interface Suggestion {
  address: string
  lat: number
  lon: number
}

interface SearchFormProps {
  onSearch: (suggestion: Suggestion) => void
  isLoading?: boolean
  initialValue?: string
}

export default function SearchForm({ onSearch, isLoading, initialValue }: SearchFormProps) {
  const [query, setQuery] = useState(initialValue ?? '')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  // NOTE(Agent): Tracks the index of the highlighted suggestion for keyboard nav.
  // -1 means nothing is highlighted (input has focus).
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // NOTE(Agent): Only fetch autocomplete suggestions when the user is actively
  // typing. This prevents fetches on mount (from initialValue) and after
  // selecting a suggestion (which also sets query programmatically).
  const isUserTypingRef = useRef(false)

  // NOTE(Agent): Unique IDs for ARIA combobox pattern. useId ensures stable,
  // SSR-compatible IDs even when multiple SearchForm instances exist.
  const inputId = useId()
  const listboxId = useId()

  useEffect(() => {
    if (!isUserTypingRef.current) return
    // NOTE(Agent): Only fire autocomplete when query is long enough.
    // Short-query clearing happens in handleUserInput to avoid setState-in-effect lint violation.
    if (query.length < 4) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setSuggestions(data.results ?? [])
        setActiveIndex(-1)
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      }
    }, 300)
  }, [query])

  function handleUserInput(value: string) {
    isUserTypingRef.current = true
    setQuery(value)
    // Clear suggestions immediately when query drops below threshold
    if (value.length < 4) {
      setSuggestions([])
      setShowSuggestions(false)
    }
    setActiveIndex(-1)
  }

  function handleSelect(s: Suggestion) {
    isUserTypingRef.current = false
    setQuery(s.address)
    setSuggestions([])
    setShowSuggestions(false)
    setActiveIndex(-1)
    onSearch(s)
  }

  // NOTE(Agent): ARIA combobox keyboard navigation (WCAG 2.1.1).
  // ArrowDown/ArrowUp cycle through suggestions, Enter selects the highlighted one,
  // Escape closes the listbox and resets the highlighted index.
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault()
        handleSelect(suggestions[activeIndex])
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setActiveIndex(-1)
    }
  }

  const activeOptionId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined

  return (
    <div className="relative w-full max-w-xl mx-auto px-4 sm:px-0">
      {/* NOTE(Agent): role="combobox" + aria-expanded + aria-controls implement the
          ARIA 1.2 combobox pattern, enabling screen readers to announce the autocomplete. */}
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
          aria-hidden="true"
        />
        <label htmlFor={inputId} className="visually-hidden">
          Search any US address
        </label>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showSuggestions && suggestions.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          className="flex-1 outline-none text-sm font-medium bg-transparent placeholder:text-[var(--text-muted)]"
          placeholder="Search any US address…"
          style={{
            color: 'var(--text-primary)',
          }}
          value={query}
          onChange={(e) => handleUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true)
            if (suggestions.length > 0) setShowSuggestions(true)
          }}
          onBlur={() => {
            setIsFocused(false)
            // NOTE(Agent): Delay hiding suggestions so mousedown on a suggestion
            // fires before blur dismisses the list.
            setTimeout(() => setShowSuggestions(false), 150)
          }}
          autoComplete="off"
        />
        {isLoading && (
          <div className="flex items-center gap-2" aria-hidden="true">
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
          id={listboxId}
          role="listbox"
          aria-label="Address suggestions"
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
              id={`${listboxId}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className="px-4 py-3 cursor-pointer transition-colors border-b last:border-b-0 font-medium"
              style={{
                color: 'var(--text-primary)',
                borderBottomColor: 'var(--border-glass)',
                backgroundColor: i === activeIndex ? 'var(--accent-glow)' : 'transparent',
              }}
              onMouseDown={() => handleSelect(s)}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(-1)}
            >
              {s.address}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

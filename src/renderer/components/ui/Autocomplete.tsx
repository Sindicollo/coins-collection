import React from 'react'

interface AutocompleteProps {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  label?: string
  error?: string
  autoFocus?: boolean
}

export function Autocomplete({
  value,
  onChange,
  suggestions,
  placeholder,
  label,
  error,
  autoFocus
}: AutocompleteProps): React.ReactElement {
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  const filtered = React.useMemo(() => {
    if (!value.trim()) return []
    const lower = value.toLowerCase()
    return suggestions.filter((s) => s.toLowerCase().startsWith(lower) && s.toLowerCase() !== lower)
  }, [value, suggestions])

  // Close suggestions on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (suggestion: string): void => {
    onChange(suggestion)
    setShowSuggestions(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (!showSuggestions || filtered.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      handleSelect(filtered[highlightedIndex])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div className="flex flex-col gap-1 relative" ref={wrapperRef}>
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setShowSuggestions(true)
          setHighlightedIndex(-1)
        }}
        onFocus={() => {
          if (filtered.length > 0) setShowSuggestions(true)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`px-3 py-2 border rounded-md text-sm
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          ${error ? 'border-red-500' : 'border-gray-300'}`}
      />
      {showSuggestions && filtered.length > 0 && (
        <ul className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
          {filtered.map((suggestion, i) => (
            <li
              key={suggestion}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === highlightedIndex
                  ? 'bg-primary-100 text-primary-800'
                  : 'hover:bg-gray-100'
              }`}
              onMouseDown={() => handleSelect(suggestion)}
              onMouseEnter={() => setHighlightedIndex(i)}
            >
              <span className="font-medium">{suggestion.slice(0, value.length)}</span>
              {suggestion.slice(value.length)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

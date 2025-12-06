import { useState, useRef, useCallback, useEffect } from 'react'
import { useLoadScript, Autocomplete } from '@react-google-maps/api'

const libraries: ('places')[] = ['places']

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Enter address...',
  disabled = false,
  className = '',
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries,
  })

  // Sync external value changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  const onLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete
  }, [])

  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace()
      const formattedAddress = place.formatted_address || ''
      setInputValue(formattedAddress)
      onChange(formattedAddress)
    }
  }, [onChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    // Also update parent for manual edits (e.g., pasting a URL)
    onChange(newValue)
  }

  // Fallback to plain input if Google Places is not available
  if (!apiKey || loadError) {
    return (
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 bg-surface-secondary border border-border-primary rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      />
    )
  }

  // Show loading state
  if (!isLoaded) {
    return (
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder="Loading..."
        disabled
        className={`w-full px-3 py-2 bg-surface-secondary border border-border-primary rounded-md text-text-primary placeholder:text-text-muted opacity-50 cursor-not-allowed ${className}`}
      />
    )
  }

  return (
    <Autocomplete
      onLoad={onLoad}
      onPlaceChanged={onPlaceChanged}
      options={{
        types: ['address'],
        fields: ['formatted_address', 'geometry'],
      }}
    >
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 bg-surface-secondary border border-border-primary rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      />
    </Autocomplete>
  )
}
